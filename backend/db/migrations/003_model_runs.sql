-- 003_model_runs.sql
--
-- Model/version/run metadata. Not partitioned — one row per training run,
-- expected to stay in the thousands at most, so a plain heap table with a
-- B-tree index is the right tool (partitioning a table this small would add
-- planning overhead for no pruning benefit).
--
-- This is what lets the product later say "this prediction came from model
-- run X, trained using data through date Y" (see price_forecasts.model_run_id
-- in 004_price_forecasts.sql) — required provenance per the architecture
-- decisions, not a nice-to-have.

CREATE TABLE IF NOT EXISTS model_versions (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,           -- e.g. 'RandomForestClassifier'
  version_label  TEXT NOT NULL,           -- e.g. 'multi_market_multi_commodity_v4'
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version_label)
);

CREATE TABLE IF NOT EXISTS model_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id      INTEGER NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT,
  -- The latest observation_date in market_prices that this run's training
  -- data included — the literal answer to "trained using data through date Y".
  trained_through_date  DATE NOT NULL,
  started_at            TIMESTAMPTZ NOT NULL,
  completed_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  commodities_count     INTEGER,
  markets_count         INTEGER,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_runs_version ON model_runs(model_version_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_completed_at ON model_runs(completed_at DESC) WHERE status = 'completed';

COMMENT ON TABLE model_runs IS 'One row per training/inference run. price_forecasts.model_run_id ties every prediction back to the exact run (and training cutoff date) that produced it.';
