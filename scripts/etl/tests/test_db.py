"""Unit tests for scripts/etl/db.py using a fake cursor — no live Postgres.
Verifies caching behavior (one upsert query per distinct name, not one per
row) and that bulk_upsert_market_prices delegates to execute_values with a
correctly-shaped ON CONFLICT upsert, without ever needing a real connection.
"""
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import ReferenceCache, bulk_upsert_market_prices  # noqa: E402


class FakeCursor:
    """Simulates `INSERT ... RETURNING id` by handing out incrementing ids,
    recording every executed statement for assertions.
    """

    def __init__(self):
        self.executed = []
        self._next_id = 1
        self.rowcount = 0

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        self._last_id = self._next_id
        self._next_id += 1

    def fetchone(self):
        return (self._last_id,)


def test_reference_cache_only_queries_once_per_distinct_state():
    # ReferenceCache expects already-whitespace-normalized names (that's
    # normalize.py's job, upstream) and only case-folds for the cache key —
    # so this exercises case-insensitivity, not whitespace normalization.
    cursor = FakeCursor()
    cache = ReferenceCache(cursor)

    id1 = cache.state_id("Telangana")
    id2 = cache.state_id("telangana")
    id3 = cache.state_id("TELANGANA")

    assert id1 == id2 == id3
    # Only the first call issues a DB round-trip; the other two are cache hits.
    assert len(cursor.executed) == 1


def test_reference_cache_district_scoped_by_state_id():
    cursor = FakeCursor()
    cache = ReferenceCache(cursor)

    state_a = cache.state_id("Telangana")
    state_b = cache.state_id("Andhra Pradesh")

    d1 = cache.district_id(state_a, "Warangal")
    d2 = cache.district_id(state_b, "Warangal")  # same district name, different state — must NOT collide

    assert d1 != d2


def test_bulk_upsert_market_prices_delegates_to_execute_values_with_upsert_sql():
    cursor = MagicMock()
    # Deliberately set to something that does NOT match the real answer (2):
    # proves the returned count no longer comes from cursor.rowcount at all
    # (see test_bulk_upsert_market_prices_returns_full_batch_count... below
    # for the full regression story on why cursor.rowcount is untrustworthy).
    cursor.rowcount = 999
    rows = [
        (1, 1, "Local", "FAQ", date(2025, 1, 1), Decimal("800"), Decimal("950"), Decimal("875"), "test-source", "hash1"),
        (1, 1, "Local", "FAQ", date(2025, 1, 2), Decimal("810"), Decimal("960"), Decimal("880"), "test-source", "hash2"),
    ]

    with patch("db.psycopg2.extras.execute_values") as mock_execute_values:
        affected = bulk_upsert_market_prices(cursor, rows)

    assert mock_execute_values.called
    call_args = mock_execute_values.call_args
    sql_arg = call_args[0][1]
    assert "ON CONFLICT" in sql_arg
    assert "DO UPDATE SET" in sql_arg
    assert affected == 2


def test_bulk_upsert_market_prices_returns_full_batch_count_not_misleading_last_page_rowcount():
    # Regression test for a real bug hit during the 2024 Telangana backfill:
    # execute_values splits any batch over page_size=1000 into multiple actual
    # INSERT statements, and psycopg2's cursor.rowcount after execute_values()
    # only reflects the LAST statement it ran — so a 2500-row batch was
    # observed reporting as few as ~500 "rows written" instead of 2500. Fixed
    # by returning len(rows) directly: an unconditional `DO UPDATE SET` (no
    # WHERE clause) always affects exactly one row per VALUES row, so this is
    # exact, not an estimate, and needs no dependency on psycopg2 internals.
    cursor = MagicMock()
    cursor.rowcount = 37  # a deliberately wrong/misleading "last page only" value
    rows = [
        (i, 1, "Local", "FAQ", date(2025, 1, (i % 28) + 1), Decimal("800"), Decimal("950"), Decimal("880"), "test-source", f"hash-{i}")
        for i in range(1, 2501)
    ]  # 2500 distinct market_ids -> no natural-key collisions, nothing deduped

    with patch("db.psycopg2.extras.execute_values") as mock_execute_values:
        affected = bulk_upsert_market_prices(cursor, rows)

    assert mock_execute_values.called
    assert affected == 2500  # NOT cursor.rowcount (37)


def test_bulk_upsert_market_prices_no_op_on_empty_rows():
    cursor = MagicMock()
    with patch("db.psycopg2.extras.execute_values") as mock_execute_values:
        affected = bulk_upsert_market_prices(cursor, [])
    assert affected == 0
    mock_execute_values.assert_not_called()


def test_bulk_upsert_market_prices_dedupes_same_natural_key_within_a_batch():
    # Regression test: hit for real ingesting the actual Telangana dataset
    # against a live dev database (Postgres raised CardinalityViolation —
    # "ON CONFLICT DO UPDATE command cannot affect row a second time" — when
    # a batch contained two rows sharing the same natural key, which real
    # AGMARKNET-style source data does contain, e.g. duplicate lot reports).
    # The later row (by file order) must win, and only one row per natural
    # key must reach execute_values.
    cursor = MagicMock()
    cursor.rowcount = 1
    rows = [
        # Same (market_id, commodity_id, variety, grade, date, source) natural key twice —
        # only the modal_price differs (880 then 900), simulating two lot reports for the same day.
        (1, 1, "Local", "FAQ", date(2025, 1, 1), Decimal("800"), Decimal("950"), Decimal("880"), "test-source", "hash-a"),
        (1, 1, "Local", "FAQ", date(2025, 1, 1), Decimal("810"), Decimal("960"), Decimal("900"), "test-source", "hash-b"),
    ]

    with patch("db.psycopg2.extras.execute_values") as mock_execute_values:
        bulk_upsert_market_prices(cursor, rows)

    passed_rows = mock_execute_values.call_args[0][2]
    assert len(passed_rows) == 1
    assert passed_rows[0][7] == Decimal("900")  # the later (winning) row's modal_price
    assert passed_rows[0][9] == "hash-b"


def test_bulk_upsert_market_prices_treats_none_and_empty_variety_as_the_same_key():
    # Must mirror the DB's own COALESCE(variety, '')/COALESCE(grade, '')
    # null-handling in the unique index — a None variety and an empty-string
    # variety are the same natural key, not two different ones.
    cursor = MagicMock()
    cursor.rowcount = 1
    rows = [
        (1, 1, None, None, date(2025, 1, 1), Decimal("800"), Decimal("950"), Decimal("880"), "test-source", "hash-a"),
        (1, 1, "", "", date(2025, 1, 1), Decimal("810"), Decimal("960"), Decimal("900"), "test-source", "hash-b"),
    ]

    with patch("db.psycopg2.extras.execute_values") as mock_execute_values:
        bulk_upsert_market_prices(cursor, rows)

    passed_rows = mock_execute_values.call_args[0][2]
    assert len(passed_rows) == 1
