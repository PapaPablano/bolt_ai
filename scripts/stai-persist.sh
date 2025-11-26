#!/usr/bin/env bash
set -euo pipefail

EDGE_BASE_URL="${EDGE_BASE_URL:-http://127.0.0.1:54321/functions/v1}"
SYMS=("AAPL" "MSFT" "SPY")
TFS=("10m" "1h" "4h")

for s in "${SYMS[@]}"; do
  for tf in "${TFS[@]}"; do
    echo "[STAI] $s $tf"
    curl -sS "${EDGE_BASE_URL}/regimes/supertrend?symbol=${s}&tf=${tf}&atr=10&fmin=1&fmax=5&fstep=0.5&alpha=0.2&persist=1" >/dev/null
  done
done

echo "Done."
