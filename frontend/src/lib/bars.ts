import type { Bar } from '@/types/bars';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toIso = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : date.toISOString();
};

const normalizeBar = (raw: Record<string, unknown>): Bar | null => {
  const time = toIso(raw.time ?? raw.t ?? raw.timestamp ?? raw.date ?? raw.start ?? raw.at);
  const open = toNumber(raw.open ?? raw.o);
  const high = toNumber(raw.high ?? raw.h);
  const low = toNumber(raw.low ?? raw.l);
  const close = toNumber(raw.close ?? raw.c);
  const volume = toNumber(raw.volume ?? raw.v ?? raw.vol ?? raw.tradeVolume) ?? 0;

  if (!time || open === null || high === null || low === null || close === null) {
    return null;
  }

  return { time, open, high, low, close, volume };
};

export const normalizeBarsPayload = (payload: unknown): Bar[] => {
  const maybeArray =
    (Array.isArray(payload) && payload) ||
    (payload as Record<string, unknown>)?.bars ||
    (payload as Record<string, unknown>)?.data ||
    [];

  if (!Array.isArray(maybeArray)) return [];

  return maybeArray
    .map((entry) => (entry && typeof entry === 'object' ? normalizeBar(entry as Record<string, unknown>) : null))
    .filter((bar): bar is Bar => Boolean(bar));
};
