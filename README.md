# YeildAI

## Demo setup

```bash
git clone <repo-url>
cd YeildAI
./scripts/setup-demo-data.sh
cd backend && npm install && npm run dev
```

In another terminal:

```bash
cd frontend && npm install && npm run dev
```

Then open http://localhost:3000.

## About the forecast data

`./scripts/setup-demo-data.sh` downloads `data/forecast_lookup_all_commodities.csv`, a
precomputed lookup table of Random Forest model outputs generated offline. It is **not**
live market data — forecasts reflect the state of the model at the time the file was
generated, not current market conditions.
