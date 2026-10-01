-- 002_market_prices.sql
--
-- Historical mandi/market price observations, range-partitioned by year on
-- observation_date. This is the "genuine multi-year historical dataset"
-- table the product now requires: every row is one (market, commodity,
-- variety, grade, date) price observation from an ingested source, never a
-- derived/generated value.
--
-- Why RANGE partitioning by year (not month, not state/district):
--   - The dominant product query shape is "give me N years of history for
--     one commodity at one market/district" and "compare year X vs year Y"
--     — both slice cleanly along the date axis, so year partitions let
--     Postgres prune all partitions outside the requested year range
--     before scanning a single row.
--   - Ingestion is naturally year-batched (one government data pull covers
--     one calendar year at a time), so year partitions also align with how
--     data arrives and how old years could later be detached/archived.
--   - State/district partitioning was considered and rejected: Telangana
--     alone will hold the vast majority of rows for the foreseeable
--     product phase, so partitioning by location would produce one huge
--     "Telangana" partition and many near-empty others — no pruning
--     benefit today. Location instead gets a plain B-tree index (below),
--     which is the right tool for "filter within a still-large partition".
--   - Monthly partitions were considered and rejected as premature: at
--     current/projected ingestion volume (low millions of rows/year for
--     one state), yearly partitions stay well within Postgres's
--     comfortable partition-count and per-partition-size ranges. Move to
--     monthly only if a single year's partition becomes unwieldy.
--
-- The partition key (observation_date) must be part of every unique
-- constraint/PK on a partitioned table in Postgres — see the composite PK
-- and unique index below.

CREATE TABLE IF NOT EXISTS market_prices (
  id                  BIGSERIAL,
  market_id           INTEGER NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
  commodity_id        INTEGER NOT NULL REFERENCES commodities(id) ON DELETE RESTRICT,
  variety             TEXT,
  grade               TEXT,
  observation_date    DATE NOT NULL,
  min_price           NUMERIC(10,2),
  max_price           NUMERIC(10,2),
  modal_price         NUMERIC(10,2) NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'Rs per Quintal',
  -- Provenance: which ingestion source produced this row (e.g.
  -- 'agmarknet-data-gov-in', 'telangana-open-data'), required so we can
  -- always answer "where did this number come from".
  source              TEXT NOT NULL,
  -- Deterministic hash of the natural key (market_id, commodity_id,
  -- variety, grade, observation_date, source), computed by the ETL loader.
  -- This is what makes re-running an ingestion idempotent: ON CONFLICT on
  -- the unique index below turns a duplicate source row into a no-op/
  -- update instead of a duplicate row.
  source_record_hash  TEXT NOT NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, observation_date)
) PARTITION BY RANGE (observation_date);

COMMENT ON TABLE market_prices IS 'Historical mandi price observations, RANGE partitioned by year on observation_date. Ingested from government market-price sources; never written by the model.';

-- Idempotent-ingestion guard: one row per (market, commodity, variety,
-- grade, date, source). COALESCE handles NULL variety/grade, since two
-- NULLs are never equal in a plain UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_prices_natural_key
  ON market_prices (market_id, commodity_id, COALESCE(variety, ''), COALESCE(grade, ''), observation_date, source);

-- Primary product access pattern: history of one commodity at one market,
-- most recent first.
CREATE INDEX IF NOT EXISTS idx_market_prices_commodity_market_date
  ON market_prices (commodity_id, market_id, observation_date DESC);

-- Secondary pattern: all commodities at one market over time (market drill-down).
CREATE INDEX IF NOT EXISTS idx_market_prices_market_date
  ON market_prices (market_id, observation_date DESC);

-- Indexes declared on a partitioned parent automatically propagate to every
-- existing partition and to every partition created afterward — defining
-- them here once (rather than per-partition) is deliberate, not an
-- oversight.

-- ── Yearly partitions ───────────────────────────────────────────────────
-- 2022-2024 are provisioned now so the historical backfill described in
-- docs/TELANGANA_DATA_SOURCE_RESEARCH.md has somewhere to land as soon as
-- it's ingested; 2025 covers the one year of real data already available
-- (historical_mandi_prices.csv); 2026-2027 cover current/near-future
-- ingestion. A DEFAULT partition catches any row outside this range rather
-- than failing the insert outright — it is expected to stay empty and
-- should be monitored (see docs/LOCAL_DEVELOPMENT.md); a row landing there
-- means either bad source data or a missing partition that needs adding.

CREATE TABLE IF NOT EXISTS market_prices_2022 PARTITION OF market_prices
  FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');
CREATE TABLE IF NOT EXISTS market_prices_2023 PARTITION OF market_prices
  FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE IF NOT EXISTS market_prices_2024 PARTITION OF market_prices
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS market_prices_2025 PARTITION OF market_prices
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS market_prices_2026 PARTITION OF market_prices
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS market_prices_2027 PARTITION OF market_prices
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE IF NOT EXISTS market_prices_default PARTITION OF market_prices DEFAULT;
