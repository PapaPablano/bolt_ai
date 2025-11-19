import { alignNYSEBucketStartUtcSec, bucketSec, type TF } from '@/utils/nyseTime';

export type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

/** Normalize historical bars for TradingView (ms timestamps, bucket start alignment, dedupe, fill). */
export function normalizeForTV(raw: Bar[], tf: TF): Bar[] {
  if (!raw?.length) return [];
  const step = bucketSec(tf);
  const src = [...raw].sort((a, b) => a.time - b.time);

  const out: Bar[] = [];
  let lastStart = -1;

  for (const bar of src) {
    const srcSec = bar.time > 1e12 ? Math.floor(bar.time / 1000) : Math.floor(bar.time);
    const tStart = alignNYSEBucketStartUtcSec(srcSec, tf);
    if (out.length && tStart === lastStart) {
      const prev = out[out.length - 1];
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      prev.volume = (prev.volume ?? 0) + (bar.volume ?? 0);
      continue;
    }

    if (lastStart > 0 && tStart > lastStart + step && out.length) {
      let fill = lastStart + step;
      const prev = out[out.length - 1];
      while (fill < tStart) {
        out.push({ time: fill * 1000, open: prev.close, high: prev.close, low: prev.close, close: prev.close, volume: 0 });
        fill += step;
      }
    }

    out.push({ time: tStart * 1000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    lastStart = tStart;
  }

  return out;
}
