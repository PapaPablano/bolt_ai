import type { Bar } from '@/types/bars';

export const toSec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export function sma(bars: Bar[], period: number): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  const queue: number[] = [];
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    const close = bars[i].close;
    queue.push(close);
    sum += close;

    if (queue.length > period) {
      sum -= queue.shift()!;
    }
    if (queue.length === period) {
      out.push({ time: toSec(bars[i].time), value: +(sum / period).toFixed(5) });
    }
  }
  return out;
}

export function ema(bars: Bar[], period: number): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  const k = 2 / (period + 1);
  let prev: number | undefined;

  for (let i = 0; i < bars.length; i++) {
    const close = bars[i].close;
    const value = prev === undefined ? close : (close - prev) * k + prev;
    prev = value;
    if (i >= period - 1) {
      out.push({ time: toSec(bars[i].time), value: +value.toFixed(5) });
    }
  }
  return out;
}

export function bollinger(bars: Bar[], period: number, mult: number) {
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];

  const queue: number[] = [];
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < bars.length; i++) {
    const close = bars[i].close;
    queue.push(close);
    sum += close;
    sumSq += close * close;

    if (queue.length > period) {
      const x = queue.shift()!;
      sum -= x;
      sumSq -= x * x;
    }

    if (queue.length === period) {
      const mean = sum / period;
      const variance = sumSq / period - mean * mean;
      const sd = Math.sqrt(Math.max(variance, 0));
      const time = toSec(bars[i].time);
      middle.push({ time, value: +mean.toFixed(5) });
      upper.push({ time, value: +(mean + mult * sd).toFixed(5) });
      lower.push({ time, value: +(mean - mult * sd).toFixed(5) });
    }
  }

  return { upper, middle, lower };
}

export function rsi(bars: Bar[], period: number) {
  const out: { time: number; value: number }[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    out.push({ time: toSec(bars[i].time), value: +value.toFixed(2) });
  }

  return out;
}
