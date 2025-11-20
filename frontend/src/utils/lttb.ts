export type XY = { time: number; value: number };

export interface DataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Lightweight Largest Triangle Three Buckets decimator that works with arbitrary
 * numeric keys. Returns a copy of the data when the threshold exceeds the length.
 */
export function decimateLTTB<T extends Record<string, number>>(
  data: T[],
  threshold: number,
  xKey: keyof T = 'time',
  yKey: keyof T = 'close',
): T[] {
  const n = data.length;
  if (!n || threshold >= n || threshold <= 0) return data.slice();

  const out: T[] = [];
  let a = 0;
  out.push(data[a]);

  const bucketSize = (n - 2) / (threshold - 2);
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const bucket = data.slice(rangeStart, Math.min(rangeEnd, n - 1));

    const nextStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextEnd = Math.floor((i + 3) * bucketSize) + 1;
    const nextRange = data.slice(nextStart, Math.min(nextEnd, n));

    let avgX = 0;
    let avgY = 0;
    const denom = Math.max(1, nextRange.length);
    for (const p of nextRange) {
      avgX += (p[xKey] as number) ?? 0;
      avgY += (p[yKey] as number) ?? 0;
    }
    avgX /= denom;
    avgY /= denom;

    let maxArea = -1;
    let candidate = bucket[0] ?? data[Math.min(a + 1, n - 1)];

    for (const point of bucket) {
      const ax = data[a][xKey] as number;
      const ay = data[a][yKey] as number;
      const px = point[xKey] as number;
      const py = point[yKey] as number;
      const area = Math.abs((ax - avgX) * (py - ay) - (ax - px) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        candidate = point;
      }
    }

    out.push(candidate);
    a = data.indexOf(candidate);
  }

  out.push(data[n - 1]);
  return out;
}

export function lttbDownsample(data: DataPoint[], threshold = 5000): DataPoint[] {
  return decimateLTTB(data, threshold, 'time', 'close');
}

const dedupeByTime = <T extends { time: number }>(pts: T[]): T[] => {
  const map = new Map<number, T>();
  for (const pt of pts) {
    map.set(pt.time, pt);
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

const sampleSegment = (segment: DataPoint[], budget: number) => {
  if (!segment.length || budget <= 0) return [];
  if (segment.length <= budget) return segment.slice();
  if (budget < 3) return [segment[0], segment[segment.length - 1]];
  return lttbDownsample(segment, budget);
};

export function decimateForVisibleRange(
  allData: DataPoint[],
  visibleRange: { from: number; to: number } | null,
  maxPoints = 5000,
  focusRatio = 0.65,
): DataPoint[] {
  if (!Array.isArray(allData) || !allData.length) return [];
  if (allData.length <= maxPoints || !visibleRange) return lttbDownsample(allData, Math.max(3, maxPoints));

  const ordered = allData.slice().sort((a, b) => a.time - b.time);
  const totalBudget = Math.max(3, maxPoints);
  const focusBudget = Math.max(1, Math.floor(totalBudget * focusRatio));
  const ambientBudget = Math.max(0, totalBudget - focusBudget);
  const leftBudget = Math.floor(ambientBudget / 2);
  const rightBudget = ambientBudget - leftBudget;

  const visible = ordered.filter((pt) => pt.time >= visibleRange.from && pt.time <= visibleRange.to);
  const left = ordered.filter((pt) => pt.time < visibleRange.from);
  const right = ordered.filter((pt) => pt.time > visibleRange.to);

  const focus = sampleSegment(visible, focusBudget);
  const leftSample = sampleSegment(left, leftBudget);
  const rightSample = sampleSegment(right, rightBudget);

  const merged = dedupeByTime([...leftSample, ...focus, ...rightSample]);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  if (!merged.length || merged[0].time !== first.time) merged.unshift(first);
  if (merged[merged.length - 1].time !== last.time) merged.push(last);

  return merged;
}
