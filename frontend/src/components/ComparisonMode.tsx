import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { ComparisonChart } from './ComparisonChart';
import { SearchBar } from './SearchBar';
import { fetchHistoricalData } from '../lib/api';
import { Modal } from './Modal';
import { useAnnouncement } from '../hooks/useFocusManagement';

interface ComparisonModeProps {
  initialSymbol: string;
  onClose: () => void;
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export function ComparisonMode({ initialSymbol, onClose }: ComparisonModeProps) {
  const [symbols, setSymbols] = useState<string[]>([initialSymbol]);
  const [datasets, setDatasets] = useState<Array<{
    symbol: string;
    data: Array<{ time: string; close: number }>;
    color: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const announce = useAnnouncement();

  useEffect(() => {
    loadData();
  }, [symbols]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dataPromises = symbols.map(async (symbol, index) => {
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
    if (symbols.length >= 5) {
      announce('Maximum 5 symbols allowed', 'assertive');
      return;
    }
    if (symbols.includes(symbol)) {
      announce(`${symbol} is already in the comparison`, 'polite');
      return;
    }
    setSymbols([...symbols, symbol]);
    announce(`${symbol} added to comparison`, 'polite');
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (symbols.length <= 1) return;
    setSymbols(symbols.filter(s => s !== symbol));
    announce(`${symbol} removed from comparison`, 'polite');
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Compare Stocks" size="xl">
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <SearchBar onSelectSymbol={handleAddSymbol} />
            <div className="text-sm text-slate-400">
              {symbols.length}/5 symbols
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {symbols.map((symbol, index) => (
              <div
                key={symbol}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="text-slate-200 font-medium">{symbol}</span>
                {symbols.length > 1 && (
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="ml-1 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          {isLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-slate-400" role="status" aria-live="polite">Loading comparison data...</div>
            </div>
          ) : datasets.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-slate-400">
                Normalized to 100 at start date. Shows relative performance over 6 months.
              </div>
              <ComparisonChart datasets={datasets} height={500} />
            </>
          ) : (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-slate-400">No data available</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
