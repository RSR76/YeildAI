"""
get_forecast_multi_commodity.py

Same as get_forecast.py, but reads the COMBINED multi-commodity lookup
table (data/forecast_lookup_all_commodities.csv) and requires a commodity
parameter, since that file now covers Tomato, Onion, Potato, etc. together.

USAGE:

    from get_forecast_multi_commodity import get_latest_forecast

    result = get_latest_forecast(
        commodity="Tomato",
        state="Uttar Pradesh",
        district="Barabanki",
        market="Barabanki"
    )
"""

import pandas as pd

LOOKUP_PATH = "data/forecast_lookup_all_commodities.csv"


def _load_lookup():
    df = pd.read_csv(LOOKUP_PATH, parse_dates=["date"])
    return df


def list_available_commodities():
    df = _load_lookup()
    return sorted(df["commodity"].unique().tolist())


def list_available_markets(commodity=None):
    """If commodity is given, only shows markets available for that
    commodity (since not every crop is tracked everywhere)."""
    df = _load_lookup()
    if commodity:
        df = df[df["commodity"].str.strip().str.lower() == commodity.strip().lower()]
    return df[["commodity", "state", "district", "market"]].drop_duplicates().reset_index(drop=True)


def get_latest_forecast(commodity, state, district, market):
    df = _load_lookup()

    match = df[
        (df["commodity"].str.strip().str.lower() == commodity.strip().lower()) &
        (df["state"].str.strip().str.lower() == state.strip().lower()) &
        (df["district"].str.strip().str.lower() == district.strip().lower()) &
        (df["market"].str.strip().str.lower() == market.strip().lower())
    ]

    if match.empty:
        print(f"No forecast found for {commodity} in {state} | {district} | {market}. "
              f"Call list_available_markets(commodity) to see valid options.")
        return None

    latest_row = match.sort_values("date").iloc[-1]

    class_probability_columns = [c for c in df.columns if c.startswith("prob_")]
    class_probabilities = {
        col.replace("prob_", ""): round(float(latest_row[col]), 2)
        for col in class_probability_columns
        if pd.notna(latest_row[col])
    }

    return {
        "commodity": latest_row["commodity"],
        "state": latest_row["state"],
        "district": latest_row["district"],
        "market": latest_row["market"],
        "prediction_window": "7_days",
        "date": str(latest_row["date"].date()),
        "current_modal_price": round(float(latest_row["current_modal_price"]), 2),
        "predicted_price_trend": latest_row["predicted_price_trend"],
        "confidence": round(float(latest_row["confidence"]), 2),
        "confidence_band": latest_row["confidence_band"],
        "class_probabilities": class_probabilities,
        "price_trend_score": round(float(latest_row["price_trend_score"]), 2),
        "model": "RandomForestClassifier",
        "model_scope": "multi_market_multi_commodity_v4",
    }


def get_all_latest_forecasts(commodity=None):
    """Returns forecasts for every market, optionally filtered to one
    commodity. Omit commodity to get everything across all crops."""
    df = _load_lookup()
    if commodity:
        df = df[df["commodity"].str.strip().str.lower() == commodity.strip().lower()]

    latest_per_market = (
        df.sort_values("date")
        .groupby(["commodity", "state", "district", "market"])
        .tail(1)
    )

    results = []
    for _, row in latest_per_market.iterrows():
        results.append(get_latest_forecast(row["commodity"], row["state"], row["district"], row["market"]))
    return results


if __name__ == "__main__":
    print("Available commodities:")
    print(list_available_commodities())

    print("\nExample forecast lookup:")
    sample = list_available_markets().iloc[0]
    result = get_latest_forecast(sample["commodity"], sample["state"], sample["district"], sample["market"])
    print(result) 