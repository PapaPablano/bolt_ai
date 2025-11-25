import { startOfDayInZone } from './dates';

const NY_TZ = 'America/New_York';

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

export type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

export const WEEKEND = new Set(['Sat', 'Sun']);
export const OPEN_OFFSET_MS = (9 * 60 + 30) * 60 * 1000;
export const CLOSE_OFFSET_MS = 16 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function toEtParts(msUtc: number): EtParts {
  const entries = etFormatter.formatToParts(msUtc).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(entries.year ?? 1970),
    month: Number(entries.month ?? 1),
    day: Number(entries.day ?? 1),
    hour: Number(entries.hour ?? 0),
    minute: Number(entries.minute ?? 0),
    second: Number(entries.second ?? 0),
    weekday: String(entries.weekday ?? 'Mon'),
  };
}

// Midnight in ET (returned as UTC ms)
export function etMidnightUtc(msUtc: number) {
  return startOfDayInZone(msUtc, 'America/New_York');
}

export type TradingCalendar = {
  isTradingDay(msUtcMidnight: number): boolean;
  nextTradingMidnight(msUtcMidnight: number, dir: -1 | 1): number;
  /** True if the full day is closed (e.g., NYSE holiday). */
  isFullHoliday?(msUtcMidnight: number): boolean;
  /** True if the session closes early (half-day). */
  isHalfDay?(msUtcMidnight: number): boolean;
  /** Overrideable session timing offsets. */
  openOffsetMs?: number;
  closeOffsetMs?: number;
  halfDayCloseOffsetMs?: number;
};
export function makeSessionResolver(calendar?: TradingCalendar) {
  const openOffset = () => calendar?.openOffsetMs ?? OPEN_OFFSET_MS;
  const closeOffsetFor = (midnightMs: number) => {
    const isHalf = calendar?.isHalfDay?.(midnightMs) === true;
    if (isHalf) return calendar?.halfDayCloseOffsetMs ?? 13 * 60 * 60 * 1000; // 13:00 ET default
    return calendar?.closeOffsetMs ?? CLOSE_OFFSET_MS;
  };

  const isFullClosure = (midnightMs: number) => {
    const weekday = toEtParts(midnightMs).weekday;
    if (WEEKEND.has(weekday)) return true;
    if (calendar?.isFullHoliday?.(midnightMs) === true) return true;
    if (calendar?.isTradingDay && !calendar.isTradingDay(midnightMs)) return true;
    return false;
  };

  const shiftMidnight = (midnightMs: number, direction: -1 | 1) => {
    let cursor = midnightMs;
    const limit = 32; // plenty to skip multi-day closures
    for (let i = 0; i < limit; i++) {
      let next: number;
      if (calendar) {
        next = calendar.nextTradingMidnight(cursor, direction);
      } else {
        // Keep advancing by whole days until we land on a non-weekend day.
        do {
          cursor = etMidnightUtc(cursor + direction * DAY_MS);
        } while (WEEKEND.has(toEtParts(cursor).weekday));
        next = cursor;
      }
      if (!isFullClosure(next)) return next;
      cursor = next;
    }
    return cursor;
  };

  return function resolveSessionOpenMs(msUtc: number): number {
    const midnight = etMidnightUtc(msUtc);
    const closedToday = isFullClosure(midnight);

    if (closedToday) {
      const next = shiftMidnight(midnight, 1);
      return next + openOffset();
    }

    const open = midnight + openOffset();
    const close = midnight + closeOffsetFor(midnight);
    if (msUtc < open) return open;
    if (msUtc >= close) {
      const next = shiftMidnight(midnight, 1);
      return next + openOffset();
    }
    return open;
  };
}

export const resolveSessionOpenMs = makeSessionResolver();
