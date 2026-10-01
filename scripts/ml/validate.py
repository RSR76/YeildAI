"""Pure validation for model prediction rows before they're persisted to
price_forecasts. Dependency-free (no pandas/psycopg2) so it's trivial to
unit test — see scripts/ml/tests/test_validate.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

VALID_TRENDS = {"Rising", "Stable", "Falling"}
VALID_CONFIDENCE_BANDS = {"High", "Medium", "Low"}

# How far prob_Falling + prob_Rising + prob_Stable may drift from 1.0 before
# a row is rejected — small floating-point rounding in the source model
# output is expected; anything larger signals a genuinely malformed row.
PROBABILITY_SUM_TOLERANCE = 0.02


class PredictionValidationError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class ValidatedPrediction:
    commodity: str
    state: str
    district: str
    market: str
    reference_date: str  # ISO 'YYYY-MM-DD'
    current_modal_price: float
    predicted_price_trend: str
    confidence: float
    confidence_band: str
    price_trend_score: float
    prob_falling: float
    prob_rising: float
    prob_stable: float
    latest_source_date: Optional[str]


def _to_float(value, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise PredictionValidationError(f"invalid_{field}")


def validate_prediction_row(raw: dict) -> ValidatedPrediction:
    """Raises PredictionValidationError with a stable `.reason` for any row
    that fails validation. Callers are expected to catch per-row and
    continue, tallying reasons — one bad row must not abort a whole run.
    """
    commodity = str(raw.get("commodity", "")).strip()
    state = str(raw.get("state", "")).strip()
    district = str(raw.get("district", "")).strip()
    market = str(raw.get("market", "")).strip()
    reference_date = str(raw.get("date", "")).strip()

    if not commodity:
        raise PredictionValidationError("missing_commodity")
    if not state:
        raise PredictionValidationError("missing_state")
    if not district:
        raise PredictionValidationError("missing_district")
    if not market:
        raise PredictionValidationError("missing_market")
    if not reference_date:
        raise PredictionValidationError("missing_date")

    current_modal_price = _to_float(raw.get("current_modal_price"), "current_modal_price")
    if current_modal_price <= 0:
        raise PredictionValidationError("non_positive_price")

    trend = str(raw.get("predicted_price_trend", "")).strip()
    if trend not in VALID_TRENDS:
        raise PredictionValidationError("invalid_trend")

    confidence = _to_float(raw.get("confidence"), "confidence")
    if not (0.0 <= confidence <= 1.0):
        raise PredictionValidationError("confidence_out_of_range")

    confidence_band = str(raw.get("confidence_band", "")).strip()
    if confidence_band not in VALID_CONFIDENCE_BANDS:
        raise PredictionValidationError("invalid_confidence_band")

    price_trend_score = _to_float(raw.get("price_trend_score"), "price_trend_score")
    if not (-1.0 <= price_trend_score <= 1.0):
        raise PredictionValidationError("price_trend_score_out_of_range")

    prob_falling = _to_float(raw.get("prob_Falling", raw.get("prob_falling")), "prob_falling")
    prob_rising = _to_float(raw.get("prob_Rising", raw.get("prob_rising")), "prob_rising")
    prob_stable = _to_float(raw.get("prob_Stable", raw.get("prob_stable")), "prob_stable")

    for label, value in (("prob_falling", prob_falling), ("prob_rising", prob_rising), ("prob_stable", prob_stable)):
        if not (0.0 <= value <= 1.0):
            raise PredictionValidationError(f"{label}_out_of_range")

    prob_sum = prob_falling + prob_rising + prob_stable
    if abs(prob_sum - 1.0) > PROBABILITY_SUM_TOLERANCE:
        raise PredictionValidationError("probabilities_do_not_sum_to_one")

    latest_source_date = raw.get("latest_source_date")
    latest_source_date = str(latest_source_date).strip() if latest_source_date else None

    return ValidatedPrediction(
        commodity=commodity,
        state=state,
        district=district,
        market=market,
        reference_date=reference_date,
        current_modal_price=current_modal_price,
        predicted_price_trend=trend,
        confidence=confidence,
        confidence_band=confidence_band,
        price_trend_score=price_trend_score,
        prob_falling=prob_falling,
        prob_rising=prob_rising,
        prob_stable=prob_stable,
        latest_source_date=latest_source_date,
    )
