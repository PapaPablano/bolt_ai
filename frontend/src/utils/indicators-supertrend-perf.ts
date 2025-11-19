  // SuperTrend-AI (performance-clustered) with flip-triggered reselection + AMA option.
  export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
  export type LinePt = { time: number; value: number };
  export type Signal = { time: number; price: number; dir: 1 | -1 };

  export type StPerfParams = {
    atrSpan: number;
    factorMin: number;
    factorMax: number;
    factorStep: number;
    k?: 3 | 2;
    fromCluster?: 'Best' | 'Average' | 'Worst';
    perfAlpha?: number; // >1 => span; else alpha
    denomSpan?: number; // for AMA normalization
    useAMA?: boolean;
    // control when the reselected factor is applied
    applyImmediateOnFlip?: boolean; // default false (apply next bar)
  };

  const EPS = 1e-12;

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

  function atrEwm(bars: Candle[], span: number) {
    const alpha = alphaFrom(span);
    const tr: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const p = bars[i - 1] ?? b;
      const hl = b.high - b.low;
      const hc = Math.abs(b.high - p.close);
      const lc = Math.abs(b.low - p.close);
      tr.push(Math.max(hl, hc, lc));
    }
    return ewm(tr, alpha);
  }

  function supertrendBands(bars: Candle[], atr: number[], factor: number) {
    const N = bars.length;
    const upper = new Array<number>(N).fill(NaN);
    const lower = new Array<number>(N).fill(NaN);
    const dir = new Array<number>(N).fill(0);
    const line: LinePt[] = new Array<LinePt>(N);

    let prevUpper = NaN;
    let prevLower = NaN;
    let trend = 0;
    for (let i = 0; i < N; i++) {
      if (!Number.isFinite(atr[i])) {
        line[i] = { time: bars[i].time, value: NaN };
        continue;
      }
      const basis = (bars[i].high + bars[i].low) / 2;
      const up0 = basis + factor * atr[i];
      const lo0 = basis - factor * atr[i];
      const up = i > 0 && Number.isFinite(prevUpper) ? Math.min(up0, prevUpper) : up0;
      const lo = i > 0 && Number.isFinite(prevLower) ? Math.max(lo0, prevLower) : lo0;
      prevUpper = up;
      prevLower = lo;

      if (trend >= 0) trend = bars[i].close > up ? 1 : bars[i].close < lo ? -1 : 1;
      else trend = bars[i].close < lo ? -1 : bars[i].close > up ? 1 : -1;

      dir[i] = trend;
      upper[i] = up;
      lower[i] = lo;
      line[i] = { time: bars[i].time, value: trend === 1 ? lo : up };
    }
    return { upper, lower, dir, line };
  }

  function kmeans1D(vals: number[], k = 3) {
    const v = vals.slice().sort((a, b) => a - b);
    if (!v.length) return { centroids: [0, 0, 0].slice(0, k), labels: vals.map(() => 0) };
    const pick = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor((p / 100) * (v.length - 1))))];
    const c = [pick(25), pick(50), pick(75)].slice(0, k);
    const iter = 40;
    const labels = new Array(vals.length).fill(0);
    for (let it = 0; it < iter; it++) {
      let changed = false;
      for (let i = 0; i < vals.length; i++) {
        const x = vals[i];
        let bi = 0;
        let bd = Math.abs(x - c[0]);
        for (let j = 1; j < c.length; j++) {
          const d = Math.abs(x - c[j]);
          if (d < bd) {
            bd = d;
            bi = j;
          }
        }
        if (labels[i] !== bi) {
          labels[i] = bi;
          changed = true;
        }
      }
      const sums = new Array(c.length).fill(0);
      const cnt = new Array(c.length).fill(0);
      for (let i = 0; i < vals.length; i++) {
        sums[labels[i]] += vals[i];
        cnt[labels[i]]++;
      }
      for (let j = 0; j < c.length; j++) if (cnt[j]) c[j] = sums[j] / cnt[j];
      if (!changed) break;
    }
    return { centroids: c, labels };
  }

  function perfForFactor(bars: Candle[], line: LinePt[], alpha: number) {
    let perf = 0;
    for (let i = 1; i < bars.length; i++) {
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

  /**
   * Batch compute with selection:
   * - Cluster over performances.
   * - Choose cluster by Best|Average|Worst.
   * - Choose SINGLE factor inside that cluster:
   *   - Best: argmax(perf) in cluster
   *   - Worst: argmin(perf) in cluster
   *   - Average: perf closest to cluster mean
   */
  export function supertrendPerfSeries(bars: Candle[], p: StPerfParams): StPerfBatch {
    const atr = atrEwm(bars, p.atrSpan);
    const candidates: number[] = [];
    for (let f = p.factorMin; f <= p.factorMax + 1e-9; f += p.factorStep) candidates.push(+f.toFixed(6));

    const alpha = alphaFrom(p.perfAlpha ?? 10);
    const perfs: number[] = [];
    const lines: LinePt[][] = [];

    for (const f of candidates) {
      const st = supertrendBands(bars, atr, f);
      lines.push(st.line);
      perfs.push(perfForFactor(bars, st.line, alpha));
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

    const pick = p.fromCluster ?? 'Best';
    let chosen = scored[scored.length - 1]; // Best
    if (pick === 'Worst') chosen = scored[0];
    if (pick === 'Average') chosen = scored[Math.floor(scored.length / 2)];

    let idx = chosen.idxs[0];
    if (pick === 'Best') idx = chosen.idxs.reduce((best, i) => (perfs[i] > perfs[best] ? i : best), chosen.idxs[0]);
    if (pick === 'Worst') idx = chosen.idxs.reduce((best, i) => (perfs[i] < perfs[best] ? i : best), chosen.idxs[0]);
    if (pick === 'Average') {
      const target = chosen.mean;
      idx = chosen.idxs.reduce(
        (best, i) => (Math.abs(perfs[i] - target) < Math.abs(perfs[best] - target) ? i : best),
        chosen.idxs[0],
      );
    }

    const factor = candidates[idx];
    const st = supertrendBands(bars, atr, factor);

    const signals: Signal[] = [];
    for (let i = 1; i < bars.length; i++) {
      if (st.dir[i] !== st.dir[i - 1]) {
        const dir = st.dir[i] > 0 ? 1 : -1;
        signals.push({ time: bars[i].time, price: st.line[i].value, dir: dir as 1 | -1 });
      }
    }

    let ama: LinePt[] | undefined;
    if (p.useAMA) {
      const absDiff: number[] = [NaN];
      for (let i = 1; i < bars.length; i++) absDiff.push(Math.abs(bars[i].close - bars[i - 1].close));
      const den = ewm(absDiff, alphaFrom(p.denomSpan ?? 10));
      const clusterMeanPerf = chosen.mean;
      const perfIdx = Math.max(0, clusterMeanPerf) / (den[den.length - 1] + EPS);
      const amaAlpha = Math.max(0.02, Math.min(0.9, perfIdx));
      ama = st.line.map((pt, i) => {
        if (i === 0 || !Number.isFinite(pt.value)) return { time: pt.time, value: pt.value };
        const prev = i > 0 && Number.isFinite(st.line[i - 1].value) ? st.line[i - 1].value : pt.value;
        const v = prev + amaAlpha * (pt.value - prev);
        return { time: pt.time, value: v };
      });
    }

    return { factor: +factor.toFixed(6), raw: st.line, ama, signals };
  }

  export type StPerfState = {
    factor: number;
    lastUpper: number;
    lastLower: number;
    trend: number;
    amaLast?: number;
    lastFlipTime?: number; // to avoid duplicate reselection same bar
  };

  /**
   * Incremental step with flip-triggered reselection.
   * - Compute with current state.factor.
   * - If flip occurs AND barClosed === true, recompute best-in-cluster factor over recent history (including current bar).
   *   Default: apply new factor from NEXT bar (no look-ahead); applyImmediateOnFlip allows recomputing current bar.
   */
  export function supertrendPerfStep(
    prev: StPerfState | null,
    hist: Candle[],
    cur: Candle,
    p: StPerfParams,
    barClosed: boolean,
  ): { state: StPerfState; raw: LinePt; ama?: LinePt; signal?: Signal } {
    const state: StPerfState = prev ?? { factor: NaN, lastUpper: NaN, lastLower: NaN, trend: 0, amaLast: undefined, lastFlipTime: undefined };

    if (!Number.isFinite(state.factor)) {
      const W = Math.min(hist.length, 1500);
      const batch = supertrendPerfSeries(hist.slice(-W), p);
      state.factor = batch.factor;
    }

    const atr = atrEwm(hist.slice(-Math.max(5, p.atrSpan + 3)).concat([cur]), p.atrSpan);
    const atrVal = atr[atr.length - 1];
    const basis = (cur.high + cur.low) / 2;
    const up0 = basis + state.factor * atrVal;
    const lo0 = basis - state.factor * atrVal;
    const up = Number.isFinite(state.lastUpper) ? Math.min(up0, state.lastUpper) : up0;
    const lo = Number.isFinite(state.lastLower) ? Math.max(lo0, state.lastLower) : lo0;

    let trend = state.trend;
    trend = trend >= 0 ? (cur.close > up ? 1 : cur.close < lo ? -1 : 1) : cur.close < lo ? -1 : cur.close > up ? 1 : -1;

    const raw: LinePt = { time: cur.time, value: trend === 1 ? lo : up };
    let signal: Signal | undefined;
    let amaOut: LinePt | undefined;

    if (trend !== state.trend && state.trend !== 0) {
      signal = { time: cur.time, price: raw.value, dir: trend > 0 ? 1 : -1 };

      if (barClosed && state.lastFlipTime !== cur.time) {
        const W = Math.min(hist.length + 1, 1500);
        const batch = supertrendPerfSeries(hist.slice(-W + 1).concat([cur]), p);
        const newFactor = batch.factor;

        if (p.applyImmediateOnFlip) {
          const up1 = Math.min(basis + newFactor * atrVal, up0);
          const lo1 = Math.max(basis - newFactor * atrVal, lo0);
          const tr1 = trend >= 0 ? (cur.close > up1 ? 1 : cur.close < lo1 ? -1 : 1) : cur.close < lo1 ? -1 : cur.close > up1 ? 1 : -1;
          const raw1: LinePt = { time: cur.time, value: tr1 === 1 ? lo1 : up1 };
          raw.value = raw1.value;
          trend = tr1;
          state.factor = newFactor;
          state.lastUpper = up1;
          state.lastLower = lo1;
        } else {
          state.factor = newFactor;
          state.lastUpper = up;
          state.lastLower = lo;
        }
        state.lastFlipTime = cur.time;
      }
    } else {
      state.lastUpper = up;
      state.lastLower = lo;
    }

    if (p.useAMA) {
      const alpha = alphaFrom(p.perfAlpha ?? 10);
      const last = state.amaLast ?? raw.value;
      const v = last + alpha * (raw.value - last);
      state.amaLast = v;
      amaOut = { time: cur.time, value: v };
    }

    state.trend = trend;

    return { state, raw, ama: amaOut, signal };
  }
