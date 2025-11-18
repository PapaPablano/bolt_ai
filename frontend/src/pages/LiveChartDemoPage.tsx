import { useState } from 'react';
import AdvancedCandleChart from '@/components/AdvancedCandleChart';
import { env } from '@/lib/env';
import { allowedSymbolRegex, normalizeSymbol } from '@/lib/symbols';

type TF = '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
type Range = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'MAX';

const normalizeTf = (value: string | undefined): TF => {
  const allowed: TF[] = ['1Min', '5Min', '10Min', '15Min', '1Hour', '4Hour', '1Day'];
  return allowed.find((tf) => tf === value) ?? '1Hour';
};

const normalizeRange = (value: string | undefined): Range => {
  const allowed: Range[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'MAX'];
  const upper = value?.toUpperCase?.();
  return (allowed.find((r) => r === upper) ?? '6M') as Range;
};

export function LiveChartDemoPage() {
  const [input, setInput] = useState(normalizeSymbol(env.defaultSymbol || 'AAPL'));
  const [symbol, setSymbol] = useState(normalizeSymbol(env.defaultSymbol || 'AAPL'));
  const [error, setError] = useState('');

  const handleSymbolChange = (value: string) => {
    const normalized = normalizeSymbol(value);
    setInput(normalized);
    if (allowedSymbolRegex.test(normalized)) {
      setSymbol(normalized);
      setError('');
    } else {
      setError('Use 1-10 letters, dots, or hyphens.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-slate-50">Advanced Candle Chart</h1>
        <p className="text-slate-400">
          Historical bars from <code className="text-slate-200">{env.barsFunction}</code>. Live updates via{' '}
          {env.alpacaWsUrl ? 'websocket' : 'quote polling fallback (1s)'} against{' '}
          <code className="text-slate-200">{env.quoteFunction}</code>. Composite intervals (10m/4h) are aggregated on
          the fly for both history and live ticks.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Symbol
          <input
            value={input}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
            aria-label="Symbol"
          />
        </label>
        {error && <span className="text-xs text-amber-400">{error}</span>}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <AdvancedCandleChart
          symbol={symbol}
          initialTf={normalizeTf(env.defaultTimeframe)}
          initialRange={normalizeRange(env.defaultRange) as Range}
          height={560}
        />
      </div>
    </div>
  );
}

export default LiveChartDemoPage;
