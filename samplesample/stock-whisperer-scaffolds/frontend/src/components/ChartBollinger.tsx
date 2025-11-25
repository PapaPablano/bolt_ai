import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

type BBPoint = { ts: string; close?: number; mid: number; upper: number; lower: number; pct_b: number; bandwidth: number };

async function fetchBB(symbol: string, tf: string, params: Record<string, any> = {}): Promise<BBPoint[]> {
  const sp = new URLSearchParams({ symbol, tf, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  const r = await fetch(`/api/indicators-bbands?${sp}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function ChartBollinger({ symbol, tf }: { symbol: string; tf: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [params, setParams] = useState({ n: 20, k: 2, squeezePct: 5 });
  const [rows, setRows] = useState<BBPoint[] | null>(null);

  useEffect(() => { (async () => setRows(await fetchBB(symbol, tf, params)))(); }, [symbol, tf, params]);

  useEffect(() => {
    if (!ref.current || chartRef.current) return;
    const chart = createChart(ref.current, { height: 360, layout: { background: { type: ColorType.Solid, color: '#0b0d12' }, textColor: '#cbd5e1' }, grid: { vertLines: { visible: false }, horzLines: { visible: false } } });
    chartRef.current = chart;
    const resize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    window.addEventListener('resize', resize); resize();
    return () => { window.removeEventListener('resize', resize); chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current; if (!chart || !rows) return;
    chart.removeAllSeries();
    const price = chart.addLineSeries({ lineWidth: 1 });
    const mid = chart.addLineSeries({ lineWidth: 1 });
    const up = chart.addLineSeries({ lineWidth: 1 });
    const lo = chart.addLineSeries({ lineWidth: 1 });

    const to = (ts: string) => Math.floor(new Date(ts).getTime() / 1000);
    price.setData(rows.map(r => ({ time: to(r.ts), value: r.close ?? (r.mid || 0) })));
    mid.setData(rows.map(r => ({ time: to(r.ts), value: r.mid })));
    up.setData(rows.map(r => ({ time: to(r.ts), value: r.upper })));
    lo.setData(rows.map(r => ({ time: to(r.ts), value: r.lower })));

    // Squeeze marking (bottom p% of lookback)
    const bw = rows.map(r => r.bandwidth).filter(x => Number.isFinite(x));
    const sorted = [...bw].sort((a,b)=>a-b); const p = params.squeezePct/100; const cut = sorted[Math.floor(sorted.length * p)] ?? Number.POSITIVE_INFINITY;
    const markers:any[] = [];
    for (const r of rows) if (r.bandwidth <= cut) markers.push({ time: to(r.ts), position: 'belowBar', color: '#94a3b8', shape: 'circle', text: 'squeeze' });
    mid.setMarkers(markers);
  }, [rows]);

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-2 text-sm">
        <label>N <input type="number" value={params.n} onChange={e=>setParams(p=>({...p, n:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
        <label>K <input type="number" step="0.1" value={params.k} onChange={e=>setParams(p=>({...p, k:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
        <label>Squeeze % <input type="number" min={1} max={20} value={params.squeezePct} onChange={e=>setParams(p=>({...p, squeezePct:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-28"/></label>
      </div>
      <div ref={ref} className="h-[360px] w-full rounded" />
    </div>
  );
}
