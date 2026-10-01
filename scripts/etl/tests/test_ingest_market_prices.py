import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest_market_prices import run  # noqa: E402

CSV_HEADER = "State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price,Commodity_Code\n"

# 2 Telangana rows + 3 non-Telangana rows, so total source rows (5) and
# state-matched rows (2) are deliberately different — a regression test for
# the bug where total_read was incremented AFTER the state filter, making it
# equal to the matched count instead of the true number of source rows scanned.
MIXED_STATE_ROWS = (
    "Telangana,Warangal,Warangal,Tomato,Local,FAQ,2025-06-01,1000,1200,1100,78\n"
    "Kerala,Kottayam,Pampady Market,Brinjal,Brinjal,FAQ,2025-06-01,5000,6500,6000,23\n"
    "Telangana,Karimnagar,Karimnagar,Onion,NO 1,FAQ,2025-06-02,1500,1800,1650,23\n"
    "Tamil Nadu,The Nilgiris,Gudalur,Garlic,Average,Local,2025-06-01,28000,30000,29000,25\n"
    "Punjab,Ludhiana,Ludhiana,Wheat,NO 2,FAQ,2025-06-01,2000,2200,2100,2\n"
)


def make_args(source_path: Path, **overrides) -> argparse.Namespace:
    defaults = dict(
        source=str(source_path),
        state="Telangana",
        source_label="test-source",
        batch_size=5000,
        dry_run=True,
        limit=None,
    )
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


def test_total_read_counts_all_source_rows_not_just_state_matches(tmp_path, capsys):
    csv_path = tmp_path / "mixed.csv"
    csv_path.write_text(CSV_HEADER + MIXED_STATE_ROWS)

    exit_code = run(make_args(csv_path))

    assert exit_code == 0
    out = capsys.readouterr().out
    # 5 source rows total, only 2 of which are Telangana — total_read must
    # reflect the 5 rows actually scanned, not the 2 matched rows.
    assert "source rows scanned (all states): 5" in out
    assert "rows read (matching state):  2" in out


def test_limit_stops_after_source_rows_scanned_not_matched_rows(tmp_path, capsys):
    csv_path = tmp_path / "mixed.csv"
    csv_path.write_text(CSV_HEADER + MIXED_STATE_ROWS)

    # With the pre-fix bug, total_read only counted matched (Telangana) rows,
    # so a limit of 3 would never trip within these 5 rows (only 2 match) and
    # the whole file would be scanned. With the fix, total_read counts all 5
    # source rows read via the single chunk, so the loop stops after that one
    # chunk (batch_size=5000 means everything is read in one chunk here) —
    # the meaningful assertion is that the reported source-rows-scanned count
    # honestly reflects rows read from the file, not the matched subset.
    exit_code = run(make_args(csv_path, limit=3))

    assert exit_code == 0
    out = capsys.readouterr().out
    assert "source rows scanned (all states): 5" in out
