#!/usr/bin/env python3
"""Historical downloader for data.gov.in resource 35985678-0d79-46b4-9ed6-6f13308a1d24
("Variety-wise Daily Market Prices Data of Commodity"), validated in
docs/TELANGANA_2024_DATA_VALIDATION.md to return real multi-year AGMARKNET
data with a field shape that matches scripts/etl/normalize.py exactly.

The resource has no date-range filter (confirmed in the validation doc) —
each request returns exactly one Arrival_Date, so a historical backfill is
one request per calendar day. This script loops the requested date range,
paginates each day's results, and writes one CSV per day plus a
`manifest.json` recording per-day fetch provenance/status — so a killed or
re-run download never re-fetches a day already marked successful, and never
duplicates rows within a day (see write_day_csv / _dedupe_records).

The output CSVs use the exact AGMARKNET column names normalize.py already
reads (State/District/Market/Commodity/Variety/Grade/Arrival_Date/Min_Price/
Max_Price/Modal_Price), so they are usable directly as --source input to
ingest_market_prices.py (concatenate the day files first, or point --source
at a single day file for a quick check) — no normalizer changes needed.

Usage:
    export DATA_GOV_IN_API_KEY=<your registered data.gov.in key>
    python fetch_datagovin_market_prices.py \\
        --state Telangana --start-date 2024-03-15 --end-date 2024-03-17 \\
        --output ./data/telangana_2024_sample

Re-running the same command resumes safely: days already recorded as
"success" in <output>/manifest.json are skipped (pass --force to refetch).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable, Iterator, Optional

import requests

DEFAULT_RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24"
DEFAULT_RESOURCE_NAME = "Variety-wise Daily Market Prices Data of Commodity"
DEFAULT_SOURCE_NAME = "data.gov.in"
API_BASE_URL = "https://api.data.gov.in/resource"
DEFAULT_API_KEY_ENV = "DATA_GOV_IN_API_KEY"

# Exact AGMARKNET field shape confirmed in docs/TELANGANA_2024_DATA_VALIDATION.md
# section F — matches what scripts/etl/normalize.py's normalize_row() reads.
FIELDNAMES = [
    "State", "District", "Market", "Commodity", "Variety", "Grade",
    "Arrival_Date", "Min_Price", "Max_Price", "Modal_Price", "Commodity_Code",
]

# The default `python-requests/x.y` User-Agent was observed live to make
# api.data.gov.in hang until read-timeout on every request (curl and a
# custom UA both succeeded in <1s against the identical request) — some
# WAF/anti-bot layer in front of the API appears to specifically slow-drop
# that UA string. A normal, honestly-descriptive client UA avoids it.
REQUEST_USER_AGENT = "YeildAI-ETL-Downloader/1.0 (+historical mandi price fetch; data.gov.in)"

DEFAULT_PAGE_SIZE = 1000
CONNECT_TIMEOUT = 5.0
DEFAULT_READ_TIMEOUT = 15.0
DEFAULT_MAX_RETRIES = 5
DEFAULT_BACKOFF_BASE = 1.0
DEFAULT_BACKOFF_CAP = 30.0
DEFAULT_MIN_REQUEST_INTERVAL = 0.5
# Real daily Telangana volume is a few hundred rows (docs/TELANGANA_2024_DATA_VALIDATION.md
# section D). 200 pages * DEFAULT_PAGE_SIZE is far beyond any plausible single-day,
# single-state volume — this bound exists only to stop an infinite pagination
# loop if the API ever misbehaves (e.g. `total` never satisfied), not because
# it's expected to be hit.
MAX_PAGES_PER_DAY = 200


class DataGovInError(Exception):
    """Base class for all fetch failures."""


class AuthenticationError(DataGovInError):
    """A bad/unauthorized key fails identically on every request — never retried,
    and aborts the whole run rather than burning through every remaining date.
    """


class MalformedResponseError(DataGovInError):
    """Response didn't match the expected {"records": [...], "total": N} shape."""


class TransientRequestError(DataGovInError):
    """Network/timeout/5xx/429 — worth a bounded retry."""


def daterange(start: date, end: date) -> Iterator[date]:
    if end < start:
        raise ValueError(f"end-date {end} is before start-date {start}")
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def read_api_key(env_var: str) -> str:
    key = os.environ.get(env_var, "").strip()
    if not key:
        raise AuthenticationError(
            f"{env_var} is not set (or empty). Export a real data.gov.in API key first, e.g.:\n"
            f"  export {env_var}=<your-key>\n"
            "Register one at https://www.data.gov.in ('My Account' -> 'Generate API Key')."
        )
    return key


class RateLimiter:
    """Guarantees at least `interval` seconds between successive wait() calls.

    No documented rate limit exists for this API (response headers reported
    X-Ratelimit-Limit: -1 during validation) — this is a courtesy pace against
    an undocumented limit, not a measured quota.
    """

    def __init__(self, interval: float, sleep_fn: Callable[[float], None] = time.sleep):
        self._interval = interval
        self._sleep_fn = sleep_fn
        self._last_call: Optional[float] = None

    def wait(self) -> None:
        if self._interval <= 0:
            return
        now = time.monotonic()
        if self._last_call is not None:
            remaining = self._interval - (now - self._last_call)
            if remaining > 0:
                self._sleep_fn(remaining)
        self._last_call = time.monotonic()


def _validate_payload(payload) -> list[dict]:
    """Raises AuthenticationError or MalformedResponseError; returns the records list."""
    if not isinstance(payload, dict):
        raise MalformedResponseError(f"expected a JSON object response, got {type(payload).__name__}")
    if "error" in payload:
        # data.gov.in returns HTTP 200 with a JSON {"error": "..."} body for a
        # bad/unauthorized key (confirmed in docs/TELANGANA_2024_DATA_VALIDATION.md
        # section J) — not a 401. Must check the body, not just the status code.
        raise AuthenticationError(f"data.gov.in API returned an error: {payload['error']!r}")
    records = payload.get("records")
    if not isinstance(records, list):
        raise MalformedResponseError("response JSON is missing a 'records' list")
    return records


def _request_page(
    session: requests.Session,
    resource_id: str,
    api_key: str,
    state: str,
    day: date,
    offset: int,
    page_size: int,
    timeout: float,
) -> dict:
    """Performs one HTTP request and returns the validated JSON payload.
    Raises AuthenticationError / MalformedResponseError / TransientRequestError /
    DataGovInError as appropriate. Never retries by itself — see _request_page_with_retry.
    """
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": page_size,
        "offset": offset,
        "filters[State]": state,
        # DD/MM/YYYY matches how Arrival_Date is actually stored (confirmed live,
        # not the misleading dd-MM-yyyy hint in the resource's own metadata).
        "filters[Arrival_Date]": day.strftime("%d/%m/%Y"),
    }
    try:
        response = session.get(
            f"{API_BASE_URL}/{resource_id}", params=params, timeout=(CONNECT_TIMEOUT, timeout),
            headers={"User-Agent": REQUEST_USER_AGENT},
        )
    except requests.exceptions.Timeout as exc:
        raise TransientRequestError(f"request timed out: {exc}") from exc
    except requests.exceptions.ConnectionError as exc:
        raise TransientRequestError(f"connection error: {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise TransientRequestError(f"request failed: {exc}") from exc

    if response.status_code in (401, 403):
        raise AuthenticationError(f"HTTP {response.status_code} from data.gov.in — check your API key")
    if response.status_code == 429 or response.status_code >= 500:
        raise TransientRequestError(f"HTTP {response.status_code} from data.gov.in")
    if response.status_code >= 400:
        raise DataGovInError(f"HTTP {response.status_code} from data.gov.in: {response.text[:300]!r}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise MalformedResponseError(f"response was not valid JSON: {exc}") from exc

    _validate_payload(payload)  # raises AuthenticationError / MalformedResponseError
    return payload


def _request_page_with_retry(
    session: requests.Session,
    resource_id: str,
    api_key: str,
    state: str,
    day: date,
    offset: int,
    page_size: int,
    timeout: float,
    max_retries: int,
    backoff_base: float,
    backoff_cap: float,
    sleep_fn: Callable[[float], None],
) -> dict:
    attempt = 0
    while True:
        attempt += 1
        try:
            return _request_page(session, resource_id, api_key, state, day, offset, page_size, timeout)
        except AuthenticationError:
            raise  # a bad key fails identically every time — retrying is pointless
        except (TransientRequestError, MalformedResponseError) as exc:
            if attempt > max_retries:
                raise DataGovInError(
                    f"giving up after {attempt} attempt(s) for {day.isoformat()} offset={offset}: {exc}"
                ) from exc
            delay = min(backoff_base * (2 ** (attempt - 1)), backoff_cap)
            sleep_fn(delay)


def _dedupe_records(records: list[dict]) -> list[dict]:
    """Collapses exact-duplicate rows (all FIELDNAMES equal) that can occur if
    pagination offsets overlap on a page boundary. Deliberately NOT a natural-key
    dedup — legitimate "duplicate lot report" rows (same market/commodity/date,
    different price) are real source data and are left for db.py's existing
    keep-last natural-key dedup at ingest time.
    """
    seen: set[tuple] = set()
    deduped = []
    for record in records:
        key = tuple(record.get(f) for f in FIELDNAMES)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(record)
    return deduped


def fetch_day(
    session: requests.Session,
    resource_id: str,
    api_key: str,
    state: str,
    day: date,
    page_size: int = DEFAULT_PAGE_SIZE,
    timeout: float = DEFAULT_READ_TIMEOUT,
    max_retries: int = DEFAULT_MAX_RETRIES,
    backoff_base: float = DEFAULT_BACKOFF_BASE,
    backoff_cap: float = DEFAULT_BACKOFF_CAP,
    rate_limiter: Optional[RateLimiter] = None,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> tuple[list[dict], int, bool]:
    """Fetches every page for one (state, day). Returns (records, reported_total, truncated).

    `truncated` is True if fewer rows were collected than the API's own `total`
    field claimed (or the MAX_PAGES_PER_DAY safety bound was hit) — callers must
    surface this rather than silently accepting a short result.
    """
    all_records: list[dict] = []
    offset = 0
    reported_total: Optional[int] = None
    page_count = 0

    while True:
        page_count += 1
        if page_count > MAX_PAGES_PER_DAY:
            total = reported_total if reported_total is not None else len(all_records)
            return _dedupe_records(all_records), total, True

        if rate_limiter is not None:
            rate_limiter.wait()

        payload = _request_page_with_retry(
            session, resource_id, api_key, state, day, offset, page_size, timeout,
            max_retries, backoff_base, backoff_cap, sleep_fn,
        )
        records = payload["records"]
        all_records.extend(records)

        total_field = payload.get("total")
        if isinstance(total_field, int):
            reported_total = total_field

        if len(records) < page_size:
            break
        offset += page_size
        if reported_total is not None and offset >= reported_total:
            break

    deduped = _dedupe_records(all_records)
    total = reported_total if reported_total is not None else len(deduped)
    truncated = reported_total is not None and len(deduped) < reported_total
    return deduped, total, truncated


def _state_slug(state: str) -> str:
    return "_".join(state.strip().lower().split())


def day_csv_path(output_dir: Path, state: str, day: date) -> Path:
    return output_dir / f"{_state_slug(state)}_{day.isoformat()}.csv"


def write_day_csv(path: Path, records: list[dict]) -> None:
    """Writes via a temp file + atomic rename so a run killed mid-write never
    leaves a half-written day file that a later resume could mistake as done.
    """
    tmp_path = path.with_name(path.name + ".tmp")
    with tmp_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore", restval="")
        writer.writeheader()
        for record in records:
            writer.writerow(record)
    tmp_path.replace(path)


def load_manifest(path: Path) -> dict:
    if not path.exists():
        return {"days": {}}
    try:
        manifest = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {"days": {}}
    manifest.setdefault("days", {})
    return manifest


def save_manifest(path: Path, manifest: dict) -> None:
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    tmp_path.replace(path)


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _parse_iso_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise SystemExit(f"[fetch] ERROR: invalid date {value!r}, expected YYYY-MM-DD") from exc


def run(args: argparse.Namespace) -> int:
    start = _parse_iso_date(args.start_date)
    end = _parse_iso_date(args.end_date)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        api_key = read_api_key(args.api_key_env)
    except AuthenticationError as exc:
        print(f"[fetch] AUTH ERROR: {exc}", file=sys.stderr)
        return 2

    manifest_path = output_dir / "manifest.json"
    manifest = load_manifest(manifest_path)
    now = _utcnow_iso()
    manifest.update({
        "resource_id": args.resource_id,
        "resource_name": DEFAULT_RESOURCE_NAME,
        "source_name": args.source_name,
        "api_base_url": API_BASE_URL,
        "state": args.state,
        "requested_start_date": args.start_date,
        "requested_end_date": args.end_date,
        "updated_at": now,
    })
    manifest.setdefault("created_at", now)

    session = requests.Session()
    rate_limiter = RateLimiter(args.min_request_interval)

    print(
        f"[fetch] state={args.state!r} range={args.start_date}..{args.end_date} "
        f"resource_id={args.resource_id} output={output_dir}"
    )

    succeeded = 0
    failed_days: list[str] = []

    for day in daterange(start, end):
        day_key = day.isoformat()
        csv_path = day_csv_path(output_dir, args.state, day)
        existing = manifest["days"].get(day_key)
        if not args.force and existing and existing.get("status") == "success" and csv_path.exists():
            print(f"[fetch] {day_key}: already fetched (row_count={existing.get('row_count')}) — skipping (--force to refetch)")
            succeeded += 1
            continue

        print(f"[fetch] {day_key}: fetching...")
        try:
            records, reported_total, truncated = fetch_day(
                session, args.resource_id, api_key, args.state, day,
                page_size=args.page_size, timeout=args.timeout,
                max_retries=args.max_retries, backoff_base=args.backoff_base, backoff_cap=args.backoff_cap,
                rate_limiter=rate_limiter,
            )
        except AuthenticationError as exc:
            print(f"[fetch] AUTH ERROR on {day_key}: {exc}", file=sys.stderr)
            print("[fetch] aborting — a bad/unauthorized key will fail identically on every remaining date.", file=sys.stderr)
            manifest["days"][day_key] = {"status": "error", "error": str(exc), "fetched_at": _utcnow_iso()}
            save_manifest(manifest_path, manifest)
            return 2
        except DataGovInError as exc:
            print(f"[fetch] {day_key}: FAILED — {exc}", file=sys.stderr)
            manifest["days"][day_key] = {"status": "error", "error": str(exc), "fetched_at": _utcnow_iso()}
            save_manifest(manifest_path, manifest)
            failed_days.append(day_key)
            continue

        write_day_csv(csv_path, records)
        manifest["days"][day_key] = {
            "status": "success",
            "row_count": len(records),
            "reported_total": reported_total,
            "truncated": truncated,
            "fetched_at": _utcnow_iso(),
        }
        save_manifest(manifest_path, manifest)
        succeeded += 1
        note = " (WARNING: truncated vs API-reported total — see manifest.json)" if truncated else ""
        print(f"[fetch] {day_key}: {len(records)} rows -> {csv_path}{note}")

    total_days = succeeded + len(failed_days)
    print("[fetch] ── summary ──────────────────────────────────────────")
    print(f"[fetch] days requested: {total_days}")
    print(f"[fetch] days succeeded: {succeeded}")
    print(f"[fetch] days failed:    {len(failed_days)}")
    if failed_days:
        print(f"[fetch] failed dates: {', '.join(failed_days)}")
        return 1
    return 0


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--state", required=True, help="State name to filter on (e.g. Telangana) — matches filters[State].")
    parser.add_argument("--start-date", required=True, help="Start date, inclusive, YYYY-MM-DD.")
    parser.add_argument("--end-date", required=True, help="End date, inclusive, YYYY-MM-DD.")
    parser.add_argument("--output", required=True, help="Directory to write one CSV per day + manifest.json into (created if missing).")
    parser.add_argument("--resource-id", default=DEFAULT_RESOURCE_ID, help=f"data.gov.in resource id. Default: {DEFAULT_RESOURCE_ID} ({DEFAULT_RESOURCE_NAME}).")
    parser.add_argument("--source-name", default=DEFAULT_SOURCE_NAME, help=f"Provenance label recorded in manifest.json. Default: {DEFAULT_SOURCE_NAME}")
    parser.add_argument("--api-key-env", default=DEFAULT_API_KEY_ENV, help=f"Env var to read the API key from. Default: {DEFAULT_API_KEY_ENV}")
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE, help=f"Records requested per page. Default: {DEFAULT_PAGE_SIZE}")
    parser.add_argument("--timeout", type=float, default=DEFAULT_READ_TIMEOUT, help=f"Per-request read timeout in seconds. Default: {DEFAULT_READ_TIMEOUT}")
    parser.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES, help=f"Max retries per page on transient failure. Default: {DEFAULT_MAX_RETRIES}")
    parser.add_argument("--backoff-base", type=float, default=DEFAULT_BACKOFF_BASE, help=f"Base delay (seconds) for exponential backoff. Default: {DEFAULT_BACKOFF_BASE}")
    parser.add_argument("--backoff-cap", type=float, default=DEFAULT_BACKOFF_CAP, help=f"Max delay (seconds) between retries. Default: {DEFAULT_BACKOFF_CAP}")
    parser.add_argument("--min-request-interval", type=float, default=DEFAULT_MIN_REQUEST_INTERVAL, help=f"Minimum seconds between requests (politeness pace — no documented limit exists). Default: {DEFAULT_MIN_REQUEST_INTERVAL}")
    parser.add_argument("--force", action="store_true", help="Re-fetch days already marked successful in manifest.json.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
