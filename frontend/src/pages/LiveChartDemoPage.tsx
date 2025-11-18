import LiveCandleChart from '@/components/LiveCandleChart';
import { env } from '@/lib/env';
import { useSymbolStore } from '@/store/symbolStore';

const timeframes: Array<{ label: string; value: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' }> = [
  { label: '1 Min', value: '1Min' },
  { label: '5 Min', value: '5Min' },
  { label: '15 Min', value: '15Min' },
  { label: '1 Hour', value: '1Hour' },
  { label: '1 Day', value: '1Day' },
];

export function LiveChartDemoPage() {
  const { symbol, timeframe, setSymbol, setTimeframe } = useSymbolStore();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-slate-50">Live Candle Chart</h1>
        <p className="text-slate-400">
          Historical bars from <code className="text-slate-200">{env.barsFunction}</code>. Live updates via{' '}
          {env.alpacaWsUrl ? 'websocket' : 'quote polling fallback (1s)'} against{' '}
          <code className="text-slate-200">{env.quoteFunction}</code>.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Symbol
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
            aria-label="Symbol"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Timeframe
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as typeof timeframes[number]['value'])}
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
            aria-label="Timeframe"
          >
            {timeframes.map((tf) => (
              <option key={tf.value} value={tf.value}>
                {tf.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <LiveCandleChart symbol={symbol} timeframe={timeframe} range="5D" />
      </div>
    </div>
  );
}

export default LiveChartDemoPage;
