import { useEffect } from 'react';
import { useTickerDataStore } from '@/store/tickerDataStore';
import { useSymbolStore } from '@/store/symbolStore';

export function OptionsSidebarClean() {
  const symbol = useSymbolStore((state) => state.symbol);
  const { prefetchOptions, data } = useTickerDataStore();

  useEffect(() => {
    if (symbol) {
      prefetchOptions(symbol);
    }
  }, [symbol, prefetchOptions]);

  const tickerData = symbol ? data[symbol] : undefined;
  const loading = tickerData?.status.optionsLoading;
  const hasOptions = !!tickerData?.options;

  return (
    <aside className="space-y-2 text-sm text-slate-300">
      <div className="font-medium text-slate-100">Options Prefetch</div>
      <div className="text-slate-400">Symbol: {symbol || '-'}</div>
      {symbol ? (
        loading ? (
          <div className="text-xs text-slate-400">Loading options chain...</div>
        ) : hasOptions ? (
          <div className="text-xs text-emerald-400">Options chain prefetched and cached.</div>
        ) : (
          <div className="text-xs text-slate-500">No options data available.</div>
        )
      ) : (
        <div className="text-xs text-slate-500">Select a symbol to prefetch options.</div>
      )}
    </aside>
  );
}
