import type { TF as PrefTF } from '@/types/prefs';

export type TF = PrefTF;

export const TF_SEC: Record<TF, number> = {
  '1Min': 60,
  '5Min': 300,
  '10Min': 600,
  '15Min': 900,
  '1Hour': 3600,
  '4Hour': 14_400,
  '1Day': 86_400,
};

const NY_TZ = 'America/New_York';
const OPEN_ET = 9 * 3600 + 30 * 60; // 09:30:00 ET
const CLOSE_ET = 16 * 3600; // 16:00:00 ET (kept for completeness if needed elsewhere)

const fmt = new Intl.DateTimeFormat('en-US', {
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

type EasternParts = {
  y: number;
  mo: number;
  d: number;
  wd: string;
  sec: number;
};

function partsET(msUtc: number): EasternParts {
  const parts = fmt
    .formatToParts(msUtc)
    .filter((x) => x.type !== 'literal')
    .reduce<Record<string, string>>((acc, cur) => {
      acc[cur.type] = cur.value;
      return acc;
    }, {});
  const hour = Number(parts.hour ?? 0);
  const minute = Number(parts.minute ?? 0);
  const second = Number(parts.second ?? 0);
  return {
    y: Number(parts.year ?? 1970),
    mo: Number(parts.month ?? 1),
    d: Number(parts.day ?? 1),
    wd: String(parts.weekday ?? 'Mon'),
    sec: hour * 3600 + minute * 60 + second,
  };
}

function isWeekend(wd: string) {
  return wd === 'Sat' || wd === 'Sun';
}

function prevBizDayMs(msUtc: number) {
  const d = new Date(msUtc);
  for (let i = 0; i < 7; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const weekday = fmt.formatToParts(d).find((part) => part.type === 'weekday')?.value as string | undefined;
    if (weekday && !isWeekend(weekday)) return d.getTime();
  }
  return msUtc;
}

function sessionOpenUtcSec(tsSec: number) {
  const ms = tsSec * 1000;
  const parts = partsET(ms);
  const baseMs = isWeekend(parts.wd) || parts.sec < OPEN_ET ? prevBizDayMs(ms) : ms;
  const pt = partsET(baseMs);
  const midnightEtMs = new Date(
    new Date(Date.UTC(pt.y, pt.mo - 1, pt.d, 5, 0, 0)).toLocaleString('en-US', { timeZone: NY_TZ }),
  ).getTime();
  return Math.floor((midnightEtMs + OPEN_ET * 1000) / 1000);
}

export function alignNYSEBucketStartUtcSec(tsSec: number, tf: TF) {
  if (tf === '1Day') return Math.floor(tsSec / TF_SEC['1Day']) * TF_SEC['1Day'];
  const open = sessionOpenUtcSec(tsSec);
  const step = bucketSec(tf);
  const idx = Math.max(0, Math.floor((tsSec - open) / step));
  return open + idx * step;
}

export const bucketSec = (tf: TF) => TF_SEC[tf];

export const toIso = (sec: number) => new Date(sec * 1000).toISOString();
export const toSec = (x: number | string) =>
  typeof x === 'number'
    ? x > 1e12
      ? Math.floor(x / 1000)
      : Math.floor(x)
    : Math.floor(new Date(x).getTime() / 1000);

export { CLOSE_ET };
