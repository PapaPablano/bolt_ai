from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal, Sequence

import numpy as np
import pandas as pd

EPS = 1e-12


def _alpha_from(value: float) -> float:
  return 2.0 / (value + 1.0) if value > 1 else max(0.001, min(0.999, value))


def _to_python_value(value: float) -> float | None:
  return float(value) if np.isfinite(value) else None


def _linspace(min_val: float, max_val: float, steps: int) -> np.ndarray:
  if steps <= 1:
    return np.array([min_val], dtype=float)
  return np.linspace(min_val, max_val, steps, dtype=float)


@dataclass
class SuperTrendAIResult:
  raw_supertrend: List[Dict[str, float | None]]
  ama_supertrend: List[Dict[str, float | None]] | None
  direction: List[int]
  signals: List[Dict[str, float | int]]
  factor: float


class SuperTrendAI:
  """Python mirror of the frontend SuperTrend-AI implementation."""

  def __init__(self, perf_alpha: float = 10, denom_span: float = 10, from_cluster: Literal['Best', 'Average', 'Worst'] = 'Best', use_ama: bool = True):
    self.perf_alpha = perf_alpha
    self.denom_span = denom_span
    self.from_cluster = from_cluster
    self.use_ama = use_ama

  def calculate(
    self,
    df: pd.DataFrame,
    atr_length: int = 14,
    factor_min: float = 1.5,
    factor_max: float = 5.0,
    factor_steps: int = 5,
    k_clusters: int = 3,
  ) -> SuperTrendAIResult:
    if df.empty:
      return SuperTrendAIResult(raw_supertrend=[], ama_supertrend=[], direction=[], signals=[], factor=float('nan'))

    frame = df.sort_values('time').reset_index(drop=True)
    time = frame['time'].to_numpy(dtype=int)
    high = frame['high'].to_numpy(dtype=float)
    low = frame['low'].to_numpy(dtype=float)
    close = frame['close'].to_numpy(dtype=float)
    atr = frame.get('atr')
    if atr is None:
      raise ValueError('DataFrame must include ATR values. Call IndicatorEngine first.')
    atr_arr = np.asarray(atr, dtype=float)

    candidates = _linspace(factor_min, factor_max, max(1, int(factor_steps)))
    lines: List[np.ndarray] = []
    dirs: List[np.ndarray] = []
    perfs: List[float] = []

    for factor in candidates:
      line, direction = self._supertrend_bands(time, high, low, close, atr_arr, factor)
      lines.append(line)
      dirs.append(direction)
      perfs.append(self._perf_for_factor(close, line))

    labels = self._kmeans(perfs, max(1, int(k_clusters)))
    groups = self._group_clusters(labels, perfs)
    scored = sorted(groups, key=lambda row: row['mean'])

    pick = self.from_cluster
    if pick == 'Worst':
      chosen = scored[0]
    elif pick == 'Average':
      chosen = scored[len(scored) // 2]
    else:
      chosen = scored[-1]

    idx = self._select_factor_index(chosen, perfs, pick)
    factor = float(round(candidates[idx], 6))
    line = lines[idx]
    direction = dirs[idx]
    raw = self._format_line(time, line)
    ama = self._compute_ama(time, line, close, chosen['mean']) if self.use_ama else None
    signals = self._signals(time, line, direction)

    return SuperTrendAIResult(
      raw_supertrend=raw,
      ama_supertrend=ama,
      direction=direction.astype(int).tolist(),
      signals=signals,
      factor=factor,
    )

  @staticmethod
  def _supertrend_bands(time: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray, atr: np.ndarray, factor: float) -> tuple[np.ndarray, np.ndarray]:
    n = len(time)
    line = np.full(n, np.nan)
    direction = np.zeros(n, dtype=int)
    prev_upper = np.nan
    prev_lower = np.nan
    trend = 0
    for i in range(n):
      if not np.isfinite(atr[i]):
        continue
      basis = (high[i] + low[i]) / 2.0
      up0 = basis + factor * atr[i]
      lo0 = basis - factor * atr[i]
      up = up0 if not np.isfinite(prev_upper) else min(up0, prev_upper)
      lo = lo0 if not np.isfinite(prev_lower) else max(lo0, prev_lower)
      prev_upper = up
      prev_lower = lo

      if trend >= 0:
        trend = 1 if close[i] > up else -1 if close[i] < lo else 1
      else:
        trend = -1 if close[i] < lo else 1 if close[i] > up else -1

      direction[i] = trend
      line[i] = lo if trend == 1 else up
    return line, direction

  def _perf_for_factor(self, close: np.ndarray, line: np.ndarray) -> float:
    alpha = _alpha_from(self.perf_alpha)
    perf = 0.0
    for i in range(1, len(close)):
      prev_line = line[i - 1]
      anchor = close[i - 1] if not np.isfinite(prev_line) else prev_line
      bias = np.sign(close[i - 1] - anchor) if np.isfinite(anchor) else 1.0
      delta = close[i] - close[i - 1]
      instant = delta if bias == 0 else delta * bias
      perf = perf + alpha * (instant - perf)
    return perf

  @staticmethod
  def _kmeans(values: Sequence[float], k: int) -> List[int]:
    if not values:
      return []
    arr = np.asarray(values, dtype=float)
    seeds = np.percentile(arr, [25, 50, 75][:k])
    centroids = np.atleast_1d(np.array(seeds, dtype=float))
    labels = np.zeros(len(arr), dtype=int)
    for _ in range(40):
      changed = False
      for i, val in enumerate(arr):
        dists = np.abs(centroids - val)
        best = int(np.argmin(dists))
        if labels[i] != best:
          labels[i] = best
          changed = True
      if not changed:
        break
      for j in range(len(centroids)):
        cluster = arr[labels == j]
        if cluster.size:
          centroids[j] = float(cluster.mean())
    return labels.tolist()

  @staticmethod
  def _group_clusters(labels: List[int], perfs: Sequence[float]) -> List[Dict]:
    groups: Dict[int, List[int]] = {}
    for idx, label in enumerate(labels):
      groups.setdefault(label, []).append(idx)
    out = []
    for label, members in groups.items():
      mean = float(np.mean([perfs[i] for i in members])) if members else 0.0
      out.append({'label': label, 'idxs': members, 'mean': mean})
    return out or [{'label': 0, 'idxs': list(range(len(perfs))), 'mean': float(np.mean(perfs) if perfs else 0.0)}]

  @staticmethod
  def _select_factor_index(group: Dict, perfs: Sequence[float], pick: str) -> int:
    idxs = group['idxs']
    if pick == 'Best':
      return max(idxs, key=lambda i: perfs[i])
    if pick == 'Worst':
      return min(idxs, key=lambda i: perfs[i])
    target = group['mean']
    return min(idxs, key=lambda i: abs(perfs[i] - target))

  @staticmethod
  def _format_line(time: np.ndarray, line: np.ndarray) -> List[Dict[str, float | None]]:
    return [{'time': int(t), 'value': _to_python_value(v)} for t, v in zip(time, line)]

  def _compute_ama(self, time: np.ndarray, line: np.ndarray, close: np.ndarray, cluster_mean: float) -> List[Dict[str, float | None]]:
    abs_diff = np.empty_like(close)
    abs_diff[0] = np.nan
    abs_diff[1:] = np.abs(close[1:] - close[:-1])
    denom_alpha = _alpha_from(self.denom_span)
    denom = pd.Series(abs_diff).ewm(alpha=denom_alpha, adjust=False).mean().to_numpy()
    denom_last = denom[-1] if np.isfinite(denom[-1]) else 1.0
    perf_idx = max(0.0, cluster_mean) / (denom_last + EPS)
    ama_alpha = min(0.9, max(0.02, perf_idx))
    out: List[Dict[str, float | None]] = []
    for idx, (t, raw_val) in enumerate(zip(time, line)):
      if not np.isfinite(raw_val):
        out.append({'time': int(t), 'value': None})
        continue
      prev = raw_val if idx == 0 or not np.isfinite(line[idx - 1]) else line[idx - 1]
      value = prev + ama_alpha * (raw_val - prev)
      out.append({'time': int(t), 'value': float(value)})
    return out

  @staticmethod
  def _signals(time: np.ndarray, line: np.ndarray, direction: np.ndarray) -> List[Dict[str, float | int]]:
    signals: List[Dict[str, float | int]] = []
    for i in range(1, len(time)):
      if direction[i] != direction[i - 1] and direction[i - 1] != 0:
        signals.append({'time': int(time[i]), 'price': _to_python_value(line[i]), 'dir': 1 if direction[i] > 0 else -1})
    return signals
