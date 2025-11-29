import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import Tooltip from '@/components/ui/Tooltip';
import { GradeBadge } from '@/components/options/GradeBadge';
import { fetchStockSearch, type SearchHit } from '@/lib/api';
import { api } from '@/lib/api/client';

export type RankedRow = {
  rank: number;
  contract: {
    id: number;
    strike: number;
    expiry: string;
    dte: number;
    bid: number;
    ask: number;
    iv: number;
    oi: number;
    vol: number;
    lastQuoteAt?: string;
    side: 'call' | 'put';
    delta?: number;
  };
  theo: number;
  ivp: number;
  scores: Record<string, number>;
  finalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  gate: { mult: number; reasons: string[] };
  adjustments: string[];
};

type RankDebug = {
  total: number;
  sideFiltered: number;
  dteFiltered: number;
  quotePresent: number;
  quoteQualityPass: number;
  dropped: {
    noQuote: number;
    zeroAsk: number;
    zeroIv: number;
    zeroOi: number;
    stale: number;
  };
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const pct = (x?: number) => `${Math.round((x ?? 0) * 100)}%`;

const spreadPct = (bid?: number, ask?: number) => {
  const b = bid ?? 0;
  const a = ask ?? 0;
  return a > 0 ? (a - b) / a : 0;
};

// ---- Column help text (short + clear) ----
const COL_HINTS: Record<string, string> = {
  grade: 'Letter grade derived from the finalScore (A=best).',
  strike: 'Option strike price.',
  expiry: 'Contract expiration date.',
  dte: 'Days to expiration (calendar days).',
  theo: 'Model theoretical value for the contract.',
  bid: 'Best bid price.',
  ask: 'Best ask price.',
  spread: 'Relative spread = (Ask − Bid) / Ask.',
  iv: 'Implied volatility of the option.',
  ivp: 'IV Percentile vs recent IV history.',
  oi: 'Open interest (open contracts).',
  vol: 'Today’s traded volume.',
};

type StockSearchPayload = {
  ok?: boolean;
  error?: string;
  results?: { symbol?: string }[];
};

type RankPayload = {
  ok?: boolean;
  error?: string;
  results?: RankedRow[];
  debug?: RankDebug;
};

function useSymbolSearch(query: string) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }

    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setBusy(true);
        const data = await fetchStockSearch(q, { limit: 8, signal: ac.signal });
        setHits(data);
      } catch {
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 150);

    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  return { hits, busy };
}

// ---- Minimal styled tooltip TH ----
function Th({
  label,
  hint,
  className = '',
  align = 'left',
}: {
  label: string;
  hint?: string;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      className={[
        'px-2 py-2 sticky top-0 z-10 bg-slate-900/95 border-b border-slate-800',
        'text-[11px] uppercase text-slate-400',
        alignClass,
        className,
      ].join(' ')}
    >
      {hint ? (
        <Tooltip content={hint}>
          <span className="inline-flex items-center gap-1">
            <span>{label}</span>
            <span
              className="w-1.5 h-1.5 rounded-full bg-slate-500/60"
              aria-hidden
            />
          </span>
        </Tooltip>
      ) : (
        <span>{label}</span>
      )}
    </th>
  );
}

// util: safe JSON-or-text
async function jsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  return { ok: false, error: await res.text() };
}

async function describeResponseError(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') return body.error;
      return JSON.stringify(body);
    } catch {
      /* ignore */
    }
  }
  try {
    const text = await res.text();
    if (text) return text;
  } catch {
    /* ignore */
  }
  return res.statusText || 'unknown error';
}

async function ensureOk(res: Response, label: string) {
  if (res.ok) return;
  const reason = await describeResponseError(res);
  throw new Error(`${label} failed: ${reason}`);
}

// optional auth header (some schwab* routes may require it)
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const tok = data?.session?.access_token;
    const headers: Record<string, string> = {};
    if (tok) headers.Authorization = `Bearer ${tok}`;
    return headers;
  } catch {
    return {};
  }
}

// warms instrument + full chain so rank won't say "unknown symbol"
async function warmOptionData(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  const auth = await authHeaders();

  // 1) resolve canonical via stock-search (keeps UX happy even if user typed alias)
  const r0 = await api(`/api/stock-search?q=${encodeURIComponent(sym)}&limit=1`);
  const j0 = (await jsonOrText(r0)) as StockSearchPayload;
  if (!j0?.ok) throw new Error(j0?.error || 'Symbol lookup failed');
  const canonical = j0.results?.[0]?.symbol || sym;

  // 2) prime instruments (provider catalog)
  await ensureOk(
    await api(`/api/schwab-instruments?symbol=${encodeURIComponent(canonical)}`, {
      headers: auth,
    }),
    'Schwab instruments',
  );

  // 3) prime the *entire* chain (set a wide DTE window)
  await ensureOk(
    await api(
      `/api/schwab-option-chains?symbol=${encodeURIComponent(
        canonical,
      )}&dteMin=0&dteMax=1500&prefetch=1`,
      { headers: auth },
    ),
    'Schwab option chains',
  );

  return canonical;
}

// --- Market-hours helpers (US equities) ---
function isUSMarketOpen(d = new Date()) {
  const ny = new Date(
    d.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  );
  const day = ny.getDay();
  if (day === 0 || day === 6) return false;

  const minutes = ny.getHours() * 60 + ny.getMinutes();
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutes >= open && minutes < close;
}

function nextUSMarketOpen(from = new Date()) {
  const ny = new Date(
    from.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  );

  const target = new Date(ny);
  target.setHours(9, 30, 0, 0);

  const day = ny.getDay();
  const minutes = ny.getHours() * 60 + ny.getMinutes();
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (day === 0) {
    target.setDate(target.getDate() + 1);
  } else if (day === 6) {
    target.setDate(target.getDate() + 2);
  } else if (minutes >= close) {
    target.setDate(target.getDate() + 1);
    while ([0, 6].includes(target.getDay())) target.setDate(target.getDate() + 1);
  } else if (minutes >= open) {
    return null;
  }
  return target;
}

function fmtNY(dt: Date | null) {
  if (!dt) return '';
  return dt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: '2-digit',
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function OptionsPanel() {
  const [symbol, setSymbol] = useState('AAPL');
  const [symInput, setSymInput] = useState('AAPL');
  const [comboOpen, setComboOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const { hits: symHits } = useSymbolSearch(symInput);
  const [side, setSide] = useState<'call' | 'put'>('call');
  const [dteMin, setDteMin] = useState(45);
  const [dteMax, setDteMax] = useState(90);
  const [rows, setRows] = useState<RankedRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [debug, setDebug] = useState<RankDebug | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expiryBias, setExpiryBias] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastWarmedRef = useRef<string | null>(null);
  const [hoverCtx, setHoverCtx] = useState<{ id: number; x: number; y: number } | null>(
    null,
  );

  const marketOpen = isUSMarketOpen();
  const nextOpen = marketOpen ? null : nextUSMarketOpen();

  useEffect(() => {
    setSymbol(symInput.trim().toUpperCase());
  }, [symInput]);

  useEffect(() => {
    if (!comboOpen || symHits.length === 0) {
      setHighlight(-1);
      return;
    }
    if (highlight >= symHits.length) {
      setHighlight(symHits.length - 1);
    }
  }, [comboOpen, symHits, highlight]);

  const handleRank = useCallback(async () => {
    const upper = symbol.trim().toUpperCase();

    async function fetchRank(): Promise<RankPayload> {
      const qs = new URLSearchParams({
        symbol: upper,
        side,
        dteMin: String(dteMin ?? 0),
        dteMax: String(dteMax ?? 400),
        top: '50',
        r: '0.045',
        debug: '1',
        staleMaxMin: marketOpen ? '60' : String(3 * 24 * 60),
      }).toString();
      const res = await api(`/api/options-rank?${qs}`);
      return (await jsonOrText(res)) as RankPayload;
    }

    const warmOnce = async (force = false) => {
      if (!upper) return;
      if (!force && lastWarmedRef.current === upper) return;

      let warning: string | null = null;
      const warmLabel = marketOpen
        ? 'Warming option chain…'
        : 'Market closed – warming latest chain…';
      setStatus(warmLabel);
      try {
        const canon = await warmOptionData(upper);
        lastWarmedRef.current = canon ?? upper;
        await sleep(marketOpen ? 250 : 500);
      } catch (warmErr) {
        console.warn('[options] warmOptionData failed', warmErr);
        const msg =
          warmErr instanceof Error ? warmErr.message : String(warmErr);
        warning = msg || 'Unable to warm option chain';
        setStatus(
          `${warning} – continuing with cached data if available.`,
        );
        lastWarmedRef.current = upper;
      } finally {
        if (!warning) {
          setStatus(null);
        } else if (typeof window !== 'undefined') {
          window.setTimeout(() => setStatus(null), 6000);
        } else {
          setStatus(null);
        }
      }
    };

    try {
      setLoading(true);
      setErr(null);
      setDebug(null);

      // warm once per symbol (covers "type + click Rank" path)
      await warmOnce();

      let payload = await fetchRank();

      // safety net: warm + retry if backend still complains
      const unknownRe = /(unknown|not\s*found|no\s*chain)/i;
      if (!payload.ok && unknownRe.test(payload.error || '')) {
        await warmOnce(true);
        await sleep(800);
        payload = await fetchRank();
      }

      if (!payload.ok) throw new Error(payload.error || 'Rank failed');

      setRows(payload.results ?? []);
      setDebug(payload.debug || null);
    } catch (error) {
      setRows([]);
      const message = error instanceof Error ? error.message : String(error);
      setErr(message);
      setDebug(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, side, dteMin, dteMax, marketOpen]);

  const medianDte = useMemo(() => {
    if (!rows || rows.length === 0) return 1;
    const dtes = rows
      .map((r) => r.contract.dte || 1)
      .sort((a, b) => a - b);
    return dtes[Math.floor(dtes.length / 2)] || 1;
  }, [rows]);

  function biasedScore(row: RankedRow): number {
    const dte = row.contract.dte || 1;
    const factor = Math.pow(
      Math.sqrt(dte / Math.max(1, medianDte)),
      expiryBias,
    );
    return row.finalScore * factor;
  }

  // selection helpers
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearSelected = useCallback(() => {
    setSelected([]);
  }, []);

  // open/close compare drawer when selection changes
  useEffect(() => {
    setDrawerOpen(selected.length > 0);
  }, [selected]);

  const quoteAgeMinutes = useMemo(() => {
    if (!rows || selected.length === 0) return null;
    const selectedRows = rows.filter((r) => selected.includes(r.contract.id));
    const timestamps = selectedRows
      .map((r) => r.contract.lastQuoteAt)
      .filter(Boolean) as string[];
    if (timestamps.length === 0) return null;
    const latestMs = Math.max(...timestamps.map((t) => Date.parse(t)));
    const ageMin = Math.max(0, Math.round((Date.now() - latestMs) / 60000));
    return ageMin;
  }, [rows, selected]);

  const quoteAgeLabel = useMemo(() => {
    if (quoteAgeMinutes == null) return null;
    if (quoteAgeMinutes === 0) return '<1m old';
    if (quoteAgeMinutes === 1) return '1m old';
    return `${quoteAgeMinutes}m old`;
  }, [quoteAgeMinutes]);

  const handleSymInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSymInput(event.target.value);
    setComboOpen(true);
  };

  const handleSymInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && symHits.length > 0) {
      event.preventDefault();
      setComboOpen(true);
      setHighlight((i) => {
        const next = i + 1;
        return next >= symHits.length ? symHits.length - 1 : next;
      });
      return;
    }
    if (event.key === 'ArrowUp' && symHits.length > 0) {
      event.preventDefault();
      setComboOpen(true);
      setHighlight((i) => {
        const next = i - 1;
        return next < 0 ? 0 : next;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight >= 0 && highlight < symHits.length) {
        const h = symHits[highlight];
        setSymInput(h.symbol);
        setComboOpen(false);
        (async () => {
          setStatus(
            marketOpen
              ? 'Warming option chain…'
              : 'Market closed – warming latest chain…',
          );
          const canon = await warmOptionData(h.symbol);
          lastWarmedRef.current = canon ?? h.symbol;
          if (!marketOpen) {
            await new Promise((r) => setTimeout(r, 500));
          }
          setStatus(null);
          handleRank();
        })();
      } else {
        handleRank();
      }
    }
  };

  return (
    <div className="space-y-4">
      <h2
        className="text-xl font-semibold"
        title="Ranks listed options by our finalScore using IV history, earnings timing, liquidity and edge"
      >
        Options Ranking
      </h2>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">
          <span>Symbol</span>
          <div className="relative">
            {(() => {
              const comboProps = {
                role: 'combobox' as const,
                'aria-controls': 'symbol-listbox',
                'aria-activedescendant':
                  highlight >= 0 ? `symopt-${highlight}` : undefined,
                'aria-autocomplete': 'list' as const,
                placeholder: 'AAPL, CRWD, TSLA\x19',
                className:
                  'w-[220px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm',
                value: symInput,
                onChange: handleSymInputChange,
                onFocus: () => setComboOpen(true),
                onBlur: () => {
                  window.setTimeout(() => setComboOpen(false), 120);
                },
                onKeyDown: handleSymInputKeyDown,
              };

              return comboOpen ? (
                <input {...comboProps} />
              ) : (
                <input {...comboProps} />
              );
            })()}
            {comboOpen && symHits.length > 0 && (
              <ul
                id="symbol-listbox"
                role="listbox"
                aria-label="Symbol suggestions"
                className="absolute z-[9999] mt-1 max-h-64 w-[360px] overflow-auto rounded border border-slate-700 bg-slate-900 shadow-2xl"
              >
                {symHits.map((h, i) => (
                  <li
                    id={`symopt-${i}`}
                    key={h.symbol}
                    role="option"
                    {...(i === highlight ? { 'aria-selected': 'true' } : {})}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-sm ${
                      i === highlight ? 'bg-slate-800' : 'hover:bg-slate-800'
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={async () => {
                      setSymInput(h.symbol);
                      setComboOpen(false);
                      setStatus(
                        marketOpen
                          ? 'Warming option chain…'
                          : 'Market closed – warming latest chain…',
                      );
                      const canon = await warmOptionData(h.symbol);
                      lastWarmedRef.current = canon ?? h.symbol;
                      if (!marketOpen) {
                        await new Promise((r) => setTimeout(r, 500));
                      }
                      setStatus(null);
                      handleRank();
                    }}
                  >
                    <span className="font-mono">{h.symbol}</span>
                    <span className="text-slate-400">{h.name}</span>
                    {h.exchange && (
                      <span className="ml-auto text-slate-500">{h.exchange}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
        <label className="text-sm flex flex-col gap-1 w-full sm:w-auto" htmlFor="side">
          <span>Side</span>
          <select
            id="side"
            aria-label="Side"
            className="w-full rounded bg-slate-900 px-2 py-1 border border-slate-700"
            value={side}
            onChange={(e) => {
              const v = e.target.value === 'put' ? 'put' : 'call';
              setSide(v);
            }}
          >
            <option value="call">Calls</option>
            <option value="put">Puts</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">
          <span>DTE range</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="w-full max-w-[4.5rem] rounded bg-slate-900 px-2 py-1 border border-slate-700"
              value={dteMin}
              onChange={(e) => setDteMin(Number(e.target.value) || 0)}
            />
            <span>–</span>
            <input
              type="number"
              className="w-full max-w-[4.5rem] rounded bg-slate-900 px-2 py-1 border border-slate-700"
              value={dteMax}
              onChange={(e) => setDteMax(Number(e.target.value) || 0)}
            />
          </div>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-xs text-slate-400">Favor farther expirations</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={expiryBias}
              onChange={(e) => setExpiryBias(Number(e.target.value))}
              className="w-40"
            />
            <span className="text-xs text-slate-500">
              {expiryBias.toFixed(1)}
            </span>
          </div>
        </label>
        <button
          type="button"
          onClick={handleRank}
          disabled={loading}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? 'Ranking…' : 'Rank'}
        </button>
      </div>

      <div aria-live="polite" className="sr-only" id="options-status">
        {status || err || ''}
      </div>

      {!marketOpen && (
        <div className="mt-1 text-[11px] text-slate-500">
          Market closed – using last available quotes.
          {nextOpen ? <> Next open: {fmtNY(nextOpen)} (ET).</> : null}
        </div>
      )}

      {status && (
        <div className="mt-1 text-[11px] text-slate-500">{status}</div>
      )}

      {debug && (
        <div className="text-[11px] text-slate-500">
          {debug.total} total {debug.quoteQualityPass} quote ok {debug.dropped.stale} stale{' '}
          {debug.dropped.noQuote + debug.dropped.zeroAsk + debug.dropped.zeroIv + debug.dropped.zeroOi + debug.dropped.stale}{' '}
          dropped
        </div>
      )}

      <div className="border border-slate-800 rounded-lg h-full">
        <div
          ref={wrapRef}
          className="relative h-full overflow-y-auto"
        >
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="min-w-[1100px] w-full text-sm whitespace-nowrap">
              <thead>
                <tr>
                  <Th label="" />
                  <Th label="Grade" hint={COL_HINTS.grade} />
                  <Th
                    label="Strike"
                    hint={COL_HINTS.strike}
                    align="right"
                  />
                  <Th
                    label="Expiry"
                    hint={COL_HINTS.expiry}
                    align="center"
                  />
                  <Th label="DTE" hint={COL_HINTS.dte} align="right" />
                  <Th label="Theo" hint={COL_HINTS.theo} align="right" />
                  <Th label="Bid" hint={COL_HINTS.bid} align="right" />
                  <Th label="Ask" hint={COL_HINTS.ask} align="right" />
                  <Th
                    label="Spread"
                    hint={COL_HINTS.spread}
                    align="right"
                  />
                  <Th label="IV" hint={COL_HINTS.iv} align="right" />
                  <Th label="IVP" hint={COL_HINTS.ivp} align="right" />
                  <Th label="OI" hint={COL_HINTS.oi} align="right" />
                  <Th label="Vol" hint={COL_HINTS.vol} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows?.map((r) => (
                  <tr
                    key={r.contract.id}
                    className="odd:bg-slate-900/40 hover:bg-slate-900/70"
                    onMouseEnter={(e) =>
                      setHoverCtx({ id: r.contract.id, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) =>
                      setHoverCtx({ id: r.contract.id, x: e.clientX, y: e.clientY })
                    }
                    onMouseLeave={() => setHoverCtx(null)}
                  >
                    <td className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(r.contract.id)}
                        onChange={() => toggleSelect(r.contract.id)}
                        aria-label="Select contract"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {r.grade ? (
                        <GradeBadge
                          grade={r.grade as 'A' | 'B' | 'C' | 'D'}
                          score={r.finalScore}
                          scores={r.scores}
                          adjustments={r.adjustments}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">{r.contract.strike.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center">
                      {fmtDate(r.contract.expiry)}
                    </td>
                    <td className="px-2 py-2 text-right">{r.contract.dte}</td>
                    <td className="px-2 py-2 text-right">{r.theo?.toFixed(2) ?? '—'}</td>
                    <td className="px-2 py-2 text-right">{r.contract.bid.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{r.contract.ask.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">
                      {pct(spreadPct(r.contract.bid, r.contract.ask))}
                    </td>
                    <td className="px-2 py-2 text-right">{pct(r.contract.iv)}</td>
                    <td className="px-2 py-2 text-right">{pct(r.ivp ?? 0)}</td>
                    <td className="px-2 py-2 text-right">{r.contract.oi}</td>
                    <td className="px-2 py-2 text-right">{r.contract.vol}</td>
                  </tr>
                ))}
                {!loading && (!rows || rows.length === 0) && (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-2 py-6 text-center text-slate-500"
                    >
                      {err ? (
                        <span className="text-red-400">{err}</span>
                      ) : (
                        'Run a rank to see results.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hoverCtx && rows && (
            (() => {
              const rect = wrapRef.current?.getBoundingClientRect();
              const row = rows.find((rr) => rr.contract.id === hoverCtx.id);
              if (!rect || !row) return null;
              const left = Math.max(12, hoverCtx.x - rect.left + 12);
              const top = Math.max(12, hoverCtx.y - rect.top + 12);
              return (
                <div
                  className="pointer-events-none absolute z-50"
                  style={{ left, top }}
                >
                  <FactorsCard row={row} />
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Compare Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Compare ({selected.length})</div>
            {quoteAgeLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                quotes {quoteAgeLabel}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="text-xs px-2 py-1 rounded border"
              onClick={clearSelected}
            >
              Clear
            </button>
            <button
              className="text-xs px-2 py-1 rounded border"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-3 overflow-auto h-[calc(100%-130px)]">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-1">Strike</th>
                <th className="text-right py-1">DTE</th>
                <th className="text-right py-1">Bid</th>
                <th className="text-right py-1">Ask</th>
                <th className="text-right py-1">IV</th>
                <th className="text-right py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows
                ?.filter((r) => selected.includes(r.contract.id))
                .sort((a, b) => biasedScore(b) - biasedScore(a))
                .map((r) => (
                  <tr
                    key={r.contract.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-1">{r.contract.strike}</td>
                    <td className="py-1 text-right">{r.contract.dte}</td>
                    <td className="py-1 text-right">
                      {r.contract.bid?.toFixed(2)}
                    </td>
                    <td className="py-1 text-right">
                      {r.contract.ask?.toFixed(2)}
                    </td>
                    <td className="py-1 text-right">
                      {(r.contract.iv ?? 0).toFixed(2)}
                    </td>
                    <td className="py-1 text-right">
                      {biasedScore(r).toFixed(3)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <SaveWatchlistForm selected={selected} onSaved={clearSelected} />
        </div>
      </div>
    </div>
  );
}

export default function OptionsPage() {
  return (
    <main className="p-4">
      <OptionsPanel />
    </main>
  );
}

function FactorsCard({ row }: { row: RankedRow }) {
  const entries = Object.entries(row.scores || {});
  const scores = entries
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 4);

  const labels: Record<string, string> = {
    edge: 'Edge (Theo vs Market)',
    dte: 'Time Horizon Fit',
    iv: 'Implied Volatility',
    delta: 'Moneyness (Δ)',
    liq: 'Liquidity (spread, OI, vol)',
    cal: 'Calendar Fit',
    earn: 'Earnings Timing',
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur px-4 py-3 w-[260px]">
      <div className="text-[12px] font-medium text-slate-200 mb-2">
        Why this ranked
      </div>
      <div className="space-y-1">
        {scores.map(([k, v]) => {
          const val = typeof v === 'number' ? v : Number(v) || 0;
          const pctVal = Math.round(val * 100);
          return (
            <div key={k} className="text-[11px] text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{labels[k] || k}</span>
                <span className="tabular-nums text-slate-200">{pctVal}%</span>
              </div>
              <div className="h-1.5 rounded bg-slate-800 overflow-hidden mt-1">
                <div
                  className="h-full bg-sky-500/80"
                  style={{ width: `${Math.max(4, pctVal)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {row.adjustments?.length ? (
        <div className="mt-3 text-[10px] text-slate-300">
          Adjustments:{' '}
          <span className="text-slate-200">{row.adjustments.join(', ')}</span>
        </div>
      ) : null}
    </div>
  );
}

type Watchlist = {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type WatchlistResponse = {
  ok: boolean;
  error?: string;
  lists?: Watchlist[];
};

type WatchlistCreateResponse = {
  ok: boolean;
  error?: string;
  list: Watchlist;
};

type AppendItemsResponse = {
  ok: boolean;
  error?: string;
};

function SaveWatchlistForm({
  selected,
  onSaved,
}: {
  selected: number[];
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const getToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const fetchLists = async () => {
    try {
      setLoadingLists(true);
      setErr(null);
      const token = await getToken();
      if (!token) {
        // Not signed in – skip loading lists in anon mode.
        setLists([]);
        return;
      }
      const res = await api('/api/options-watchlist', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Soft-fail for unauthorized access.
        setLists([]);
        return;
      }
      const ct = res.headers.get('content-type') || '';
      const payload: WatchlistResponse | null = ct.includes('application/json')
        ? await res.json()
        : null;
      if (!payload?.ok) throw new Error(payload?.error || 'Failed to load watchlists');
      const arr = payload.lists ?? [];
      setLists(arr);
      if (!listId && arr.length) setListId(arr[0].id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErr(message);
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    fetchLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendItems = async (targetId: string, token: string) => {
    const r2 = await api(`/api/options-watchlist/${targetId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contract_ids: selected }),
    });
    const j2: AppendItemsResponse = await r2.json();
    if (!j2.ok) throw new Error(j2.error || 'Failed to add items');
  };

  const save = async () => {
    try {
      setBusy(true);
      setErr(null);

      if (!selected.length) throw new Error('Select at least one contract.');

      const token = await getToken();
      if (!token) {
        // Not signed in – skip saving in anon mode.
        return;
      }

      if (mode === 'existing') {
        if (!listId) throw new Error('Pick a watchlist.');
        await appendItems(listId, token);
        onSaved?.();
        return;
      }

      const nm = name.trim();
      if (!nm) throw new Error('Enter a name.');

      const r1 = await api('/api/options-watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nm }),
      });
      if (r1.status === 401) {
        setErr('Sign in to create option watchlists.');
        return;
      }
      const j1: WatchlistCreateResponse = await r1.json();
      if (!j1.ok) throw new Error(j1.error || 'Failed to create list');

      const createdId: string = j1.list.id;
      await appendItems(createdId, token);

      await fetchLists();
      setMode('existing');
      setListId(createdId);
      setName('');

      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const disableSave =
    busy ||
    selected.length === 0 ||
    (mode === 'new' && !name.trim());

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-slate-500">
        Save selected contracts to a watchlist
      </div>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="radio"
            name="wl-mode"
            value="existing"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
          />
          Existing
        </label>
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="radio"
            name="wl-mode"
            value="new"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
          />
          New list
        </label>
        <button
          type="button"
          onClick={fetchLists}
          className="ml-auto text-[11px] underline decoration-dotted disabled:opacity-50"
          disabled={loadingLists}
        >
          {loadingLists ? 'Refreshing…' : 'Refresh lists'}
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="flex items-center gap-2">
          <select
            aria-label="Existing option watchlist"
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={listId ?? ''}
            onChange={(e) => setListId(e.target.value || null)}
            disabled={loadingLists || !lists.length}
          >
            {!lists.length && <option value="">No watchlists yet</option>}
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New watchlist name"
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}

      {err && <div className="text-xs text-red-500">{err}</div>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-50 text-sm"
          disabled={disableSave}
          onClick={save}
        >
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
