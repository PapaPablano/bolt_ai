import { describe, it, expect } from 'vitest';
import type { BusinessDay } from 'lightweight-charts';
import { fromChartTimeValue } from '../../utils/timeUtils';

describe('fromChartTimeValue', () => {
  it('parses yyyy-mm-dd strings to seconds UTC', () => {
    const secs = Math.floor(Date.UTC(2024, 0, 5) / 1000);
    expect(fromChartTimeValue('2024-01-05')).toBe(secs);
  });

  it('parses BusinessDay objects to seconds UTC', () => {
    const bd: BusinessDay = { year: 2024, month: 1, day: 5 };
    const secs = Math.floor(Date.UTC(2024, 0, 5) / 1000);
    expect(fromChartTimeValue(bd)).toBe(secs);
  });
});
