import { useEffect, useState } from 'react';
import type { StPerfParams } from '@/utils/indicators-supertrend-perf';

type IndToggle = 'STAI' | 'EMA' | 'RSI' | 'VWAP' | 'BB' | 'MACD';

type Props = {
  initial: {
    st: StPerfParams;
    bb: { period: number; mult: number };
    macd: { fast: number; slow: number; signal: number };
    vwap: { mult: number };
  };
  toggles: Record<IndToggle, boolean>;
  onToggle: (name: IndToggle, on: boolean) => void;
  onSetStParams: (params: Partial<StPerfParams>) => void;
  onSetBbParams: (params: Partial<{ period: number; mult: number }>) => void;
  onSetMacdParams: (params: Partial<{ fast: number; slow: number; signal: number }>) => void;
  onSetVwapParams: (params: Partial<{ mult: number }>) => void;
};

export function IndicatorPanel({ initial, toggles, onToggle, onSetStParams, onSetBbParams, onSetMacdParams, onSetVwapParams }: Props) {
  const [stParams, setStParams] = useState<StPerfParams>(initial.st);
  const [bbParams, setBbParams] = useState(initial.bb);
  const [macdParams, setMacdParams] = useState(initial.macd);
  const [vwapParams, setVwapParams] = useState(initial.vwap);

  useEffect(() => setStParams(initial.st), [initial.st]);
  useEffect(() => setBbParams(initial.bb), [initial.bb]);
  useEffect(() => setMacdParams(initial.macd), [initial.macd]);
  useEffect(() => setVwapParams(initial.vwap), [initial.vwap]);

  const updateSt = <K extends keyof StPerfParams>(key: K, value: StPerfParams[K]) => {
    const next = { ...stParams, [key]: value };
    setStParams(next);
    onSetStParams({ [key]: value } as Partial<StPerfParams>);
  };
  const updateBb = (patch: Partial<{ period: number; mult: number }>) => {
    const next = { ...bbParams, ...patch };
    setBbParams(next);
    onSetBbParams(patch);
  };
  const updateMacd = (patch: Partial<{ fast: number; slow: number; signal: number }>) => {
    const next = { ...macdParams, ...patch };
    setMacdParams(next);
    onSetMacdParams(patch);
  };
  const updateVwap = (patch: Partial<{ mult: number }>) => {
    const next = { ...vwapParams, ...patch };
    setVwapParams(next);
    onSetVwapParams(patch);
  };

  const checkbox = (name: IndToggle, label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={!!toggles[name]} onChange={(event) => onToggle(name, event.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="rounded-md border border-slate-800/60 bg-slate-900/60 p-3 text-sm space-y-4">
      <div className="font-medium text-slate-200">Indicators</div>

      {checkbox('STAI', 'SuperTrend-AI')}
      <div className="grid grid-cols-2 gap-2 text-xs ml-4">
        <Field label="ATR">
          <input type="number" min={5} max={150} value={stParams.atrSpan} onChange={(event) => updateSt('atrSpan', Number(event.target.value))} />
        </Field>
        <Field label="Factor min">
          <input type="number" step="0.1" value={stParams.factorMin} onChange={(event) => updateSt('factorMin', Number(event.target.value))} />
        </Field>
        <Field label="Factor max">
          <input type="number" step="0.1" value={stParams.factorMax} onChange={(event) => updateSt('factorMax', Number(event.target.value))} />
        </Field>
        <Field label="Factor step">
          <input type="number" step="0.1" value={stParams.factorStep} onChange={(event) => updateSt('factorStep', Number(event.target.value))} />
        </Field>
        <Field label="Cluster">
          <select value={stParams.fromCluster ?? 'Best'} onChange={(event) => updateSt('fromCluster', event.target.value as StPerfParams['fromCluster'])}>
            <option value="Best">Best</option>
            <option value="Average">Average</option>
            <option value="Worst">Worst</option>
          </select>
        </Field>
        <Field label="k">
          <select value={stParams.k ?? 3} onChange={(event) => updateSt('k', Number(event.target.value) as StPerfParams['k'])}>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Field>
        <Field label="Use AMA">
          <input type="checkbox" checked={!!stParams.useAMA} onChange={(event) => updateSt('useAMA', event.target.checked)} />
        </Field>
        <Field label="Immediate flips">
          <input
            type="checkbox"
            checked={!!stParams.applyImmediateOnFlip}
            onChange={(event) => updateSt('applyImmediateOnFlip', event.target.checked)}
          />
        </Field>
      </div>

      {checkbox('EMA', 'EMA (20)')}
      {checkbox('RSI', 'RSI (14)')}

      {checkbox('VWAP', 'Session VWAP')}
      <div className="grid grid-cols-2 gap-2 text-xs ml-4">
        <Field label="Mult">
          <input type="number" step="0.1" min={0.1} value={vwapParams.mult} onChange={(event) => updateVwap({ mult: Number(event.target.value) })} />
        </Field>
      </div>

      {checkbox('BB', 'Bollinger Bands')}
      <div className="grid grid-cols-2 gap-2 text-xs ml-4">
        <Field label="Period">
          <input type="number" min={5} value={bbParams.period} onChange={(event) => updateBb({ period: Number(event.target.value) })} />
        </Field>
        <Field label="Mult">
          <input type="number" step="0.1" value={bbParams.mult} onChange={(event) => updateBb({ mult: Number(event.target.value) })} />
        </Field>
      </div>

      {checkbox('MACD', 'MACD')}
      <div className="grid grid-cols-3 gap-2 text-xs ml-4">
        <Field label="Fast">
          <input type="number" min={2} value={macdParams.fast} onChange={(event) => updateMacd({ fast: Number(event.target.value) })} />
        </Field>
        <Field label="Slow">
          <input type="number" min={2} value={macdParams.slow} onChange={(event) => updateMacd({ slow: Number(event.target.value) })} />
        </Field>
        <Field label="Signal">
          <input type="number" min={2} value={macdParams.signal} onChange={(event) => updateMacd({ signal: Number(event.target.value) })} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
