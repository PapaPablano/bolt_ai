import * as LWC from 'lightweight-charts';
import type { MutableRefObject, RefObject } from 'react';

type Props = {
  title?: string;
  containerRef: RefObject<HTMLElement>;
  chartRef: MutableRefObject<ReturnType<typeof LWC.createChart> | null>;
};

export default function ChartProbe({ title = 'Chart Probe', containerRef, chartRef }: Props) {
  const container = containerRef.current;
  const chart = chartRef.current as unknown as Record<string, unknown> | null;

  const style = container ? getComputedStyle(container) : null;
  const containerInfo = container
    ? {
        width: container.clientWidth,
        height: container.clientHeight,
        display: style?.display,
        visibility: style?.visibility,
      }
    : null;

  const chartApiInfo = chart
    ? {
        hasAddCandle: typeof chart.addCandlestickSeries === 'function',
        hasAddLine: typeof chart.addLineSeries === 'function',
        methods: Object.keys(chart)
          .filter((k) => typeof (chart as Record<string, unknown>)[k] === 'function')
          .slice(0, 30),
      }
    : null;

  const libInfo = {
    version: (LWC as unknown as { version?: string }).version ?? 'unknown',
    hasCreateChart: typeof LWC.createChart === 'function',
  };

  const env = {
    mode: import.meta.env.MODE,
    dev: !!import.meta.env.DEV,
    prod: !!import.meta.env.PROD,
    vite: true,
  };

  const snap = { libInfo, containerInfo, chartApiInfo, env, now: new Date().toISOString() };
  const serialized = JSON.stringify(snap, null, 2);
  const closeHref = typeof window === 'undefined' ? '#' : window.location.pathname;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serialized);
    } catch {
      // ignore copy failures
    }
  };

  const badge = (ok: boolean, label: string) => (
    <span
      key={label}
      className={`px-2 py-0.5 rounded text-xs font-mono ${ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'}`}
      title={label}
    >
      {label}
    </span>
  );

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 50,
        maxWidth: 360,
      }}
      className="rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur p-3 text-slate-200 shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-400">{snap.now}</div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {badge(!!snap.libInfo.hasCreateChart, 'createChart')}
        {badge(!!snap.chartApiInfo?.hasAddCandle, 'addCandlestickSeries')}
        {badge(!!snap.chartApiInfo?.hasAddLine, 'addLineSeries')}
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800/80 text-slate-300">v{String(snap.libInfo.version)}</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800/80 text-slate-300">{snap.env.mode}</span>
      </div>

      <div className="grid gap-1 text-xs font-mono leading-snug">
        <div className="text-slate-400">container</div>
        <pre className="bg-slate-800/60 rounded p-2 overflow-auto">{JSON.stringify(snap.containerInfo, null, 2)}</pre>
        <div className="text-slate-400">chart</div>
        <pre className="bg-slate-800/60 rounded p-2 overflow-auto">{JSON.stringify(snap.chartApiInfo, null, 2)}</pre>
      </div>

      <div className="mt-2 flex gap-2">
        <button onClick={copy} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">
          Copy diagnostics
        </button>
        <a href={closeHref} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">
          Close
        </a>
      </div>
    </div>
  );
}
