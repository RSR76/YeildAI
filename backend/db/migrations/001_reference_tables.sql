-- 001_reference_tables.sql
--
-- Location and commodity reference (dimension) tables. Small, low-write,
-- high-read tables — plain B-tree-indexed heap tables, no partitioning
-- needed. Every fact table (market_prices, price_forecasts) references
-- these via small integer surrogate keys instead of repeating text state/
-- district/market/commodity strings on every one of the millions of price
-- rows, which keeps the partitioned fact tables compact and their indexes
-- fast.
--
-- Telangana is not hardcoded as a special-cased table: it is simply a row
-- in `states` with is_supported = true. Any other state can be added later
-- as an unsupported (or supported) row without a schema change — this is
-- the mechanism behind "Telangana-first, multi-state-ready".

CREATE TABLE IF NOT EXISTS states (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  code          TEXT UNIQUE,
  is_supported  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE states IS 'States present in ingested source data. is_supported marks states YieldAI actively serves forecasts for (Telangana = true today).';

CREATE TABLE IF NOT EXISTS districts (
  id          SERIAL PRIMARY KEY,
  state_id    INTEGER NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  -- District-level centroid, if obtained from an authoritative source.
  -- Nullable on purpose: a NULL here must never be treated as "0,0" by
  -- callers — it means "we do not have this coordinate", full stop.
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state_id, name)
);

CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state_id);

CREATE TABLE IF NOT EXISTS markets (
  id           SERIAL PRIMARY KEY,
  district_id  INTEGER NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  -- Market/APMC-level coordinates, if geocoded from an authoritative source
  -- (e.g. AGMARKNET market master, data.gov.in). Nullable — see districts.latitude.
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, name)
);

CREATE INDEX IF NOT EXISTS idx_markets_district ON markets(district_id);

CREATE TABLE IF NOT EXISTS commodities (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
