import pandas as pd
import pytest

import get_forecast_multi_commodity as gfmc


@pytest.fixture
def sample_lookup(tmp_path, monkeypatch):
    rows = [
        {
            "commodity": "Tomato",
            "state": "Uttar Pradesh",
            "district": "Barabanki",
            "market": "Barabanki",
            "date": "2026-07-01",
            "current_modal_price": 850.0,
            "predicted_price_trend": "Falling",
            "confidence": 0.80,
            "confidence_band": "Medium",
            "price_trend_score": -0.20,
            "prob_falling": 0.80,
            "prob_rising": 0.10,
            "prob_stable": 0.10,
        },
        {
            "commodity": "Tomato",
            "state": "Uttar Pradesh",
            "district": "Barabanki",
            "market": "Barabanki",
            "date": "2026-07-08",
            "current_modal_price": 860.0,
            "predicted_price_trend": "Rising",
            "confidence": 0.96,
            "confidence_band": "High",
            "price_trend_score": 0.90,
            "prob_falling": 0.02,
            "prob_rising": 0.96,
            "prob_stable": 0.02,
        },
        {
            "commodity": "Onion",
            "state": "Maharashtra",
            "district": "Nashik",
            "market": "Lasalgaon",
            "date": "2026-07-05",
            "current_modal_price": 1200.0,
            "predicted_price_trend": "Stable",
            "confidence": 0.55,
            "confidence_band": "Low",
            "price_trend_score": 0.05,
            "prob_falling": 0.25,
            "prob_rising": 0.20,
            "prob_stable": 0.55,
        },
        {
            "commodity": "Onion",
            "state": "Maharashtra",
            "district": "Nashik",
            "market": "Lasalgaon",
            "date": "2026-07-06",
            "current_modal_price": 1210.0,
            "predicted_price_trend": "Stable",
            "confidence": 0.60,
            "confidence_band": "Low",
            "price_trend_score": 0.03,
            "prob_falling": 0.20,
            "prob_rising": 0.20,
            "prob_stable": 0.60,
        },
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "forecast_lookup_all_commodities.csv"
    df.to_csv(csv_path, index=False)
    monkeypatch.setattr(gfmc, "LOOKUP_PATH", str(csv_path))
    return csv_path


def test_get_latest_forecast_returns_most_recent_date(sample_lookup):
    result = gfmc.get_latest_forecast(
        commodity="Tomato", state="Uttar Pradesh", district="Barabanki", market="Barabanki"
    )

    assert result is not None
    assert result["date"] == "2026-07-08"
    assert result["current_modal_price"] == 860.0
    assert result["predicted_price_trend"] == "Rising"


def test_get_latest_forecast_no_match_returns_none(sample_lookup):
    result = gfmc.get_latest_forecast(
        commodity="Wheat", state="Punjab", district="Ludhiana", market="Ludhiana"
    )

    assert result is None


def test_get_latest_forecast_is_case_and_whitespace_insensitive(sample_lookup):
    result = gfmc.get_latest_forecast(
        commodity="  tomato ", state="uttar pradesh", district="BARABANKI", market=" barabanki"
    )

    assert result is not None
    assert result["commodity"] == "Tomato"


def test_class_probabilities_built_from_prob_columns(sample_lookup):
    result = gfmc.get_latest_forecast(
        commodity="Tomato", state="Uttar Pradesh", district="Barabanki", market="Barabanki"
    )

    assert result["class_probabilities"] == {
        "falling": 0.02,
        "rising": 0.96,
        "stable": 0.02,
    }


def test_get_latest_forecast_output_shape(sample_lookup):
    result = gfmc.get_latest_forecast(
        commodity="Onion", state="Maharashtra", district="Nashik", market="Lasalgaon"
    )

    expected_keys = {
        "commodity",
        "state",
        "district",
        "market",
        "prediction_window",
        "date",
        "current_modal_price",
        "predicted_price_trend",
        "confidence",
        "confidence_band",
        "class_probabilities",
        "price_trend_score",
        "model",
        "model_scope",
    }
    assert expected_keys.issubset(result.keys())
    # These two fields are hardcoded literals today (no real model is wired
    # up yet) - asserting on them documents current behavior rather than
    # claiming they're derived from an actual trained model.
    assert result["model"] == "RandomForestClassifier"
    assert result["model_scope"] == "multi_market_multi_commodity_v4"
    assert result["prediction_window"] == "7_days"


def test_list_available_commodities(sample_lookup):
    assert gfmc.list_available_commodities() == ["Onion", "Tomato"]


def test_list_available_markets_filtered_by_commodity(sample_lookup):
    markets = gfmc.list_available_markets(commodity="Tomato")

    assert len(markets) == 1
    row = markets.iloc[0]
    assert row["commodity"] == "Tomato"
    assert row["market"] == "Barabanki"
