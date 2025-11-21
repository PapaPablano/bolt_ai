import { describe, it, expect } from 'vitest';
import { resolveSessionOpenMs, makeSessionResolver, type TradingCalendar } from './session';

const msUtc = (y: number, m: number, d: number, h: number, mi: number, s: number) => Date.UTC(y, m - 1, d, h, mi, s);

describe('resolveSessionOpenMs', () => {
  it('anchors pre-open to same-day 09:30 ET', () => {
    // 2024-07-08 Mon 12:00 UTC ≈ 08:00 ET (pre-open)
    const t = msUtc(2024, 7, 8, 12, 0, 0);
    const open = resolveSessionOpenMs(t);
    expect(open).toBe(msUtc(2024, 7, 8, 13, 30, 0));
  });

describe('resolveSessionOpenMs – DST edges', () => {
  it('anchors to 09:30 ET on the Monday after DST start', () => {
    const resolve = makeSessionResolver();
    const t = Date.UTC(2024, 2, 11, 12, 50, 0);
    expect(resolve(t)).toBe(Date.UTC(2024, 2, 11, 13, 30, 0));
  });

  it('anchors to 09:30 ET on the Monday after DST end', () => {
    const resolve = makeSessionResolver();
    const t = Date.UTC(2024, 10, 4, 13, 0, 0);
    expect(resolve(t)).toBe(Date.UTC(2024, 10, 4, 14, 30, 0));
  });
});

describe('resolveSessionOpenMs – holiday handling with stub calendar', () => {
  const HOLIDAY = Date.UTC(2024, 0, 1);
  const cal: TradingCalendar = {
    isTradingDay: (midnight) => midnight !== HOLIDAY,
    nextTradingMidnight: (midnight, dir) => {
      let cursor = midnight;
      do {
        cursor += dir * 24 * 60 * 60 * 1000;
      } while (cursor === HOLIDAY);
      return cursor;
    },
  };

  it('skips a holiday Monday and anchors to Tuesday 09:30 ET', () => {
    const resolve = makeSessionResolver(cal);
    const t = Date.UTC(2024, 0, 1, 14, 0, 0);
    expect(resolve(t)).toBe(Date.UTC(2024, 0, 2, 14, 30, 0));
  });

  it('post-close ahead of the holiday anchors to Tuesday (skipping holiday)', () => {
    const resolve = makeSessionResolver(cal);
    const dec29FriPostClose = Date.UTC(2023, 11, 30, 23, 0, 0);
    expect(resolve(dec29FriPostClose)).toBe(Date.UTC(2024, 0, 2, 14, 30, 0));
  });
});

  it('moves post-close to next trading day 09:30 ET', () => {
    // 2024-07-08 Mon 21:30 UTC ≈ 17:30 ET (after close)
    const t = msUtc(2024, 7, 8, 21, 30, 0);
    const open = resolveSessionOpenMs(t);
    expect(open).toBe(msUtc(2024, 7, 9, 13, 30, 0));
  });

  it('skips weekend to Monday 09:30 ET', () => {
    // 2024-07-13 Sat 15:00 UTC
    const t = msUtc(2024, 7, 13, 15, 0, 0);
    const open = resolveSessionOpenMs(t);
    expect(open).toBe(msUtc(2024, 7, 15, 13, 30, 0));
  });
});
