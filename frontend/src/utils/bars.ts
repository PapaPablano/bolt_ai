import { alignNYSEBucketStartUtcSec, bucketSec } from '@/utils/nyseTime';
import type { TF } from '@/types/prefs';

export type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

/** Sort, align to NYSE buckets, dedupe same-bucket bars by merging O/H/L/C, and optionally fill holes. */
export function normalizeHistoricalBars(raw: Bar[], tf: TF): Bar[] {
  if (!raw?.length) return [];
  const step = bucketSec(tf);
  const src = [...raw].sort((a, b) => a.time - b.time);
  const out: Bar[] = [];
  let lastT = -1;

  for (const b of src) {
    const t = alignNYSEBucketStartUtcSec(b.time, tf);

    if (out.length && t === lastT) {
      const prev = out[out.length - 1];
      prev.high = Math.max(prev.high, b.high);
      prev.low = Math.min(prev.low, b.low);
      prev.close = b.close;
      prev.volume = (prev.volume ?? 0) + (b.volume ?? 0);
      continue;
    }

    if (lastT > 0 && t > lastT + step && out.length) {
      let fill = lastT + step;
      const prev = out[out.length - 1];
      while (fill < t) {
        out.push({ time: fill, open: prev.close, high: prev.close, low: prev.close, close: prev.close, volume: 0 });
        fill += step;
      }
    }

    out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
    lastT = t;
  }

  return out;
}
