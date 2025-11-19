import React from 'react';

type Props = {
  ok: boolean;
  lwcVersion?: string;
  width: number;
  height: number;
  series: number;
  lastEvent?: string;
  error?: string;
};

export function ChartProbe({ ok, lwcVersion, width, height, series, lastEvent, error }: Props) {
  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-md bg-slate-900/90 text-slate-200 shadow-lg border border-slate-700 px-3 py-2 text-xs">
      <div className="font-semibold">Chart Probe</div>
      <div>
        OK:{' '}
        <span className={ok ? 'text-green-400' : 'text-red-400'}>
          {String(ok)}
        </span>
      </div>
      <div>LWC: {lwcVersion ?? 'n/a'}</div>
      <div>
        Box: {width}×{height}
      </div>
      <div>Series: {series}</div>
      {lastEvent && <div>Last: {lastEvent}</div>}
      {error && <div className="text-red-400 max-w-[22rem] truncate">Err: {error}</div>}
    </div>
  );
}
