// Core bar shape used by AdvancedCandleChart (numeric seconds since epoch).
export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/**
 * Normalize historical bars for the internal chart model.
 *
 * Responsibilities:
 * - sort by time ascending
 * - drop bars with non-finite time
 * - merge duplicate timestamps by expanding high/low, using latest close, and summing volume
 *
 * More advanced bucket alignment and gap-filling is handled upstream (preprocessOhlcv),
 * so this function is intentionally conservative.
 */
export function normalizeHistoricalBars(raw: Bar[]): Bar[] {
  if (!raw?.length) return [];

  const sorted = [...raw].sort((a, b) => a.time - b.time);
  const out: Bar[] = [];
  let lastTime = Number.NEGATIVE_INFINITY;

  for (const bar of sorted) {
    if (!Number.isFinite(bar.time)) continue;

    if (bar.time === lastTime && out.length) {
      // Merge into the previous bar at the same timestamp.
      const prev = out[out.length - 1];
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      if (bar.volume !== undefined) {
        prev.volume = (prev.volume ?? 0) + bar.volume;
      }
      continue;
    }

    out.push({ ...bar });
    lastTime = bar.time;
  }

  return out;
}
