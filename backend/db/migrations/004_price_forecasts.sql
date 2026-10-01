-- 004_price_forecasts.sql
--
-- Model predictions, persisted directly to Postgres by the model pipeline
-- (scripts/ml/persist_predictions.py) instead of a generated CSV. This is
-- the table that replaces forecast_lookup_all_commodities.csv as the
-- application's serving source.
--
-- RANGE partitioned by year on reference_date for the same pruning reasons
-- as market_prices (002_market_prices.sql): "latest forecast" and
-- "forecast history" queries both filter on reference_date, and yearly
-- partitions keep that filter cheap as forecast history accumulates across
-- multiple model runs over time. At today's single-state, weekly-refresh
-- scale a forecasts table would still be small enough to leave
-- unpartitioned, but partitioning it the same way as market_prices keeps
-- the two fact tables' maintenance (yearly partition provisioning,
-- eventual archival) identical rather than two different schemes to reason
-- about.
--
-- Deliberately NOT constrained to one row per (market, commodity,
-- reference_date): every model run's predictions are kept (see the unique
-- index below, which includes model_run_id), so re-running the model does
-- not overwrite prior predictions — provenance and auditability over
-- storage minimalism. "Latest" is a query concern (ORDER BY reference_date
-- DESC, created_at DESC LIMIT 1), not a schema constraint.

CREATE TABLE IF NOT EXISTS price_forecasts (
  id                     BIGSERIAL,
  model_run_id           UUID NOT NULL REFERENCES model_runs(id) ON DELETE RESTRICT,
  market_id              INTEGER NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
  commodity_id           INTEGER NOT NULL REFERENCES commodities(id) ON DELETE RESTRICT,
  -- The date this forecast is FOR (not the date it was computed on).
  reference_date         DATE NOT NULL,
  prediction_window      TEXT NOT NULL DEFAULT '7_days',
  current_modal_price    NUMERIC(10,2) NOT NULL,
  predicted_price_trend  TEXT NOT NULL CHECK (predicted_price_trend IN ('Rising', 'Stable', 'Falling')),
  confidence             NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  confidence_band        TEXT NOT NULL CHECK (confidence_band IN ('High', 'Medium', 'Low')),
  price_trend_score      NUMERIC(6,4) NOT NULL CHECK (price_trend_score >= -1 AND price_trend_score <= 1),
  prob_falling           NUMERIC(5,4) NOT NULL CHECK (prob_falling >= 0 AND prob_falling <= 1),
  prob_rising            NUMERIC(5,4) NOT NULL CHECK (prob_rising >= 0 AND prob_rising <= 1),
  prob_stable            NUMERIC(5,4) NOT NULL CHECK (prob_stable >= 0 AND prob_stable <= 1),
  -- Freshness signal: the most recent market_prices.observation_date this
  -- specific prediction's features were computed from. Lets the API/UI
  -- honestly say "based on data through <date>" instead of implying the
  -- forecast is always as fresh as "now".
  latest_source_date     DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, reference_date)
) PARTITION BY RANGE (reference_date);

COMMENT ON TABLE price_forecasts IS 'Model predictions written by scripts/ml/persist_predictions.py. Replaces forecast_lookup_all_commodities.csv as the serving source. One row per (model_run, market, commodity, reference_date) — never overwritten across runs.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_forecasts_run_key
  ON price_forecasts (model_run_id, market_id, commodity_id, reference_date);

-- "Latest forecast for commodity X at market Y" — the single most common
-- read in the product (Mandi Prices row, Recommendations scoring input).
CREATE INDEX IF NOT EXISTS idx_price_forecasts_commodity_market_date
  ON price_forecasts (commodity_id, market_id, reference_date DESC);

-- "All latest forecasts in a district/state" (Mandi Prices table, Recommendations).
CREATE INDEX IF NOT EXISTS idx_price_forecasts_market_date
  ON price_forecasts (market_id, reference_date DESC);

CREATE TABLE IF NOT EXISTS price_forecasts_2025 PARTITION OF price_forecasts
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS price_forecasts_2026 PARTITION OF price_forecasts
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS price_forecasts_2027 PARTITION OF price_forecasts
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS price_forecasts_default PARTITION OF price_forecasts DEFAULT;
