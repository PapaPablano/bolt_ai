// Baseline indicators + incremental updaters.
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type LinePt = { time: number; value: number };
export type HistPt = { time: number; value: number; color?: string };

export function smaLine(closes: number[], times: number[], n: number): LinePt[] {
  const out: LinePt[] = [];
  let sum = 0;
  const q: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    q.push(closes[i]);
    if (q.length > n) sum -= q.shift()!;
    if (q.length === n) out.push({ time: times[i], value: +(sum / n).toFixed(6) });
  }
  return out;
}

export function emaSeries(closes: number[], times: number[], n: number): LinePt[] {
  const out: LinePt[] = [];
  const k = 2 / (n + 1);
  let prev: number | undefined;
  for (let i = 0; i < closes.length; i++) {
    const v = prev === undefined ? closes[i] : (closes[i] - prev) * k + prev;
    prev = v;
    if (i >= n - 1) out.push({ time: times[i], value: +v.toFixed(6) });
  }
  return out;
}

export type EmaState = { k: number; ema?: number };
export const emaInit = (period: number, seed?: number): EmaState => ({ k: 2 / (period + 1), ema: seed });
export const emaStep = (state: EmaState, price: number) =>
  (state.ema = state.ema === undefined ? price : (price - state.ema) * state.k + state.ema);

export type MacdConfig = { fast: number; slow: number; signal: number };
export type MacdState = { ef: EmaState; es: EmaState; esig: EmaState; macd?: number };
export const macdInit = (cfg: MacdConfig): MacdState => ({ ef: emaInit(cfg.fast), es: emaInit(cfg.slow), esig: emaInit(cfg.signal) });

export function macdSeries(prices: number[], times: number[], cfg: MacdConfig) {
  const ef = emaInit(cfg.fast);
  const es = emaInit(cfg.slow);
  const esg = emaInit(cfg.signal);
  const macd: LinePt[] = [];
  const signal: LinePt[] = [];
  const hist: HistPt[] = [];
  for (let i = 0; i < prices.length; i++) {
    const f = emaStep(ef, prices[i]);
    const s = emaStep(es, prices[i]);
    const m = f - s;
    if (i >= cfg.slow - 1) {
      const sg = emaStep(esg, m);
      macd.push({ time: times[i], value: +m.toFixed(6) });
      signal.push({ time: times[i], value: +sg.toFixed(6) });
      hist.push({ time: times[i], value: +(m - sg).toFixed(6) });
    }
  }
  return { macd, signal, hist };
}

export function macdStep(state: MacdState, price: number) {
  const f = emaStep(state.ef, price);
  const s = emaStep(state.es, price);
  const m = f - s;
  state.macd = m;
  const sg = emaStep(state.esig, m);
  return { macd: m, signal: sg, hist: m - sg };
}

export type VwapState = { cumPV: number; cumV: number; sessionKey: string | null };
export const vwapInit = (): VwapState => ({ cumPV: 0, cumV: 0, sessionKey: null });

export function sessionKeyNY(tsSec: number): string {
  // yyyy-mm-dd in NY
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(tsSec * 1000));
}

export function vwapSeries(bars: Candle[]) {
  const out: LinePt[] = [];
  let st = vwapInit();
  for (const b of bars) {
    const sk = sessionKeyNY(b.time);
    if (st.sessionKey !== sk) st = { cumPV: 0, cumV: 0, sessionKey: sk };
    const tp = (b.high + b.low + b.close) / 3;
    const vol = b.volume ?? 0;
    st.cumPV += tp * vol;
    st.cumV += vol || 1; // avoid /0 for sparse data
    out.push({ time: b.time, value: +(st.cumPV / st.cumV).toFixed(6) });
  }
  return out;
}

export function vwapStep(state: VwapState, bar: Candle) {
  const sk = sessionKeyNY(bar.time);
  if (state.sessionKey !== sk) {
    state.cumPV = 0;
    state.cumV = 0;
    state.sessionKey = sk;
  }
  const tp = (bar.high + bar.low + bar.close) / 3;
  const vol = bar.volume ?? 0;
  state.cumPV += tp * vol;
  state.cumV += vol || 1;
  return state.cumPV / state.cumV;
}
