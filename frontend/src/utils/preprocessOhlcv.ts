import { alignNYSEBucketStartUtcSec, bucketSec, toIso, toSec } from './nyseTime';
import type { Bar } from '@/types/bars';
import type { TF } from '@/types/prefs';

export type PreprocessOptions = {
  timeframe: TF;
  maxGapBuckets?: number;
  capStdDevs?: number;
};

export type PreprocessResult = {
  bars: Bar[];
  dropped: number;
  capped: number;
  gapsFilled: number;
  msgs: string[];
};

function cloneBar(b: Bar): Bar {
  return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
}

export function preprocessOhlcv(raw: Bar[], opts: PreprocessOptions): PreprocessResult {
  const msgs: string[] = [];
  if (!raw?.length) return { bars: [], dropped: 0, capped: 0, gapsFilled: 0, msgs };

  const bucket = bucketSec(opts.timeframe);
  const seen = new Set<number>();
  let dropped = 0;
  let capped = 0;
  let gapsFilled = 0;
  const cleaned: Bar[] = [];

  // sort + dedupe by aligned sec
  const sorted = [...raw].sort((a, b) => toSec(a.time) - toSec(b.time));
  for (const b of sorted) {
    const t = alignNYSEBucketStartUtcSec(toSec(b.time), opts.timeframe);
    if (seen.has(t)) {
      dropped++;
      continue;
    }
    seen.add(t);
    cleaned.push({ time: toIso(t), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 });
  }

  // zero/negative volume guard
  for (const b of cleaned) {
    if (!Number.isFinite(b.volume) || b.volume! < 0) b.volume = 0;
  }

  // simple outlier cap on OHLC using rolling mean/std (conservative)
  const capK = opts.capStdDevs ?? 6;
  if (capK > 0) {
    const closes = cleaned.map((b) => b.close);
    const mean = closes.reduce((a, v) => a + v, 0) / closes.length;
    const variance = closes.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, closes.length);
    const sd = Math.sqrt(variance);
    const loCap = mean - capK * sd;
    const hiCap = mean + capK * sd;
    for (const b of cleaned) {
      const o = b.open;
      const h = b.high;
      const l = b.low;
      const c = b.close;
      const cap = (v: number) => Math.max(loCap, Math.min(hiCap, v));
      const cappedVals = [cap(o), cap(h), cap(l), cap(c)];
      if (cappedVals.some((v, i) => v !== [o, h, l, c][i])) {
        capped++;
        b.open = cappedVals[0];
        b.high = Math.max(cappedVals[0], cappedVals[1], cappedVals[2], cappedVals[3]);
        b.low = Math.min(cappedVals[0], cappedVals[1], cappedVals[2], cappedVals[3]);
        b.close = cappedVals[3];
      }
    }
  }

  // gap detection (within session) and optional forward-fill
  const filled: Bar[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i];
    filled.push(cur);
    if (i === cleaned.length - 1) continue;
    const curSec = toSec(cur.time);
    const nextSec = toSec(cleaned[i + 1].time);
    const gapBuckets = Math.floor((nextSec - curSec) / bucket) - 1;
    if (gapBuckets > 0 && gapBuckets <= (opts.maxGapBuckets ?? 3)) {
      for (let g = 1; g <= gapBuckets; g++) {
        const ts = curSec + g * bucket;
        filled.push({
          time: toIso(ts),
          open: cur.close,
          high: cur.close,
          low: cur.close,
          close: cur.close,
          volume: 0,
        });
        gapsFilled++;
      }
    }
  }

  // NYSE session validation
  const sessionViolations: Bar[] = [];
  for (const b of filled) {
    const aligned = alignNYSEBucketStartUtcSec(toSec(b.time), opts.timeframe);
    if (aligned !== toSec(b.time)) sessionViolations.push(b);
  }
  if (sessionViolations.length) msgs.push(`Session misaligned bars: ${sessionViolations.length}`);
  if (dropped) msgs.push(`Dropped duplicates: ${dropped}`);
  if (capped) msgs.push(`Capped outliers: ${capped}`);
  if (gapsFilled) msgs.push(`Filled gaps: ${gapsFilled}`);

  return { bars: filled.map(cloneBar), dropped, capped, gapsFilled, msgs };
}

// Optional normalization for ML/backtests (not used for overlays)
export function normalizeFeatures(bars: Bar[]) {
  if (!bars.length) return [];
  const closes = bars.map((b) => b.close);
  const mean = closes.reduce((a, v) => a + v, 0) / closes.length;
  const variance = closes.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, closes.length);
  const sd = Math.sqrt(variance) || 1;
  return bars.map((b) => ({
    ...b,
    close_z: (b.close - mean) / sd,
    range_pct: (b.high - b.low) / (Math.abs(b.close) + 1e-8),
  }));
}
