import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ComparisonWorkbench } from '../components/ComparisonWorkbench';
import { generateComparisonMetadata, updateMetaTags } from '../lib/seo';

function useSymbolsFromQuery(defaultSymbols: string[] = ['AAPL', 'MSFT']) {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const paramSymbols = params.get('symbols');
    if (!paramSymbols) return defaultSymbols;
    return paramSymbols
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);
  }, [location.search, defaultSymbols]);
}

export function ComparePage() {
  const symbols = useSymbolsFromQuery();

  useEffect(() => {
    updateMetaTags(generateComparisonMetadata(symbols));
  }, [symbols]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Relative Strength Lab</p>
        <h2 className="text-3xl font-semibold text-slate-50">Stock Comparison Workspace</h2>
        <p className="text-slate-400 max-w-3xl">
          Plot multiple equities on a normalized scale to identify trend confirmation, rotation, and pairs trade opportunities.
        </p>
      </header>

      <ComparisonWorkbench initialSymbols={symbols} />
    </div>
  );
}
