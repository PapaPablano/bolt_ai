export type Tf = '1m' | '5m' | '10m' | '15m' | '1h' | '4h' | '1d';
export type Ohlc = { time: number; open: number; high: number; low: number; close: number; volume: number };

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8001';
const DAY_MS = 86_400_000;

const UI_TF_MAP: Record<string, Tf> = {
  '1m': '1m',
  '1min': '1m',
  '1minute': '1m',
  '5m': '5m',
  '5min': '5m',
  '5minute': '5m',
  '10m': '10m',
  '10min': '10m',
  '10minute': '10m',
  '15m': '15m',
  '15min': '15m',
  '15minute': '15m',
  '1h': '1h',
  '1hr': '1h',
  '1hour': '1h',
  '4h': '4h',
  '4hr': '4h',
  '4hour': '4h',
  '1d': '1d',
  '1day': '1d',
  'daily': '1d',
};

const RANGE_DAYS: Record<string, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '2Y': 730,
  '5Y': 1825,
  '10Y': 3650,
  'MAX': 3650,
};

const INTRADAY_TFS = new Set<Tf>(['1m', '5m', '10m', '15m']);
const HOURLY_TFS = new Set<Tf>(['1h', '4h']);

export function toApiTimeframe(tfInput: string | undefined | null): Tf {
  const key = tfInput?.toString?.().toLowerCase().replace(/[^0-9a-z]/g, '') ?? '';
  return UI_TF_MAP[key] ?? '1d';
}

export function buildRangeBounds(tfInput: string, range?: string, nowMs = Date.now()): { tf: Tf; startMs: number; endMs: number } {
  const tf = toApiTimeframe(tfInput);
  const rangeKey = range?.toUpperCase?.() ?? '6M';
  const days = RANGE_DAYS[rangeKey] ?? 180;

  let capDays = days;
  if (INTRADAY_TFS.has(tf)) {
    capDays = Math.min(days, 90);
  } else if (HOURLY_TFS.has(tf)) {
    capDays = Math.min(days, 365);
  } else {
    capDays = Math.min(days, 3650);
  }

  const endMs = nowMs;
  const startMs = Math.max(0, endMs - capDays * DAY_MS);
  return { tf, startMs, endMs };
}

export async function fetchOHLC(symbol: string, tf: Tf, startMs: number, endMs: number): Promise<Ohlc[]> {
  const url = new URL(`${API_BASE}/ohlc`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('tf', tf);
  url.searchParams.set('start', String(startMs));
  url.searchParams.set('end', String(endMs));

  const res = await fetch(url.toString(), { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`OHLC request failed (${res.status})`);
  }

  const json = await res.json();
  const bars = Array.isArray(json?.bars) ? json.bars : [];
  return bars as Ohlc[];
}

export function windowFromDays(tfInput: string, days: number, nowMs = Date.now()) {
  const tf = toApiTimeframe(tfInput);
  const endMs = nowMs;
  const startMs = Math.max(0, endMs - Math.max(1, days) * DAY_MS);
  return { tf, startMs, endMs };
}
