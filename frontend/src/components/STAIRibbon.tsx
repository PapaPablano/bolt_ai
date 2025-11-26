import React from 'react';
import type { STAIResponse } from '@/lib/apiIndicators';

export default function STAIRibbon({ stai }: { stai: STAIResponse | null }) {
  if (!stai || !stai.factor?.length || !stai.bands?.length) return null;
  const i = stai.factor.length - 1;
  const factor = stai.factor[i];
  const cluster = stai.cluster[i];
  const trend = stai.bands[i]?.trend;
  const label = stai.labels?.[i];

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-slate-800 bg-slate-900/60 text-xs sm:text-sm">
      <span className="rounded-full px-2 py-0.5 border border-slate-700">
        STAI factor: {Number.isFinite(factor) ? factor.toFixed(2) : '-'}
      </span>
      <span className="rounded-full px-2 py-0.5 border border-slate-700">Cluster: {cluster ?? '-'}</span>
      <span
        className={`rounded-full px-2 py-0.5 border border-slate-700 ${
          trend === 1 ? 'bg-emerald-900/40 text-emerald-200' : 'bg-rose-900/40 text-rose-200'
        }`}
      >
        Trend: {trend === 1 ? 'UP' : 'DOWN'}
      </span>
      {label && (
        <span className="rounded-full px-2 py-0.5 border border-slate-700 bg-slate-800/80 text-slate-200">
          Regime: {label}
        </span>
      )}
    </div>
  );
}
