import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ColorType, LineStyle } from 'lightweight-charts';

type Band = { t:number; upper:number; lower:number; trend:1|-1 };
type Out = { bands: Band[]; factor: number[]; perf: number[]; cluster: ('LOW'|'AVG'|'TOP')[] };

async function fetchSTAI(symbol:string, tf:string, params:Record<string,any>={}): Promise<Out> {
  const sp = new URLSearchParams({ symbol, tf, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  const res = await fetch(`/api/regimes-supertrend?${sp}`); // proxy to Edge Function
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ChartSTAI({ symbol, tf }: { symbol: string; tf: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [params, setParams] = useState({ atr: 10, fmin: 1, fmax: 5, fstep: 0.5, alpha: 0.2 });
  const [data, setData] = useState<Out | null>(null);

  useEffect(() => { (async () => { setData(await fetchSTAI(symbol, tf, params)); })(); }, [symbol, tf, params]);

  useEffect(() => {
    if (!ref.current) return; if (chartRef.current) return;
    const chart = createChart(ref.current, { height: 420, layout: { background: { type: ColorType.Solid, color: '#0b0d12' }, textColor: '#d0d3d7' }, grid: { vertLines: { visible: false }, horzLines: { visible: false } } });
    chartRef.current = chart;
    const resize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    window.addEventListener('resize', resize); resize();
    return () => { window.removeEventListener('resize', resize); chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current; if (!chart || !data) return;
    chart.removeAllSeries();
    const price = chart.addLineSeries({ lineWidth: 1 });
    const up = chart.addLineSeries({ lineWidth: 1 });
    const lo = chart.addLineSeries({ lineWidth: 1 });

    const to = (t:number)=> Math.floor(t/1000);
    price.setData(data.bands.map(b => ({ time: to(b.t), value: (b.upper + b.lower)/2 })));
    up.setData(data.bands.map(b => ({ time: to(b.t), value: b.upper })));
    lo.setData(data.bands.map(b => ({ time: to(b.t), value: b.lower })));

    const markers:any[] = [];
    for (let i=1;i<data.bands.length;i++){
      const a=data.bands[i-1], b=data.bands[i];
      if (a.trend!==b.trend){
        if (b.trend===1) markers.push({ time: to(b.t), position:'belowBar', shape:'arrowUp', color:'#4caf50', text:`flip↑ f*=${data.factor[i].toFixed(2)}`});
        else markers.push({ time: to(b.t), position:'aboveBar', shape:'arrowDown', color:'#e53935', text:`flip↓ f*=${data.factor[i].toFixed(2)}`});
      }
    }
    up.setMarkers(markers);
  }, [data]);

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-2 text-sm">
        <label>ATR <input type="number" value={params.atr} onChange={e=>setParams(p=>({...p, atr:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded"/></label>
        <label>Fmin <input type="number" step="0.1" value={params.fmin} onChange={e=>setParams(p=>({...p, fmin:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded"/></label>
        <label>Fmax <input type="number" step="0.1" value={params.fmax} onChange={e=>setParams(p=>({...p, fmax:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded"/></label>
        <label>Fstep <input type="number" step="0.1" value={params.fstep} onChange={e=>setParams(p=>({...p, fstep:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded"/></label>
        <label>α <input type="number" step="0.01" value={params.alpha} onChange={e=>setParams(p=>({...p, alpha:+e.target.value}))} className="bg-gray-900 border px-2 py-1 rounded w-20"/></label>
      </div>
      <div ref={ref} className="h-[420px] w-full rounded"/>
    </div>
  );
}
