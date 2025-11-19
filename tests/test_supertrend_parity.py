from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
  sys.path.insert(0, str(REPO_ROOT))

from backend.indicators import IndicatorEngine, SuperTrendAI

TS_RUNNER = REPO_ROOT / 'scripts' / 'supertrend_ts_runner.ts'


@dataclass
class ParityResult:
  symbol: str
  timeframe: str
  passed: bool
  raw_max_diff: float
  ama_max_diff: float
  signal_match: bool
  signal_count_py: int
  signal_count_ts: int


class SuperTrendParityTest:
  """Validates parity between Python and TypeScript SuperTrend-AI implementations."""

  def __init__(self) -> None:
    self.engine = IndicatorEngine()
    self.supertrend_ai = SuperTrendAI(perf_alpha=10, denom_span=10, from_cluster='Best', use_ama=True)
    self.test_symbols = ['AAPL', 'TSLA', 'SPY', 'NVDA', 'AMZN']
    self.test_timeframes = ['5m', '15m', '1h']
    self.atr_length = 14
    self.factor_min = 1.5
    self.factor_max = 5.0
    self.factor_steps = 7
    self.k_clusters = 3
    self.tolerance = 0.0001

  @property
  def factor_step(self) -> float:
    if self.factor_steps <= 1:
      return max(0.1, self.factor_max - self.factor_min)
    return (self.factor_max - self.factor_min) / (self.factor_steps - 1)

  def run_full_parity_test(self) -> bool:
    results: List[ParityResult] = []
    for symbol in self.test_symbols:
      for tf in self.test_timeframes:
        print(f'Testing {symbol} @ {tf}...')
        df = self.load_test_data(symbol, tf)
        py_result = self.calculate_python(df)
        ts_result = self.calculate_typescript(df)
        results.append(self.compare_outputs(py_result, ts_result, symbol, tf))
    self.generate_report(results)
    return all(result.passed for result in results)

  def load_test_data(self, symbol: str, timeframe: str) -> pd.DataFrame:
    intervals = {'5m': 300, '15m': 900, '1h': 3600}
    step = intervals[timeframe]
    points = 720
    start = pd.Timestamp('2024-01-02T14:30:00Z').value // 10**9
    seed = int(hashlib.sha256(f'{symbol}-{timeframe}'.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    base_price = {
      'AAPL': 185.0,
      'TSLA': 220.0,
      'SPY': 430.0,
      'NVDA': 470.0,
      'AMZN': 140.0,
    }.get(symbol, 100.0)
    drift_scale = {'5m': 0.6, '15m': 1.0, '1h': 2.4}[timeframe]
    returns = rng.normal(0, drift_scale, size=points)
    close = base_price + np.cumsum(returns)
    open_ = np.concatenate(([base_price], close[:-1]))
    spread = rng.uniform(0.1, 1.5, size=points)
    high = np.maximum(open_, close) + spread
    low = np.maximum(0.01, np.minimum(open_, close) - spread)
    volume = rng.integers(50_000, 2_000_000, size=points)
    times = start + np.arange(points) * step
    return pd.DataFrame({'time': times, 'open': open_, 'high': high, 'low': low, 'close': close, 'volume': volume})

  def calculate_python(self, df: pd.DataFrame) -> Dict[str, Any]:
    enriched = self.engine.calculate(df, ['atr'], {'atr': {'length': self.atr_length, 'mode': 'EMA'}})
    result = self.supertrend_ai.calculate(
      enriched,
      atr_length=self.atr_length,
      factor_min=self.factor_min,
      factor_max=self.factor_max,
      factor_steps=self.factor_steps,
      k_clusters=self.k_clusters,
    )
    return result.__dict__

  def calculate_typescript(self, df: pd.DataFrame) -> Dict[str, Any]:
    candles = df[['time', 'open', 'high', 'low', 'close', 'volume']].to_dict('records')
    payload = {
      'candles': candles,
      'params': {
        'atrSpan': self.atr_length,
        'factorMin': self.factor_min,
        'factorMax': self.factor_max,
        'factorStep': self.factor_step,
        'k': self.k_clusters,
        'fromCluster': 'Best',
        'perfAlpha': self.supertrend_ai.perf_alpha,
        'denomSpan': self.supertrend_ai.denom_span,
        'useAMA': True,
      },
    }
    proc = subprocess.run(
      ['npx', 'tsx', str(TS_RUNNER)],
      input=json.dumps(payload),
      capture_output=True,
      text=True,
      cwd=REPO_ROOT,
      check=False,
    )
    if proc.returncode != 0:
      raise RuntimeError(f'TypeScript runner failed: {proc.stderr}')
    return json.loads(proc.stdout or '{}')

  def compare_outputs(self, python_result: Dict[str, Any], ts_result: Dict[str, Any], symbol: str, timeframe: str) -> ParityResult:
    raw_py = self._line_to_array(python_result.get('raw_supertrend', []))
    raw_ts = self._line_to_array(ts_result.get('raw_supertrend', []))
    raw_diff, raw_base = self._diff_vector(raw_py, raw_ts)
    raw_passed = self._within_tolerance(raw_base, raw_diff)

    ama_py = self._line_to_array(python_result.get('ama_supertrend') or [])
    ama_ts = self._line_to_array(ts_result.get('ama_supertrend') or [])
    ama_diff, ama_base = self._diff_vector(ama_py, ama_ts)
    ama_passed = self._within_tolerance(ama_base, ama_diff)

    py_signals = self._normalize_signals(python_result.get('signals', []))
    ts_signals = self._normalize_signals(ts_result.get('signals', []))
    signal_match = py_signals == ts_signals

    passed = raw_passed and ama_passed and signal_match
    return ParityResult(
      symbol=symbol,
      timeframe=timeframe,
      passed=passed,
      raw_max_diff=float(raw_diff.max() if raw_diff.size else 0.0),
      ama_max_diff=float(ama_diff.max() if ama_diff.size else 0.0),
      signal_match=signal_match,
      signal_count_py=len(py_signals),
      signal_count_ts=len(ts_signals),
    )

  def generate_report(self, results: Sequence[ParityResult]) -> None:
    rows = [
      '<tr><th>Symbol</th><th>Timeframe</th><th>Status</th><th>Raw Max Diff</th><th>AMA Max Diff</th><th>Signal Match</th></tr>',
    ]
    for result in results:
      status = '✅ PASS' if result.passed else '❌ FAIL'
      rows.append(
        f'<tr><td>{result.symbol}</td><td>{result.timeframe}</td><td>{status}</td>'
        f'<td>{result.raw_max_diff:.6f}</td><td>{result.ama_max_diff:.6f}</td>'
        f'<td>{"✅" if result.signal_match else "❌"}</td></tr>',
      )
    html = f"""
    <html>
    <head><title>SuperTrend-AI Parity Report</title></head>
    <body>
    <h1>SuperTrend-AI Parity Test Results</h1>
    <table border="1">{''.join(rows)}</table>
    </body>
    </html>
    """
    report_path = REPO_ROOT / 'parity_report.html'
    report_path.write_text(html.strip(), encoding='utf-8')
    print(f'\nParity report saved to {report_path}')

  @staticmethod
  def _line_to_array(line: Sequence[Dict[str, Any]]) -> np.ndarray:
    values = [float(item.get('value')) if item.get('value') is not None else np.nan for item in line]
    return np.array(values, dtype=float)

  def _diff_vector(self, left: np.ndarray, right: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    length = min(len(left), len(right))
    if length == 0:
      return np.array([]), np.array([])
    mask = np.isfinite(left[:length]) & np.isfinite(right[:length])
    diff = np.abs(left[:length][mask] - right[:length][mask])
    return diff, left[:length][mask]

  def _within_tolerance(self, reference: np.ndarray, diff: np.ndarray) -> bool:
    if diff.size == 0:
      return True
    ref = np.abs(reference)
    denom = np.maximum(ref, 1e-6)
    rel = diff / denom
    return bool(np.all(rel <= self.tolerance))

  @staticmethod
  def _normalize_signals(signals: Sequence[Dict[str, Any]]) -> set[Tuple[int, float | None, int]]:
    norm = set()
    for sig in signals:
      price = sig.get('price')
      norm.add((int(sig['time']), None if price is None else round(float(price), 6), int(sig['dir'])))
    return norm


def test_supertrend_parity() -> None:
  tester = SuperTrendParityTest()
  assert tester.run_full_parity_test()


if __name__ == '__main__':
  tester = SuperTrendParityTest()
  success = tester.run_full_parity_test()
  if success:
    print('\n✅ All parity tests PASSED')
    raise SystemExit(0)
  print('\n❌ Some parity tests FAILED')
  raise SystemExit(1)
