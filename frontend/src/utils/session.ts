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

export function etMidnightUtc(msUtc: number) {
  const parts = toEtParts(msUtc);
  const approx = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = msUtc - approx;
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) + offset;
}

export type TradingCalendar = {
  isTradingDay(msUtcMidnight: number): boolean;
  nextTradingMidnight(msUtcMidnight: number, dir: -1 | 1): number;
};

export function makeSessionResolver(calendar?: TradingCalendar) {
  const isWeekend = (weekday: string) => weekday === 'Sat' || weekday === 'Sun';

  const shiftMidnight = (midnightMs: number, direction: -1 | 1) => {
    if (!calendar) {
      let cursor = midnightMs;
      for (let i = 0; i < 7; i++) {
        cursor += direction * DAY_MS;
        const weekday = toEtParts(cursor).weekday;
        if (!isWeekend(weekday)) return cursor;
      }
      return midnightMs;
    }
    return calendar.nextTradingMidnight(midnightMs, direction);
  };

  return function resolveSessionOpenMs(msUtc: number): number {
    const midnight = etMidnightUtc(msUtc);
    const weekday = toEtParts(msUtc).weekday;
    const isTradingDay = calendar ? calendar.isTradingDay(midnight) : !isWeekend(weekday);

    if (!isTradingDay) {
      const next = shiftMidnight(midnight, 1);
      return next + OPEN_OFFSET_MS;
    }

    const open = midnight + OPEN_OFFSET_MS;
    const close = midnight + CLOSE_OFFSET_MS;
    if (msUtc < open) return open;
    if (msUtc >= close) {
      const next = shiftMidnight(midnight, 1);
      return next + OPEN_OFFSET_MS;
    }
    return open;
  };
}

export const resolveSessionOpenMs = makeSessionResolver();
