// DST-safe NYSE anchoring helpers without external deps.

const TF_TO_SEC: Record<string, number> = {
  '1Min': 60,
  '5Min': 300,
  '10Min': 600,
  '15Min': 900,
  '1Hour': 3600,
  '4Hour': 14_400,
  '1Day': 86_400,
};

const NY_TZ = 'America/New_York';
const OPEN_SEC = 9 * 3600 + 30 * 60; // 09:30:00
const CLOSE_SEC = 16 * 3600; // 16:00:00

function easternParts(tsMs: number) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(tsMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const h = map.hour ?? 0;
  const m = map.minute ?? 0;
  const s = map.second ?? 0;
  return {
    y: map.year,
    mo: map.month,
    d: map.day,
    h,
    m,
    s,
    secSinceMidnight: h * 3600 + m * 60 + s,
  };
}

export function tfToBucketSec(tf: string) {
  return TF_TO_SEC[tf] ?? 60;
}

export function alignNYSEBucketStartSec(tsSec: number, timeframe: string): number {
  if (timeframe === '1Day') return Math.floor(tsSec / 86_400) * 86_400;

  const bucketSec = tfToBucketSec(timeframe);
  const { secSinceMidnight } = easternParts(tsSec * 1000);

  const sinceOpen = Math.max(0, secSinceMidnight - OPEN_SEC);
  const alignedLocal = Math.floor(sinceOpen / bucketSec) * bucketSec;

  const remainder = sinceOpen - alignedLocal;
  return tsSec - remainder;
}

export function isAfterCloseNY(tsSec: number) {
  const { secSinceMidnight } = easternParts(tsSec * 1000);
  return secSinceMidnight >= CLOSE_SEC;
}
