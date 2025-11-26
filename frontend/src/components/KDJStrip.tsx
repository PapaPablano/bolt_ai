import React from 'react';

type Row = { ts: string; k: number; d: number; j: number };

export default function KDJStrip({ data }: { data: Row[] | null }) {
  if (!data || !data.length) return null;
  const last = data[data.length - 1];

  return (
    <div className="p-2 border-t border-slate-800 bg-slate-900/60 text-xs sm:text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div>K: {Number.isFinite(last.k) ? last.k.toFixed(2) : '-'}</div>
        <div>D: {Number.isFinite(last.d) ? last.d.toFixed(2) : '-'}</div>
        <div>J: {Number.isFinite(last.j) ? last.j.toFixed(2) : '-'}</div>
        <div className="text-slate-500">({data.length} pts)</div>
      </div>
    </div>
  );
}
