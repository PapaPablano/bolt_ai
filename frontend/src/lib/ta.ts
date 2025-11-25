export type SeriesPoint = { t: number; v: number };
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export function sma(src: SeriesPoint[], period: number): SeriesPoint[] {
  if (period <= 0 || src.length === 0) return [];
  const out: SeriesPoint[] = [];
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i].v;
    if (i >= period) sum -= src[i - period].v;
    if (i >= period - 1) {
      out.push({ t: src[i].t, v: sum / period });
    }
  }
  return out;
}

export function ema(src: SeriesPoint[], period: number): SeriesPoint[] {
  if (period <= 0 || src.length === 0) return [];
  const out: SeriesPoint[] = [];
  const k = 2 / (period + 1);
  let prevEma = src[0].v;
  out.push({ t: src[0].t, v: prevEma });
  for (let i = 1; i < src.length; i++) {
    const v = src[i].v * k + prevEma * (1 - k);
    prevEma = v;
    out.push({ t: src[i].t, v });
  }
  return out;
}

export function rsi(src: SeriesPoint[], period: number): SeriesPoint[] {
  if (period <= 0 || src.length < period + 1) return [];
  const out: SeriesPoint[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = src[i].v - src[i - 1].v;
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  let rsiVal = 100 - 100 / (1 + rs);
  out.push({ t: src[period].t, v: rsiVal });
  for (let i = period + 1; i < src.length; i++) {
    const diff = src[i].v - src[i - 1].v;
    let g = 0;
    let l = 0;
    if (diff > 0) g = diff;
    else l = -diff;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsiVal = 100 - 100 / (1 + rs);
    out.push({ t: src[i].t, v: rsiVal });
  }
  return out;
}

export function macd(
  src: SeriesPoint[],
  fast: number,
  slow: number,
  signal: number
): { macd: SeriesPoint[]; signal: SeriesPoint[]; hist: SeriesPoint[] } {
  if (src.length === 0) {
    return { macd: [], signal: [], hist: [] };
  }
  const fastEma = ema(src, fast);
  const slowEma = ema(src, slow);
  const minLen = Math.min(fastEma.length, slowEma.length);
  const macdSeries: SeriesPoint[] = [];
  for (let i = 0; i < minLen; i++) {
    const idxFast = fastEma.length - minLen + i;
    const idxSlow = slowEma.length - minLen + i;
    const v = fastEma[idxFast].v - slowEma[idxSlow].v;
    macdSeries.push({ t: slowEma[idxSlow].t, v });
  }
  const signalSeries = ema(macdSeries, signal);
  const minLen2 = Math.min(macdSeries.length, signalSeries.length);
  const histSeries: SeriesPoint[] = [];
  for (let i = 0; i < minLen2; i++) {
    const idxMacd = macdSeries.length - minLen2 + i;
    const idxSig = signalSeries.length - minLen2 + i;
    const v = macdSeries[idxMacd].v - signalSeries[idxSig].v;
    histSeries.push({ t: signalSeries[idxSig].t, v });
  }
  return { macd: macdSeries, signal: signalSeries, hist: histSeries };
}

export function bbands(
  src: SeriesPoint[],
  period: number,
  mult: number
): { upper: SeriesPoint[]; mid: SeriesPoint[]; lower: SeriesPoint[] } {
  if (period <= 0 || src.length < period) {
    return { upper: [], mid: [], lower: [] };
  }
  const mid: SeriesPoint[] = [];
  const upper: SeriesPoint[] = [];
  const lower: SeriesPoint[] = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i].v;
    sum += v;
    sumSq += v * v;
    if (i >= period) {
      const vOld = src[i - period].v;
      sum -= vOld;
      sumSq -= vOld * vOld;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = sumSq / period - mean * mean;
      const std = Math.sqrt(Math.max(variance, 0));
      const t = src[i].t;
      mid.push({ t, v: mean });
      upper.push({ t, v: mean + mult * std });
      lower.push({ t, v: mean - mult * std });
    }
  }
  return { upper, mid, lower };
}
