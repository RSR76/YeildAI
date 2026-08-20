import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize import (  # noqa: E402
    RowValidationError,
    natural_key_hash,
    normalize_row,
    normalize_state,
    normalize_text,
    parse_date,
    parse_price,
)


def test_normalize_text_collapses_whitespace_and_trims():
    assert normalize_text("  Ranga   Reddy \n") == "Ranga Reddy"


def test_normalize_text_blank_becomes_none():
    assert normalize_text("   ") is None
    assert normalize_text("") is None
    assert normalize_text(None) is None


def test_normalize_state_merges_known_dirty_variant():
    assert normalize_state("Uttrakhand") == "Uttarakhand"
    assert normalize_state("UTTRAKHAND") == "Uttarakhand"


def test_normalize_state_leaves_unrelated_states_untouched():
    assert normalize_state("Telangana") == "Telangana"
    assert normalize_state("  Andhra Pradesh ") == "Andhra Pradesh"


def test_parse_price_valid():
    assert parse_price("1200.50") == Decimal("1200.50")


def test_parse_price_invalid_or_blank_returns_none_not_zero():
    assert parse_price("") is None
    assert parse_price(None) is None
    assert parse_price("not-a-number") is None
    assert parse_price("0") is None  # non-positive rejected, never coerced to a fake zero price
    assert parse_price("-50") is None


def test_parse_date_iso_format():
    assert parse_date("2025-01-01") == date(2025, 1, 1)


def test_parse_date_dmy_format():
    assert parse_date("01/07/2026") == date(2026, 7, 1)


def test_parse_date_unparseable_returns_none():
    assert parse_date("not-a-date") is None
    assert parse_date("") is None
    assert parse_date(None) is None


def test_natural_key_hash_is_deterministic_and_order_sensitive():
    h1 = natural_key_hash("Warangal", "Tomato", "Local", "FAQ", date(2025, 1, 1), "agmarknet-data-gov-in")
    h2 = natural_key_hash("Warangal", "Tomato", "Local", "FAQ", date(2025, 1, 1), "agmarknet-data-gov-in")
    h3 = natural_key_hash("Warangal", "Tomato", "Local", "FAQ", date(2025, 1, 2), "agmarknet-data-gov-in")
    assert h1 == h2
    assert h1 != h3


def test_natural_key_hash_treats_none_and_empty_variety_the_same_as_the_db_coalesce_does():
    h_none = natural_key_hash("Warangal", "Tomato", None, "FAQ", date(2025, 1, 1), "src")
    h_empty = natural_key_hash("Warangal", "Tomato", "", "FAQ", date(2025, 1, 1), "src")
    assert h_none == h_empty


VALID_RAW_ROW = {
    "State": "Telangana",
    "District": "Warangal",
    "Market": "Warangal",
    "Commodity": "Tomato",
    "Variety": "Local",
    "Grade": "FAQ",
    "Arrival_Date": "2025-06-15",
    "Min_Price": "800",
    "Max_Price": "950",
    "Modal_Price": "875",
}


def test_normalize_row_valid_row():
    row = normalize_row(VALID_RAW_ROW, source="agmarknet-data-gov-in")
    assert row.state == "Telangana"
    assert row.district == "Warangal"
    assert row.modal_price == Decimal("875")
    assert row.observation_date == date(2025, 6, 15)
    assert len(row.source_record_hash) == 64  # sha256 hex digest


def test_normalize_row_missing_district_raises_with_stable_reason():
    raw = {**VALID_RAW_ROW, "District": ""}
    try:
        normalize_row(raw, source="test")
        assert False, "expected RowValidationError"
    except RowValidationError as exc:
        assert exc.reason == "missing_district"


def test_normalize_row_unparseable_date_raises():
    raw = {**VALID_RAW_ROW, "Arrival_Date": "garbage"}
    try:
        normalize_row(raw, source="test")
        assert False, "expected RowValidationError"
    except RowValidationError as exc:
        assert exc.reason == "unparseable_date"


def test_normalize_row_invalid_price_raises():
    raw = {**VALID_RAW_ROW, "Modal_Price": "not-a-price"}
    try:
        normalize_row(raw, source="test")
        assert False, "expected RowValidationError"
    except RowValidationError as exc:
        assert exc.reason == "invalid_modal_price"


def test_normalize_row_missing_min_max_price_is_still_valid_row():
    # min/max are nullable in the schema — only modal_price is required.
    raw = {**VALID_RAW_ROW, "Min_Price": "", "Max_Price": ""}
    row = normalize_row(raw, source="test")
    assert row.min_price is None
    assert row.max_price is None
    assert row.modal_price == Decimal("875")
