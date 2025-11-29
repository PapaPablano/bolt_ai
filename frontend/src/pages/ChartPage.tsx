import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import UnifiedCandleChart from '@/components/UnifiedCandleChart';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import type { TF, Range } from '@/types/prefs';
import type { AppOutletContext } from '@/App';
import { Button } from '@/components/ui/button';
import type { Bar } from '@/types/bars';

const TIMEFRAME_OPTIONS: TF[] = ['1Min', '5Min', '10Min', '15Min', '1Hour', '4Hour', '1Day'];
const RANGE_OPTIONS: Range[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'MAX'];

export default function ChartPage() {
  const { selectedSymbol } = useOutletContext<AppOutletContext>();
  const { prefs, loading: prefsLoading } = useChartPrefs();
  const [timeframe, setTimeframe] = useState<TF>(prefs.default_timeframe);
  const [range, setRange] = useState<Range>(prefs.default_range);

  useEffect(() => {
    if (prefs.default_timeframe) setTimeframe(prefs.default_timeframe);
    if (prefs.default_range) setRange(prefs.default_range);
  }, [prefs.default_timeframe, prefs.default_range]);

  const { data: histBars, isLoading, isError, refetch } = useHistoricalBars(selectedSymbol, timeframe, range);
  const live = useLiveBars(selectedSymbol, timeframe, { enabled: true });

  const candles = useMemo<Bar[]>(() => (Array.isArray(histBars) ? histBars : []), [histBars]);

  const showChart = candles.length > 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-slate-400">Symbol</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{selectedSymbol}</h1>
          <p className="text-sm text-slate-400">Interactive multi-timeframe chart with live bar updates.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.map((tf) => (
              <Button
                key={tf}
                variant={tf === timeframe ? 'default' : 'secondary'}
                onClick={() => setTimeframe(tf)}
                size="sm"
                className="min-w-[56px]"
              >
                {tf.replace('Min', 'm').replace('Hour', 'h').replace('Day', 'd')}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt}
                variant={opt === range ? 'default' : 'secondary'}
                onClick={() => setRange(opt)}
                size="sm"
                className="min-w-[48px]"
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        {prefsLoading || isLoading ? (
          <div className="flex h-[420px] items-center justify-center text-slate-400">Loading chart data…</div>
        ) : isError ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center text-red-400">
            <p>Unable to load historical bars for {selectedSymbol}.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : showChart ? (
          <UnifiedCandleChart candles={candles} liveBar={live.bar ?? null} />
        ) : (
          <div className="flex h-[420px] items-center justify-center text-slate-400">No historical data available.</div>
        )}
      </div>
    </section>
  );
}
