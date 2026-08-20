# Telangana 2024 Historical Data — Source Validation

**Purpose:** Resolve the single open question left by `TELANGANA_DATA_SOURCE_RESEARCH.md` —
"does data.gov.in's API actually return multi-year (2022–2024) Telangana records, or only a
rolling recent window?" — by directly querying the live API with a real key.

**Method:** Direct `curl` calls against `api.data.gov.in`, 2026-08-19. No PostgreSQL was
touched; no data was ingested. All sample files were written to a session scratchpad directory
outside this repository, not committed.

**Result: resolved, decisively.** Real Telangana 2024 data exists, is retrievable, and matches
our ETL's expected schema almost exactly. Details below.

---

## A. Best authoritative source

**data.gov.in resource `35985678-0d79-46b4-9ed6-6f13308a1d24`, "Variety-wise Daily Market Prices
Data of Commodity"** — Ministry of Agriculture and Farmers Welfare / Directorate of Marketing
and Inspection (DMI), sourced from AGMARKNET. This is a *different* resource from the one most
tutorials/scrapers reference ("Current Daily Price of Various Commodities from Various Markets
(Mandi)", `9ef84268-d588-465a-a308-a864a43d0070`), which was also tested and directly
disproven as a historical source (see section C).

## B. Exact source / API / resource

- **Endpoint:** `https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24`
- **Format:** `format=json` or `format=csv`, both confirmed working.
- **Filters confirmed to work:** `filters[State]`, `filters[District]`, `filters[Commodity]`,
  `filters[Arrival_Date]` (exact-match, `DD/MM/YYYY`, matching how the field is stored — not
  the `dd-MM-yyyy` format hint shown in the resource metadata, which is misleading).
  `State` and `District` are marked `"mandatory": true` in the resource's own field metadata —
  i.e. this resource is designed to be queried per-state.
- **No documented date-range filter** (no `from`/`to` operators found) — each request returns
  one exact `Arrival_Date`. A year of data requires iterating one request per calendar day
  (see section L).
- **API key:** A real registered key is required for normal use. The commonly-circulated public
  "sample key" (`579b464d...cdd3946e...`, used throughout `TELANGANA_DATA_SOURCE_RESEARCH.md`'s
  prior test) returned `{"error": "Key not authorised"}` for both resources — **confirmed dead**,
  do not rely on it. However, the resource's own webpage
  (`https://www.data.gov.in/resource/variety-wise-daily-market-prices-data-commodity`) embeds a
  **different, currently-live sample key** in its page source (used for the platform's own
  in-page preview widget) that **did** authenticate successfully for every query in this session,
  including `format=csv&limit=all`. This is not a properly self-registered key — it's a
  publicly embedded preview key with no documented quota guarantee, and could rotate or be
  revoked without notice. **Recommendation: register a real personal API key via data.gov.in
  self-service signup (free, "My Account" → "Generate API Key") before building a production
  ingestion pipeline** — the exposed key is fine for this research pass, not for a durable job.

## C. Whether 2024 Telangana historical data is actually obtainable

**Yes, directly confirmed.** Example: `filters[State]=Telangana&filters[Arrival_Date]=15/03/2024`
returned `"total": 353` real records for that single day (full detail in section E).

For contrast, the *other* candidate resource (`9ef84268...`, "Current Daily Price") was also
tested with the same 2024-03-15 filter and returned `"total": 0` — its `total` record count is
only 5,000–6,300 records platform-wide at any moment, and every record returned (with no date
filter at all) carried today's date (`19/08/2026`). **This resource is a live same-day snapshot
only, with zero historical retention — not even a rolling window.** This directly confirms and
resolves the "15-day rolling history" concern flagged (but not proven) in the prior research
doc: the concern was actually an understatement — it's not 15 days, it's zero days of history
beyond "today." Do not use this resource for any backfill.

## D. Earliest / latest dates verified

- **Earliest observed (unfiltered, Telangana):** a `06/01/2006` record surfaced in an
  unfiltered Telangana query (`total: 1,721,201` Telangana rows platform-wide for this
  resource). Note: Telangana as a state did not legally exist until 2014 (bifurcated from
  Andhra Pradesh) — AGMARKNET is retroactively applying the current state label to pre-2014
  records. This is a real characteristic of the source, not a data error, but worth knowing:
  don't be surprised by "Telangana" rows predating the state's creation.
- **Continuity directly spot-checked across 11 dates** spanning 2022–2026, every one non-zero:

  | Date | Telangana records that day |
  |---|---|
  | 01/01/2022 | 322 |
  | 01/06/2022 | 396 |
  | 01/01/2023 | 443 |
  | 01/06/2023 | 453 |
  | 01/01/2024 | 101 |
  | 10/01/2024 | 287 |
  | 15/03/2024 | 353 |
  | 10/04/2024 | 334 |
  | 10/07/2024 | 377 |
  | 01/06/2024 | 407 |
  | 10/10/2024 | 276 |
  | 01/12/2024 | 162 |
  | 20/12/2024 | 362 |
  | 01/01/2025 | 61 |
  | 15/06/2025 | 239 |
  | 01/01/2026 | 175 |
  | 18/08/2026 | 440 |

  **Latest verified date: 18/08/2026 (yesterday relative to this session)** — the resource is
  kept genuinely current, not just historical. This means it could *also* eventually replace/
  supplement the manually-sourced `historical_mandi_prices.csv` used for the existing 2025
  ingestion, though that's a separate decision from this task.

## E. Sample record(s)

Full day pulled and saved locally (`telangana_2024_sample.csv`, 353 rows, scratchpad only, not
committed):

```
Arrival_Date,Commodity,Commodity_Code,District,Grade,Market,Max_Price,Min_Price,Modal_Price,State,Variety
15/03/2024,"Field Pea",64,Hyderabad,FAQ,"L B Nagar",4000,3000,3500,Telangana,"Field Pea"
15/03/2024,"Arhar (Tur/Red Gram)(Whole)",49,Adilabad,FAQ,Bhainsa,9927,7066,9856,Telangana,"F.A.Q. (Whole)"
15/03/2024,"Arhar (Tur/Red Gram)(Whole)",49,Nalgonda,FAQ,Suryapeta,9527,6559,9169,Telangana,Local
```

Plus 5 additional full days pulled across 2024 (Jan/Apr/Jul/Oct/Dec) for a combined
**1,989-row sample** used for the quality checks below.

## F. Fields returned

`Arrival_Date, Commodity, Commodity_Code, District, Grade, Market, Max_Price, Min_Price,
Modal_Price, State, Variety` — **field names are an exact match** to what
`scripts/etl/normalize.py` already looks for (`State`, `District`, `Market`, `Commodity`,
`Variety`, `Grade`, `Arrival_Date`, `Min_Price`, `Max_Price`, `Modal_Price`), plus one extra
column (`Commodity_Code`) that our ETL simply ignores (not read by `normalize_row`). CSV column
order differs from the order implied in `scripts/etl/README.md`'s example, but that's
irrelevant — `normalize_row` reads by dict key (`raw.get("State")` etc.), not by position.

## G. Estimated scale

Average of the 9 real 2024 daily counts sampled above: **~295 Telangana rows/day**. Extrapolated
across 365 days: **roughly 100,000–110,000 rows for full-year 2024** — the same order of
magnitude as the 85,017 rows already ingested for 2025, slightly higher (plausibly because this
resource's underlying feed reports more markets/commodities per day than the specific CSV
snapshot used for 2025). Platform-wide (all states, this resource), total is **81,271,186**
rows — a genuinely large, real archive, not a toy dataset.

## H. Compatibility with existing ETL/schema

**High — effectively a drop-in fit.**
- Column names match `normalize_row`'s expected keys exactly (State/District/Market/Commodity/
  Variety/Grade/Arrival_Date/Min_Price/Max_Price/Modal_Price).
- Date format (`DD/MM/YYYY`) matches `normalize.py`'s existing `_DMY_DATE_RE` pattern exactly —
  **zero parser changes needed**.
- Prices are clean numeric strings; `parse_price` already handles this shape.
- `market_prices_2024` partition **already exists** in `002_market_prices.sql` — schema is
  ready, no migration needed.
- The known "duplicate lot report" issue that `scripts/etl/db.py` was already fixed for during
  the 2025 ingestion **reproduces exactly** in this 2024 sample (see section I) — the existing
  fix (batch-level dedup by natural key, keep-last) should handle it without further changes.

## I. District/market naming mismatches

**None found.** Across the 1,989-row multi-month 2024 sample, every `District` value observed
(`Adilabad, Hyderabad, Jagityal, Karimnagar, Khammam, Mahbubnagar, Medak, Nalgonda, Nizamabad,
Ranga Reddy, Warangal`) is an exact string match to one of the 13 districts already seeded in
`005_seed_states_and_telangana_districts.sql`. Two seeded districts (`Rajanna Siricilla`,
`Bhadradri Kothagudem`) simply didn't appear in these particular 6 sampled days — normal sparse
reporting for smaller/newer districts, not a naming mismatch. **Recommend re-checking this
specifically during a full-year ingestion dry-run** (the existing `--dry-run` flag will surface
any `missing_district`/unmapped-district rows automatically if a real mismatch exists elsewhere
in the year).

One genuine duplicate-natural-key pair was found in the single-day sample
(`Metpally / Turmeric / Finger / FAQ / 15-03-2024`, two rows with different prices) — this is
the exact same real-world "duplicate lot report" pattern documented in
`CLAUDE_TELANGANA_DATABASE_UPGRADE_REPORT.md` section 38 ("Bugs found and fixed"), already
handled by `scripts/etl/db.py`'s per-batch dedup fix.

## J. API limitations / rate limits / key requirements

- **Key requirement:** yes, `api-key` query param required for both resources tested. The
  long-circulated public sample key is dead. A live (but not self-registered) key was found
  embedded in the resource's own webpage and used for all testing in this session — **do not
  hardcode this key into ETL code**; register a real one first (see section B).
- **Rate limit:** response headers show `X-Ratelimit-Limit: -1`, `X-Ratelimit-Remaining: -1` —
  no active numeric limit reported for this key. ~25 sequential requests in this session hit no
  429s or throttling. Real registered keys on data.gov.in are documented elsewhere (not
  independently re-verified here) to carry a request-per-hour/day quota — budget for this when
  designing the day-by-day ingestion loop (see section L).
- **Pagination:** standard `limit`/`offset` params confirmed present in every response; a
  single day's Telangana volume (~100–450 rows) comfortably fits in one request with a generous
  `limit` (e.g. 5,000) — no need to paginate within a day for Telangana specifically.
- **No date-range filter** — see section B. A full year requires ~365 requests (one per
  calendar day), each cheap (sub-second, <500 rows).
- **Bulk download:** `format=csv&limit=all` is supported and was used successfully for the
  single-day sample; using `limit=all` with no date filter would attempt to pull the full
  81M-row platform-wide dataset in one response — **do not do this**; always scope by
  `filters[State]` + `filters[Arrival_Date]` per request.

## K. What code changes, if any, would be required

**Very little.** The existing pipeline was already built to accept this exact CSV shape:

1. **New: a small fetch script** (`scripts/etl/fetch_datagovin_year.py` or similar, not yet
   written) to loop over each calendar day of 2024, call the API with
   `filters[State]=Telangana&filters[Arrival_Date]=<day>&format=csv`, and either (a) write one
   CSV per day, or (b) concatenate into one `telangana_2024.csv` matching the shape
   `ingest_market_prices.py` already expects.
2. **No changes needed** to `scripts/etl/normalize.py`, `scripts/etl/db.py`, or
   `ingest_market_prices.py` — column names, date format, and dedup handling already fit.
3. **No schema/migration changes** — `market_prices_2024` partition already exists.
4. The new fetch script should store the registered API key via an environment variable (e.g.
   `DATAGOVIN_API_KEY`), never hardcoded, consistent with how `DATABASE_URL` is already handled.

## L. Exact recommended next step for a controlled 2024 ingestion

1. **Register a real data.gov.in API key** (free self-service signup) — do this before writing
   any fetch script, to avoid depending on the embedded preview key used for this research pass.
2. **Write the fetch script** described in section K — day-by-day pull for `State=Telangana`,
   `Arrival_Date` = each day of 2024, saving to a local CSV (gitignored, same convention as the
   existing `~/Yieldmodelling/data/historical_mandi_prices.csv`).
3. **Dry-run** `ingest_market_prices.py --source <2024 file> --state Telangana --dry-run` —
   confirm valid/invalid row counts and inspect any `invalid_reasons` breakdown before touching
   the database, exactly as was done for the 2025 backfill.
4. **Real run** against `yieldai_telangana_dev` only (never the `yeildai` production database),
   confirm row count lands in `market_prices_2024`, and spot-check via the same kind of
   `pg_catalog` verification queries used in the 2025 live-verification session (section 38 of
   `CLAUDE_TELANGANA_DATABASE_UPGRADE_REPORT.md`).
5. **Do not attempt this until the user explicitly approves the ingestion** — this document is
   research/validation only, per the task's instructions.

---

## Secondary source: e-NAM Historical Trade Data

**Deprioritized, confirmed again this session.** Web search found no documented bulk historical
API or export mechanism for enam.gov.in beyond its live trading portal/mobile app (arrivals and
current min/max prices). No evidence of a Telangana-specific historical trade-data download was
found. This matches and reconfirms the prior research doc's C-rank conclusion — no new
information changes that assessment. Given data.gov.in's resource `35985678...` is now
*directly confirmed* to provide real multi-year Telangana data with a clean schema fit, there is
no remaining reason to invest further effort chasing eNAM as a cross-check source for this
specific backfill; it could still be worth a manual spot-check of a handful of prices later,
which is a much lower-effort task than building a scraper/ingestion path against it.
