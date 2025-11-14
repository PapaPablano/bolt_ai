import { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, ListChecks } from 'lucide-react';
import { StockCard } from '../components/StockCard';
import { RelatedStocks } from '../components/RelatedStocks';
import { InternalLink, StockLink } from '../components/InternalLink';
import { fetchStockQuote, type StockQuote } from '../lib/api';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META'];
const TRENDING_SYMBOLS = ['NFLX', 'AMD', 'GOOGL', 'SHOP'];

interface WatchlistPageProps {
  onSymbolSelect: (symbol: string, options?: { navigate?: boolean }) => void;
}

export function WatchlistPage({ onSymbolSelect }: WatchlistPageProps) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [status, setStatus] = useState<'favorites' | 'trending'>('favorites');

  useEffect(() => {
    updateMetaTags(generatePageMetadata('watchlist'));
  }, []);

  useEffect(() => {
    const symbols = status === 'favorites' ? DEFAULT_WATCHLIST : TRENDING_SYMBOLS;
    const loadQuotes = async () => {
      const entries = await Promise.all(symbols.map(async (symbol) => {
        try {
          const quote = await fetchStockQuote(symbol);
          return [symbol, quote] as const;
        } catch (error) {
          console.error('Error loading watchlist quote', error);
          return null;
        }
      }));
      const next: Record<string, StockQuote> = {};
      entries.forEach((entry) => {
        if (entry) {
          next[entry[0]] = entry[1];
        }
      });
      setQuotes(next);
    };
    loadQuotes();
  }, [status]);

  const quoteSymbols = status === 'favorites' ? DEFAULT_WATCHLIST : TRENDING_SYMBOLS;

  const movers = useMemo(() => {
    return quoteSymbols
      .map((symbol) => quotes[symbol])
      .filter(Boolean)
      .sort((a, b) => (b!.changePercent ?? 0) - (a!.changePercent ?? 0))
      .slice(0, 3)
      .map((quote) => ({
        symbol: quote!.symbol,
        name: `${quote!.symbol} Watch`,
        change: quote!.changePercent,
      }));
  }, [quoteSymbols, quotes]);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-[0.35em]">
          <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
          Pin Critical Symbols
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-50">My Watchlist</h2>
            <p className="text-slate-400 max-w-2xl">
              Monitor conviction names, react to intraday volatility, and jump directly into detailed analysis or comparisons.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStatus('favorites')}
              className={`px-4 py-2 rounded-full border ${status === 'favorites' ? 'border-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
            >
              Favorites
            </button>
            <button
              onClick={() => setStatus('trending')}
              className={`px-4 py-2 rounded-full border ${status === 'trending' ? 'border-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
            >
              Trending
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Active Symbols ({quoteSymbols.length})
          </h3>
          <div className="text-sm text-slate-400">
            Click a card to open the detailed chart view.
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quoteSymbols.map((symbol) => (
            <div key={symbol}>
              {quotes[symbol] ? (
                <StockCard
                  quote={quotes[symbol]}
                  onClick={() => onSymbolSelect(symbol, { navigate: true })}
                  isSelected={false}
                />
              ) : (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 h-32 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Quick Actions</h3>
            <p className="text-sm text-slate-400 mb-4">
              Layer research modules into your daily workflow.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InternalLink
                to="/compare"
                className="border border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
              >
                Compare Symbols
                <p className="text-xs text-slate-400 mt-1">Launch multi-chart view</p>
              </InternalLink>
              <InternalLink
                to="/screener"
                className="border border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
              >
                Open Screener
                <p className="text-xs text-slate-400 mt-1">Discover new setups</p>
              </InternalLink>
              <InternalLink
                to="/alerts"
                className="border border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
              >
                Manage Alerts
                <p className="text-xs text-slate-400 mt-1">Stay ahead of catalysts</p>
              </InternalLink>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Symbol Coverage</h3>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              {DEFAULT_WATCHLIST.map((symbol) => (
                <div key={symbol} className="flex flex-col">
                  <span className="text-slate-200 font-semibold">{symbol}</span>
                  <span>Core position</span>
                </div>
              ))}
              {TRENDING_SYMBOLS.map((symbol) => (
                <div key={symbol} className="flex flex-col">
                  <span className="text-slate-200 font-semibold">{symbol}</span>
                  <span>Momentum radar</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <RelatedStocks currentSymbol={quoteSymbols[0]} stocks={movers} title="Top Movers" showCompareLink={false} />
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Suggested Research Flow</h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>Scan the watchlist for outsized overnight gaps.</li>
          <li>Jump into the dashboard for a full technical review.</li>
          <li>Use <StockLink symbol="AAPL">Stock detail pages</StockLink> for fundamentals.</li>
          <li>Launch <InternalLink to="/compare" className="text-blue-400 hover:text-blue-300">comparison view</InternalLink> for relative strength.</li>
          <li>Set proactive <InternalLink to="/alerts" className="text-blue-400 hover:text-blue-300">alert levels</InternalLink>.</li>
        </ol>
      </section>
    </div>
  );
}
