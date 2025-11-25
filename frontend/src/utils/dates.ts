export function startOfDayUtc(t: number | Date): number {
  const d = typeof t === 'number' ? new Date(t) : t;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const DEFAULT_TZ = 'America/New_York';

export function startOfDayInZone(t: number | Date, tz: string = DEFAULT_TZ): number {
  // Derive the calendar date in the given zone using Intl, similar to session.ts helpers.
  const d = typeof t === 'number' ? new Date(t) : t;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const year = Number(parts.year ?? 1970);
  const month = Number(parts.month ?? 1);
  const day = Number(parts.day ?? 1);
  const hour = Number(parts.hour ?? 0);
  const minute = Number(parts.minute ?? 0);
  const second = Number(parts.second ?? 0);

  const approx = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = d.getTime() - approx;
  const midnightApprox = Date.UTC(year, month - 1, day, 0, 0, 0);

  return midnightApprox + offset;
}
