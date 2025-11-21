import type { CandlestickData, Time } from 'lightweight-charts';

const MINUTE_MS = 60_000;

export function genMockBars({ minutes = 900, end = Date.now() }: { minutes?: number; end?: number } = {}): CandlestickData[] {
  const out: CandlestickData[] = [];
  let cursor = end - minutes * MINUTE_MS;
  let price = 100;
  for (let i = 0; i < minutes; i += 1) {
    const open = price;
    const drift = (Math.random() - 0.5) * 0.6;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random();
    const low = Math.min(open, close) - Math.random();
    out.push({
      time: Math.floor(cursor / 1000) as Time,
      open,
      high,
      low,
      close,
    });
    price = close;
    cursor += MINUTE_MS;
  }
  return out;
}
