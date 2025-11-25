import { describe, it, expect } from 'vitest';
import { bollinger, kdj, supertrendBands, type Bar } from '../index';

describe('Bollinger', () => {
  it('emits bands, %B, and bandwidth with warmup NaNs', () => {
    const close = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5));
    const { mid, upper, lower, pctB, bw } = bollinger(close, 20, 2);
    expect(mid.length).toBe(60);
    expect(upper.length).toBe(60);
    expect(lower.length).toBe(60);
    expect(pctB.length).toBe(60);
    expect(bw.length).toBe(60);
    expect(pctB.some((v) => Number.isNaN(v))).toBe(true);
    expect(bw.filter((n) => !Number.isNaN(n)).every((n) => n >= 0)).toBe(true);
  });
});

describe('KDJ', () => {
  it('respects J = 3K - 2D and supports EMA mode', () => {
    const high = Array.from({ length: 80 }, (_, i) => 101 + Math.sin(i / 7) + 1);
    const low = Array.from({ length: 80 }, (_, i) => 99 + Math.sin(i / 7) - 1);
    const close = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 7));
    const { K, D, J } = kdj(high, low, close, 9, 3, 3, 'ema');
    const idx = J.length - 1;
    expect(J[idx]).toBeCloseTo(3 * K[idx] - 2 * D[idx], 8);
  });
});

describe('Supertrend (base)', () => {
  it('produces bands for each bar and behaves sanely on smooth series', () => {
    const bars: Bar[] = Array.from({ length: 120 }, (_, i) => {
      const c = 100 + Math.sin(i / 6) * 2;
      return { t: i, o: c, h: c + 1, l: c - 1, c };
    });
    const out = supertrendBands(bars, 10, 3);
    expect(out.length).toBe(120);
    // Loose sanity: upper should not be below lower on any bar.
    expect(out.every((p) => p.upper >= p.lower)).toBe(true);
  });
});
