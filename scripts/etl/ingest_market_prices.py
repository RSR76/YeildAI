#!/usr/bin/env python3
"""Ingests a raw AGMARKNET-style mandi price CSV into the partitioned
market_prices table (backend/db/migrations/002_market_prices.sql).

Reads in chunks with pandas (never the whole 573MB/5.8M-row file into memory
at once), normalizes/validates each row (scripts/etl/normalize.py), and
bulk-upserts via psycopg2.extras.execute_values (scripts/etl/db.py) inside
one transaction per chunk. Re-running the same source is safe: the upsert
targets market_prices' natural-key unique index, so a duplicate row updates
in place rather than duplicating.

Usage:
    python ingest_market_prices.py --source /path/to/historical_mandi_prices.csv --state Telangana --dry-run
    python ingest_market_prices.py --source /path/to/historical_mandi_prices.csv --state Telangana
"""
from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db import ReferenceCache, bulk_upsert_market_prices, get_connection, transaction  # noqa: E402
from normalize import RowValidationError, normalize_row  # noqa: E402

DEFAULT_SOURCE_LABEL = "agmarknet-data-gov-in"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Path to the raw CSV (State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price[,...])")
    parser.add_argument("--state", default="Telangana", help="State to filter to (case-insensitive). Default: Telangana.")
    parser.add_argument("--source-label", default=DEFAULT_SOURCE_LABEL, help=f"Provenance label stored in market_prices.source. Default: {DEFAULT_SOURCE_LABEL}")
    parser.add_argument("--batch-size", type=int, default=5000, help="Rows per chunk read + per DB transaction. Default: 5000.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing to the database.")
    parser.add_argument("--limit", type=int, default=None, help="Stop after this many source rows (for quick local testing).")
    return parser.parse_args()


def run(args: argparse.Namespace) -> int:
    source_path = Path(args.source)
    if not source_path.exists():
        print(f"[ingest] ERROR: source file not found: {source_path}", file=sys.stderr)
        return 1

    started_at = time.time()
    total_read = 0
    total_matched_state = 0
    total_valid = 0
    invalid_reasons: Counter[str] = Counter()
    total_written = 0

    conn = None
    cache: ReferenceCache | None = None
    if not args.dry_run:
        conn = get_connection()

    print(f"[ingest] source={source_path} state={args.state!r} dry_run={args.dry_run} batch_size={args.batch_size}")

    try:
        reader = pd.read_csv(source_path, chunksize=args.batch_size, dtype=str, keep_default_na=False)
        for chunk in reader:
            if args.limit is not None and total_read >= args.limit:
                break

            # Count every source row read BEFORE filtering — total_read drives
            # the --limit early-stop and the progress log's "source rows read"
            # figure, both of which must reflect rows actually scanned from
            # the file, not just the (much smaller) state-matched subset.
            total_read += len(chunk)

            state_col = "State" if "State" in chunk.columns else "state"
            chunk = chunk[chunk[state_col].str.strip().str.lower() == args.state.strip().lower()]
            total_matched_state += len(chunk)

            normalized_rows = []
            for raw in chunk.to_dict(orient="records"):
                try:
                    normalized_rows.append(normalize_row(raw, source=args.source_label))
                except RowValidationError as exc:
                    invalid_reasons[exc.reason] += 1

            total_valid += len(normalized_rows)

            if not args.dry_run and normalized_rows:
                assert conn is not None
                with transaction(conn) as cursor:
                    if cache is None:
                        cache = ReferenceCache(cursor)
                    db_rows = []
                    for row in normalized_rows:
                        state_id = cache.state_id(row.state)
                        district_id = cache.district_id(state_id, row.district)
                        market_id = cache.market_id(district_id, row.market)
                        commodity_id = cache.commodity_id(row.commodity)
                        db_rows.append((
                            market_id, commodity_id, row.variety, row.grade, row.observation_date,
                            row.min_price, row.max_price, row.modal_price, row.source, row.source_record_hash,
                        ))
                    total_written += bulk_upsert_market_prices(cursor, db_rows)

            if total_read and total_read % (args.batch_size * 20) == 0:
                print(f"[ingest] ... {total_read} source rows read so far ({total_matched_state} matched state={args.state!r})")
    finally:
        if conn is not None:
            conn.close()

    elapsed = time.time() - started_at
    print("[ingest] ── summary ──────────────────────────────────────────")
    print(f"[ingest] source rows scanned (all states): {total_read}")
    print(f"[ingest] rows read (matching state):  {total_matched_state}")
    print(f"[ingest] rows valid/normalized:       {total_valid}")
    print(f"[ingest] rows invalid (skipped):      {sum(invalid_reasons.values())}")
    for reason, count in invalid_reasons.most_common():
        print(f"[ingest]   - {reason}: {count}")
    if args.dry_run:
        print("[ingest] DRY RUN — no rows written to the database.")
    else:
        print(f"[ingest] rows written (inserted or updated): {total_written}")
    print(f"[ingest] elapsed: {elapsed:.1f}s")

    return 0


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
