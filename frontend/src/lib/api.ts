// Shared frontend API helpers
import { api } from '@/lib/api/client';

export type SearchHit = {
  symbol: string;
  name?: string;
  exchange?: string;
};

export async function jsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';

  if (ct.includes('application/json')) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      return { ok: res.ok, error: 'Invalid JSON response' };
    }

    const baseOk = data && typeof data === 'object' && 'ok' in data ? (data as any).ok : undefined;
    return { ok: baseOk ?? res.ok, ...(data ?? {}) };
  }

  return { ok: res.ok, error: await res.text() };
}

/**
 * Edge-aware URL resolver:
 * - With Vite proxy, pass "/api/..." directly.
 * - If VITE_EDGE_BASE_URL is set, "/api/foo" → "<BASE>/foo".
 */
export function edgeUrl(pathAndQuery: string) {
  const base = (import.meta as any)?.env?.VITE_EDGE_BASE_URL as string | undefined;
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

  const hits = (payload.results ?? []).map((r: any) => ({
    symbol: r.symbol ?? r.ticker ?? '',
    name: r.name ?? r.companyName ?? r.description ?? '',
    exchange: r.exchange ?? r.primaryExchange ?? '',
  })) as SearchHit[];

  const cleaned = hits.filter((h) => h.symbol);
  _searchCache.set(key, { ts: Date.now(), hits: cleaned });
  return cleaned;
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

  let parsed: any = rawText;
  if (ct.includes('application/json')) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // fall through to text-based error handling below
    }
  }

  if (!res.ok) {
    const message =
      (parsed && (parsed.error || parsed.message)) ||
      rawText ||
      res.statusText ||
      'quote failed';
    throw new Error(message);
  }

  const payload = parsed;
  return payload.data ?? payload.quote ?? payload;
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
