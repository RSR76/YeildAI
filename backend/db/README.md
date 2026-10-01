# Analytical schema (backend/db/migrations)

Raw-SQL migrations for the partitioned analytical schema — states,
districts, markets, commodities, `market_prices` (yearly-partitioned
historical prices), `model_versions`/`model_runs`, and `price_forecasts`
(yearly-partitioned model predictions). This is deliberately **separate**
from Prisma (`backend/prisma/schema.prisma`), which still owns `User` and
`FarmProfile` (and the untouched legacy `Forecast`/`Crop`/etc. models). See
`docs/POSTGRES_FORECAST_MIGRATION_PLAN.md` for why Prisma isn't used to
manage the partitioned tables.

## Status in this environment

This schema was authored and statically reviewed here, but **not applied to
a live database** — neither `psql` nor `docker` is installed in the
environment this was built in, so `npm run db:migrate` has not actually
been run against real Postgres. Treat the migration files as
reviewed-but-unexecuted until someone runs them against a real instance and
reports back.

## Standing up a fresh local database

```bash
# 1. Start local Postgres (from the repo root)
docker compose up -d postgres

# 2. Point backend/.env at it (see backend/.env.example)
cp backend/.env.example backend/.env
# DATABASE_URL="postgresql://yieldai:yieldai_dev_only@localhost:5432/yieldai_dev"

# 3. Apply migrations
cd backend
npm run db:migrate
```

`npm run db:migrate` applies every `backend/db/migrations/*.sql` file not
yet recorded in the `schema_migrations` tracking table, in filename order,
each inside its own transaction. Re-running it is safe — already-applied
files are skipped.

To see what *would* run without touching a database (useful with no
Postgres available, e.g. in CI or this environment):

```bash
npm run db:migrate:dry-run
```

## Migration files

| File | Creates |
|---|---|
| `001_reference_tables.sql` | `states`, `districts`, `markets`, `commodities` |
| `002_market_prices.sql` | `market_prices` (RANGE-partitioned by year on `observation_date`, 2022-2027 + default), natural-key unique index, commodity/market+date indexes |
| `003_model_runs.sql` | `model_versions`, `model_runs` |
| `004_price_forecasts.sql` | `price_forecasts` (RANGE-partitioned by year on `reference_date`, 2025-2027 + default), unique + lookup indexes |
| `005_seed_states_and_telangana_districts.sql` | Seeds all 30 states observed in the source data (Telangana marked `is_supported = true`) and Telangana's 13 real districts |

Markets and commodities are intentionally **not** seeded by migration —
`scripts/etl/ingest_market_prices.py` upserts them from real ingested rows.

## Adding a new yearly partition

When a new calendar year needs a partition (e.g. 2028), add a new migration
file rather than editing an existing one:

```sql
-- 006_market_prices_2028_partition.sql
CREATE TABLE IF NOT EXISTS market_prices_2028 PARTITION OF market_prices
  FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
```

Do the same for `price_forecasts_<year>`. Rows landing in the `_default`
partition (should stay empty) are a signal a partition is missing.
