import { DateTime } from 'luxon';

const NY_TZ = 'America/New_York';

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
  const dt = DateTime.fromMillis(msUtc, { zone: NY_TZ });
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayIndex = Math.max(1, Math.min(dt.weekday, 7));
  return {
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second,
    weekday: weekdayNames[weekdayIndex - 1] ?? 'Mon',
  };
}

// Midnight in ET (returned as UTC ms)
export function etMidnightUtc(msUtc: number) {
  const dt = DateTime.fromMillis(msUtc, { zone: NY_TZ });
  const midnightEt = dt.startOf('day');
  return midnightEt.toMillis();
}

function etMinutesSinceMidnight(msUtc: number): number {
  const p = toEtParts(msUtc);
  return p.hour * 60 + p.minute + p.second / 60;
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

  // Be maximally forgiving about what callers pass (number | Date | ISO)
  function toMs(input: unknown): number {
    if (typeof input === 'number') return input;
    if (input instanceof Date) return input.getTime();
    if (typeof input === 'string') {
      const parsed = Date.parse(input);
      if (Number.isFinite(parsed)) return parsed;
    }

    type ValueOfCapable = { valueOf?: () => unknown };
    const candidateValue = (input as ValueOfCapable)?.valueOf?.();
    const candidate = typeof candidateValue === 'number' ? candidateValue : candidateValue ?? input;
    const n = Number(candidate);
    return Number.isFinite(n) ? n : NaN;
  }

  return function resolveSessionOpenMs(msUtc: number): number {
    const ts = toMs(msUtc);
    if (!Number.isFinite(ts)) {
      // Hard fail early so tests surface the real culprit.
      throw new Error('resolveSessionOpenMs: invalid msUtc input');
    }

    const midnight = etMidnightUtc(ts);
    const closedToday = isFullClosure(midnight);

    if (closedToday) {
      const next = shiftMidnight(midnight, 1);
      return next + openOffset();
    }

    const open = midnight + openOffset();
    const close = midnight + closeOffsetFor(midnight);

    // primary numeric check + ET time-of-day fallback
    const afterCloseNumeric = ts >= close;
    const minutesNowET = etMinutesSinceMidnight(ts);
    const closeMinutesET = closeOffsetFor(midnight) / 60000;
    const afterCloseET = minutesNowET >= closeMinutesET;

    if (ts < open) return open;
    if (afterCloseNumeric || afterCloseET) {
      const next = shiftMidnight(midnight, 1);
      return next + openOffset();
    }
    return open;
  };
}

export const resolveSessionOpenMs = makeSessionResolver();
