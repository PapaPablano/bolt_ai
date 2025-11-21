import { describe, it, expect } from 'vitest';
import { __test as ChartTest } from './AdvancedCandleChart';

const { mergePanePatch } = ChartTest;

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
