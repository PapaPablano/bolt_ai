import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    side: 'call' | 'put';
  };
  theo: number;
  ivp: number;
  scores: Record<string, number>;
  finalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  gate: { mult: number; reasons: string[] };
  adjustments: string[];
};

export default function OptionsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [side, setSide] = useState<'call' | 'put'>('call');
  const [dteMin, setDteMin] = useState(45);
  const [dteMax, setDteMax] = useState(90);
  const [rows, setRows] = useState<RankedRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiryBias, setExpiryBias] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function runRank() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        symbol,
        side,
        dteMin: String(dteMin),
        dteMax: String(dteMax),
        top: '50',
      });
      const res = await fetch(`/api/options-rank?${qs.toString()}`);
      const json = await res.json();
      setRows((json?.results ?? []) as RankedRow[]);
    } catch {
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    if (!rows) return [] as RankedRow[][];
    const map = new Map<number, RankedRow[]>();
    for (const r of rows) {
      const key = Math.round(r.contract.strike * 100);
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.values()).map((group) =>
      group.slice().sort((a, b) => a.contract.dte - b.contract.dte),
    );
  }, [rows]);

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

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Options Ranking</h1>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm flex flex-col gap-1">
          <span>Symbol</span>
          <input
            className="rounded bg-slate-900 px-2 py-1 border border-slate-700"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span>Side</span>
          <select
            className="rounded bg-slate-900 px-2 py-1 border border-slate-700"
            value={side}
            onChange={(e) => setSide(e.target.value as 'call' | 'put')}
          >
            <option value="call">Calls</option>
            <option value="put">Puts</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span>DTE range</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="w-20 rounded bg-slate-900 px-2 py-1 border border-slate-700"
              value={dteMin}
              onChange={(e) => setDteMin(Number(e.target.value) || 0)}
            />
            <span>–</span>
            <input
              type="number"
              className="w-20 rounded bg-slate-900 px-2 py-1 border border-slate-700"
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
          onClick={runRank}
          disabled={loading}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? 'Ranking…' : 'Rank'}
        </button>
      </div>

      <div className="overflow-auto border border-slate-800 rounded">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-slate-900/60">
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className="px-2 py-2 text-left">Grade</th>
              <th className="px-2 py-2 text-right">Score</th>
              <th className="px-2 py-2 text-right">Strike</th>
              <th className="px-2 py-2 text-right">DTE</th>
              <th className="px-2 py-2 text-right">Bid</th>
              <th className="px-2 py-2 text-right">Ask</th>
              <th className="px-2 py-2 text-right">Spread%</th>
              <th className="px-2 py-2 text-right">IV</th>
              <th className="px-2 py-2 text-right">IVP</th>
              <th className="px-2 py-2 text-right">Edge%</th>
              <th className="px-2 py-2 text-left">Adj / Gates</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group, gi) => (
              <tr key={gi}>
                <td colSpan={11} className="p-0">
                  <table className="w-full">
                    <tbody>
                      {group
                        .slice()
                        .sort((a, b) => biasedScore(b) - biasedScore(a))
                        .map((r) => {
                        const mid = (r.contract.bid + r.contract.ask) / 2;
                        const spreadPct = mid > 0 ? ((r.contract.ask - r.contract.bid) / mid) * 100 : 100;
                        const edgePct =
                          r.contract.ask > 0
                            ? ((r.theo - r.contract.ask) / r.contract.ask) * 100
                            : 0;
                        const displayScore = biasedScore(r);
                        return (
                          <tr
                            key={`${r.contract.id ?? ''}-${r.contract.expiry}-${r.contract.dte}`}
                            className="border-t border-slate-800"
                          >
                            <td className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                aria-label="Select contract for comparison"
                                checked={selected.includes(r.contract.id)}
                                onChange={() => toggleSelect(r.contract.id)}
                              />
                            </td>
                            <td className="px-2 py-1 font-semibold">{r.grade}</td>
                            <td className="px-2 py-1 text-right">
                              {displayScore.toFixed(3)}
                              {expiryBias !== 0 && (
                                <span className="ml-1 text-[10px] text-slate-500">
                                  raw {r.finalScore.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-right">{r.contract.strike.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">{r.contract.dte}</td>
                            <td className="px-2 py-1 text-right">{r.contract.bid.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">{r.contract.ask.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">{spreadPct.toFixed(1)}%</td>
                            <td className="px-2 py-1 text-right">{(r.contract.iv * 100).toFixed(1)}%</td>
                            <td className="px-2 py-1 text-right">{(r.ivp * 100).toFixed(0)}%</td>
                            <td className="px-2 py-1 text-right">{edgePct.toFixed(1)}%</td>
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap gap-1">
                                {r.adjustments.map((a) => (
                                  <span key={a} className="px-1.5 py-0.5 rounded bg-slate-800">
                                    {a}
                                  </span>
                                ))}
                                {r.gate.reasons.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-900/50">
                                    {r.gate.reasons.join(', ')}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td
                  colSpan={11}
                  className="px-2 py-6 text-center text-slate-500"
                >
                  Run a rank to see results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Compare Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-medium">Compare ({selected.length})</div>
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

function SaveWatchlistForm({
  selected,
  onSaved,
}: {
  selected: number[];
  onSaved?: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canSave = name.trim().length > 0 && selected.length > 0;

  const save = async () => {
    try {
      setBusy(true);
      setErr(null);
      // Grab the current user's JWT
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      if (!token) throw new Error('Not signed in – cannot save watchlist');

      // 1) create the list
      const r1 = await fetch('/api/options-watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const j1 = await r1.json();
      if (!j1.ok) throw new Error(j1.error || 'Failed to create list');

      const listId = j1.list.id;

      // 2) add items
      const r2 = await fetch(`/api/options-watchlist/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contract_ids: selected }),
      });
      const j2 = await r2.json();
      if (!j2.ok) throw new Error(j2.error || 'Failed to add items');

      onSaved?.();
      setName('');
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-slate-500">
        Save selected contracts to a watchlist
      </div>
      <div className="flex gap-2">
        <input
          className="border rounded px-2 py-1 text-sm flex-1"
          placeholder="Watchlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-50 text-sm"
          disabled={!canSave || busy}
          onClick={save}
        >
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
      {err && <div className="text-xs text-red-500">{err}</div>}
    </div>
  );
}
