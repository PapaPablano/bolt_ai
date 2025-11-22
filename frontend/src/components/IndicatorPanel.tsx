import { useEffect, useState } from 'react';
import type { StPerfParams } from '@/utils/indicators-supertrend-perf';
import {
  DEFAULT_INDICATOR_STYLE_PREFS,
  cloneIndicatorStylePrefs,
  type HistThickness,
  type IndicatorStyle,
  type IndicatorStylePrefs,
  type LineWidth,
} from '@/types/indicator-styles';
import { Switch } from '@/components/ui/switch';

export type KdjPanelParams = {
  period: number;
  kSmooth: number;
  dSmooth: number;
  sessionAnchored: boolean;
};

type IndToggle = 'STAI' | 'EMA' | 'RSI' | 'VWAP' | 'BB' | 'MACD' | 'KDJ' | 'Calendar';

type Props = {
  initial: {
    st: StPerfParams;
    bb: { period: number; mult: number };
    macd: { fast: number; slow: number; signal: number };
    vwap: { mult: number };
    kdj: KdjPanelParams;
  };
  toggles: Record<IndToggle, boolean>;
  calendarToggleAllowed?: boolean;
  onToggle: (name: IndToggle, on: boolean) => void;
  onSetStParams: (params: Partial<StPerfParams>) => void;
  onSetBbParams: (params: Partial<{ period: number; mult: number }>) => void;
  onSetMacdParams: (params: Partial<{ fast: number; slow: number; signal: number }>) => void;
  onSetVwapParams: (params: Partial<{ mult: number }>) => void;
  onSetKdjParams: (params: Partial<KdjPanelParams>) => void;
  stylePrefs: IndicatorStylePrefs;
  onChangeStyles: (next: IndicatorStylePrefs) => void;
};

export function IndicatorPanel({
  initial,
  toggles,
  calendarToggleAllowed = false,
  onToggle,
  onSetStParams,
  onSetBbParams,
  onSetMacdParams,
  onSetVwapParams,
  onSetKdjParams,
  stylePrefs,
  onChangeStyles,
}: Props) {
  const [stParams, setStParams] = useState<StPerfParams>(initial.st);
  const [bbParams, setBbParams] = useState(initial.bb);
  const [macdParams, setMacdParams] = useState(initial.macd);
  const [vwapParams, setVwapParams] = useState(initial.vwap);
  const [kdjParams, setKdjParams] = useState(initial.kdj);

  useEffect(() => setStParams(initial.st), [initial.st]);
  useEffect(() => setBbParams(initial.bb), [initial.bb]);
  useEffect(() => setMacdParams(initial.macd), [initial.macd]);
  useEffect(() => setVwapParams(initial.vwap), [initial.vwap]);
  useEffect(() => setKdjParams(initial.kdj), [initial.kdj]);

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
  const updateKdj = (patch: Partial<KdjPanelParams>) => {
    const next = { ...kdjParams, ...patch };
    setKdjParams(next);
    onSetKdjParams(patch);
  };

  const checkbox = (name: IndToggle, label: string) => (
    <label className="flex items-center gap-2">
      <input
        data-testid={`toggle-${name.toLowerCase()}`}
        type="checkbox"
        checked={!!toggles[name]}
        onChange={(event) => onToggle(name, event.target.checked)}
      />
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

      {checkbox('KDJ', 'KDJ (Stoch K/D + J)')}
      <div className="grid grid-cols-4 gap-2 text-xs ml-4">
        <Field label="N">
          <input
            type="number"
            min={3}
            value={kdjParams.period}
            onChange={(event) => updateKdj({ period: Math.max(3, Number(event.target.value) || 9) })}
          />
        </Field>
        <Field label="K">
          <input
            type="number"
            min={1}
            value={kdjParams.kSmooth}
            onChange={(event) => updateKdj({ kSmooth: Math.max(1, Number(event.target.value) || 3) })}
          />
        </Field>
        <Field label="D">
          <input
            type="number"
            min={1}
            value={kdjParams.dSmooth}
            onChange={(event) => updateKdj({ dSmooth: Math.max(1, Number(event.target.value) || 3) })}
          />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={kdjParams.sessionAnchored} onChange={(event) => updateKdj({ sessionAnchored: event.target.checked })} />
          <span className="text-slate-400">Anchor to RTH</span>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm flex flex-col">
          <span>Economic Calendar</span>
          {!calendarToggleAllowed && <span className="text-xs text-slate-500">Disabled in this build</span>}
        </div>
        <Switch
          data-testid="toggle-calendar"
          checked={!!toggles.Calendar}
          onCheckedChange={(checked) => onToggle('Calendar', checked)}
          disabled={!calendarToggleAllowed}
        />
      </div>

      <StylesSection prefs={stylePrefs} onChange={onChangeStyles} />
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

type IndicatorOverrideKey = keyof NonNullable<IndicatorStylePrefs['perIndicator']>;

function StylesSection({ prefs, onChange }: { prefs: IndicatorStylePrefs; onChange: (next: IndicatorStylePrefs) => void }) {
  const lw = prefs.global.lineWidth ?? DEFAULT_INDICATOR_STYLE_PREFS.global.lineWidth;
  const ht = prefs.global.histThickness ?? DEFAULT_INDICATOR_STYLE_PREFS.global.histThickness;

  const emit = (next: IndicatorStylePrefs) => onChange(cloneIndicatorStylePrefs(next));

  const setGlobal = (patch: Partial<IndicatorStylePrefs['global']>) => emit({ ...prefs, global: { ...prefs.global, ...patch } });

  const setOverride = (key: IndicatorOverrideKey, patch: Partial<IndicatorStyle>) => {
    const per = { ...(prefs.perIndicator ?? {}) } as NonNullable<IndicatorStylePrefs['perIndicator']>;
    per[key] = { ...(per[key] ?? {}), ...patch };
    emit({ ...prefs, perIndicator: per });
  };

  const applyToAll = () => {
    const per: NonNullable<IndicatorStylePrefs['perIndicator']> = {};
    const lineKeys: IndicatorOverrideKey[] = ['stAi', 'ema', 'rsi', 'vwap', 'bb', 'macdLine', 'macdSignal', 'kdjK', 'kdjD', 'kdjJ'];
    const histKeys: IndicatorOverrideKey[] = ['macdHist', 'volume'];
    lineKeys.forEach((key) => {
      per[key] = { ...(per[key] ?? {}), lineWidth: lw };
    });
    histKeys.forEach((key) => {
      per[key] = { ...(per[key] ?? {}), histThickness: ht };
    });
    emit({ ...prefs, perIndicator: per });
  };

  const resetOverrides = () => emit(cloneIndicatorStylePrefs(DEFAULT_INDICATOR_STYLE_PREFS));

  const lineControls: { key: IndicatorOverrideKey; label: string }[] = [
    { key: 'stAi', label: 'ST-AI line' },
    { key: 'vwap', label: 'VWAP line' },
    { key: 'macdLine', label: 'MACD line' },
    { key: 'macdSignal', label: 'MACD signal' },
    { key: 'kdjK', label: 'KDJ K' },
    { key: 'kdjD', label: 'KDJ D' },
    { key: 'kdjJ', label: 'KDJ J' },
  ];

  const histControls: { key: IndicatorOverrideKey; label: string }[] = [{ key: 'macdHist', label: 'MACD histogram' }];

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Styles</h4>
        <div className="flex gap-2 text-xs">
          <button type="button" className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={applyToAll}>
            Apply to all
          </button>
          <button type="button" className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={resetOverrides}>
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-center">
        <label className="text-xs text-slate-400">Global line width</label>
        <input type="range" min={1} max={4} step={1} value={lw} onChange={(event) => setGlobal({ lineWidth: Number(event.target.value) as LineWidth })} />
        <label className="text-xs text-slate-400">Global histogram thickness</label>
        <select value={ht} onChange={(event) => setGlobal({ histThickness: event.target.value as HistThickness })}>
          <option value="thin">Thin</option>
          <option value="normal">Normal</option>
          <option value="wide">Wide</option>
        </select>
      </div>

      <div className="grid gap-2">
        {lineControls.map(({ key, label }) => {
          const value = prefs.perIndicator?.[key]?.lineWidth ?? lw;
          return (
            <div key={key} className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs text-slate-400">{label}</span>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={value}
                onChange={(event) => setOverride(key, { lineWidth: Number(event.target.value) as LineWidth })}
              />
              <span className="text-xs text-slate-500 text-right">{value}px</span>
            </div>
          );
        })}
        {histControls.map(({ key, label }) => {
          const value = prefs.perIndicator?.[key]?.histThickness ?? ht;
          return (
            <div key={key} className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs text-slate-400">{label}</span>
              <select className="col-span-2" value={value} onChange={(event) => setOverride(key, { histThickness: event.target.value as HistThickness })}>
                <option value="thin">Thin</option>
                <option value="normal">Normal</option>
                <option value="wide">Wide</option>
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
