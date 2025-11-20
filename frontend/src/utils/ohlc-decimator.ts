export type Ohlc = { time: number; open: number; high: number; low: number; close: number; volume?: number };

// OHLC-aware visible-range decimator. Preserves O/H/L/C by aggregating per bucket.
// Use this for candlestick series. Use LTTB helper ONLY for single-value line overlays.
type DownsampleOptions = {
  origin?: number;
  devicePixelRatio?: number;
  sessionBoundary?: (start: number, end: number) => number | null;
};

export function downsampleOhlcVisible(
  data: Ohlc[],
  visibleFromMs: number,
  visibleToMs: number,
  containerPx: number,
  pointsPerPx = 1.6,
  options: DownsampleOptions = {},
): Ohlc[] {
  if (!data.length) return [];
  const from = Math.max(visibleFromMs, data[0].time);
  const to = Math.min(visibleToMs, data[data.length - 1].time);
  if (!(to > from)) return [];

  const dpr = options.devicePixelRatio && options.devicePixelRatio > 0
    ? options.devicePixelRatio
    : typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio || 1
      : 1;
  const budget = Math.max(200, Math.ceil(containerPx * dpr * pointsPerPx));
  const span = to - from;
  if (span <= 0 || data.length <= budget) {
    return data;
  }

  const bucketMs = Math.ceil(span / budget);
  const origin = options.origin ?? from;

  const out: Ohlc[] = [];
  let i = lowerBoundByTime(data, from);
  while (i < data.length && data[i].time <= to) {
    const bucketStart = bucketStartFromOrigin(data[i].time, bucketMs, origin);
    let bucketEnd = bucketStart + bucketMs;
    const guardedEnd = options.sessionBoundary?.(bucketStart, bucketEnd);
    if (guardedEnd != null && guardedEnd > bucketStart) {
      bucketEnd = Math.min(bucketEnd, guardedEnd);
    }
    if (!(bucketEnd > bucketStart)) {
      i++;
      continue;
    }

    let open: number | undefined;
    let close: number | undefined;
    let high = -Infinity;
    let low = Infinity;
    let vol = 0;

    const startIdx = i;
    while (i < data.length && data[i].time < bucketEnd) {
      const b = data[i];
      if (open === undefined) open = b.open;
      high = Math.max(high, b.high);
      low = Math.min(low, b.low);
      close = b.close;
      vol += b.volume ?? 0;
      i++;
    }

    if (open === undefined || close === undefined) {
      const fallback = data[startIdx];
      if (!fallback) break;
      open = fallback.open;
      high = Math.max(high, fallback.high);
      low = Math.min(low, fallback.low);
      close = fallback.close;
      vol += fallback.volume ?? 0;
      i = Math.max(i, startIdx + 1);
    }

    out.push({
      time: bucketStart,
      open,
      high,
      low,
      close,
      volume: vol,
    });
  }

  const last = out[out.length - 1];
  if (!last || last.time < to) {
    const j = upperBoundByTime(data, to) - 1;
    if (j >= 0) {
      const b = data[j];
      if (!last || last.time !== b.time) out.push(b);
    }
  }

  return out;
}

function bucketStartFromOrigin(ts: number, bucketSize: number, origin: number) {
  if (!Number.isFinite(bucketSize) || bucketSize <= 0) return ts;
  return origin + Math.floor((ts - origin) / bucketSize) * bucketSize;
}

function lowerBoundByTime(a: Ohlc[], t: number) {
  let l = 0;
  let r = a.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (a[m].time < t) l = m + 1;
    else r = m;
  }
  return l;
}

function upperBoundByTime(a: Ohlc[], t: number) {
  let l = 0;
  let r = a.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (a[m].time <= t) l = m + 1;
    else r = m;
  }
  return l;
}
