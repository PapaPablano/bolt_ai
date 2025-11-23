import { describe, it, expect } from 'vitest';
import { __test as ChartTest } from './AdvancedCandleChart';

const { mergePanePatch, shouldIgnoreLiveBar } = ChartTest;

describe('mergePanePatch', () => {
  it('replaces tail when patch time equals last', () => {
    const prev = [
      { time: 10, value: 1 },
      { time: 20, value: 2 },
    ];
    const patch = [{ time: 20, value: 3 }];
    expect(mergePanePatch(prev, patch)).toEqual([
      { time: 10, value: 1 },
      { time: 20, value: 3 },
    ]);
  });

  it('appends when newer time arrives', () => {
    const prev = [{ time: 20, value: 2 }];
    const patch = [{ time: 30, value: 5 }];
    expect(mergePanePatch(prev, patch)).toEqual([
      { time: 20, value: 2 },
      { time: 30, value: 5 },
    ]);
  });

  it('no-op for empty patch', () => {
    const prev = [{ time: 20, value: 2 }];
    expect(mergePanePatch(prev, [])).toEqual(prev);
  });
});

describe('shouldIgnoreLiveBar', () => {
  it('returns false when no bounds are set', () => {
    expect(shouldIgnoreLiveBar(100, null)).toBe(false);
  });

  it('returns false when time is inside bounds', () => {
    expect(shouldIgnoreLiveBar(150, { from: 100, to: 200 })).toBe(false);
  });

  it('returns true when time is before bounds', () => {
    expect(shouldIgnoreLiveBar(50, { from: 100, to: 200 })).toBe(true);
  });

  it('returns true when time is after bounds', () => {
    expect(shouldIgnoreLiveBar(250, { from: 100, to: 200 })).toBe(true);
  });
});
