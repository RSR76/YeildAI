"""Unit tests for scripts/ml/persist_predictions.py's DB-writing helpers,
using a mocked cursor/psycopg2.extras — no live Postgres required.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from persist_predictions import bulk_upsert_price_forecasts, complete_model_run, fail_model_run, start_model_run  # noqa: E402


def test_start_model_run_inserts_version_then_run_and_returns_run_id():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(7,), ("run-uuid-123",)]  # model_version_id, then model_run id

    run_id = start_model_run(cursor, "RandomForestClassifier", "v4", "2025-12-30", started_at="2026-08-17T00:00:00Z")

    assert run_id == "run-uuid-123"
    assert cursor.execute.call_count == 2
    version_sql = cursor.execute.call_args_list[0][0][0]
    run_sql = cursor.execute.call_args_list[1][0][0]
    assert "model_versions" in version_sql
    assert "ON CONFLICT (name, version_label)" in version_sql
    assert "model_runs" in run_sql
    assert "%s" in run_sql  # parameterized, not string-interpolated


def test_complete_model_run_sets_completed_status_and_counts():
    cursor = MagicMock()
    complete_model_run(cursor, "run-uuid-123", commodities_count=5, markets_count=12)

    sql, params = cursor.execute.call_args[0]
    assert "status = 'completed'" in sql
    assert params == (5, 12, "run-uuid-123")


def test_fail_model_run_sets_failed_status_with_truncated_notes():
    cursor = MagicMock()
    fail_model_run(cursor, "run-uuid-123", "boom")

    sql, params = cursor.execute.call_args[0]
    assert "status = 'failed'" in sql
    assert params == ("boom", "run-uuid-123")


def test_bulk_upsert_price_forecasts_delegates_to_execute_values_with_run_scoped_upsert():
    cursor = MagicMock()
    cursor.rowcount = 1
    rows = [
        ("run-uuid-123", 1, 1, "2026-08-01", "7_days", 1200.0, "Rising", 0.82, "High", 0.64, 0.09, 0.82, 0.09),
    ]

    with patch("persist_predictions.psycopg2.extras.execute_values") as mock_execute_values:
        affected = bulk_upsert_price_forecasts(cursor, rows)

    assert mock_execute_values.called
    sql_arg = mock_execute_values.call_args[0][1]
    assert "ON CONFLICT (model_run_id, market_id, commodity_id, reference_date)" in sql_arg
    assert affected == 1


def test_bulk_upsert_price_forecasts_no_op_on_empty_rows():
    cursor = MagicMock()
    with patch("persist_predictions.psycopg2.extras.execute_values") as mock_execute_values:
        affected = bulk_upsert_price_forecasts(cursor, [])
    assert affected == 0
    mock_execute_values.assert_not_called()
