import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validate import PredictionValidationError, validate_prediction_row  # noqa: E402

VALID_ROW = {
    "commodity": "Tomato",
    "state": "Telangana",
    "district": "Warangal",
    "market": "Warangal",
    "date": "2026-08-01",
    "current_modal_price": "1200.0",
    "predicted_price_trend": "Rising",
    "confidence": "0.82",
    "confidence_band": "High",
    "price_trend_score": "0.64",
    "prob_Falling": "0.09",
    "prob_Rising": "0.82",
    "prob_Stable": "0.09",
}


def test_valid_row_passes():
    result = validate_prediction_row(VALID_ROW)
    assert result.commodity == "Tomato"
    assert result.confidence == 0.82
    assert result.predicted_price_trend == "Rising"


def test_rejects_invalid_trend_label():
    raw = {**VALID_ROW, "predicted_price_trend": "Skyrocketing"}
    try:
        validate_prediction_row(raw)
        assert False
    except PredictionValidationError as exc:
        assert exc.reason == "invalid_trend"


def test_rejects_confidence_out_of_range():
    raw = {**VALID_ROW, "confidence": "1.5"}
    try:
        validate_prediction_row(raw)
        assert False
    except PredictionValidationError as exc:
        assert exc.reason == "confidence_out_of_range"


def test_rejects_non_positive_price():
    raw = {**VALID_ROW, "current_modal_price": "0"}
    try:
        validate_prediction_row(raw)
        assert False
    except PredictionValidationError as exc:
        assert exc.reason == "non_positive_price"


def test_rejects_probabilities_that_do_not_sum_to_one():
    raw = {**VALID_ROW, "prob_Falling": "0.5", "prob_Rising": "0.5", "prob_Stable": "0.5"}
    try:
        validate_prediction_row(raw)
        assert False
    except PredictionValidationError as exc:
        assert exc.reason == "probabilities_do_not_sum_to_one"


def test_tolerates_small_floating_point_rounding_in_probability_sum():
    raw = {**VALID_ROW, "prob_Falling": "0.09", "prob_Rising": "0.82", "prob_Stable": "0.10"}  # sums to 1.01
    result = validate_prediction_row(raw)
    assert result.prob_stable == 0.10


def test_rejects_missing_commodity():
    raw = {**VALID_ROW, "commodity": ""}
    try:
        validate_prediction_row(raw)
        assert False
    except PredictionValidationError as exc:
        assert exc.reason == "missing_commodity"


def test_optional_latest_source_date_defaults_to_none():
    raw = {k: v for k, v in VALID_ROW.items()}
    result = validate_prediction_row(raw)
    assert result.latest_source_date is None
