# Market price ETL

Loads raw AGMARKNET-style mandi price CSVs into the partitioned
`market_prices` table (`backend/db/migrations/002_market_prices.sql`).

```
raw CSV → normalize.py (validate/clean) → db.py (upsert reference rows,
batched execute_values) → market_prices
```

## Setup

```bash
cd scripts/etl
pip install -r requirements.txt
```

## Importing Telangana data

```bash
export DATABASE_URL="postgresql://yieldai:yieldai_dev_only@localhost:5432/yieldai_dev"

# Always dry-run first — reports row counts and invalid-row reasons without writing anything.
python ingest_market_prices.py \
  --source ~/Yieldmodelling/data/historical_mandi_prices.csv \
  --state Telangana \
  --dry-run

# Then run for real:
python ingest_market_prices.py \
  --source ~/Yieldmodelling/data/historical_mandi_prices.csv \
  --state Telangana
```

This example path (`~/Yieldmodelling/data/historical_mandi_prices.csv`) is
where the real 2025 Telangana source data was found on the machine this
migration was built on — it is NOT part of this repository (573MB, correctly
gitignored) and will differ on another machine. Point `--source` at wherever
your copy of a raw mandi price CSV actually lives; any file with the columns
`State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price`
(the AGMARKNET/data.gov.in export shape) works.

Re-running the same source is safe — rows upsert on their natural key
(market, commodity, variety, grade, date, source), so nothing duplicates.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--source` | (required) | Path to the raw CSV |
| `--state` | `Telangana` | State to filter to (case-insensitive) |
| `--source-label` | `agmarknet-data-gov-in` | Stored in `market_prices.source` for provenance |
| `--batch-size` | `5000` | Rows per pandas chunk / per DB transaction |
| `--dry-run` | off | Validate and report without writing |
| `--limit` | none | Stop after N source rows (for quick local smoke tests) |

## Tests

```bash
python -m pytest tests/
```

Unit tests (`tests/test_normalize.py`, `tests/test_db.py`) cover
normalization, price/date parsing, validation-error categorization, hash
determinism, and the reference-cache/upsert query shape — all with mocked
inputs, no live database required. `tests/fixtures/telangana_sample.csv` is
a 300-row real excerpt of Telangana rows (pulled from
`historical_mandi_prices.csv`, not fabricated) used to exercise
`ingest_market_prices.py --dry-run` end-to-end.

**Not covered locally**: the actual `psycopg2` INSERT/upsert path against a
live Postgres instance — no PostgreSQL was available in the environment this
was built in. `db.py`'s query-building is unit-tested with a mocked cursor;
run `ingest_market_prices.py` (without `--dry-run`) against a real database
and inspect `market_prices` row counts before trusting it in a demo.
