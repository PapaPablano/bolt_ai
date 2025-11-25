import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle, IChartApi } from 'lightweight-charts';

type KDJPoint = { ts: string; k: number; d: number; j: number };

async function fetchKDJ(symbol: string, tf: string, params: Record<string, any> = {}): Promise<KDJPoint[]> {
  const sp = new URLSearchParams({ symbol, tf, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  const r = await fetch(`/api/indicators-kdj?${sp}`); // proxy to Edge Function
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function OscKDJ({ symbol, tf }: { symbol: string; tf: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [params, setParams] = useState({ n: 9, m: 3, l: 3, mode: 'ema' });
  const [rows, setRows] = useState<KDJPoint[] | null>(null);

  useEffect(() => { (async () => setRows(await fetchKDJ(symbol, tf, params)))(); }, [symbol, tf, params]);

  useEffect(() => {
    if (!ref.current || chartRef.current) return;
    const chart = createChart(ref.current, {
      height: 180,
      layout: { background: { type: ColorType.Solid, color: '#0b0d12' }, textColor: '#cbd5e1' },
      rightPriceScale: { visible: true },
      timeScale: { visible: true },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });
    chartRef.current = chart;
    const resize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    window.addEventListener('resize', resize); resize();
    return () => { window.removeEventListener('resize', resize); chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current; if (!chart || !rows) return;
    chart.removeAllSeries();
    const K = chart.addLineSeries({ lineWidth: 1 });
    const D = chart.addLineSeries({ lineWidth: 1, lineStyle: LineStyle.Solid });
    const J = chart.addLineSeries({ lineWidth: 1, lineStyle: LineStyle.Dashed });

    const to = (ts: string) => Math.floor(new Date(ts).getTime() / 1000);
    K.setData(rows.map(r => ({ time: to(r.ts), value: r.k })));
    D.setData(rows.map(r => ({ time: to(r.ts), value: r.d })));
    J.setData(rows.map(r => ({ time: to(r.ts), value: r.j })));

    const markers: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i-1], cur = rows[i];
      const prevDiff = prev.j - prev.d, curDiff = cur.j - cur.d;
      if (prevDiff <= 0 && curDiff > 0) markers.push({ time: to(cur.ts), position: 'belowBar', color: '#4caf50', shape: 'arrowUp', text: 'J>D' });
      if (prevDiff >= 0 && curDiff < 0) markers.push({ time: to(cur.ts), position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'J<D' });
    }
    D.setMarkers(markers);
  }, [rows]);

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-2 text-sm">
        <label>N <input type="number" min={3} value={params.n} onChange={e=>setParams(p=>({...p, n:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
        <label>M <input type="number" min={1} value={params.m} onChange={e=>setParams(p=>({...p, m:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
        <label>L <input type="number" min={1} value={params.l} onChange={e=>setParams(p=>({...p, l:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
        <label>Mode
          <select value={params.mode} onChange={e=>setParams(p=>({...p, mode:e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded">
            <option value="ema">EMA</option>
            <option value="rma">RMA</option>
          </select>
        </label>
      </div>
      <div ref={ref} className="w-full h-[180px]" />
    </div>
  );
}
