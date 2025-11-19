// frontend/src/utils/indicators-supertrend-perf.ts
// SuperTrend-AI (clustered) aligned to LuxAlgo/Python: Wilder ATR (default), classic trailing bands,
// recent-window clustering, best-in-cluster selection, flip-gated reselection, optional AMA.

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type LinePt = { time: number; value: number };
export type Signal = { time: number; price: number; dir: 1 | -1 };

export type StPerfParams = {
  atrSpan: number; // ATR length (e.g. 10 or 14)
  atrMode?: 'RMA' | 'EMA'; // default RMA to match LuxAlgo/Python
  factorMin: number;
  factorMax: number;
  factorStep: number;
  k?: 3 | 2;
  fromCluster?: 'Best' | 'Average' | 'Worst';
  perfAlpha?: number; // >1 => span; else alpha (EMA form)
  perfLookback?: number; // bars used for clustering (e.g. 1000). Default: all available (capped at 1500)
  minClusterSize?: number; // fallback to global best if cluster too small (default 2)
  // AMA options
  useAMA?: boolean;
  denomSpan?: number; // AMA normalization window for perf index
  // Reselection timing
  applyImmediateOnFlip?: boolean; // default false (apply next bar)
  // Stabilization
  seedFactor?: number; // optional initial factor before first reselection
};

const EPS = 1e-12;

// --- utils -------------------------------------------------------------------

const alphaFrom = (perfAlpha = 10) => (perfAlpha > 1 ? 2 / (perfAlpha + 1) : Math.max(0.001, Math.min(0.999, perfAlpha)));

function ewm(values: number[], alpha: number) {
  const out: number[] = new Array(values.length).fill(NaN);
  let s: number | undefined;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = s ?? NaN;
      continue;
    }
    s = s === undefined ? v : s + alpha * (v - s);
    out[i] = s;
  }
  return out;
}

function rma(values: number[], length: number) {
  if (length <= 1) return values.slice();
  const out = new Array<number>(values.length).fill(NaN);
  const alpha = 1 / length; // Wilder
  let s: number | undefined;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = s ?? NaN;
      continue;
    }
    s = s === undefined ? v : s * (1 - alpha) + v * alpha;
    out[i] = s;
  }
  return out;
}

function trueRange(bars: Candle[]) {
  const tr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1] ?? b;
    tr.push(Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)));
  }
  return tr;
}

function atrSeries(bars: Candle[], span: number, mode: 'RMA' | 'EMA' = 'RMA') {
  const tr = trueRange(bars);
  return mode === 'RMA' ? rma(tr, span) : ewm(tr, alphaFrom(span));
}

// Classic SuperTrend final band trailing using previous close conditions.
function supertrendBandsClassic(bars: Candle[], atr: number[], factor: number) {
  const N = bars.length;
  const upper = new Array<number>(N).fill(NaN);
  const lower = new Array<number>(N).fill(NaN);
  const fupper = new Array<number>(N).fill(NaN);
  const flower = new Array<number>(N).fill(NaN);
  const dir = new Array<number>(N).fill(0);
  const line: LinePt[] = new Array<LinePt>(N);

  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(atr[i])) {
      line[i] = { time: bars[i].time, value: NaN };
      continue;
    }
    const hl2 = (bars[i].high + bars[i].low) / 2;
    upper[i] = hl2 + factor * atr[i];
    lower[i] = hl2 - factor * atr[i];

    if (i === 0) {
      fupper[i] = upper[i];
      flower[i] = lower[i];
      dir[i] = 1;
      line[i] = { time: bars[i].time, value: flower[i] };
      continue;
    }

    // Trailing: compare to prior close, not unconditional min/max
    fupper[i] = bars[i - 1].close > fupper[i - 1] ? upper[i] : Math.min(upper[i], fupper[i - 1]);
    flower[i] = bars[i - 1].close < flower[i - 1] ? lower[i] : Math.max(lower[i], flower[i - 1]);

    // Trend flip rules
    if (dir[i - 1] >= 0) {
      dir[i] = bars[i].close > fupper[i] ? 1 : bars[i].close < flower[i] ? -1 : 1;
    } else {
      dir[i] = bars[i].close < flower[i] ? -1 : bars[i].close > fupper[i] ? 1 : -1;
    }

    line[i] = { time: bars[i].time, value: dir[i] === 1 ? flower[i] : fupper[i] };
  }
  return { upper: fupper, lower: flower, dir, line };
}

function kmeans1D(vals: number[], k = 3) {
  const v = vals.slice().sort((a, b) => a - b);
  if (!v.length) return { centroids: [0, 0, 0].slice(0, k), labels: vals.map(() => 0) };
  const pick = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor((p / 100) * (v.length - 1))))];
  // simple percentile seeding (kmeans++ not needed in 1D for this)
  const c = [pick(25), pick(50), pick(75)].slice(0, k);
  const labels = new Array(vals.length).fill(0);
  for (let it = 0; it < 40; it++) {
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      const x = vals[i];
      let best = 0,
        bd = Math.abs(x - c[0]);
      for (let j = 1; j < c.length; j++) {
        const d = Math.abs(x - c[j]);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        changed = true;
      }
    }
    const sums = new Array(c.length).fill(0),
      cnt = new Array(c.length).fill(0);
    for (let i = 0; i < vals.length; i++) {
      sums[labels[i]] += vals[i];
      cnt[labels[i]]++;
    }
    for (let j = 0; j < c.length; j++) if (cnt[j]) c[j] = sums[j] / cnt[j];
    if (!changed) break;
  }
  return { centroids: c, labels };
}

// LuxAlgo-like performance metric: EWMA of (Δclose * sign(close - ST))
function perfForFactor(bars: Candle[], line: LinePt[], alpha: number, startIdx = 1) {
  let perf = 0;
  for (let i = Math.max(1, startIdx); i < bars.length; i++) {
    const dc = bars[i].close - bars[i - 1].close;
    const bias = Math.sign(bars[i - 1].close - (line[i - 1]?.value ?? bars[i - 1].close));
    const instant = dc * (bias === 0 ? 1 : bias);
    perf = perf + alpha * (instant - perf);
  }
  return perf;
}

export type StPerfBatch = {
  factor: number;
  raw: LinePt[];
  ama?: LinePt[];
  signals: Signal[];
};

export function supertrendPerfSeries(bars: Candle[], p: StPerfParams): StPerfBatch {
  const atr = atrSeries(bars, p.atrSpan, p.atrMode ?? 'RMA');

  // candidate factors
  const candidates: number[] = [];
  for (let f = p.factorMin; f <= p.factorMax + 1e-9; f += p.factorStep) candidates.push(+f.toFixed(6));

  // restrict to recent window for performance clustering (closer to “adapts to market conditions”)
  const lookback = Math.max(50, Math.min(p.perfLookback ?? 1500, bars.length));
  const start = bars.length - lookback;
  const alpha = alphaFrom(p.perfAlpha ?? 10);

  const perfs: number[] = [];
  const lines: LinePt[][] = [];

  for (const f of candidates) {
    const st = supertrendBandsClassic(bars, atr, f);
    lines.push(st.line);
    perfs.push(perfForFactor(bars, st.line, alpha, start));
  }

  const { labels } = kmeans1D(perfs, p.k ?? 3);

  const groups: Record<number, number[]> = {};
  for (let i = 0; i < candidates.length; i++) {
    const g = labels[i];
    if (!groups[g]) groups[g] = [];
    groups[g].push(i);
  }

  const scored = Object.keys(groups)
    .map((k) => {
      const gi = Number(k);
      const idxs = groups[gi];
      const mean = idxs.reduce((a, i) => a + perfs[i], 0) / Math.max(1, idxs.length);
      return { gi, mean, idxs };
    })
    .sort((a, b) => a.mean - b.mean);

  // choose cluster
  const pick = p.fromCluster ?? 'Best';
  let chosen = scored[scored.length - 1]; // Best
  if (pick === 'Worst') chosen = scored[0];
  if (pick === 'Average') chosen = scored[Math.floor(scored.length / 2)];

  // guard tiny clusters
  if (!chosen || (p.minClusterSize ?? 2) > chosen.idxs.length) {
    const bestIdx = perfs.reduce((bi, v, i) => (v > perfs[bi] ? i : bi), 0);
    const factor = candidates[bestIdx];
    const st = supertrendBandsClassic(bars, atr, factor);
    return finalizeBatch(bars, factor, st.line, p);
  }

  // pick SINGLE factor inside chosen cluster
  let idx = chosen.idxs[0];
  if (pick === 'Best') idx = chosen.idxs.reduce((best, i) => (perfs[i] > perfs[best] ? i : best), idx);
  if (pick === 'Worst') idx = chosen.idxs.reduce((best, i) => (perfs[i] < perfs[best] ? i : best), idx);
  if (pick === 'Average') {
    const target = chosen.mean;
    idx = chosen.idxs.reduce(
      (best, i) => (Math.abs(perfs[i] - target) < Math.abs(perfs[best] - target) ? i : best),
      idx,
    );
  }

  const factor = candidates[idx];
  const st = supertrendBandsClassic(bars, atr, factor);
  return finalizeBatch(bars, factor, st.line, p);
}

function finalizeBatch(bars: Candle[], factor: number, line: LinePt[], p: StPerfParams): StPerfBatch {
  const signals: Signal[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = line[i - 1]?.value;
    if (!Number.isFinite(prev)) continue;
    const upFlip = bars[i].close > prev && bars[i - 1].close <= prev;
    const dnFlip = bars[i].close < prev && bars[i - 1].close >= prev;
    if (upFlip || dnFlip) {
      const dir = upFlip ? 1 : -1;
      signals.push({ time: bars[i].time, price: prev!, dir: dir as 1 | -1 });
    }
  }

  let ama: LinePt[] | undefined;
  if (p.useAMA) {
    const perfAlpha = alphaFrom(p.perfAlpha ?? 10);
    const absDiff: number[] = [NaN];
    for (let i = 1; i < bars.length; i++) absDiff.push(Math.abs(bars[i].close - bars[i - 1].close));
    const den = ewm(absDiff, alphaFrom(p.denomSpan ?? 10));
    const perfIdx = Math.max(0, perfAlpha) / (den[den.length - 1] + EPS);
    const amaAlpha = Math.max(0.02, Math.min(0.9, perfIdx));
    ama = line.map((pt, i) => {
      if (i === 0 || !Number.isFinite(pt.value)) return { time: pt.time, value: pt.value };
      const prev = Number.isFinite(line[i - 1].value) ? line[i - 1].value : pt.value;
      return { time: pt.time, value: prev + amaAlpha * (pt.value - prev) };
    });
  }

  return { factor: +factor.toFixed(6), raw: line, ama, signals };
}

// --- incremental step --------------------------------------------------------

export type StPerfState = {
  factor: number;
  lastUpper: number;
  lastLower: number;
  trend: number;
  prevClose?: number;
  amaLast?: number;
  lastFlipTime?: number;
};

export function supertrendPerfStep(
  prev: StPerfState | null,
  hist: Candle[],
  cur: Candle,
  p: StPerfParams,
  barClosed: boolean,
): { state: StPerfState; raw: LinePt; ama?: LinePt; signal?: Signal } {
  const state: StPerfState = prev ?? {
    factor: Number.isFinite(p.seedFactor ?? NaN) ? (p.seedFactor as number) : NaN,
    lastUpper: NaN,
    lastLower: NaN,
    trend: 0,
    prevClose: hist.at(-1)?.close,
    amaLast: undefined,
    lastFlipTime: undefined,
  };

  if (!Number.isFinite(state.factor)) {
    const W = Math.min(hist.length, p.perfLookback ?? 1500);
    const batch = supertrendPerfSeries(hist.slice(-W), p);
    state.factor = batch.factor;
  }

  // compute ATR (single value) with selected mode
  const atrArr = atrSeries([...hist.slice(-Math.max(5, p.atrSpan + 3)), cur], p.atrSpan, p.atrMode ?? 'RMA');
  const atrVal = atrArr.at(-1)!;
  const hl2 = (cur.high + cur.low) / 2;
  const up0 = hl2 + state.factor * atrVal;
  const lo0 = hl2 - state.factor * atrVal;

  // trailing using previous close
  const prevUpper = Number.isFinite(state.lastUpper) ? state.lastUpper : up0;
  const prevLower = Number.isFinite(state.lastLower) ? state.lastLower : lo0;
  const prevClose = state.prevClose ?? cur.close;

  const fupper = prevClose > prevUpper ? up0 : Math.min(up0, prevUpper);
  const flower = prevClose < prevLower ? lo0 : Math.max(lo0, prevLower);

  // trend and line
  let trend = state.trend;
  if (trend >= 0) trend = cur.close > fupper ? 1 : cur.close < flower ? -1 : 1;
  else trend = cur.close < flower ? -1 : cur.close > fupper ? 1 : -1;

  let raw: LinePt = { time: cur.time, value: trend === 1 ? flower : fupper };
  let signal: Signal | undefined;

  if (trend !== state.trend && state.trend !== 0) {
    signal = { time: cur.time, price: raw.value, dir: trend > 0 ? 1 : -1 };

    if (barClosed && state.lastFlipTime !== cur.time) {
      const W = Math.min(hist.length + 1, p.perfLookback ?? 1500);
      const batch = supertrendPerfSeries(hist.slice(-W + 1).concat([cur]), p);
      const newFactor = batch.factor;

      if (p.applyImmediateOnFlip) {
        const up1 = hl2 + newFactor * atrVal;
        const lo1 = hl2 - newFactor * atrVal;
        const fu1 = prevClose > prevUpper ? up1 : Math.min(up1, prevUpper);
        const fl1 = prevClose < prevLower ? lo1 : Math.max(lo1, prevLower);
        const tr1 = trend >= 0 ? (cur.close > fu1 ? 1 : cur.close < fl1 ? -1 : 1) : cur.close < fl1 ? -1 : cur.close > fu1 ? 1 : -1;
        raw = { time: cur.time, value: tr1 === 1 ? fl1 : fu1 };
        trend = tr1;
        state.factor = newFactor;
        state.lastUpper = fu1;
        state.lastLower = fl1;
      } else {
        state.factor = newFactor;
        state.lastUpper = fupper;
        state.lastLower = flower;
      }
      state.lastFlipTime = cur.time;
    } else {
      state.lastUpper = fupper;
      state.lastLower = flower;
    }
  } else {
    state.lastUpper = fupper;
    state.lastLower = flower;
  }

  let ama: LinePt | undefined;
  if (p.useAMA) {
    const alpha = alphaFrom(p.perfAlpha ?? 10);
    const last = state.amaLast ?? raw.value;
    const v = last + alpha * (raw.value - last);
    state.amaLast = v;
    ama = { time: cur.time, value: v };
  }

  state.trend = trend;
  state.prevClose = cur.close;

  return { state, raw, ama, signal };
}
