"""Pure normalization/validation helpers for the market-price ETL pipeline.

Deliberately dependency-free (no pandas/psycopg2 imports) so these functions
are trivial to unit test in isolation — see scripts/etl/tests/test_normalize.py.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

_WHITESPACE_RE = re.compile(r"\s+")

# Known dirty duplicates observed directly in the real source data (verified
# via `awk -F',' '{print $1}' historical_mandi_prices.csv | sort -u`, not
# guessed) — both "Uttarakhand" and "Uttrakhand" appear as literal distinct
# strings for the same state. Deliberately NOT applied to Telangana district
# names: no such duplicate was observed there, and the task instructions are
# explicit that district-name variants must not be silently merged without
# evidence. Extend this map only when a specific dirty variant is actually
# observed in ingested data, with a comment citing how it was found.
KNOWN_STATE_ALIASES = {
    "uttrakhand": "Uttarakhand",
}


def normalize_text(value: Optional[str]) -> Optional[str]:
    """Trim + collapse internal whitespace. Empty/whitespace-only -> None (never an empty string sentinel)."""
    if value is None:
        return None
    collapsed = _WHITESPACE_RE.sub(" ", value.strip())
    return collapsed if collapsed else None


def normalize_state(value: Optional[str]) -> Optional[str]:
    normalized = normalize_text(value)
    if normalized is None:
        return None
    alias = KNOWN_STATE_ALIASES.get(normalized.lower())
    return alias if alias else normalized


def parse_price(value) -> Optional[Decimal]:
    """Returns None for blank/invalid/non-positive prices — never a fabricated 0."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ("nan", "none", "null"):
        return None
    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return None
    if parsed <= 0:
        return None
    return parsed


_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DMY_DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")


def parse_date(value: Optional[str]) -> Optional[date]:
    """Handles the two formats observed in real source files: ISO 'YYYY-MM-DD'
    (historical_mandi_prices.csv) and 'DD/MM/YYYY' (mandi_prices.csv, an
    AGMARKNET-style export). Anything else is treated as unparseable rather
    than guessed at.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if _ISO_DATE_RE.match(text):
            return datetime.strptime(text, "%Y-%m-%d").date()
        if _DMY_DATE_RE.match(text):
            return datetime.strptime(text, "%d/%m/%Y").date()
    except ValueError:
        return None
    return None


def natural_key_hash(
    market: str, commodity: str, variety: Optional[str], grade: Optional[str], observation_date: date, source: str
) -> str:
    """Deterministic hash of the row's natural key — matches the ON CONFLICT
    target in market_prices' unique index (market_id, commodity_id,
    COALESCE(variety, ''), COALESCE(grade, ''), observation_date, source).
    Stored for auditability/debugging; the actual idempotency guarantee comes
    from the database unique index, not from this hash alone.
    """
    parts = [
        market.strip().lower(),
        commodity.strip().lower(),
        (variety or "").strip().lower(),
        (grade or "").strip().lower(),
        observation_date.isoformat(),
        source.strip().lower(),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class NormalizedRow:
    state: str
    district: str
    market: str
    commodity: str
    variety: Optional[str]
    grade: Optional[str]
    observation_date: date
    min_price: Optional[Decimal]
    max_price: Optional[Decimal]
    modal_price: Decimal
    source: str
    source_record_hash: str


class RowValidationError(Exception):
    """Raised for a row that cannot be safely ingested. `reason` is a short, stable category label used for the ingestion summary's error breakdown."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def normalize_row(raw: dict, source: str) -> NormalizedRow:
    """Raises RowValidationError for any row that fails validation — callers
    are expected to catch this per-row and continue, tallying reasons for
    the ingestion summary rather than aborting the whole run.
    """
    state = normalize_state(raw.get("State") or raw.get("state"))
    district = normalize_text(raw.get("District") or raw.get("district"))
    market = normalize_text(raw.get("Market") or raw.get("market"))
    commodity = normalize_text(raw.get("Commodity") or raw.get("commodity"))
    variety = normalize_text(raw.get("Variety") or raw.get("variety"))
    grade = normalize_text(raw.get("Grade") or raw.get("grade"))
    raw_date = raw.get("Arrival_Date") or raw.get("date")
    modal_price = parse_price(raw.get("Modal_Price") if raw.get("Modal_Price") is not None else raw.get("modal_price"))
    min_price = parse_price(raw.get("Min_Price") if raw.get("Min_Price") is not None else raw.get("min_price"))
    max_price = parse_price(raw.get("Max_Price") if raw.get("Max_Price") is not None else raw.get("max_price"))

    if not state:
        raise RowValidationError("missing_state")
    if not district:
        raise RowValidationError("missing_district")
    if not market:
        raise RowValidationError("missing_market")
    if not commodity:
        raise RowValidationError("missing_commodity")

    observation_date = parse_date(raw_date)
    if observation_date is None:
        raise RowValidationError("unparseable_date")

    if modal_price is None:
        raise RowValidationError("invalid_modal_price")

    row_hash = natural_key_hash(market, commodity, variety, grade, observation_date, source)

    return NormalizedRow(
        state=state,
        district=district,
        market=market,
        commodity=commodity,
        variety=variety,
        grade=grade,
        observation_date=observation_date,
        min_price=min_price,
        max_price=max_price,
        modal_price=modal_price,
        source=source,
        source_record_hash=row_hash,
    )
