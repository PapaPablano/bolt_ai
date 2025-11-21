import type { CandlestickData, Time } from 'lightweight-charts';

const MINUTE_MS = 60_000;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function genMockBars({ minutes = 900, end = Date.now(), seed = 1 }: { minutes?: number; end?: number; seed?: number } = {}): CandlestickData[] {
  const out: CandlestickData[] = [];
  let cursor = end - minutes * MINUTE_MS;
  let price = 100;
  const rand = mulberry32(seed);

  for (let i = 0; i < minutes; i += 1) {
    const open = price;
    const drift = (rand() - 0.5) * 0.6;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rand();
    const low = Math.min(open, close) - rand();
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
