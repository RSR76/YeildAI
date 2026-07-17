#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$REPO_ROOT/data"
CSV_FILE="$DATA_DIR/forecast_lookup_all_commodities.csv"
CSV_URL="https://github.com/RSR76/YeildAI/releases/download/forecast-data-v1/forecast_lookup_all_commodities.csv"

mkdir -p "$DATA_DIR"

if [ -f "$CSV_FILE" ]; then
  echo "Forecast data already present at $CSV_FILE, skipping download."
  exit 0
fi

echo "Downloading forecast data to $CSV_FILE..."

if ! curl -fL --retry 3 -o "$CSV_FILE.tmp" "$CSV_URL"; then
  rm -f "$CSV_FILE.tmp"
  echo "ERROR: Failed to download forecast data from $CSV_URL" >&2
  echo "Check your network connection and that the release asset still exists, then re-run this script." >&2
  exit 1
fi

mv "$CSV_FILE.tmp" "$CSV_FILE"
echo "Forecast data downloaded successfully."
