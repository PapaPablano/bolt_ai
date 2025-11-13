import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { ComparisonChart } from './ComparisonChart';
import { SearchBar } from './SearchBar';
import { fetchHistoricalData } from '../lib/api';

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
      alert('Maximum 5 symbols allowed');
      return;
    }
    if (symbols.includes(symbol)) {
      alert('Symbol already added');
      return;
    }
    setSymbols([...symbols, symbol]);
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (symbols.length <= 1) return;
    setSymbols(symbols.filter(s => s !== symbol));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-slate-100">Compare Stocks</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
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
                <div className="text-slate-400">Loading comparison data...</div>
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
      </div>
    </div>
  );
}
