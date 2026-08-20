# Migration Plan: CSV-Backed Forecasting to PostgreSQL-Backed Forecasting

**Status:** Plan only. Nothing in this document has been deployed or applied to production — no commit, push, or deploy has been performed as part of this work. This is a plan for a human to execute deliberately, phase by phase, with verification gates in between.

---

## 0. Preconditions before starting Phase 1 below

- [ ] A real (non-production, disposable-for-testing) PostgreSQL instance is reachable — local Docker, a managed dev instance, or a Render staging database. **Never the production Render database.**
- [ ] `backend/db/migrations/*.sql` has been reviewed by a second engineer (schema/partition decisions in particular).
- [ ] `docs/TELANGANA_DATA_SOURCE_RESEARCH.md`'s open questions (does data.gov.in's API actually return 2022-2024 Telangana rows, or only a rolling recent window?) have been resolved with a real API key test — this determines how much real multi-year backfill is possible before go-live vs. deferred.

---

## 1. Deploy schema

Run `npm run db:migrate` (see `backend/db/README.md`) against the target database. This applies `001`-`005` in order inside a tracked `schema_migrations` table, creating the reference tables, the partitioned `market_prices`/`price_forecasts` tables with their 2022-2027 yearly partitions, `model_versions`/`model_runs`, and the Telangana state/district seed data.

**Verification gate:** `\dt` and `\d+ market_prices` in `psql` show all tables and partitions; `SELECT * FROM states WHERE is_supported;` returns exactly the Telangana row.

## 2. Ingest historical data

Run `scripts/etl/ingest_market_prices.py --source <path to historical_mandi_prices.csv> --state Telangana` (dry-run first: add `--dry-run` and review the summary report before writing). This backfills `market_prices` for whatever years of source data are available — today, that's 2025 only; 2022-2024 backfill depends on resolving the open sourcing question in §0.

**Verification gate:** row counts in `market_prices` per year match the source file's per-year counts (the ETL script's summary report prints this); re-running the same import produces zero new rows (idempotency check).

## 3. Populate predictions

Run `scripts/ml/persist_predictions.py` against the existing model's output (Stage A — see `ARCHITECTURE_V2.md` section 5) to populate `model_versions`, `model_runs`, and `price_forecasts`.

**Verification gate:** `SELECT count(*) FROM price_forecasts;` is non-zero and roughly matches the source prediction count; every row has a valid `model_run_id` join.

## 4. Validate DB output vs. current CSV output

For a sample of (commodity, state, district, market) combinations already served correctly by the CSV path today, call both `CsvForecastRepository` and `PostgresForecastRepository`'s `getLatest`/`getAllLatest` and diff the results field-by-field. `backend/tests/` includes repository contract tests that exercise both implementations against the same interface — extend these with real data once a database is available, rather than trusting synthetic fixtures alone at this stage.

**Verification gate:** no unexplained diffs on price/trend/confidence/probability fields for the sampled combinations. Explainable diffs (e.g. DB has fresher data than the CSV snapshot) should be documented, not silently accepted.

## 5. Enable the DB repository in staging

Set `FORECAST_DATA_SOURCE=postgres` and a real `DATABASE_URL` in a staging environment (never production yet). Confirm `/ready` reports `status: "ready"` and that a `DATABASE_URL` connection failure produces a `failed` readiness state rather than a silent CSV fallback (this is enforced in code — see `backend/src/repositories/forecastRepositoryFactory.ts`).

**Verification gate:** manually exercise Mandi Prices, Recommendations, and the new year-aware endpoints in staging; check backend logs confirm `[forecastRepository] selected: postgres`.

## 6. Compare responses under real staging traffic

Run the app in staging for a representative period (a few days is enough at this scale) and compare actual API response shapes/latency against the CSV path's historical behavior (either by keeping a shadow CSV-backed staging instance temporarily, or by replaying a captured request log against both).

**Verification gate:** p50/p95 latency for `/api/forecast/*` and `/api/recommendations` in staging is acceptable (indexed Postgres queries should outperform the CSV path's in-memory Map lookups at this data volume, but this must be measured, not assumed); no elevated error rate.

## 7. Switch production backend

Update the production environment's `FORECAST_DATA_SOURCE=postgres` and `DATABASE_URL` (pointing at the production database, now populated via steps 1-3 run against it, or restored from a validated staging snapshot). Deploy.

**Verification gate:** `/ready` reports `postgres`; smoke-test the same manual flows as step 5 in production; monitor error rates and latency for the following 24-48 hours before proceeding to step 8.

## 8. Remove CSV runtime dependency

Only after step 7 has been stable in production for a reasonable observation window: remove `FORECAST_CSV_PATH` from the production environment, and consider whether `CsvForecastRepository`/`csvForecastIndex.ts` should be deleted from the codebase or kept as a documented local-dev-only fallback (recommendation: keep it, clearly labeled as dev/legacy-only in code comments, since it remains useful for a teammate who wants to run the app without standing up Postgres — see `docs/LOCAL_DEVELOPMENT.md`).

---

## Rollback strategy

At every step above, rollback is: set `FORECAST_DATA_SOURCE=csv` back in the environment and redeploy/restart. Because the CSV path is never deleted until step 8, and because the Postgres path is purely additive (no existing table was altered, no existing endpoint's response shape was changed), rolling back is a config change plus a restart, not a code revert, for steps 1-7. If step 8 has already happened, rollback additionally requires re-deploying the commit prior to the CSV-removal change.

Database rollback specifically: migrations `001`-`005` are additive (new tables only, nothing altered or dropped on the existing `User`/`FarmProfile`/legacy Prisma tables) — a schema rollback would mean `DROP TABLE` on the new tables, which is safe with respect to existing app data but destroys any ingested history/predictions, so only do this if the new tables are confirmed unused by anything in production.

---

## Explicit non-goals of this plan

- This plan does not cover multi-state expansion — that is future architecture (see `ARCHITECTURE_V2.md` section 6).
- This plan does not cover Stage B (training directly from Postgres) — see `ARCHITECTURE_V2.md` section 5.
- No step in this plan was executed against production infrastructure as part of this work session.
