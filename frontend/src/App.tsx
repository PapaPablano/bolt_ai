import { useState, useEffect } from 'react';
import { TradingChart } from './components/TradingChart';
import { StockCard } from './components/StockCard';
import { SearchBar } from './components/SearchBar';
import { NewsPanel } from './components/NewsPanel';
import { TimeframeSelector } from './components/TimeframeSelector';
import { PatternDetector } from './components/PatternDetector';
import { ChartToolbar } from './components/ChartToolbar';
import { ComparisonMode } from './components/ComparisonMode';
import { SkipLinks } from './components/SkipLinks';
import { FocusIndicator } from './components/FocusIndicator';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { fetchStockQuote, fetchHistoricalData, type StockQuote, type BarData } from './lib/api';
import { DrawingManager, type DrawingTool } from './lib/chartDrawings';
import { useAnnouncement } from './hooks/useFocusManagement';
import { BarChart3, GitCompare } from 'lucide-react';

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'];

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [chartData, setChartData] = useState<BarData[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [timeframe, setTimeframe] = useState('1M');
  const [showComparison, setShowComparison] = useState(false);
  const [drawingManager] = useState(() => new DrawingManager());
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const announce = useAnnouncement();

  useEffect(() => {
    const loadWatchlist = async () => {
      const quotePromises = DEFAULT_SYMBOLS.map(async (symbol) => {
        try {
          const quote = await fetchStockQuote(symbol);
          return [symbol, quote] as const;
        } catch (error) {
          console.error(`Error fetching quote for ${symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(quotePromises);
      const quotesMap: Record<string, StockQuote> = {};
      results.forEach((result) => {
        if (result) {
          quotesMap[result[0]] = result[1];
        }
      });

      setQuotes(quotesMap);
    };

    loadWatchlist();
    const interval = setInterval(loadWatchlist, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadChartData = async () => {
      setIsLoadingChart(true);
      try {
        const data = await fetchHistoricalData(selectedSymbol, timeframe);
        setChartData(data);
      } catch (error) {
        console.error('Error loading chart data:', error);
        setChartData([]);
      } finally {
        setIsLoadingChart(false);
      }
    };

    loadChartData();
  }, [selectedSymbol, timeframe]);

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    announce(`Selected ${symbol}. Loading chart data.`, 'polite');
  };

  const handleToolChange = (tool: DrawingTool) => {
    setActiveTool(tool);
    drawingManager.setActiveTool(tool);
  };

  const handleClearDrawings = () => {
    drawingManager.clearDrawings();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <FocusIndicator />
      <SkipLinks />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-40" role="banner">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Stock Whisperer
              </h1>
            </div>
            <SearchBar onSelectSymbol={handleSymbolSelect} />
          </div>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-6" role="main">
        <section id="watchlist" className="mb-6" aria-label="Stock watchlist">
          <h2 className="text-lg font-semibold text-slate-300 mb-4">Watchlist</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {DEFAULT_SYMBOLS.map((symbol) => (
              <div key={symbol}>
                {quotes[symbol] ? (
                  <StockCard
                    quote={quotes[symbol]}
                    onClick={() => setSelectedSymbol(symbol)}
                    isSelected={selectedSymbol === symbol}
                  />
                ) : (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 h-32 animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="chart" className="mb-6" aria-label="Trading chart and analysis">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">{selectedSymbol}</h2>
              {quotes[selectedSymbol] && (
                <p className="text-sm text-slate-400">
                  Current: {quotes[selectedSymbol].price.toFixed(2)} USD
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <TimeframeSelector selected={timeframe} onChange={setTimeframe} />
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <GitCompare className="w-4 h-4" />
                Compare
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <div className="mb-4">
                <ChartToolbar
                  activeTool={activeTool}
                  onToolChange={handleToolChange}
                  onClearDrawings={handleClearDrawings}
                />
              </div>
              {isLoadingChart ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg h-[600px] flex items-center justify-center">
                  <div className="text-slate-400">Loading chart...</div>
                </div>
              ) : chartData.length > 0 ? (
                <TradingChart data={chartData} symbol={selectedSymbol} />
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg h-[600px] flex items-center justify-center">
                  <div className="text-slate-400">No chart data available</div>
                </div>
              )}
            </div>

            <div id="news" className="lg:col-span-1">
              <NewsPanel symbol={selectedSymbol} />
            </div>
          </div>

          <PatternDetector data={chartData} />
        </section>
      </main>

      {showComparison && (
        <ComparisonMode
          initialSymbol={selectedSymbol}
          onClose={() => setShowComparison(false)}
        />
      )}

      <footer className="border-t border-slate-800 mt-12 py-6" role="contentinfo">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>Stock Whisperer - Phase 1: Enhanced Charting Foundation</p>
          <p className="mt-1">Powered by Alpaca Market Data & Supabase</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
