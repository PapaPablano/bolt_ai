// Shared frontend API helpers
import { api } from '@/lib/api/client';

export type SearchHit = {
  symbol: string;
  name?: string;
  exchange?: string;
};

export type ApiPayload = {
  ok: boolean;
  error?: string;
} & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const toSearchHit = (raw: unknown): SearchHit | null => {
  if (!isRecord(raw)) return null;

  const symbol = getString(raw.symbol) ?? getString(raw.ticker);
  if (!symbol) return null;

  const name = getString(raw.name) ?? getString(raw.companyName) ?? getString(raw.description);
  const exchange = getString(raw.exchange) ?? getString(raw.primaryExchange);

  return {
    symbol,
    ...(name ? { name } : {}),
    ...(exchange ? { exchange } : {}),
  } satisfies SearchHit;
};

export async function jsonOrText(res: Response): Promise<ApiPayload> {
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('application/json')) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      return { ok: res.ok, error: 'Invalid JSON response' };
    }

    if (isRecord(data)) {
      const baseOk = 'ok' in data ? data.ok : undefined;
      const okValue = typeof baseOk === 'boolean' ? baseOk : res.ok;
      return { ok: okValue, ...data };
    }

    return { ok: res.ok, data };
  }

  return { ok: res.ok, error: await res.text() };
}

/**
 * Edge-aware URL resolver:
 * - With Vite proxy, pass "/api/..." directly.
 * - If VITE_EDGE_BASE_URL is set, "/api/foo" → "<BASE>/foo".
 */
export function edgeUrl(pathAndQuery: string) {
  const base = import.meta.env?.VITE_EDGE_BASE_URL as string | undefined;
  if (!base) return pathAndQuery;
  return `${base}${pathAndQuery.replace(/^\/api/, '')}`;
}

const _searchCache = new Map<string, { ts: number; hits: SearchHit[] }>();
const TTL_MS = 30_000;

/** Stock search via Edge function; lightweight 30s in-memory cache. */
export async function fetchStockSearch(
  q: string,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<SearchHit[]> {
  const query = q.trim();
  const limit = opts.limit ?? 8;
  if (!query) return [];

  const key = `${query}::${limit}`;
  const cached = _searchCache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.hits;

  const qs = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  const res = await api(`/api/stock-search?${qs}`, { signal: opts.signal });
  const payload = await jsonOrText(res);

  if (!payload?.ok) {
    console.warn('stock-search error:', payload?.error ?? 'unknown');
    return [];
  }

  const rawResults = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.data)
      ? payload.data
      : [];

  const hits = rawResults
    .map((result) => toSearchHit(result))
    .filter((hit): hit is SearchHit => Boolean(hit));

  _searchCache.set(key, { ts: Date.now(), hits });
  return hits;
}

export async function fetchHistoricalData(
  symbol: string,
  rangeOrOpts: string | {
    range?: string;
    interval?: string;
    start?: string;
    end?: string;
    signal?: AbortSignal;
  } = {},
) {
  const opts =
    typeof rangeOrOpts === 'string' ? { range: rangeOrOpts } : (rangeOrOpts ?? {});

  const sym = symbol.trim().toUpperCase();
  const params = new URLSearchParams({ symbol: sym });
  if (opts.range) params.set('range', opts.range);
  if (opts.interval) params.set('interval', opts.interval);
  if (opts.start) params.set('start', opts.start);
  if (opts.end) params.set('end', opts.end);
  const res = await api(`/api/stock-historical-v3?${params.toString()}`, {
    signal: opts.signal,
  });
  const payload = await jsonOrText(res);
  if (!payload?.ok) throw new Error(payload?.error || 'historical failed');
  return payload.data ?? payload.results ?? payload;
}

export async function fetchIntradayData(
  symbol: string,
  opts: { interval?: string; limit?: number; signal?: AbortSignal } = {},
) {
  const sym = symbol.trim().toUpperCase();
  const params = new URLSearchParams({ symbol: sym });
  if (opts.interval) params.set('interval', opts.interval);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  const res = await api(`/api/stock-intraday?${params.toString()}`, {
    signal: opts.signal,
  });
  const payload = await jsonOrText(res);
  if (!payload?.ok) throw new Error(payload?.error || 'intraday failed');
  return payload.data ?? payload.results ?? payload;
}

export async function fetchQuote(symbol: string, opts: { signal?: AbortSignal } = {}) {
  const sym = symbol.trim().toUpperCase();
  const res = await api('/api/stock-quote', {
    method: 'POST',
    signal: opts.signal,
    body: JSON.stringify({ symbol: sym }),
  });

  const ct = res.headers.get('content-type') || '';
  const rawText = await res.text();

  let parsed: unknown = rawText;
  if (ct.includes('application/json')) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // fall through to text-based error handling below
    }
  }

  if (!res.ok) {
    let message = rawText || res.statusText || 'quote failed';
    if (isRecord(parsed)) {
      const parsedMessage = getString(parsed.error) ?? getString(parsed.message);
      if (parsedMessage) {
        message = parsedMessage;
      }
    }
    throw new Error(message);
  }

  if (isRecord(parsed)) {
    const data = parsed.data ?? parsed.quote ?? parsed;
    return data;
  }

  return parsed;
}

// Compat types for legacy imports from '../lib/api'
export type StockQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
};

export type BarData = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// DashboardPage.tsx expects fetchStockQuote; delegate to the edge-based fetchQuote helper.
export async function fetchStockQuote(symbol: string, opts: { signal?: AbortSignal } = {}) {
  return fetchQuote(symbol, opts);
}
