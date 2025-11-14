import { useEffect, useMemo, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { TradingChart } from '../components/TradingChart';
import { StockCard } from '../components/StockCard';
import { NewsPanel } from '../components/NewsPanel';
import { TimeframeSelector } from '../components/TimeframeSelector';
import { PatternDetector } from '../components/PatternDetector';
import { ChartToolbar } from '../components/ChartToolbar';
import { ComparisonMode } from '../components/ComparisonMode';
import { RelatedStocks } from '../components/RelatedStocks';
import { fetchStockQuote, fetchHistoricalData, type StockQuote, type BarData } from '../lib/api';
import { updateMetaTags, generateStockMetadata } from '../lib/seo';
import { URLBuilder } from '../lib/urlHelpers';
import { useAnnouncement } from '../hooks/useFocusManagement';
import { DrawingManager, type DrawingTool } from '../lib/chartDrawings';
import { InternalLink } from '../components/InternalLink';

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'];

const STOCK_DETAILS: Record<string, { name: string; sector: string }> = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services' },
  AMZN: { name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary' },
  TSLA: { name: 'Tesla, Inc.', sector: 'Consumer Discretionary' },
  NVDA: { name: 'NVIDIA Corporation', sector: 'Technology' }
};

interface DashboardPageProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string, options?: { navigate?: boolean }) => void;
}

export function DashboardPage({ selectedSymbol, onSymbolChange }: DashboardPageProps) {
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

  useEffect(() => {
    const stockDetails = STOCK_DETAILS[selectedSymbol] || { name: `${selectedSymbol} Stock`, sector: 'Markets' };
    const currentPrice = quotes[selectedSymbol]?.price;
    updateMetaTags(
      generateStockMetadata(selectedSymbol, stockDetails.name, currentPrice)
    );
  }, [selectedSymbol, quotes]);

  const handleSymbolSelect = (symbol: string) => {
    onSymbolChange(symbol, { navigate: true });
    announce(`Selected ${symbol}. Loading chart data.`, 'polite');
  };

  const handleToolChange = (tool: DrawingTool) => {
    setActiveTool(tool);
    drawingManager.setActiveTool(tool);
  };

  const handleClearDrawings = () => {
    drawingManager.clearDrawings();
  };

  const relatedStocks = useMemo(() => {
    return DEFAULT_SYMBOLS.filter((symbol) => symbol !== selectedSymbol)
      .slice(0, 3)
      .map((symbol) => ({
        symbol,
        name: STOCK_DETAILS[symbol]?.name || `${symbol} Stock`,
        change: quotes[symbol]?.changePercent,
        sector: STOCK_DETAILS[symbol]?.sector
      }));
  }, [quotes, selectedSymbol]);

  const comparisonUrl = useMemo(() => {
    const builder = URLBuilder.compare([selectedSymbol, ...relatedStocks.map((stock) => stock.symbol)]);
    return builder.build();
  }, [relatedStocks, selectedSymbol]);

  return (
    <>
      <section id="watchlist" className="mb-6" aria-label="Stock watchlist">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Watchlist</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {DEFAULT_SYMBOLS.map((symbol) => (
            <div key={symbol} className="space-y-2">
              {quotes[symbol] ? (
                <StockCard
                  quote={quotes[symbol]}
                  onClick={() => handleSymbolSelect(symbol)}
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
            <InternalLink
              to={comparisonUrl}
              className="text-sm text-blue-400 hover:text-blue-300"
              aria-label={`Open comparison view for ${selectedSymbol} and related stocks`}
            >
              Open comparison page
            </InternalLink>
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

          <aside id="news" className="lg:col-span-1" role="complementary" aria-label="Stock news and updates">
            <NewsPanel symbol={selectedSymbol} />
          </aside>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PatternDetector data={chartData} />
          </div>
          <RelatedStocks currentSymbol={selectedSymbol} stocks={relatedStocks} />
        </div>
      </section>

      {showComparison && (
        <ComparisonMode
          initialSymbol={selectedSymbol}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
