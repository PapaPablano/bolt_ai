#!/usr/bin/env python3
"""
CLI wrapper around backend.indicators.SuperTrendAI for parity checks.
Reads JSON payload from stdin: { "candles": [...], "params": {...} }.
Outputs JSON with raw/AMA lines and signals.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
  sys.path.insert(0, str(REPO_ROOT))

from backend.indicators import IndicatorEngine, SuperTrendAI


def load_payload() -> Dict[str, Any]:
  data = sys.stdin.read()
  return json.loads(data or '{}')


def main() -> None:
  payload = load_payload()
  candles = payload.get('candles', [])
  params = payload.get('params', {})
  if not candles:
    print(json.dumps({'raw_supertrend': [], 'ama_supertrend': [], 'signals': [], 'factor': None}))
    return

  frame = pd.DataFrame(candles).sort_values('time').reset_index(drop=True)
  atr_span = int(params.get('atrSpan', 14))
  atr_mode = params.get('atrMode', 'EMA')
  engine = IndicatorEngine()
  frame = engine.calculate(frame, ['atr'], {'atr': {'length': atr_span, 'mode': atr_mode}})

  factor_min = float(params.get('factorMin', 1.5))
  factor_max = float(params.get('factorMax', 5.0))
  factor_step = float(params.get('factorStep', 0.5))
  steps = max(1, int(round((factor_max - factor_min) / max(factor_step, 1e-9))) + 1)

  st = SuperTrendAI(
    perf_alpha=params.get('perfAlpha', 10),
    denom_span=params.get('denomSpan', 10),
    from_cluster=params.get('fromCluster', 'Best'),
    use_ama=bool(params.get('useAMA', False)),
  )
  result = st.calculate(
    frame,
    atr_length=atr_span,
    factor_min=factor_min,
    factor_max=factor_max,
    factor_steps=steps,
    k_clusters=int(params.get('k', 3)),
  )
  print(json.dumps(result.__dict__))


if __name__ == '__main__':
  main()
