import { Suspense, useEffect, useMemo, useState, lazy } from 'react';
import { GitCompare } from 'lucide-react';
import { StockCard } from '../components/StockCard';
import { NewsPanel } from '../components/NewsPanel';
import { PatternDetector } from '../components/PatternDetector';
import { ComparisonMode } from '../components/ComparisonMode';
import { RelatedStocks } from '../components/RelatedStocks';
import { TrendingStocks } from '../components/TrendingStocks';
import { fetchStockQuote, type StockQuote, type BarData } from '../lib/api';
import { updateMetaTags, generateStockMetadata } from '../lib/seo';
import { URLBuilder, ROUTES } from '../lib/urlHelpers';
import { useAnnouncement } from '../hooks/useFocusManagement';
import { InternalLink } from '../components/InternalLink';
const AdvancedCandleChart = lazy(() => import('../components/AdvancedCandleChart'));
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { supabase } from '../lib/supabase';

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
  const [showComparison, setShowComparison] = useState(false);
  const [forceChartRender, setForceChartRender] = useState(false);
  const [smokeResult, setSmokeResult] = useState<unknown | null>(null);
  const [smokeError, setSmokeError] = useState<string | null>(null);
  const [smokeLoading, setSmokeLoading] = useState(false);
  const announce = useAnnouncement();
  const { prefs, loading: prefsLoading } = useChartPrefs();
  const tf = prefs.default_timeframe;
  const range = prefs.default_range;
  const { data: histBars, isLoading: barsLoading } = useHistoricalBars(selectedSymbol, tf, range);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setForceChartRender(sp.get('mock') === '1');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runSmokeTest = async () => {
      setSmokeLoading(true);
      setSmokeError(null);

      try {
        const { data, error } = await (supabase as unknown as {
          functions: {
            invoke: (name: string, args: { body?: unknown }) => Promise<{ data: unknown; error: unknown }>;
          };
        }).functions.invoke('stock-quote', {
          body: { symbol: selectedSymbol || 'AAPL' },
        });

        if (cancelled) return;

        if (error) {
          console.error('SupabaseSmokePanel stock-quote error', error);
          const message = error instanceof Error ? error.message : String(error);
          setSmokeError(message);
          setSmokeResult(null);
        } else {
          setSmokeResult(data ?? null);
          setSmokeError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('SupabaseSmokePanel unexpected error', err);
        const message = err instanceof Error ? err.message : String(err);
        setSmokeError(message);
        setSmokeResult(null);
      } finally {
        if (!cancelled) {
          setSmokeLoading(false);
        }
      }
    };

    runSmokeTest();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

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
    if (histBars) {
      setChartData(histBars);
      setIsLoadingChart(false);
    } else {
      setIsLoadingChart(barsLoading || prefsLoading);
    }
  }, [histBars, barsLoading, prefsLoading]);

  const currentDetails = useMemo(
    () => STOCK_DETAILS[selectedSymbol] || { name: `${selectedSymbol} Stock`, sector: 'Markets' },
    [selectedSymbol]
  );

  useEffect(() => {
    const currentPrice = quotes[selectedSymbol]?.price;
    updateMetaTags(
      generateStockMetadata(selectedSymbol, currentDetails.name, currentPrice)
    );
  }, [selectedSymbol, quotes, currentDetails.name]);

  const handleSymbolSelect = (symbol: string) => {
    onSymbolChange(symbol, { navigate: true });
    announce(`Selected ${symbol}. Loading chart data.`, 'polite');
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

  const trendingStocks = useMemo(() => {
    const entries = Object.entries(quotes);
    if (entries.length === 0) {
      return DEFAULT_SYMBOLS.slice(0, 4).map((symbol) => ({
        symbol,
        name: STOCK_DETAILS[symbol]?.name || `${symbol} Stock`,
        sector: STOCK_DETAILS[symbol]?.sector
      }));
    }

    return entries
      .sort(([, aQuote], [, bQuote]) => {
        const aChange = Math.abs(aQuote?.changePercent || 0);
        const bChange = Math.abs(bQuote?.changePercent || 0);
        return bChange - aChange;
      })
      .slice(0, 5)
      .map(([symbol, quote]) => ({
        symbol,
        name: STOCK_DETAILS[symbol]?.name || `${symbol} Stock`,
        price: quote?.price,
        changePercent: quote?.changePercent,
        sector: STOCK_DETAILS[symbol]?.sector
      }));
  }, [quotes]);

  return (
    <>
      <section
        aria-label="Supabase connectivity smoke test"
        className="mb-6 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-300"
      >
        <h2 className="mb-2 font-semibold text-slate-100">SupabaseSmokePanel (stock-quote)</h2>
        {smokeLoading && <div>Loading stock-quote from Supabase...</div>}
        {!smokeLoading && smokeError && (
          <pre className="whitespace-pre-wrap break-words text-red-300">
            ERROR: {smokeError}
          </pre>
        )}
        {!smokeLoading && !smokeError && smokeResult != null && (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(smokeResult, null, 2)}
          </pre>
        )}
        {!smokeLoading && !smokeError && !smokeResult && (
          <div className="text-slate-400">No response received yet.</div>
        )}
      </section>

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

      <div className="mb-8" aria-label="Trending insights">
        <TrendingStocks items={trendingStocks} onSelectSymbol={handleSymbolSelect} />
      </div>

      <section id="chart" className="mb-6" aria-label="Trading chart and analysis">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{selectedSymbol}</h2>
            {quotes[selectedSymbol] && (
              <p className="text-sm text-slate-400">
                Current: {quotes[selectedSymbol].price.toFixed(2)} USD
              </p>
            )}
            {currentDetails.sector && (
              <p className="text-sm text-slate-400">
                Sector:{' '}
                <InternalLink
                  to={ROUTES.sector(currentDetails.sector)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {currentDetails.sector}
                </InternalLink>
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
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
            {chartData.length > 0 || forceChartRender ? (
              <Suspense
                fallback={
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg h-[600px] flex items-center justify-center">
                    <div className="text-slate-400">Loading chart...</div>
                  </div>
                }
              >
                <AdvancedCandleChart symbol={selectedSymbol} initialTf={tf} initialRange={range} height={600} />
              </Suspense>
            ) : isLoadingChart ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg h-[600px] flex items-center justify-center">
                <div className="text-slate-400">Loading chart...</div>
              </div>
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
