"""Unit tests for scripts/etl/fetch_datagovin_market_prices.py using a mocked
requests.Session — no live data.gov.in call is made by any test here.
"""
import json
import sys
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fetch_datagovin_market_prices as fdm  # noqa: E402


def _mock_response(status_code=200, payload=None, text=""):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = payload
    resp.text = text
    return resp


def _record(market="Warangal", district="Warangal", commodity="Tomato", modal="1100", date_str="15/03/2024"):
    return {
        "State": "Telangana", "District": district, "Market": market, "Commodity": commodity,
        "Variety": "Local", "Grade": "FAQ", "Arrival_Date": date_str,
        "Min_Price": "1000", "Max_Price": "1200", "Modal_Price": modal, "Commodity_Code": "78",
    }


def _payload(records, total=None):
    return {"records": records, "total": total if total is not None else len(records), "count": len(records)}


# ── fetch_day: pagination / shape ────────────────────────────────────────

def test_fetch_day_single_page_success():
    payload = _payload([_record(market="Warangal"), _record(market="Karimnagar")])
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)) as mock_get:
        records, total, truncated = fdm.fetch_day(
            fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 3, 15),
            sleep_fn=lambda s: None,
        )
    assert len(records) == 2
    assert total == 2
    assert truncated is False
    assert mock_get.call_count == 1


def test_fetch_day_pagination_combines_all_pages():
    page1 = _payload([_record(market="A"), _record(market="B")], total=3)
    page2 = _payload([_record(market="C")], total=3)
    with patch.object(
        fdm.requests.Session, "get", side_effect=[_mock_response(200, page1), _mock_response(200, page2)]
    ) as mock_get:
        records, total, truncated = fdm.fetch_day(
            fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 3, 15),
            page_size=2, sleep_fn=lambda s: None,
        )
    assert len(records) == 3
    assert total == 3
    assert truncated is False
    assert mock_get.call_count == 2
    assert mock_get.call_args_list[1].kwargs["params"]["offset"] == 2


def test_fetch_day_empty_day_returns_no_records_without_error():
    payload = _payload([], total=0)
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)):
        records, total, truncated = fdm.fetch_day(
            fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 1, 1),
            sleep_fn=lambda s: None,
        )
    assert records == []
    assert total == 0
    assert truncated is False


def test_fetch_day_dedupes_exact_duplicate_rows_across_pages():
    rec = _record(market="Warangal")
    page1 = _payload([rec, dict(rec)], total=3)  # simulated offset-drift duplicate on a page boundary
    page2 = _payload([_record(market="Karimnagar")], total=3)
    with patch.object(
        fdm.requests.Session, "get", side_effect=[_mock_response(200, page1), _mock_response(200, page2)]
    ):
        records, total, truncated = fdm.fetch_day(
            fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 3, 15),
            page_size=2, sleep_fn=lambda s: None,
        )
    assert len(records) == 2  # the exact-duplicate row collapses to one


# ── fetch_day: errors / retries ──────────────────────────────────────────

def test_fetch_day_client_error_is_not_retried():
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(400, None, text="bad request")) as mock_get:
        with pytest.raises(fdm.DataGovInError):
            fdm.fetch_day(
                fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 1, 1),
                max_retries=3, sleep_fn=lambda s: None,
            )
    assert mock_get.call_count == 1  # non-retryable 4xx must not be retried


def test_fetch_day_retries_transient_failure_then_succeeds():
    payload = _payload([_record()])
    sleep_calls = []
    with patch.object(
        fdm.requests.Session, "get",
        side_effect=[_mock_response(503, None, text="unavailable"), _mock_response(200, payload)],
    ) as mock_get:
        records, total, truncated = fdm.fetch_day(
            fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 1, 1),
            max_retries=3, sleep_fn=sleep_calls.append,
        )
    assert len(records) == 1
    assert mock_get.call_count == 2
    assert len(sleep_calls) == 1  # exactly one backoff sleep before the retry succeeded


def test_fetch_day_gives_up_after_max_retries_not_infinite():
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(503, None, text="down")) as mock_get:
        with pytest.raises(fdm.DataGovInError):
            fdm.fetch_day(
                fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 1, 1),
                max_retries=2, sleep_fn=lambda s: None,
            )
    assert mock_get.call_count == 3  # initial attempt + 2 retries, then bounded give-up


def test_fetch_day_malformed_response_missing_records_key():
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, {"total": 5})) as mock_get:
        with pytest.raises(fdm.DataGovInError):
            fdm.fetch_day(
                fdm.requests.Session(), "resource-id", "fake-key", "Telangana", date(2024, 1, 1),
                max_retries=1, sleep_fn=lambda s: None,
            )
    assert mock_get.call_count == 2  # malformed responses are retried too, in case it's a transient glitch


def test_fetch_day_authentication_error_from_json_body_is_not_retried():
    with patch.object(
        fdm.requests.Session, "get", return_value=_mock_response(200, {"error": "Key not authorised"})
    ) as mock_get:
        with pytest.raises(fdm.AuthenticationError):
            fdm.fetch_day(
                fdm.requests.Session(), "resource-id", "bad-key", "Telangana", date(2024, 1, 1),
                max_retries=3, sleep_fn=lambda s: None,
            )
    assert mock_get.call_count == 1  # a bad key fails identically every time — retrying is pointless


def test_fetch_day_authentication_error_from_http_401():
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(401, None, text="unauthorized")) as mock_get:
        with pytest.raises(fdm.AuthenticationError):
            fdm.fetch_day(
                fdm.requests.Session(), "resource-id", "bad-key", "Telangana", date(2024, 1, 1),
                sleep_fn=lambda s: None,
            )
    assert mock_get.call_count == 1


def test_daterange_rejects_end_before_start():
    with pytest.raises(ValueError):
        list(fdm.daterange(date(2024, 3, 17), date(2024, 3, 15)))


# ── run(): resume / duplicate-safety / provenance ────────────────────────

def test_run_skips_already_successful_days_on_resume(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "fake-key")
    output_dir = tmp_path / "out"
    payload = _payload([_record()])
    base_args = [
        "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-15",
        "--output", str(output_dir), "--min-request-interval", "0",
    ]

    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)) as mock_get:
        exit_code = fdm.run(fdm.parse_args(base_args))
    assert exit_code == 0
    assert mock_get.call_count == 1

    # Re-run over the same range: the day is already "success" in manifest.json,
    # so no new HTTP request should fire and no duplicate rows should appear.
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)) as mock_get2:
        exit_code2 = fdm.run(fdm.parse_args(base_args))
    assert exit_code2 == 0
    assert mock_get2.call_count == 0

    csv_path = output_dir / "telangana_2024-03-15.csv"
    rows = csv_path.read_text().strip().splitlines()
    assert len(rows) == 2  # header + 1 data row, not duplicated


def test_run_force_flag_refetches_even_if_already_successful(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "fake-key")
    output_dir = tmp_path / "out"
    payload = _payload([_record()])
    base_args = [
        "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-15",
        "--output", str(output_dir), "--min-request-interval", "0",
    ]
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)):
        fdm.run(fdm.parse_args(base_args))

    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)) as mock_get:
        fdm.run(fdm.parse_args(base_args + ["--force"]))
    assert mock_get.call_count == 1


def test_run_continues_past_a_failed_day_and_reports_it(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "fake-key")
    output_dir = tmp_path / "out"
    good_payload = _payload([_record()])

    def side_effect(url, params=None, timeout=None, headers=None):
        if params["filters[Arrival_Date]"] == "15/03/2024":
            return _mock_response(500, None, text="down")
        return _mock_response(200, good_payload)

    with patch.object(fdm.requests.Session, "get", side_effect=side_effect):
        args = fdm.parse_args([
            "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-16",
            "--output", str(output_dir), "--min-request-interval", "0", "--max-retries", "0",
        ])
        exit_code = fdm.run(args)

    assert exit_code == 1  # non-zero because at least one day failed
    assert (output_dir / "telangana_2024-03-16.csv").exists()
    assert not (output_dir / "telangana_2024-03-15.csv").exists()

    manifest = json.loads((output_dir / "manifest.json").read_text())
    assert manifest["days"]["2024-03-15"]["status"] == "error"
    assert manifest["days"]["2024-03-16"]["status"] == "success"


def test_run_aborts_immediately_on_authentication_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "bad-key")
    output_dir = tmp_path / "out"
    with patch.object(
        fdm.requests.Session, "get", return_value=_mock_response(200, {"error": "Key not authorised"})
    ) as mock_get:
        args = fdm.parse_args([
            "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-20",
            "--output", str(output_dir), "--min-request-interval", "0",
        ])
        exit_code = fdm.run(args)
    assert exit_code == 2
    assert mock_get.call_count == 1  # aborted after the first day's auth failure, not one call per remaining day


def test_run_fails_clearly_when_api_key_env_var_missing(tmp_path, monkeypatch):
    monkeypatch.delenv("DATA_GOV_IN_API_KEY", raising=False)
    output_dir = tmp_path / "out"
    args = fdm.parse_args([
        "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-15",
        "--output", str(output_dir),
    ])
    exit_code = fdm.run(args)
    assert exit_code == 2


def test_manifest_records_provenance_fields(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "fake-key")
    output_dir = tmp_path / "out"
    payload = _payload([_record()])
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)):
        args = fdm.parse_args([
            "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-15",
            "--output", str(output_dir), "--min-request-interval", "0",
        ])
        fdm.run(args)
    manifest = json.loads((output_dir / "manifest.json").read_text())
    assert manifest["resource_id"] == fdm.DEFAULT_RESOURCE_ID
    assert manifest["state"] == "Telangana"
    assert manifest["requested_start_date"] == "2024-03-15"
    assert manifest["requested_end_date"] == "2024-03-15"
    assert "updated_at" in manifest
    assert manifest["days"]["2024-03-15"]["status"] == "success"
    assert manifest["days"]["2024-03-15"]["row_count"] == 1


def test_api_key_value_is_never_printed(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "super-secret-value-xyz")
    output_dir = tmp_path / "out"
    payload = _payload([_record()])
    with patch.object(fdm.requests.Session, "get", return_value=_mock_response(200, payload)):
        args = fdm.parse_args([
            "--state", "Telangana", "--start-date", "2024-03-15", "--end-date", "2024-03-15",
            "--output", str(output_dir), "--min-request-interval", "0",
        ])
        fdm.run(args)
    captured = capsys.readouterr()
    assert "super-secret-value-xyz" not in captured.out
    assert "super-secret-value-xyz" not in captured.err
