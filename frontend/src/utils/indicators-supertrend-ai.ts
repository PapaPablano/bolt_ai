// SuperTrend-AI (ATR + 1D k-means over recent ATR → adaptive factor).
import type { Candle, LinePt } from './indicators-core';

export type StAiParams = { atrLen: number; minFactor: number; midFactor: number; maxFactor: number };

function atrWilder(bars: Candle[], n: number): number[] {
  if (!bars.length) return [];
  const tr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1] ?? b;
    const hl = b.high - b.low;
    const hc = Math.abs(b.high - p.close);
    const lc = Math.abs(b.low - p.close);
    tr.push(Math.max(hl, hc, lc));
  }
  const atr: number[] = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < n) {
      sum += tr[i];
      atr[i] = i === n - 1 ? sum / n : NaN;
    } else atr[i] = (atr[i - 1] * (n - 1) + tr[i]) / n;
  }
  return atr;
}

function kMeans1D(vals: number[], k = 3, iters = 50) {
  const v = vals.filter(Number.isFinite);
  if (!v.length) return { c: [0, 0, 0].slice(0, k) };
  const pct = (p: number) => {
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor((p / 100) * (s.length - 1))];
  };
  let c = [pct(20), pct(50), pct(80)].slice(0, k);
  for (let it = 0; it < iters; it++) {
    const g: number[][] = Array.from({ length: k }, () => []);
    for (const x of v) {
      let bi = 0;
      let bd = Math.abs(x - c[0]);
      for (let j = 1; j < k; j++) {
        const d = Math.abs(x - c[j]);
        if (d < bd) {
          bd = d;
          bi = j;
        }
      }
      g[bi].push(x);
    }
    const nc = c.map((_, j) => (g[j].length ? g[j].reduce((a, b) => a + b, 0) / g[j].length : c[j]));
    if (nc.every((x, i) => x === c[i])) break;
    c = nc;
  }
  c.sort((a, b) => a - b);
  return { c };
}

export type StAiBatch = { line: LinePt[]; upper: number[]; lower: number[]; dir: number[] };

export function supertrendAiSeries(bars: Candle[], p: StAiParams): StAiBatch {
  const N = bars.length;
  const atr = atrWilder(bars, p.atrLen);
  const hl2 = bars.map((b) => (b.high + b.low) / 2);
  const atrSlice = atr.slice(Math.max(0, N - 500)).filter(Number.isFinite);
  const { c } = kMeans1D(atrSlice, 3);
  const fMap = [p.minFactor, p.midFactor, p.maxFactor];

  const upper: number[] = new Array(N).fill(NaN);
  const lower: number[] = new Array(N).fill(NaN);
  const dir: number[] = new Array(N).fill(0);
  const line: LinePt[] = [];

  let trend = 0;
  let prevU = NaN;
  let prevL = NaN;
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(atr[i])) {
      line.push({ time: bars[i].time, value: NaN });
      continue;
    }
    // choose factor by nearest centroid
    let ci = 0;
    let bd = Math.abs(atr[i] - c[0]);
    for (let j = 1; j < c.length; j++) {
      const d = Math.abs(atr[i] - c[j]);
      if (d < bd) {
        bd = d;
        ci = j;
      }
    }
    const f = fMap[ci];

    const up0 = hl2[i] + f * atr[i];
    const lo0 = hl2[i] - f * atr[i];
    const up = i > 0 && Number.isFinite(prevU) ? Math.min(up0, prevU) : up0;
    const lo = i > 0 && Number.isFinite(prevL) ? Math.max(lo0, prevL) : lo0;
    prevU = up;
    prevL = lo;

    trend = trend >= 0 ? (bars[i].close > up ? 1 : bars[i].close < lo ? -1 : 1) : bars[i].close < lo ? -1 : bars[i].close > up ? 1 : -1;

    upper[i] = up;
    lower[i] = lo;
    dir[i] = trend;
    line.push({ time: bars[i].time, value: trend === 1 ? lo : up });
  }
  return { line, upper, lower, dir };
}

export type StAiState = { lastUpper: number; lastLower: number; trend: number };
export function supertrendAiStep(state: StAiState | null, hist: Candle[], cur: Candle, p: StAiParams) {
  const tail = hist.slice(-p.atrLen - 5).concat([cur]);
  const atrArr = atrWilder(tail, p.atrLen);
  const atrVal = atrArr[atrArr.length - 1];
  // choose factor from history centroids
  const { c } = kMeans1D(atrWilder(hist.slice(-500), p.atrLen).filter(Number.isFinite), 3);
  let ci = 0;
  let bd = Math.abs(atrVal - c[0]);
  for (let j = 1; j < c.length; j++) {
    const d = Math.abs(atrVal - c[j]);
    if (d < bd) {
      bd = d;
      ci = j;
    }
  }
  const f = [p.minFactor, p.midFactor, p.maxFactor][ci];
  const basis = (cur.high + cur.low) / 2;
  const up0 = basis + f * atrVal;
  const lo0 = basis - f * atrVal;
  const up = state ? Math.min(up0, state.lastUpper) : up0;
  const lo = state ? Math.max(lo0, state.lastLower) : lo0;
  let trend = state?.trend ?? 0;
  trend = trend >= 0 ? (cur.close > up ? 1 : cur.close < lo ? -1 : 1) : cur.close < lo ? -1 : cur.close > up ? 1 : -1;
  return { nextState: { lastUpper: up, lastLower: lo, trend }, point: { time: cur.time, value: trend === 1 ? lo : up } };
}
