import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type TF = '10m' | '1h' | '4h';

type Props = {
  symbol: string;
  setSymbol: (s: string) => void;
  tf: TF;
  setTf: (tf: TF) => void;

  onLoadBB: () => void;
  onLoadKDJ: () => void;
  onLoadSTAI: (persist?: boolean) => void;

  showBB: boolean;
  setShowBB: (v: boolean) => void;
  showKDJ: boolean;
  setShowKDJ: (v: boolean) => void;
  showSTAI: boolean;
  setShowSTAI: (v: boolean) => void;
};

export default function WorkspaceIndicatorPanel(props: Props) {
  const {
    symbol,
    setSymbol,
    tf,
    setTf,
    onLoadBB,
    onLoadKDJ,
    onLoadSTAI,
    showBB,
    setShowBB,
    showKDJ,
    setShowKDJ,
    showSTAI,
    setShowSTAI,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 border-b border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Symbol"
          className="w-28"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
        <select
          aria-label="Timeframe"
          className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          value={tf}
          onChange={(e) => setTf(e.target.value as TF)}
        >
          <option value="10m">10m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
        </select>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={showBB} onCheckedChange={setShowBB} />
          <span>Bollinger</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={showKDJ} onCheckedChange={setShowKDJ} />
          <span>KDJ</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={showSTAI} onCheckedChange={setShowSTAI} />
          <span>STAI</span>
        </label>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="secondary" size="sm" type="button" onClick={onLoadBB}>
          Load BB
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={onLoadKDJ}>
          Load KDJ
        </Button>
        <Button variant="default" size="sm" type="button" onClick={() => onLoadSTAI(false)}>
          Load STAI
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => onLoadSTAI(true)}>
          STAI + Persist
        </Button>
      </div>
    </div>
  );
}
