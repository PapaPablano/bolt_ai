import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, ListChecks, Loader2, LogOut, PlusCircle, Trash2 } from 'lucide-react';
import { StockCard } from '../components/StockCard';
import { RelatedStocks } from '../components/RelatedStocks';
import { InternalLink, StockLink } from '../components/InternalLink';
import { fetchStockQuote, type StockQuote } from '../lib/api';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';
import { supabase } from '../lib/supabase';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { SupabaseAuthPanel } from '../components/SupabaseAuthPanel';

interface WatchlistPageProps {
  onSymbolSelect: (symbol: string, options?: { navigate?: boolean }) => void;
}

interface WatchlistItemRecord {
  id: string;
  symbol: string;
  notes: string | null;
  added_at: string;
}

interface WatchlistRecord {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  watchlist_items: WatchlistItemRecord[];
}

type WatchlistQueryRow = Omit<WatchlistRecord, 'watchlist_items'> & {
  watchlist_items: WatchlistItemRecord[] | null;
};

export function WatchlistPage({ onSymbolSelect }: WatchlistPageProps) {
  const { user, loading: userLoading } = useSupabaseUser();
  const [watchlists, setWatchlists] = useState<WatchlistRecord[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [formState, setFormState] = useState({ name: '', description: '' });
  const [symbolInput, setSymbolInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateMetaTags(generatePageMetadata('watchlist'));
  }, []);

  const loadWatchlists = useCallback(async () => {
    if (!user) {
      setWatchlists([]);
      setSelectedWatchlistId(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('watchlists')
      .select('id, name, description, is_default, created_at, watchlist_items (id, symbol, notes, added_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading watchlists', error);
      setError(error.message);
      setWatchlists([]);
      setIsLoading(false);
      return;
    }

    const normalized: WatchlistRecord[] = ((data ?? []) as WatchlistQueryRow[]).map((watchlist) => ({
      ...watchlist,
      watchlist_items: (watchlist.watchlist_items ?? []).map((item) => ({
        ...item,
        symbol: item.symbol?.toUpperCase() ?? '',
      })),
    }));

    setWatchlists(normalized);
    setSelectedWatchlistId((current) => {
      if (current && normalized.some((watchlist) => watchlist.id === current)) {
        return current;
      }
      return normalized.find((watchlist) => watchlist.is_default)?.id ?? normalized[0]?.id ?? null;
    });

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadWatchlists();
  }, [loadWatchlists]);

  useEffect(() => {
    const activeWatchlist = watchlists.find((watchlist) => watchlist.id === selectedWatchlistId);
    const symbols = activeWatchlist?.watchlist_items.map((item) => item.symbol) ?? [];

    if (symbols.length === 0) {
      setQuotes({});
      setSymbolsLoading(false);
      return;
    }

    let isMounted = true;
    setSymbolsLoading(true);

    const loadQuotes = async () => {
      const entries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote = await fetchStockQuote(symbol);
            return [symbol, quote] as const;
          } catch (err) {
            console.error(`Error fetching quote for ${symbol}`, err);
            return null;
          }
        })
      );

      if (!isMounted) return;
      const next: Record<string, StockQuote> = {};
      entries.forEach((entry) => {
        if (entry) {
          next[entry[0]] = entry[1];
        }
      });
      setQuotes(next);
      setSymbolsLoading(false);
    };

    loadQuotes();

    return () => {
      isMounted = false;
    };
  }, [selectedWatchlistId, watchlists]);

  const selectedWatchlist = watchlists.find((watchlist) => watchlist.id === selectedWatchlistId);
  const activeItems = useMemo(
    () => selectedWatchlist?.watchlist_items ?? [],
    [selectedWatchlist],
  );
  const watchlistSymbols = activeItems.map((item) => item.symbol);

  const movers = useMemo(() => {
    return activeItems
      .map((item) => quotes[item.symbol])
      .filter(Boolean)
      .sort((a, b) => (b!.changePercent ?? 0) - (a!.changePercent ?? 0))
      .slice(0, 3)
      .map((quote) => ({
        symbol: quote!.symbol,
        name: quote!.symbol,
        change: quote!.changePercent,
      }));
  }, [activeItems, quotes]);

  const handleCreateWatchlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !formState.name.trim()) return;

    setStatusMessage(null);
    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      user_id: user.id,
    };

    const { error } = await supabase.from('watchlists').insert(payload);
    if (error) {
      console.error('Error creating watchlist', error);
      setStatusMessage(error.message);
      return;
    }

    setFormState({ name: '', description: '' });
    setStatusMessage('Watchlist created successfully.');
    await loadWatchlists();
  };

  const handleAddSymbol = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedWatchlistId || !symbolInput.trim()) return;

    setStatusMessage(null);
    const symbol = symbolInput.trim().toUpperCase();
    const { error } = await supabase.from('watchlist_items').insert({
      watchlist_id: selectedWatchlistId,
      symbol,
    });

    if (error) {
      console.error('Error adding symbol', error);
      setStatusMessage(error.message);
      return;
    }

    setSymbolInput('');
    setStatusMessage(`${symbol} added to the watchlist.`);
    await loadWatchlists();
  };

  const handleRemoveSymbol = async (itemId: string) => {
    setStatusMessage(null);
    const { error } = await supabase.from('watchlist_items').delete().eq('id', itemId);
    if (error) {
      console.error('Error removing symbol', error);
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('Symbol removed.');
    await loadWatchlists();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <SupabaseAuthPanel
        title="Sign in to access your watchlists"
        description="Watchlists, alerts, and screener history are stored securely in Supabase. Sign in with your trading account to continue."
      />
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-[0.35em]">
          <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
          Pin Critical Symbols
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-50">My Watchlists</h2>
            <p className="text-slate-400 max-w-2xl">
              Your curated baskets live in Supabase with full CRUD support, ready to feed the dashboard, comparison, and alert systems.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-slate-100">Watchlist Manager</h3>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <form onSubmit={handleCreateWatchlist} className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-400 space-y-2">
              Name
              <input
                type="text"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                placeholder="Momentum radar"
                required
              />
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Description
              <input
                type="text"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                placeholder="What are you tracking?"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold rounded-lg md:col-span-2"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              Create watchlist
            </button>
          </form>
        </div>

        {watchlists.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {watchlists.map((watchlist) => (
              <button
                key={watchlist.id}
                onClick={() => setSelectedWatchlistId(watchlist.id)}
                className={`px-4 py-2 rounded-full border transition-colors ${
                  selectedWatchlistId === watchlist.id
                    ? 'border-blue-500 text-white'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {watchlist.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-400" aria-hidden="true" />
            {selectedWatchlist ? `${selectedWatchlist.name}` : 'No watchlist selected'}
          </h3>
          {selectedWatchlist && (
            <form onSubmit={handleAddSymbol} className="flex items-center gap-3">
              <input
                type="text"
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                placeholder="Add symbol (AAPL)"
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:border-blue-500 transition-colors"
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                Add
              </button>
            </form>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : watchlists.length === 0 ? (
          <p className="text-slate-400 text-sm">Create your first watchlist to start tracking symbols.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlistSymbols.length === 0 && (
              <div className="col-span-full text-slate-400 text-sm">
                No symbols yet. Use the form above to add the first ticker.
              </div>
            )}
            {watchlistSymbols.map((symbol) => (
              <div key={symbol} className="relative group">
                {symbolsLoading && !quotes[symbol] ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 h-32 animate-pulse" />
                ) : quotes[symbol] ? (
                  <StockCard
                    quote={quotes[symbol]}
                    onClick={() => onSymbolSelect(symbol, { navigate: true })}
                    isSelected={false}
                  />
                ) : (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 h-32 flex items-center justify-center text-sm text-slate-400">
                    Unable to load {symbol}
                  </div>
                )}
                <button
                  onClick={() => {
                    const item = activeItems.find((entry) => entry.symbol === symbol);
                    if (item) handleRemoveSymbol(item.id);
                  }}
                  className="absolute top-2 right-2 bg-slate-900/80 border border-slate-800 rounded-full p-1 text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${symbol}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Quick Actions</h3>
            <p className="text-sm text-slate-400 mb-4">
              Jump into comparison, screening, or alerts with a single click.
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
                Run Screener
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
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Suggested Research Flow</h3>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>Scan watchlist gaps and volume spikes at open.</li>
              <li>Jump into dashboard charts for the most active names.</li>
              <li>
                Use <StockLink symbol="AAPL">dedicated stock views</StockLink> for fundamentals.
              </li>
              <li>
                Launch <InternalLink to="/compare" className="text-blue-400 hover:text-blue-300">comparison mode</InternalLink> for relative strength.
              </li>
              <li>
                Set proactive <InternalLink to="/alerts" className="text-blue-400 hover:text-blue-300">alerts</InternalLink> around key levels.
              </li>
            </ol>
          </div>
        </div>

        <RelatedStocks
          currentSymbol={watchlistSymbols[0] ?? 'AAPL'}
          stocks={movers}
          title="Top Movers"
          showCompareLink={Boolean(watchlistSymbols.length)}
        />
      </section>
    </div>
  );
}
