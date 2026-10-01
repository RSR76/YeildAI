# Local Development Setup

This is the setup a new teammate needs — no tribal knowledge required. It covers both the "just get the app running" path (CSV-backed, no database needed, works today) and the full PostgreSQL-backed path being rolled out per `docs/ARCHITECTURE_V2.md`.

## 0. Prerequisites

- Node.js 22+, npm 10+
- Python 3.11+ (only needed for the ETL/model-persistence scripts, not for running the app)
- Optional but recommended for the full DB path: Docker (for local Postgres via `docker-compose.yml`) — if you don't have Docker, the CSV-backed path below still works fully.

## 1. Clone and install

```bash
git clone <repo>
cd YeildAI-telangana-db
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## 2. Fastest path: run without a database at all

This is what the previous MVP setup required, and still works — it's the right choice if you just need the app running to work on frontend/UI changes and don't have (or don't want to stand up) Postgres yet.

```bash
cp backend/.env.example backend/.env
# leave DATABASE_URL unset and FORECAST_DATA_SOURCE unset (or =csv) in backend/.env
```

You'll also need the real forecast CSV (`data/forecast_lookup_all_commodities.csv`) — this is a large generated file that is intentionally **not** committed to git (see `.gitignore`). Ask a teammate for a copy, or point `FORECAST_CSV_PATH` in `backend/.env` at wherever you have it. Without it, the backend will report a failed readiness state on `/ready` rather than silently serving stale/empty data — this is intentional (see `backend/src/lib/csvForecastIndex.ts`).

```bash
cd backend && npm run dev   # starts on the port in backend/.env, default per PORT
cd frontend && npm run dev  # separate terminal
```

Auth/farm features (login, signup, farm profiles) still require a real PostgreSQL connection even on this path — `User`/`FarmProfile` have always been Prisma/Postgres-backed, independent of the CSV-vs-DB forecast question. If you only need forecast/recommendation pages and not login, this path is enough. If you need authenticated flows, continue to step 3 (this closes the gap that previously blocked a teammate without local Postgres from testing authenticated flows).

## 3. Full path: PostgreSQL-backed (auth + forecasts + multi-year history)

### 3a. Start Postgres

With Docker:

```bash
docker compose up -d postgres
```

This starts a local-only `postgres:16-alpine` container per the root `docker-compose.yml`, with a named volume so data survives restarts. The credentials in `docker-compose.yml` are local-dev-only placeholders — never reuse them anywhere real.

Without Docker: point `DATABASE_URL` in `backend/.env` at any disposable PostgreSQL 13+ instance you have (a local install, a free-tier cloud dev database, etc.). **Never point local development at the production Render database.**

### 3b. Configure environment

```bash
cp backend/.env.example backend/.env
```

Fill in `DATABASE_URL` to match your Postgres instance (the `docker-compose.yml` default is documented in `backend/.env.example`). Set `FORECAST_DATA_SOURCE=postgres` once you've completed 3c-3d below (leave it as `csv` or unset until then, so the backend keeps working against the CSV path while you set up the DB).

### 3c. Run migrations

```bash
cd backend
npm run db:migrate
```

This applies every file in `backend/db/migrations/` in order (see `backend/db/README.md` for exactly what each one creates), tracked in a `schema_migrations` table so re-running is safe. This also runs Prisma's existing `User`/`FarmProfile`/legacy tables — see `backend/prisma/schema.prisma` — via `npm run prisma:migrate` (unchanged from before this work).

### 3d. Import Telangana fixture/demo data

For a quick local dataset (not the full 573MB source file), use a small Telangana fixture:

```bash
cd scripts/etl
pip install -r requirements.txt
python ingest_market_prices.py --source <path-to-fixture-or-real-csv> --state Telangana --dry-run   # review first
python ingest_market_prices.py --source <path-to-fixture-or-real-csv> --state Telangana              # actually loads
```

See `scripts/etl/README.md` for exact fixture paths and options. To also populate `price_forecasts` (so Mandi Prices/Recommendations show something), run:

```bash
cd scripts/ml
python persist_predictions.py --source <path-to-forecast-source>
```

### 3e. Switch the backend to Postgres and run

Set `FORECAST_DATA_SOURCE=postgres` in `backend/.env`, then:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Check `http://localhost:<port>/ready` — it should report the Postgres path is selected and ready. If `DATABASE_URL` is unreachable, `/ready` will report a **failed** state (by design — see `docs/POSTGRES_FORECAST_MIGRATION_PLAN.md`), not a silent fallback to CSV.

## 4. Running tests

```bash
cd backend && npm test        # vitest — repository/service/controller tests, mocked DB where a live one isn't available
cd frontend && npm test       # vitest — component/logic tests
cd scripts/etl && python -m pytest    # ETL normalization/validation unit tests
cd scripts/ml && python -m pytest     # prediction-persistence unit tests
```

Database integration tests (real Postgres, not mocks) require a live disposable instance — see the final upgrade report for exactly what has and hasn't been integration-tested in this environment.

## 5. Common issues

- **`/ready` reports `failed` with a Postgres connection error** — check `DATABASE_URL` in `backend/.env`, confirm the Postgres container/instance is actually running (`docker compose ps`).
- **`market_prices_default` partition has rows in it** — this means a row's `observation_date` fell outside the provisioned yearly partitions (2022-2027); either bad source data or a missing partition that needs adding via a new migration file.
- **CSV path says "Forecast CSV not found"** — you're on the CSV path (step 2) without the actual generated CSV file; get it from a teammate or switch to the Postgres path (step 3).
