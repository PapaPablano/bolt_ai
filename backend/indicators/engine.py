from __future__ import annotations

from typing import Dict, Iterable

import numpy as np
import pandas as pd


def _true_range(df: pd.DataFrame) -> np.ndarray:
  high = df['high'].to_numpy(dtype=float)
  low = df['low'].to_numpy(dtype=float)
  close = df['close'].to_numpy(dtype=float)
  prev_close = np.roll(close, 1)
  prev_close[0] = close[0]
  hl = high - low
  hc = np.abs(high - prev_close)
  lc = np.abs(low - prev_close)
  return np.maximum.reduce([hl, hc, lc])


def _ewm(series: np.ndarray, alpha: float) -> np.ndarray:
  return pd.Series(series).ewm(alpha=alpha, adjust=False).mean().to_numpy()


class IndicatorEngine:
  """Lightweight indicator calculator used by regression tests."""

  def calculate(self, df: pd.DataFrame, indicators: Iterable[str], params: Dict[str, Dict] | None = None) -> pd.DataFrame:
    params = params or {}
    out = df.copy()
    for name in indicators:
      if name.lower() == 'atr':
        cfg = params.get('atr', {})
        length = int(cfg.get('length', 14))
        mode = str(cfg.get('mode', 'EMA')).upper()
        out['atr'] = self._atr(out, length, mode)
      else:
        raise ValueError(f'Unsupported indicator: {name}')
    return out

  @staticmethod
  def _atr(df: pd.DataFrame, length: int, mode: str) -> np.ndarray:
    if length <= 0:
      raise ValueError('ATR length must be positive')
    tr = _true_range(df)
    alpha = 2.0 / (length + 1.0) if mode == 'EMA' else 1.0 / float(length)
    return _ewm(tr, alpha)
