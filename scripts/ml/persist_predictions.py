#!/usr/bin/env python3
"""Persists model predictions directly into PostgreSQL (model_versions /
model_runs / price_forecasts) instead of writing forecast_lookup_all_commodities.csv.

This is Stage A of the model->database migration described in
docs/POSTGRES_FORECAST_MIGRATION_PLAN.md: it takes prediction output shaped
exactly like the existing forecast CSV (same columns the RandomForest
pipeline at ~/Yieldmodelling/notebooks/forecasting_model_multi_commodity.py
already produces) and writes it to Postgres, referencing one model_run row
for the whole batch. It does NOT retrain the model or read training features
from Postgres — that's Stage B, and would require re-architecting the
training script itself (out of scope here; see the migration plan doc).

Usage:
    python persist_predictions.py --source /path/to/forecast_lookup_all_commodities.csv \
        --model-name RandomForestClassifier --model-version multi_market_multi_commodity_v4 \
        --trained-through 2025-12-30 [--dry-run] [--limit 1000]
"""
from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "etl"))

from db import ReferenceCache, get_connection, transaction  # noqa: E402  (reused from scripts/etl/db.py)
from validate import PredictionValidationError, validate_prediction_row  # noqa: E402

DEFAULT_BATCH_SIZE = 5000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="CSV shaped like forecast_lookup_all_commodities.csv")
    parser.add_argument("--model-name", default="RandomForestClassifier")
    parser.add_argument("--model-version", required=True, help="e.g. multi_market_multi_commodity_v4")
    parser.add_argument("--trained-through", required=True, help="ISO date (YYYY-MM-DD) — latest market_prices date this model's training data included")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    return parser.parse_args()


def start_model_run(cursor, model_name: str, model_version: str, trained_through: str, started_at: datetime) -> str:
    cursor.execute(
        """
        INSERT INTO model_versions (name, version_label) VALUES (%s, %s)
        ON CONFLICT (name, version_label) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
        """,
        (model_name, model_version),
    )
    model_version_id = cursor.fetchone()[0]

    cursor.execute(
        """
        INSERT INTO model_runs (model_version_id, trained_through_date, started_at, status)
        VALUES (%s, %s, %s, 'running')
        RETURNING id
        """,
        (model_version_id, trained_through, started_at),
    )
    return cursor.fetchone()[0]


def complete_model_run(cursor, model_run_id: str, commodities_count: int, markets_count: int) -> None:
    cursor.execute(
        """
        UPDATE model_runs
        SET status = 'completed', completed_at = now(), commodities_count = %s, markets_count = %s
        WHERE id = %s
        """,
        (commodities_count, markets_count, model_run_id),
    )


def fail_model_run(cursor, model_run_id: str, notes: str) -> None:
    cursor.execute(
        "UPDATE model_runs SET status = 'failed', completed_at = now(), notes = %s WHERE id = %s",
        (notes, model_run_id),
    )


def bulk_upsert_price_forecasts(cursor, rows) -> int:
    rows = list(rows)
    if not rows:
        return 0
    template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
    sql = """
        INSERT INTO price_forecasts
            (model_run_id, market_id, commodity_id, reference_date, prediction_window,
             current_modal_price, predicted_price_trend, confidence, confidence_band,
             price_trend_score, prob_falling, prob_rising, prob_stable)
        VALUES %s
        ON CONFLICT (model_run_id, market_id, commodity_id, reference_date)
        DO UPDATE SET
            current_modal_price = EXCLUDED.current_modal_price,
            predicted_price_trend = EXCLUDED.predicted_price_trend,
            confidence = EXCLUDED.confidence,
            confidence_band = EXCLUDED.confidence_band,
            price_trend_score = EXCLUDED.price_trend_score,
            prob_falling = EXCLUDED.prob_falling,
            prob_rising = EXCLUDED.prob_rising,
            prob_stable = EXCLUDED.prob_stable
    """
    psycopg2.extras.execute_values(cursor, sql, rows, template=template, page_size=1000)
    return cursor.rowcount


def run(args: argparse.Namespace) -> int:
    source_path = Path(args.source)
    if not source_path.exists():
        print(f"[persist] ERROR: source file not found: {source_path}", file=sys.stderr)
        return 1

    started_at = time.time()
    total_read = 0
    total_valid = 0
    invalid_reasons: Counter[str] = Counter()
    commodities_seen: set[str] = set()
    markets_seen: set[tuple[str, str, str]] = set()
    total_written = 0

    conn = None
    cache: ReferenceCache | None = None
    model_run_id = None

    if not args.dry_run:
        conn = get_connection()
        with transaction(conn) as cursor:
            model_run_id = start_model_run(
                cursor, args.model_name, args.model_version, args.trained_through, datetime.now(timezone.utc)
            )
        print(f"[persist] started model_run {model_run_id}")

    print(f"[persist] source={source_path} model={args.model_name}/{args.model_version} dry_run={args.dry_run}")

    try:
        reader = pd.read_csv(source_path, chunksize=args.batch_size, dtype=str, keep_default_na=False)
        for chunk in reader:
            if args.limit is not None and total_read >= args.limit:
                break
            total_read += len(chunk)

            validated = []
            for raw in chunk.to_dict(orient="records"):
                try:
                    validated.append(validate_prediction_row(raw))
                except PredictionValidationError as exc:
                    invalid_reasons[exc.reason] += 1

            total_valid += len(validated)
            for v in validated:
                commodities_seen.add(v.commodity)
                markets_seen.add((v.state, v.district, v.market))

            if not args.dry_run and validated:
                assert conn is not None and model_run_id is not None
                with transaction(conn) as cursor:
                    if cache is None:
                        cache = ReferenceCache(cursor)
                    db_rows = []
                    for v in validated:
                        state_id = cache.state_id(v.state)
                        district_id = cache.district_id(state_id, v.district)
                        market_id = cache.market_id(district_id, v.market)
                        commodity_id = cache.commodity_id(v.commodity)
                        db_rows.append((
                            model_run_id, market_id, commodity_id, v.reference_date, "7_days",
                            v.current_modal_price, v.predicted_price_trend, v.confidence, v.confidence_band,
                            v.price_trend_score, v.prob_falling, v.prob_rising, v.prob_stable,
                        ))
                    total_written += bulk_upsert_price_forecasts(cursor, db_rows)

        if not args.dry_run:
            assert conn is not None and model_run_id is not None
            with transaction(conn) as cursor:
                complete_model_run(cursor, model_run_id, len(commodities_seen), len(markets_seen))
    except Exception as exc:
        if not args.dry_run and conn is not None and model_run_id is not None:
            with transaction(conn) as cursor:
                fail_model_run(cursor, model_run_id, str(exc)[:500])
        raise
    finally:
        if conn is not None:
            conn.close()

    elapsed = time.time() - started_at
    print("[persist] ── summary ──────────────────────────────────────────")
    print(f"[persist] rows read:     {total_read}")
    print(f"[persist] rows valid:    {total_valid}")
    print(f"[persist] rows invalid:  {sum(invalid_reasons.values())}")
    for reason, count in invalid_reasons.most_common():
        print(f"[persist]   - {reason}: {count}")
    print(f"[persist] distinct commodities: {len(commodities_seen)}, distinct markets: {len(markets_seen)}")
    if args.dry_run:
        print("[persist] DRY RUN — no rows written, no model_run created.")
    else:
        print(f"[persist] rows written: {total_written} (model_run_id={model_run_id})")
    print(f"[persist] elapsed: {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
