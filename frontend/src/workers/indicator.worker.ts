/// <reference lib="webworker" />

import {
  supertrendPerfSeries,
  supertrendPerfStep,
  type Candle,
  type LinePt,
  type StPerfParams,
  type StPerfState,
} from '@/utils/indicators-supertrend-perf';

type IndName = 'STAI' | 'EMA' | 'RSI' | 'VWAP' | 'BB' | 'MACD' | 'KDJ';
type PaneName = 'kdj';

type MsgInit = { type: 'INIT'; symbol: string; tf: string; stParams?: StPerfParams };

type MsgSetHistory = { type: 'SET_HISTORY'; bars: Candle[] };
type MsgLive = { type: 'LIVE_BAR'; bar: Candle; barClosed: boolean };
type MsgToggle = { type: 'TOGGLE'; name: IndName; on: boolean };
type MsgSetParams =
  | { type: 'SET_PARAMS'; name: 'STAI'; params: Partial<StPerfParams> }
  | { type: 'SET_PARAMS'; name: 'BB'; params: Partial<BbParams> }
  | { type: 'SET_PARAMS'; name: 'MACD'; params: Partial<MacdParams> }
  | { type: 'SET_PARAMS'; name: 'VWAP'; params: Partial<VwapParams> }
  | { type: 'SET_PARAMS'; name: 'KDJ'; params: Partial<KdjParams> };
type Incoming = MsgInit | MsgSetHistory | MsgLive | MsgToggle | MsgSetParams;

type CompactLine = [number, number];
type CompactPoint = CompactLine;
type MultiSeries = Record<string, CompactLine[]>;
type MultiPoint = Record<string, CompactPoint>;

type OutOverlayFull = { type: 'OVERLAY_FULL'; name: IndName; series: CompactLine[]; aux?: Record<string, unknown> };
type OutOverlayPatch = { type: 'OVERLAY_PATCH'; name: IndName; point: CompactPoint };
type OutOverlayFullMulti = { type: 'OVERLAY_FULL_MULTI'; name: IndName; series: MultiSeries };
type OutOverlayPatchMulti = { type: 'OVERLAY_PATCH_MULTI'; name: IndName; point: MultiPoint };
type OutSignals = { type: 'SIGNALS'; name: 'STAI'; signals: { time: number; price: number; dir: 1 | -1 }[] };
type OutPaneFull = { type: 'PANE_FULL'; key: PaneName; k: CompactLine[]; d: CompactLine[]; j: CompactLine[] };
type OutPanePatch = {
  type: 'PANE_PATCH';
  key: PaneName;
  k?: CompactLine[];
  d?: CompactLine[];
  j?: CompactLine[];
};
type Outgoing =
  | OutOverlayFull
  | OutOverlayPatch
  | OutOverlayFullMulti
  | OutOverlayPatchMulti
  | OutSignals
  | OutPaneFull
  | OutPanePatch;

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

type EmaState = { span: number; alpha: number; last?: number; warmupCount: number; warmupSum: number };
type RsiState = { span: number; avgGain?: number; avgLoss?: number; lastClose?: number; warmupCount: number };
type VwapState = { sumPV: number; sumV: number; sessionStartMs: number; sessionNextOpenMs: number };
type BbParams = { period: number; mult: number };
type VwapParams = { mult: number };
type RollingStatsState = { capacity: number; n: number; mean: number; m2: number; queue: number[] };
type MacdParams = { fast: number; slow: number; signal: number };
type MacdState = { fast: EmaState; slow: EmaState; signal: EmaState };
type KdjParams = {
  period: number;
  kSmooth: number;
  dSmooth: number;
  sessionAnchored: boolean;
};
type KdjSeries = { k: LinePt[]; d: LinePt[]; j: LinePt[] } | null;

type WorkerState = {
  symbol: string;
  tf: string;
  hist: Candle[];
  stOn: boolean;
  emaOn: boolean;
  rsiOn: boolean;
  vwapOn: boolean;
  bbOn: boolean;
  macdOn: boolean;
  kdjOn: boolean;
  stParams: StPerfParams;
  bbParams: BbParams;
  macdParams: MacdParams;
  vwapParams: VwapParams;
  kdjParams: KdjParams;
  stState: StPerfState | null;
  emaState: EmaState | null;
  rsiState: RsiState | null;
  vwapState: VwapState | null;
  bbState: RollingStatsState | null;
  macdState: MacdState | null;
  kdjSeries: KdjSeries;
  stCheckpoint: StPerfState | null;
  emaCheckpoint: EmaState | null;
  rsiCheckpoint: RsiState | null;
  vwapCheckpoint: VwapState | null;
  bbCheckpoint: RollingStatsState | null;
  macdCheckpoint: MacdState | null;
  kdjCommitTime?: number;
  stCommitTime?: number;
  emaCommitTime?: number;
  rsiCommitTime?: number;
  vwapCommitTime?: number;
  bbCommitTime?: number;
  macdCommitTime?: number;
};

const EMA_SPAN = 20;
const RSI_SPAN = 14;
const HISTORY_REPLAY_RATIO = 0.5;

const defaultStParams: StPerfParams = {
  atrSpan: 14,
  factorMin: 1.5,
  factorMax: 4,
  factorStep: 0.5,
  k: 3,
  fromCluster: 'Best',
  perfAlpha: 10,
  denomSpan: 10,
  useAMA: true,
  applyImmediateOnFlip: false,
};

const defaultBbParams: BbParams = { period: 20, mult: 2 };
const defaultMacdParams: MacdParams = { fast: 12, slow: 26, signal: 9 };
const defaultVwapParams: VwapParams = { mult: 1 };
const defaultKdjParams: KdjParams = { period: 9, kSmooth: 3, dSmooth: 3, sessionAnchored: true };

const state: WorkerState = {
  symbol: '',
  tf: '',
  hist: [],
  stOn: true,
  emaOn: false,
  rsiOn: false,
  vwapOn: false,
  bbOn: false,
  macdOn: false,
  kdjOn: false,
  stParams: defaultStParams,
  bbParams: defaultBbParams,
  macdParams: defaultMacdParams,
  vwapParams: defaultVwapParams,
  kdjParams: defaultKdjParams,
  stState: null,
  emaState: null,
  rsiState: null,
  vwapState: null,
  bbState: null,
  macdState: null,
  kdjSeries: null,
  stCheckpoint: null,
  emaCheckpoint: null,
  rsiCheckpoint: null,
  vwapCheckpoint: null,
  bbCheckpoint: null,
  macdCheckpoint: null,
};

const encodeSeries = (series: LinePt[]): CompactLine[] => series.map((pt) => [pt.time, pt.value]);
const encodePoint = (pt: LinePt): CompactPoint => [pt.time, pt.value];
const encodeMultiSeries = (series: Record<string, LinePt[]>): MultiSeries => {
  const out: MultiSeries = {};
  Object.keys(series).forEach((key) => {
    out[key] = encodeSeries(series[key]);
  });
  return out;
};
const encodeMultiPoint = (points: Record<string, LinePt | CompactPoint>): MultiPoint => {
  const out: MultiPoint = {};
  Object.keys(points).forEach((key) => {
    const val = points[key];
    out[key] = Array.isArray(val) ? (val as CompactPoint) : encodePoint(val as LinePt);
  });
  return out;
};

const sortAndDedupeBars = (bars: Candle[]) => {
  const sorted = bars.slice().sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (const bar of sorted) {
    const clone = { ...bar };
    if (Number.isNaN(clone.time)) continue;
    if (out.length && out[out.length - 1].time === clone.time) out[out.length - 1] = clone;
    else out.push(clone);
  }
  return out;
};

const post = (payload: Outgoing) => ctx.postMessage(payload);
const encodeLines = (series: LinePt[]): CompactLine[] => encodeSeries(series);

const initEmaState = (span = EMA_SPAN): EmaState => ({ span, alpha: 2 / (span + 1), warmupCount: 0, warmupSum: 0 });
const cloneEmaState = (src: EmaState | null, span = EMA_SPAN): EmaState =>
  src ? { ...src } : initEmaState(span);
const stepEma = (st: EmaState, close: number): number => {
  if (st.warmupCount < st.span) {
    st.warmupSum += close;
    st.warmupCount++;
    if (st.warmupCount < st.span) return NaN;
    const avg = st.warmupSum / st.span;
    st.last = avg;
    return avg;
  }
  st.last = st.last === undefined ? close : st.last + st.alpha * (close - st.last);
  return st.last;
};

const initRsiState = (span = RSI_SPAN): RsiState => ({ span, warmupCount: 0 });
const cloneRsiState = (src: RsiState | null, span = RSI_SPAN): RsiState => (src ? { ...src } : initRsiState(span));
const stepRsi = (st: RsiState, close: number): number => {
  if (st.lastClose === undefined) {
    st.lastClose = close;
    return NaN;
  }
  const change = close - st.lastClose;
  const gain = Math.max(0, change);
  const loss = Math.max(0, -change);
  if (st.warmupCount < st.span) {
    st.avgGain = (st.avgGain ?? 0) + gain;
    st.avgLoss = (st.avgLoss ?? 0) + loss;
    st.warmupCount++;
    st.lastClose = close;
    if (st.warmupCount < st.span) return NaN;
    st.avgGain = (st.avgGain ?? 0) / st.span;
    st.avgLoss = (st.avgLoss ?? 0) / st.span;
  } else {
    st.avgGain = ((st.avgGain ?? 0) * (st.span - 1) + gain) / st.span;
    st.avgLoss = ((st.avgLoss ?? 0) * (st.span - 1) + loss) / st.span;
    st.lastClose = close;
  }
  if (!st.avgLoss) return 100;
  const rs = (st.avgGain ?? 0) / (st.avgLoss || 1e-12);
  return 100 - 100 / (1 + rs);
};

const initVwapState = (): VwapState => ({ sumPV: 0, sumV: 0, sessionStartMs: Number.NaN, sessionNextOpenMs: Number.NaN });
const cloneVwapState = (src: VwapState | null): VwapState => (src ? { ...src } : initVwapState());

const DAY_MS = 24 * 60 * 60 * 1000;
const etAnchorsMs = (tMs: number) => {
  const asEt = new Date(tMs).toLocaleString('en-US', { timeZone: 'America/New_York' });
  const d = new Date(asEt);
  d.setHours(0, 0, 0, 0);
  const midnightEt = d.toLocaleString('en-US', { timeZone: 'UTC' });
  const midnightMs = Date.parse(midnightEt);
  const etOpenMs = midnightMs + (9 * 60 + 30) * 60 * 1000;
  return { etOpenMs, etNextOpenMs: etOpenMs + DAY_MS };
};

const timeToMs = (value: number) => (value > 1e12 ? value : value * 1000);

const sessionKeyMs = (barTime: number) => {
  const ms = timeToMs(barTime);
  const { etOpenMs } = etAnchorsMs(ms);
  return etOpenMs;
};

const buildSessionBoundarySet = (tf: string, bars: Candle[]): Set<number> => {
  const set = new Set<number>();
  if (!bars.length || tf === '1Day') return set;
  let prevKey: number | null = null;
  for (const bar of bars) {
    const key = sessionKeyMs(bar.time);
    if (prevKey === null || key !== prevKey) {
      set.add(bar.time);
      prevKey = key;
    }
  }
  return set;
};

const kdjAlpha = (smooth: number) => (smooth > 1 ? 1 / smooth : 1);

const computeKdjSeries = (
  bars: Candle[],
  params: KdjParams,
  tf: string,
): KdjSeries => {
  if (!bars.length) return { k: [], d: [], j: [] };
  const sorted = sortAndDedupeBars(bars);
  const data = sorted.map((bar) => ({
    time: bar.time,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));
  const period = Math.max(1, params.period | 0);
  const alphaK = kdjAlpha(Math.max(1, params.kSmooth | 0));
  const alphaD = kdjAlpha(Math.max(1, params.dSmooth | 0));
  const sessionStarts = params.sessionAnchored ? buildSessionBoundarySet(tf, sorted) : undefined;

  const K: LinePt[] = [];
  const D: LinePt[] = [];
  const J: LinePt[] = [];
  let kPrev = 50;
  let dPrev = 50;

  for (let i = 0; i < data.length; i++) {
    const { time, close } = data[i];
    if (sessionStarts?.has(time)) {
      kPrev = 50;
      dPrev = 50;
    }
    const start = Math.max(0, i - (period - 1));
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = start; j <= i; j++) {
      hi = Math.max(hi, data[j].high);
      lo = Math.min(lo, data[j].low);
    }
    const range = Math.max(1e-9, hi - lo);
    const rsv = ((close - lo) / range) * 100;
    const kNow = kPrev + alphaK * (rsv - kPrev);
    const dNow = dPrev + alphaD * (kNow - dPrev);
    const jNow = 3 * kNow - 2 * dNow;
    K.push({ time, value: kNow });
    D.push({ time, value: dNow });
    J.push({ time, value: jNow });
    kPrev = kNow;
    dPrev = dNow;
  }

  return { k: K, d: D, j: J };
};

const postKdjFull = (series: KdjSeries) => {
  if (!series) return;
  post({ type: 'PANE_FULL', key: 'kdj', k: encodeSeries(series.k), d: encodeSeries(series.d), j: encodeSeries(series.j) });
};

const postKdjPatch = (series?: Partial<KdjSeries> | null) => {
  if (!series) return;
  post({
    type: 'PANE_PATCH',
    key: 'kdj',
    k: series.k ? encodeLines(series.k) : undefined,
    d: series.d ? encodeLines(series.d) : undefined,
    j: series.j ? encodeLines(series.j) : undefined,
  });
};

const buildKdjBars = (bar?: Candle): Candle[] => {
  const hist = state.hist.slice();
  if (!bar) return hist;
  const idx = hist.findIndex((b) => b.time === bar.time);
  if (idx >= 0) hist[idx] = { ...bar };
  else hist.push({ ...bar });
  return hist;
};

const ensureVwapSession = (st: VwapState, barTime: number) => {
  const ms = barTime > 1e12 ? barTime : barTime * 1000;
  const { etOpenMs, etNextOpenMs } = etAnchorsMs(ms);
  if (!Number.isFinite(st.sessionStartMs)) {
    st.sessionStartMs = etOpenMs;
    st.sessionNextOpenMs = etNextOpenMs;
    return;
  }
  if (ms >= st.sessionNextOpenMs) {
    st.sumPV = 0;
    st.sumV = 0;
    st.sessionStartMs = etOpenMs;
    st.sessionNextOpenMs = etNextOpenMs;
  }
};

const stepVwap = (st: VwapState, bar: Candle) => {
  ensureVwapSession(st, bar.time);
  const vol = bar.volume ?? 0;
  st.sumPV += bar.close * vol;
  st.sumV += vol;
  if (st.sumV === 0) return bar.close;
  return st.sumPV / st.sumV;
};

const initRollingStats = (capacity: number): RollingStatsState => ({ capacity, n: 0, mean: 0, m2: 0, queue: [] });
const cloneRollingStats = (src: RollingStatsState | null, capacity: number): RollingStatsState => (src ? { ...src, queue: [...src.queue], capacity } : initRollingStats(capacity));
const pushRollingStats = (st: RollingStatsState, value: number) => {
  st.queue.push(value);
  if (st.n < st.capacity) {
    st.n++;
    const delta = value - st.mean;
    st.mean += delta / st.n;
    st.m2 += delta * (value - st.mean);
  } else if (st.capacity > 0) {
    const old = st.queue.shift()!;
    const nPrev = st.n;
    if (nPrev > 1) {
      const meanRemoved = (st.mean * nPrev - old) / (nPrev - 1);
      const m2Removed = st.m2 - (old - st.mean) * (old - meanRemoved);
      st.mean = meanRemoved;
      st.m2 = m2Removed;
      st.n = nPrev - 1;
    } else {
      st.mean = 0;
      st.m2 = 0;
      st.n = 0;
    }
    st.n++;
    const delta = value - st.mean;
    st.mean += delta / st.n;
    st.m2 += delta * (value - st.mean);
  }
  const mu = st.n ? st.mean : Number.NaN;
  const sigma = st.n > 1 ? Math.sqrt(st.m2 / (st.n - 1)) : Number.NaN;
  return { mean: mu, sigma };
};

const initMacdState = (params: MacdParams): MacdState => ({
  fast: initEmaState(params.fast),
  slow: initEmaState(params.slow),
  signal: initEmaState(params.signal),
});
const cloneMacdState = (src: MacdState | null, params: MacdParams): MacdState =>
  src
    ? {
        fast: cloneEmaState(src.fast, params.fast),
        slow: cloneEmaState(src.slow, params.slow),
        signal: cloneEmaState(src.signal, params.signal),
      }
    : initMacdState(params);
const stepMacd = (st: MacdState, close: number) => {
  const ef = stepEma(st.fast, close);
  const es = stepEma(st.slow, close);
  if (!Number.isFinite(ef) || !Number.isFinite(es)) return { macd: Number.NaN, signal: Number.NaN, hist: Number.NaN };
  const macd = ef - es;
  const signal = stepEma(st.signal, macd);
  return { macd, signal, hist: macd - signal };
};

const sameBar = (a: Candle, b: Candle) =>
  a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close && (a.volume ?? 0) === (b.volume ?? 0);

const resetSnapshots = () => {
  state.stCheckpoint = null;
  state.emaCheckpoint = null;
  state.rsiCheckpoint = null;
  state.vwapCheckpoint = null;
  state.bbCheckpoint = null;
  state.macdCheckpoint = null;
  state.stCommitTime = undefined;
  state.emaCommitTime = undefined;
  state.rsiCommitTime = undefined;
  state.vwapCommitTime = undefined;
  state.bbCommitTime = undefined;
  state.macdCommitTime = undefined;
  state.kdjCommitTime = undefined;
};

const computeAll = () => {
  if (!state.hist.length) {
    state.stState = null;
    state.emaState = null;
    state.rsiState = null;
    state.vwapState = null;
    state.bbState = null;
    state.macdState = null;
    resetSnapshots();
    return;
  }

  if (state.stOn) {
    const batch = supertrendPerfSeries(state.hist, state.stParams);
    const line = batch.ama ?? batch.raw;
    post({ type: 'OVERLAY_FULL', name: 'STAI', series: encodeSeries(line), aux: { factor: batch.factor } });
    if (batch.signals.length) post({ type: 'SIGNALS', name: 'STAI', signals: batch.signals });
    state.stState = {
      factor: batch.factor,
      lastUpper: Number.NaN,
      lastLower: Number.NaN,
      trend: 0,
      amaLast: batch.ama?.at(-1)?.value,
      lastFlipTime: undefined,
    };
  } else {
    state.stState = null;
  }

  if (state.emaOn) {
    const emaSt = initEmaState(EMA_SPAN);
    const series = state.hist.map((bar) => ({ time: bar.time, value: stepEma(emaSt, bar.close) }));
    state.emaState = emaSt;
    post({ type: 'OVERLAY_FULL', name: 'EMA', series: encodeSeries(series) });
  } else {
    state.emaState = null;
  }

  if (state.rsiOn) {
    const rsiSt = initRsiState(RSI_SPAN);
    const series = state.hist.map((bar) => ({ time: bar.time, value: stepRsi(rsiSt, bar.close) }));
    state.rsiState = rsiSt;
    post({ type: 'OVERLAY_FULL', name: 'RSI', series: encodeSeries(series) });
  } else {
    state.rsiState = null;
  }

  if (state.vwapOn) {
    const vwapSt = initVwapState();
    const series: LinePt[] = [];
    for (const bar of state.hist) {
      const value = stepVwap(vwapSt, bar);
      series.push({ time: bar.time, value });
    }
    state.vwapState = vwapSt;
    post({ type: 'OVERLAY_FULL', name: 'VWAP', series: encodeSeries(series) });
  } else {
    state.vwapState = null;
  }

  if (state.bbOn) {
    const bbSt = initRollingStats(state.bbParams.period);
    const mid: LinePt[] = [];
    const up: LinePt[] = [];
    const lo: LinePt[] = [];
    for (const bar of state.hist) {
      const { mean, sigma } = pushRollingStats(bbSt, bar.close);
      mid.push({ time: bar.time, value: mean });
      const offset = state.bbParams.mult * sigma;
      up.push({ time: bar.time, value: mean + offset });
      lo.push({ time: bar.time, value: mean - offset });
    }
    state.bbState = bbSt;
    post({ type: 'OVERLAY_FULL_MULTI', name: 'BB', series: encodeMultiSeries({ mid, up, lo }) });
  } else {
    state.bbState = null;
  }

  if (state.macdOn) {
    const macdSt = initMacdState(state.macdParams);
    const macd: LinePt[] = [];
    const signal: LinePt[] = [];
    const hist: LinePt[] = [];
    for (const bar of state.hist) {
      const next = stepMacd(macdSt, bar.close);
      macd.push({ time: bar.time, value: next.macd });
      signal.push({ time: bar.time, value: next.signal });
      hist.push({ time: bar.time, value: next.hist });
    }
    state.macdState = macdSt;
    post({ type: 'OVERLAY_FULL_MULTI', name: 'MACD', series: encodeMultiSeries({ macd, signal, hist }) });
  } else {
    state.macdState = null;
  }

  if (state.kdjOn) {
    state.kdjSeries = computeKdjSeries(state.hist, state.kdjParams, state.tf);
    postKdjFull(state.kdjSeries);
    state.kdjCommitTime = state.kdjSeries?.k.at(-1)?.time;
  } else {
    state.kdjSeries = null;
  }

  resetSnapshots();
};

const rewriteTail = (bar: Candle) => {
  const canRewindSt = !state.stOn || (state.stCheckpoint && state.stCommitTime === bar.time);
  const canRewindEma = !state.emaOn || (state.emaCheckpoint && state.emaCommitTime === bar.time);
  const canRewindRsi = !state.rsiOn || (state.rsiCheckpoint && state.rsiCommitTime === bar.time);
  const canRewindVwap = !state.vwapOn || (state.vwapCheckpoint && state.vwapCommitTime === bar.time);
  const canRewindBb = !state.bbOn || (state.bbCheckpoint && state.bbCommitTime === bar.time);
  const canRewindMacd = !state.macdOn || (state.macdCheckpoint && state.macdCommitTime === bar.time);
  if (!canRewindSt || !canRewindEma || !canRewindRsi || !canRewindVwap || !canRewindBb || !canRewindMacd) return false;

  if (state.stOn && state.stCheckpoint) state.stState = { ...state.stCheckpoint };
  if (state.emaOn && state.emaCheckpoint) state.emaState = cloneEmaState(state.emaCheckpoint, EMA_SPAN);
  if (state.rsiOn && state.rsiCheckpoint) state.rsiState = cloneRsiState(state.rsiCheckpoint, RSI_SPAN);
  if (state.vwapOn && state.vwapCheckpoint) state.vwapState = cloneVwapState(state.vwapCheckpoint);
  if (state.bbOn && state.bbCheckpoint) state.bbState = cloneRollingStats(state.bbCheckpoint, state.bbParams.period);
  if (state.macdOn && state.macdCheckpoint) state.macdState = cloneMacdState(state.macdCheckpoint, state.macdParams);

  const idx = state.hist.findIndex((b) => b.time === bar.time);
  if (idx >= 0) state.hist.splice(idx, 1);
  onLiveBar(bar, true);
  return true;
};

const setHist = (bars: Candle[]) => {
  if (!bars.length) {
    state.hist = [];
    state.stState = null;
    state.emaState = null;
    state.rsiState = null;
    state.vwapState = null;
    state.bbState = null;
    state.macdState = null;
    resetSnapshots();
    return;
  }

  const next = sortAndDedupeBars(bars);
  if (!state.hist.length) {
    state.hist = next;
    computeAll();
    return;
  }

  const prev = state.hist;
  const prevFirst = prev[0]?.time ?? 0;
  const nextFirst = next[0]?.time ?? 0;
  const prevLast = prev[prev.length - 1]?.time ?? 0;
  const nextLast = next[next.length - 1]?.time ?? 0;
  const replaced = nextFirst < prevFirst || nextLast < prevLast || next.length < prev.length * HISTORY_REPLAY_RATIO;
  if (replaced) {
    state.hist = next;
    computeAll();
    return;
  }

  const deltaIdx = next.findIndex((bar) => bar.time > prevLast);
  if (deltaIdx >= 0) {
    for (let i = deltaIdx; i < next.length; i++) onLiveBar(next[i], true);
  }

  const prevLastBar = prev[prev.length - 1];
  const nextLastBar = next[next.length - 1];
  if (deltaIdx === -1 && prevLastBar && nextLastBar && !sameBar(prevLastBar, nextLastBar)) {
    if (!rewriteTail(nextLastBar)) {
      state.hist = next;
      computeAll();
      return;
    }
  }

  state.hist = next;
};

const onLiveBar = (bar: Candle, barClosed: boolean) => {
  if (state.stOn) {
    const before = state.stState ? { ...state.stState } : null;
    const { state: stState, raw, ama, signal } = supertrendPerfStep(state.stState, state.hist, bar, state.stParams, barClosed);
    const pt = ama ?? raw;
    post({ type: 'OVERLAY_PATCH', name: 'STAI', point: encodePoint(pt) });
    if (signal) post({ type: 'SIGNALS', name: 'STAI', signals: [signal] });
    if (barClosed) {
      state.stCheckpoint = before;
      state.stState = stState;
      state.stCommitTime = bar.time;
    } else {
      state.stState = stState;
    }
  }

  if (state.emaOn) {
    const before = cloneEmaState(state.emaState, EMA_SPAN);
    const preview = cloneEmaState(state.emaState, EMA_SPAN);
    const next = stepEma(preview, bar.close);
    post({ type: 'OVERLAY_PATCH', name: 'EMA', point: [bar.time, next] });
    if (barClosed) {
      state.emaCheckpoint = before;
      state.emaState = preview;
      state.emaCommitTime = bar.time;
    }
  }

  if (state.rsiOn) {
    const before = cloneRsiState(state.rsiState, RSI_SPAN);
    const preview = cloneRsiState(state.rsiState, RSI_SPAN);
    const value = stepRsi(preview, bar.close);
    post({ type: 'OVERLAY_PATCH', name: 'RSI', point: [bar.time, value] });
    if (barClosed) {
      state.rsiCheckpoint = before;
      state.rsiState = preview;
      state.rsiCommitTime = bar.time;
    }
  }

  if (state.vwapOn) {
    const before = cloneVwapState(state.vwapState);
    const preview = cloneVwapState(state.vwapState);
    const value = stepVwap(preview, bar);
    post({ type: 'OVERLAY_PATCH', name: 'VWAP', point: [bar.time, value] });
    if (barClosed) {
      state.vwapCheckpoint = before;
      state.vwapState = preview;
      state.vwapCommitTime = bar.time;
    }
  }

  if (state.bbOn) {
    const before = cloneRollingStats(state.bbState, state.bbParams.period);
    const preview = cloneRollingStats(state.bbState, state.bbParams.period);
    const { mean, sigma } = pushRollingStats(preview, bar.close);
    const offset = state.bbParams.mult * sigma;
    post({
      type: 'OVERLAY_PATCH_MULTI',
      name: 'BB',
      point: encodeMultiPoint({
        mid: [bar.time, mean],
        up: [bar.time, mean + offset],
        lo: [bar.time, mean - offset],
      }),
    });
    if (barClosed) {
      state.bbCheckpoint = before;
      state.bbState = preview;
      state.bbCommitTime = bar.time;
    }
  }

  if (state.macdOn) {
    const before = cloneMacdState(state.macdState, state.macdParams);
    const preview = cloneMacdState(state.macdState, state.macdParams);
    const next = stepMacd(preview, bar.close);
    post({
      type: 'OVERLAY_PATCH_MULTI',
      name: 'MACD',
      point: encodeMultiPoint({
        macd: [bar.time, next.macd],
        signal: [bar.time, next.signal],
        hist: [bar.time, next.hist],
      }),
    });
    if (barClosed) {
      state.macdCheckpoint = before;
      state.macdState = preview;
      state.macdCommitTime = bar.time;
    }
  }

  if (state.kdjOn) {
    const previewBars = buildKdjBars(bar);
    const tailStart = Math.max(0, previewBars.length - (state.kdjParams.period + 15));
    const tail = previewBars.slice(tailStart);
    const tailSeries = computeKdjSeries(tail, state.kdjParams, state.tf);
    const lastK = tailSeries?.k.at(-1);
    const lastD = tailSeries?.d.at(-1);
    const lastJ = tailSeries?.j.at(-1);
    if (lastK || lastD || lastJ) {
      postKdjPatch({
        k: lastK ? [lastK] : undefined,
        d: lastD ? [lastD] : undefined,
        j: lastJ ? [lastJ] : undefined,
      });
    }
    if (barClosed) {
      state.kdjSeries = computeKdjSeries(previewBars, state.kdjParams, state.tf);
      postKdjFull(state.kdjSeries);
      state.kdjCommitTime = bar.time;
    }
  }

  if (barClosed) {
    const idx = state.hist.findIndex((b) => b.time === bar.time);
    if (idx >= 0) state.hist[idx] = { ...bar };
    else state.hist.push({ ...bar });
  }
};

ctx.addEventListener('message', (event: MessageEvent<Incoming>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'INIT':
      state.symbol = msg.symbol;
      state.tf = msg.tf;
      if (msg.stParams) state.stParams = { ...state.stParams, ...msg.stParams };
      state.emaState = null;
      state.rsiState = null;
      state.vwapState = null;
      state.bbState = null;
      state.macdState = null;
      resetSnapshots();
      break;
    case 'SET_HISTORY':
      setHist(msg.bars);
      break;
    case 'LIVE_BAR':
      onLiveBar(msg.bar, msg.barClosed);
      break;
    case 'TOGGLE':
      if (msg.name === 'STAI') state.stOn = msg.on;
      if (msg.name === 'EMA') state.emaOn = msg.on;
      if (msg.name === 'RSI') state.rsiOn = msg.on;
      if (msg.name === 'VWAP') state.vwapOn = msg.on;
      if (msg.name === 'BB') state.bbOn = msg.on;
      if (msg.name === 'MACD') state.macdOn = msg.on;
      if (msg.name === 'KDJ') state.kdjOn = msg.on;
      computeAll();
      break;
    case 'SET_PARAMS':
      if (msg.name === 'STAI') state.stParams = { ...state.stParams, ...msg.params };
      if (msg.name === 'BB') state.bbParams = { ...state.bbParams, ...msg.params } as BbParams;
      if (msg.name === 'MACD') state.macdParams = { ...state.macdParams, ...msg.params } as MacdParams;
      if (msg.name === 'VWAP') state.vwapParams = { ...state.vwapParams, ...msg.params } as VwapParams;
      if (msg.name === 'KDJ') state.kdjParams = { ...state.kdjParams, ...msg.params } as KdjParams;
      computeAll();
      break;
    default:
      break;
  }
});
