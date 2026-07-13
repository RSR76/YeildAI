# ForecastingService Integration Guide (for AI-assisted backend integration)

> **Note to any AI assistant reading this:** this document describes a completed, working component (`get_forecast_multi_commodity.py`) that needs to be wired into a Python backend (Flask/FastAPI/Django). Everything below is factual and exact — function signatures, return types, and example outputs are all real, not illustrative placeholders. Use this to generate integration code (route handlers, service classes, etc.) directly.

---

## 1. System context (why this component exists)

This is part of a larger agriculture decision-support platform called YieldAI. The overall recommendation flow is:

```
Farmer selects location
    -> RecommendationService (orchestrator)
    -> ForecastingService (THIS COMPONENT — produces price trend signals)
    -> RulesEngineService (scores crop suitability using forecast signals
       + soil/season suitability data)
    -> RecommendationService returns ranked crop recommendations

```

`get_forecast_multi_commodity.py` **is the ForecastingService implementation** for the MVP. It does not call a live ML model per request — it reads from a precomputed lookup table (explained in section 3). Any backend route that needs a price trend forecast should call the functions in this file, not reimplement forecasting logic elsewhere.

---

## 2. Files required and their exact locations


| File                                       | Required at                                                                                      | Purpose                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| `get_forecast_multi_commodity.py`          | Same directory as your Flask/FastAPI app, or importable via your project's Python path           | Contains all functions to call |
| `data/forecast_lookup_all_commodities.csv` | Relative path `data/forecast_lookup_all_commodities.csv` from wherever the Python process is run | The forecast data itself       |


**Important:** `get_forecast_multi_commodity.py` hardcodes the CSV path as:

```python
LOOKUP_PATH = "data/forecast_lookup_all_commodities.csv"

```

If your Flask/FastAPI app runs from a different working directory, either: (a) place the `data/` folder relative to wherever the app is launched from, or (b) edit `LOOKUP_PATH` in the file to an absolute path or one derived from`os.path.dirname(__file__)`.

**Dependencies:** only `pandas` is required. No scikit-learn, no joblib — this file does not load any ML model, it only reads a CSV.

---

## 3. Why this is a batch lookup, not a live model call

Some of the underlying signals (regional price momentum, market breadth — i.e. what % of markets are trending the same direction) require full-dataset context across ALL markets on a given date, not just the one market being queried. Recomputing that per HTTP request would be slow and unnecessary.

Instead: the forecast for every market/commodity/date combination is precomputed offline and stored in the CSV. The functions below just filter and look up the latest row — this is fast (pandas filter on an in-memory or lazily-loaded dataframe) and requires no ML inference at request time.

**Implication for your route design:** treat these functions as a fast, synchronous data lookup, not a slow ML inference call. No need for async job queues, background workers, or timeouts beyond normal DB-query-level expectations.

---

## 4. Exact function signatures

All four functions are importable directly:

```python
from get_forecast_multi_commodity import (
    get_latest_forecast,
    get_all_latest_forecasts,
    list_available_commodities,
    list_available_markets,
)

```

### `get_latest_forecast(commodity: str, state: str, district: str, market: str) -> dict | None`

Returns the most recent forecast for one specific market as a dict, or `None` if no match is found (prints a diagnostic message when it returns `None` — check your server logs).

**Matching is case-insensitive and whitespace-trimmed** on all four parameters (e.g. `"tomato"`, `"Tomato"`, `" Tomato "` all match the same way).

**Exact return shape (all keys always present when not None):**

```python
{
    "commodity": str,              # e.g. "Tomato"
    "state": str,                  # e.g. "Uttar Pradesh"
    "district": str,                # e.g. "Barabanki"
    "market": str,                  # e.g. "Barabanki"
    "prediction_window": str,       # always "7_days" currently
    "date": str,                    # ISO format "YYYY-MM-DD", the date this forecast is FOR
    "current_modal_price": float,   # e.g. 860.0
    "predicted_price_trend": str,   # one of: "Rising", "Stable", "Falling"
    "confidence": float,            # 0.0 to 1.0
    "confidence_band": str,         # one of: "High" (>=0.70), "Medium" (>=0.50), "Low" (<0.50)
    "class_probabilities": dict,    # e.g. {"Falling": 0.01, "Rising": 0.96, "Stable": 0.02}
    "price_trend_score": float,     # Rising_prob minus Falling_prob, range -1.0 to 1.0
    "model": str,                   # always "RandomForestClassifier" currently
    "model_scope": str,             # always "multi_market_multi_commodity_v4" currently
}

```

**Example real output** (this is an actual result from the trained model, not a hypothetical):

```json
{
  "commodity": "Tomato",
  "state": "Uttar Pradesh",
  "district": "Barabanki",
  "market": "Barabanki",
  "prediction_window": "7_days",
  "date": "2025-11-02",
  "current_modal_price": 860.0,
  "predicted_price_trend": "Rising",
  "confidence": 0.96,
  "confidence_band": "High",
  "class_probabilities": {"Falling": 0.01, "Rising": 0.96, "Stable": 0.02},
  "price_trend_score": 0.95,
  "model": "RandomForestClassifier",
  "model_scope": "multi_market_multi_commodity_v4"
}

```

### `get_all_latest_forecasts(commodity: str | None = None) -> list[dict]`

Returns a list of dicts (same shape as above), one per market. If `commodity` is omitted, returns forecasts across ALL 117 commodities and ALL markets (this will be a large list — ~thousands of entries — consider pagination if exposing this directly via an API route).

### `list_available_commodities() -> list[str]`

Returns a sorted list of all commodity names available in the lookup table (117 total). Use this to validate a `commodity`parameter before calling `get_latest_forecast`, or to populate a dropdown/autocomplete in the frontend if needed.

### `list_available_markets(commodity: str | None = None) -> pandas.DataFrame`

Returns a DataFrame with columns `["commodity", "state", "district", "market"]`. If `commodity` is passed, filters to only markets that have data for that commodity (not every commodity is tracked in every market).

**Note:** this returns a `pandas.DataFrame`, not a list of dicts. Convert with `.to_dict(orient="records")` if you need JSON-serializable output for an API response.

---

## 5. Example Flask integration (ready to adapt)

```python
from flask import Flask, jsonify, request
from get_forecast_multi_commodity import get_latest_forecast, list_available_commodities

app = Flask(__name__)

@app.route("/forecast", methods=["GET"])
def forecast():
    commodity = request.args.get("commodity")
    state = request.args.get("state")
    district = request.args.get("district")
    market = request.args.get("market")

    if not all([commodity, state, district, market]):
        return jsonify({"error": "commodity, state, district, and market are all required"}), 400

    result = get_latest_forecast(commodity, state, district, market)

    if result is None:
        return jsonify({"error": f"No forecast found for {commodity} in {state}/{district}/{market}"}), 404

    return jsonify(result), 200


@app.route("/forecast/commodities", methods=["GET"])
def commodities():
    return jsonify(list_available_commodities()), 200

```

## 5b. Example FastAPI integration (ready to adapt)

```python
from fastapi import FastAPI, HTTPException
from get_forecast_multi_commodity import get_latest_forecast, list_available_commodities

app = FastAPI()

@app.get("/forecast")
def forecast(commodity: str, state: str, district: str, market: str):
    result = get_latest_forecast(commodity, state, district, market)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No forecast found for {commodity} in {state}/{district}/{market}")
    return result


@app.get("/forecast/commodities")
def commodities():
    return list_available_commodities()

```

---

## 6. Edge cases and error handling to implement on the backend side


| Case                                 | What happens in `get_forecast_multi_commodity.py`                                                  | What your route should do                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Market/commodity combo not found     | Returns `None`, prints a message to stdout/logs                                                    | Return HTTP 404 with a clear message (see example above)                                                                            |
| Missing required parameter           | Not handled inside the function — will raise a `TypeError` if a required positional arg is missing | Validate all 4 params exist before calling; return HTTP 400 if not                                                                  |
| Lookup CSV file missing/moved        | Raises `FileNotFoundError` from pandas                                                             | Not expected in normal operation; would indicate a deployment/path issue — let it surface as a 500 error, don't silently swallow it |
| Commodity name typo (e.g. "Tomatoo") | Returns `None` same as a genuine not-found case                                                    | Same 404 handling; optionally suggest calling `list_available_commodities()` to help the caller self-correct                        |


---

## 7. Known limitations (relevant to how you present/use results)

- **117 of 118 candidate commodities trained successfully** (one, Kinnow, had insufficient historical data and was excluded).
- **Model accuracy varies significantly by commodity.** Perishable, volatile vegetables (e.g. Ashgourd, Ginger, Coconut, Yam) show the strongest improvement over baseline (~30+ percentage points). Stable staples (dals, mustard oil) show minimal improvement over baseline, since their prices barely move regardless of prediction. If the demo needs to showcase the forecasting value clearly, prefer volatile vegetable examples over stable staples.
- **"Stable" is the hardest class to predict correctly** across most commodities — expect lower precision/recall on Stable predictions specifically vs. Rising/Falling.
- **Data staleness:** forecasts are only as fresh as the last time `forecasting_model_multi_commodity.py` (the training script, not included in this handoff) was run. This CSV is a snapshot, not live-updating.

---

## 8. What NOT to build right now

Do not attempt to wire this to a live model inference endpoint, retrain on request, or add real-time recomputation for arbitrary dates — none of that is implemented, and building it would require re-architecting how cross-market features are computed. For this MVP/demo stage, the lookup table approach above is the intended and sufficient integration path.