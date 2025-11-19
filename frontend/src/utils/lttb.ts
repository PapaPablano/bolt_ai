export interface DataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Largest Triangle Three Buckets (LTTB) downsampling.
 * Preserves overall visual shape while reducing the number of points rendered.
 * Based on Sveinn Steinarsson's 2013 thesis.
 */
export function lttbDownsample(data: DataPoint[], threshold = 5000): DataPoint[] {
  if (!Array.isArray(data) || data.length <= threshold || threshold < 3) return data;

  const sampled: DataPoint[] = [];
  sampled.push(data[0]);

  const bucketSize = (data.length - 2) / (threshold - 2);
  const lastIndex = data.length - 1;
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    const avgRangeLength = Math.max(avgRangeEnd - avgRangeStart, 1);

    let avgX = 0;
    let avgY = 0;
    if (avgRangeLength <= 1) {
      const idx = Math.min(avgRangeStart, lastIndex);
      avgX = data[idx].time;
      avgY = data[idx].close;
    } else {
      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += data[j].time;
        avgY += data[j].close;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
    }

    const rangeStart = Math.min(Math.max(Math.floor(i * bucketSize) + 1, 1), lastIndex - 1);
    const rangeEnd = Math.min(Math.max(Math.floor((i + 1) * bucketSize) + 1, rangeStart + 1), lastIndex - 1);

    const pointA = data[a];
    let maxArea = -1;
    let maxAreaPoint = rangeStart;

    for (let j = rangeStart; j <= rangeEnd; j++) {
      const point = data[j];
      const area =
        Math.abs((pointA.time - avgX) * (point.close - pointA.close) - (pointA.time - point.time) * (avgY - pointA.close)) *
        0.5;
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = j;
      }
    }

    sampled.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }

  sampled.push(data[lastIndex]);
  return sampled;
}

export function decimateForVisibleRange(
  allData: DataPoint[],
  visibleRange: { from: number; to: number } | null,
  maxPoints = 5000,
): DataPoint[] {
  if (!visibleRange || visibleRange.to < visibleRange.from) return allData;
  const visible = allData.filter((d) => d.time >= visibleRange.from && d.time <= visibleRange.to);
  if (visible.length === 0) return [];
  return lttbDownsample(visible, maxPoints);
}
