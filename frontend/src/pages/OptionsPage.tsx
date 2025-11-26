import { useMemo, useState } from 'react';

export type RankedRow = {
  rank: number;
  contract: {
    id?: string | number;
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
                      {group.map((r) => {
                        const mid = (r.contract.bid + r.contract.ask) / 2;
                        const spreadPct = mid > 0 ? ((r.contract.ask - r.contract.bid) / mid) * 100 : 100;
                        const edgePct =
                          r.contract.ask > 0
                            ? ((r.theo - r.contract.ask) / r.contract.ask) * 100
                            : 0;
                        return (
                          <tr
                            key={`${r.contract.id ?? ''}-${r.contract.expiry}-${r.contract.dte}`}
                            className="border-t border-slate-800"
                          >
                            <td className="px-2 py-1 font-semibold">{r.grade}</td>
                            <td className="px-2 py-1 text-right">{r.finalScore.toFixed(3)}</td>
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
    </div>
  );
}
