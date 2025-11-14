import { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { ComparisonChart } from './ComparisonChart';
import { SearchBar } from './SearchBar';
import { fetchHistoricalData } from '../lib/api';
import { useAnnouncement } from '../hooks/useFocusManagement';
import { InternalLink } from './InternalLink';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

interface ComparisonDataset {
  symbol: string;
  data: Array<{ time: string; close: number }>;
  color: string;
}

interface ComparisonWorkbenchProps {
  initialSymbols: string[];
  maxSymbols?: number;
  variant?: 'page' | 'modal';
  description?: string;
}

export function ComparisonWorkbench({
  initialSymbols,
  maxSymbols = 5,
  variant = 'page',
  description = 'Add up to five symbols to compare normalized performance side-by-side.',
}: ComparisonWorkbenchProps) {
  const [symbols, setSymbols] = useState<string[]>(() => Array.from(new Set(initialSymbols)).slice(0, maxSymbols));
  const [datasets, setDatasets] = useState<ComparisonDataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const announce = useAnnouncement();

  useEffect(() => {
    loadData(symbols);
  }, [symbols]);

  const loadData = async (currentSymbols: string[]) => {
    setIsLoading(true);
    try {
      const dataPromises = currentSymbols.map(async (symbol, index) => {
        const bars = await fetchHistoricalData(symbol, '6M');
        return {
          symbol,
          data: bars.map(bar => ({ time: bar.time, close: bar.close })),
          color: CHART_COLORS[index % CHART_COLORS.length],
        };
      });

      const results = await Promise.all(dataPromises);
      setDatasets(results);
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSymbol = (symbol: string) => {
    const normalized = symbol.toUpperCase();
    if (symbols.length >= maxSymbols) {
      announce(`Maximum ${maxSymbols} symbols allowed`, 'assertive');
      return;
    }
    if (symbols.includes(normalized)) {
      announce(`${normalized} is already in the comparison`, 'polite');
      return;
    }
    setSymbols([...symbols, normalized]);
    announce(`${normalized} added to comparison`, 'polite');
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (symbols.length <= 1) {
      announce('At least one symbol is required', 'polite');
      return;
    }
    setSymbols(symbols.filter(s => s !== symbol));
    announce(`${symbol} removed from comparison`, 'polite');
  };

  const helperLinks = useMemo(() => [
    { label: 'Growth Screener', to: '/screener?style=growth' },
    { label: 'Momentum Screener', to: '/screener?style=momentum' },
    { label: 'Value Screener', to: '/screener?style=value' }
  ], []);

  return (
    <div className="space-y-8">
      {variant === 'page' && (
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-widest">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            Multi-Symbol Analysis
          </div>
          <p className="text-slate-400 max-w-2xl">{description}</p>
        </header>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <SearchBar onSelectSymbol={handleAddSymbol} />
        </div>
        <div className="text-sm text-slate-400">
          {symbols.length}/{maxSymbols} symbols selected
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-live="polite">
        {symbols.map((symbol, index) => (
          <div
            key={symbol}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="text-slate-200 font-medium">{symbol}</span>
            {symbols.length > 1 && (
              <button
                onClick={() => handleRemoveSymbol(symbol)}
                className="ml-1 hover:text-red-400 transition-colors"
                aria-label={`Remove ${symbol} from comparison`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        {isLoading ? (
          <div className="h-[500px] flex items-center justify-center" role="status" aria-live="polite">
            <div className="text-slate-400">Loading comparison data...</div>
          </div>
        ) : datasets.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-slate-400">
              Normalized to 100 at start date. Hover to inspect precise values across the last six months.
            </div>
            <ComparisonChart datasets={datasets} height={500} />
          </>
        ) : (
          <div className="h-[500px] flex items-center justify-center">
            <div className="text-slate-400">No data available</div>
          </div>
        )}
      </div>

      {variant === 'page' && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Next Research Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {helperLinks.map((link) => (
              <InternalLink
                key={link.label}
                to={link.to}
                className="p-4 border border-slate-800 rounded-xl hover:border-blue-500 transition-colors flex items-center justify-between text-slate-300"
              >
                {link.label}
                <TrendingUp className="w-4 h-4 text-blue-400" aria-hidden="true" />
              </InternalLink>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
