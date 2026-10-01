"""psycopg2 connection/transaction/upsert helpers for the ETL pipeline.

Every write in this module is parameterized (psycopg2 placeholders, never
string-formatted SQL with user-controlled values) and batched via
psycopg2.extras.execute_values for bulk inserts rather than one INSERT per
row — required for loading a 573MB / 5.8M-row source file without pinning
the ETL process for hours.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterable, Optional

import psycopg2
import psycopg2.extras


def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Export it (see backend/.env.example) before running ingest_market_prices.py "
            "without --dry-run."
        )
    return psycopg2.connect(database_url)


@contextmanager
def transaction(conn):
    """Wraps a block in BEGIN/COMMIT, rolling back on any exception."""
    try:
        yield conn.cursor()
        conn.commit()
    except Exception:
        conn.rollback()
        raise


class ReferenceCache:
    """In-process name->id cache for states/districts/markets/commodities,
    upserting on first sight within a run. Avoids a round-trip SELECT for
    every one of millions of price rows referencing the same handful of
    markets/commodities.
    """

    def __init__(self, cursor):
        self._cursor = cursor
        self._state_ids: dict[str, int] = {}
        self._district_ids: dict[tuple[int, str], int] = {}
        self._market_ids: dict[tuple[int, str], int] = {}
        self._commodity_ids: dict[str, int] = {}

    def state_id(self, name: str) -> int:
        key = name.lower()
        if key in self._state_ids:
            return self._state_ids[key]
        self._cursor.execute(
            """
            INSERT INTO states (name, is_supported) VALUES (%s, FALSE)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (name,),
        )
        state_id = self._cursor.fetchone()[0]
        self._state_ids[key] = state_id
        return state_id

    def district_id(self, state_id: int, name: str) -> int:
        key = (state_id, name.lower())
        if key in self._district_ids:
            return self._district_ids[key]
        self._cursor.execute(
            """
            INSERT INTO districts (state_id, name) VALUES (%s, %s)
            ON CONFLICT (state_id, name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (state_id, name),
        )
        district_id = self._cursor.fetchone()[0]
        self._district_ids[key] = district_id
        return district_id

    def market_id(self, district_id: int, name: str) -> int:
        key = (district_id, name.lower())
        if key in self._market_ids:
            return self._market_ids[key]
        self._cursor.execute(
            """
            INSERT INTO markets (district_id, name) VALUES (%s, %s)
            ON CONFLICT (district_id, name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (district_id, name),
        )
        market_id = self._cursor.fetchone()[0]
        self._market_ids[key] = market_id
        return market_id

    def commodity_id(self, name: str) -> int:
        key = name.lower()
        if key in self._commodity_ids:
            return self._commodity_ids[key]
        self._cursor.execute(
            """
            INSERT INTO commodities (name) VALUES (%s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (name,),
        )
        commodity_id = self._cursor.fetchone()[0]
        self._commodity_ids[key] = commodity_id
        return commodity_id


def bulk_upsert_market_prices(cursor, rows: Iterable[tuple]) -> int:
    """Batched upsert into market_prices via execute_values, keyed on the
    same natural key as the DB's unique index (market_id, commodity_id,
    variety, grade, observation_date, source). Each `row` tuple must be:
    (market_id, commodity_id, variety, grade, observation_date, min_price,
    max_price, modal_price, source, source_record_hash).
    Returns the number of rows affected (inserted or updated).
    """
    rows = list(rows)
    if not rows:
        return 0

    # Real AGMARKNET-style source data legitimately contains more than one
    # row for the same (market, commodity, variety, grade, date, source)
    # natural key within a single batch (e.g. duplicate lot reports) — a
    # real occurrence hit while ingesting the actual Telangana dataset
    # against the dev database (85,025-row integration run), not a
    # hypothetical. Postgres's ON CONFLICT DO UPDATE cannot update the same
    # target row twice within one statement (CardinalityViolation), so the
    # batch is deduplicated by natural key here — matching the same
    # COALESCE(variety, '')/COALESCE(grade, '') null-handling as the DB's
    # own unique index — keeping the LAST occurrence in file order, which is
    # the same "last one wins" semantics already used for the CSV-derived
    # forecast index elsewhere in this codebase.
    deduped: dict[tuple, tuple] = {}
    for row in rows:
        market_id, commodity_id, variety, grade, observation_date = row[0], row[1], row[2], row[3], row[4]
        source = row[8]
        key = (market_id, commodity_id, variety or "", grade or "", observation_date, source)
        deduped[key] = row
    rows = list(deduped.values())

    template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
    sql = """
        INSERT INTO market_prices
            (market_id, commodity_id, variety, grade, observation_date,
             min_price, max_price, modal_price, source, source_record_hash)
        VALUES %s
        ON CONFLICT (market_id, commodity_id, COALESCE(variety, ''), COALESCE(grade, ''), observation_date, source)
        DO UPDATE SET
            min_price = EXCLUDED.min_price,
            max_price = EXCLUDED.max_price,
            modal_price = EXCLUDED.modal_price,
            source_record_hash = EXCLUDED.source_record_hash,
            ingested_at = now()
    """
    psycopg2.extras.execute_values(cursor, sql, rows, template=template, page_size=1000)
    # NOT cursor.rowcount: execute_values internally splits a large `rows`
    # list into multiple actual INSERT statements (page_size=1000), and
    # psycopg2 only exposes cursor.rowcount for the LAST statement it ran —
    # so for any batch over 1000 rows, cursor.rowcount silently reports only
    # the final page instead of the true total (hit for real during the 2024
    # Telangana backfill: batches of ~5000 rows reported as low as ~1000
    # "written"). len(rows) is exact here, not an estimate: this is an
    # unconditional `DO UPDATE SET` with no WHERE clause, so Postgres always
    # affects exactly one row per VALUES row (insert or update) — the same
    # guarantee that makes the natural-key ON CONFLICT target idempotent.
    return len(rows)


def latest_observation_date(cursor, state_name: Optional[str] = None):
    """Used by scripts/ml/persist_predictions.py to record model_runs.trained_through_date."""
    if state_name:
        cursor.execute(
            """
            SELECT MAX(mp.observation_date) FROM market_prices mp
            JOIN markets m ON m.id = mp.market_id
            JOIN districts d ON d.id = m.district_id
            JOIN states s ON s.id = d.state_id
            WHERE lower(s.name) = lower(%s)
            """,
            (state_name,),
        )
    else:
        cursor.execute("SELECT MAX(observation_date) FROM market_prices")
    return cursor.fetchone()[0]
