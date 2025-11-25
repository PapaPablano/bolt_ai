import { describe, it, expect } from 'vitest';
import { supertrendAI, type Bar } from '../index';

describe('Supertrend AI', () => {
  it('is deterministic (seeded) and returns one point per bar', () => {
    const bars: Bar[] = Array.from({ length: 200 }, (_, i) => {
      const drift = i > 100 ? (i - 100) * 0.01 : 0;
      const c = 100 + Math.sin(i / 10) * 1.5 + drift;
      return { t: i, o: c, h: c + 1, l: c - 1, c };
    });

    const opts = {
      atrPeriod: 10,
      factorMin: 1,
      factorMax: 5,
      factorStep: 0.5,
      perfAlpha: 0.2,
      seed: 42,
    } as const;

    const a = supertrendAI(bars, opts);
    const b = supertrendAI(bars, opts);

    expect(a.bands.length).toBe(bars.length);
    expect(a.factor.length).toBe(bars.length);
    expect(a.perf.length).toBe(bars.length);
    expect(a.cluster.length).toBe(bars.length);
    expect(JSON.stringify(a.bands)).toBe(JSON.stringify(b.bands));
    expect(JSON.stringify(a.factor)).toBe(JSON.stringify(b.factor));
  });
});
