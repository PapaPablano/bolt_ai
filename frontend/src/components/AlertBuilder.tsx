import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createAlert, type AlertCondition, type TF } from '@/lib/apiAlerts';

export default function AlertBuilder() {
  const [ticker, setTicker] = useState('AAPL');
  const [type, setType] = useState<'kdj_cross' | 'bb_squeeze' | 'supertrend_flip'>('kdj_cross');
  const [tf, setTf] = useState<TF>('1h');

  const [when, setWhen] = useState<'J_crosses_D' | 'J_crosses_below_D'>('J_crosses_D');
  const [n, setN] = useState(9);
  const [m, setM] = useState(3);
  const [l, setL] = useState(3);

  const [bbN, setBbN] = useState(20);
  const [bbK, setBbK] = useState(2);
  const [pct, setPct] = useState(5);

  const [atr, setAtr] = useState(10);
  const [fmin, setFmin] = useState(1);
  const [fmax, setFmax] = useState(5);
  const [fstep, setFstep] = useState(0.5);
  const [alpha, setAlpha] = useState(0.2);

  const cond: AlertCondition = useMemo(() => {
    switch (type) {
      case 'kdj_cross':
        return { type, tf, when, n, m, l };
      case 'bb_squeeze':
        return { type, tf, n: bbN, k: bbK, bw_pctile: pct };
      case 'supertrend_flip':
        return { type, tf, atr, fmin, fmax, fstep, alpha };
    }
  }, [type, tf, when, n, m, l, bbN, bbK, pct, atr, fmin, fmax, fstep, alpha]);

  const [status, setStatus] = useState('');

  async function onCreate() {
    try {
      await createAlert({ ticker, condition: cond, active: true });
      setStatus('Alert saved');
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    }
  }

  return (
    <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/60 space-y-3 text-sm">
      <div className="font-medium text-slate-200">Minimal Alert Builder</div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Alert symbol"
          className="w-28"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
        />
        <select
          aria-label="Alert type"
          className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="kdj_cross">KDJ cross</option>
          <option value="bb_squeeze">BB squeeze</option>
          <option value="supertrend_flip">Supertrend flip</option>
        </select>
        <select
          aria-label="Alert timeframe"
          className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          value={tf}
          onChange={(e) => setTf(e.target.value as TF)}
        >
          <option value="10m">10m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>
      </div>

      {type === 'kdj_cross' && (
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <select
            aria-label="KDJ cross direction"
            className="w-56 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={when}
            onChange={(e) => setWhen(e.target.value as any)}
          >
            <option value="J_crosses_D">J crosses ABOVE D</option>
            <option value="J_crosses_below_D">J crosses BELOW D</option>
          </select>
          <Input
            aria-label="KDJ n"
            className="w-20"
            type="number"
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
          />
          <Input
            aria-label="KDJ m"
            className="w-20"
            type="number"
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
          />
          <Input
            aria-label="KDJ l"
            className="w-20"
            type="number"
            value={l}
            onChange={(e) => setL(Number(e.target.value))}
          />
        </div>
      )}

      {type === 'bb_squeeze' && (
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span>n</span>
            <Input
              aria-label="BB period"
              className="w-20"
              type="number"
              value={bbN}
              onChange={(e) => setBbN(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>k</span>
            <Input
              aria-label="BB multiplier"
              className="w-20"
              type="number"
              value={bbK}
              onChange={(e) => setBbK(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>%ile</span>
            <Input
              aria-label="Bandwidth percentile"
              className="w-24"
              type="number"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {type === 'supertrend_flip' && (
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span>ATR</span>
            <Input
              aria-label="ATR length"
              className="w-20"
              type="number"
              value={atr}
              onChange={(e) => setAtr(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>fmin</span>
            <Input
              aria-label="Factor min"
              className="w-20"
              type="number"
              value={fmin}
              onChange={(e) => setFmin(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>fmax</span>
            <Input
              aria-label="Factor max"
              className="w-20"
              type="number"
              value={fmax}
              onChange={(e) => setFmax(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>fstep</span>
            <Input
              aria-label="Factor step"
              className="w-20"
              type="number"
              value={fstep}
              onChange={(e) => setFstep(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>alpha</span>
            <Input
              aria-label="Performance memory alpha"
              className="w-24"
              type="number"
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={onCreate}>
          Save Alert
        </Button>
        <div className="text-xs text-slate-400">{status}</div>
      </div>
    </div>
  );
}
