import { useCallback, useEffect, useState } from 'react';
import { Filter, History, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { InternalLink, StockLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { supabase } from '../lib/supabase';
import { SupabaseAuthPanel } from '../components/SupabaseAuthPanel';

interface ScreenerFilters {
  sector: string;
  marketCap: string;
  price: string;
  performance: string;
}

interface ScreenerResult {
  symbol: string;
  name: string;
  exchange?: string;
  instrumentType?: string;
  source?: string;
}

interface ScreenerRun {
  id: string;
  cacheKey: string;
  lastUpdated: string;
  filters: ScreenerFilters;
  results: ScreenerResult[];
}

interface StockCacheRow {
  id: string;
  cache_key: string;
  last_updated: string;
  data?: {
    filters?: ScreenerFilters;
    results?: ScreenerResult[];
  };
}

interface StockSearchResultRow {
  symbol: string;
  name: string;
  exchange?: string;
  instrumentType?: string;
}

const INITIAL_FILTERS: ScreenerFilters = {
  sector: 'technology',
  marketCap: 'large',
  price: '50-200',
  performance: '1M',
};

export function ScreenerPage() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [filters, setFilters] = useState<ScreenerFilters>(INITIAL_FILTERS);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [savedRuns, setSavedRuns] = useState<ScreenerRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateMetaTags(generatePageMetadata('screener'));
  }, []);

  const loadRuns = useCallback(async () => {
    if (!user) {
      setSavedRuns([]);
      setResults([]);
      return;
    }

    const { data, error } = await supabase
      .from('stock_cache')
      .select('id, cache_key, data, last_updated')
      .like('cache_key', `screener:${user.id}:%`)
      .order('last_updated', { ascending: false })
      .limit(10);

    if (error) {
      setError(error.message);
      return;
    }

    const mapped: ScreenerRun[] = (data ?? []).map((row: StockCacheRow) => ({
      id: row.id,
      cacheKey: row.cache_key,
      lastUpdated: row.last_updated,
      filters: row.data?.filters ?? INITIAL_FILTERS,
      results: row.data?.results ?? [],
    }));

    setSavedRuns(mapped);
    if (!results.length && mapped[0]) {
      setResults(mapped[0].results);
    }
  }, [user, results.length]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleChange = (key: keyof ScreenerFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => setFilters(INITIAL_FILTERS);

  const sectorQueryMap: Record<string, string> = {
    technology: 'technology stocks',
    consumer: 'consumer stocks',
    healthcare: 'healthcare stocks',
    energy: 'energy stocks',
  };

  const handleRunScreener = async () => {
    if (!user) return;
    setIsRunning(true);
    setStatusMessage(null);
    setError(null);

    const query = sectorQueryMap[filters.sector] ?? 'stocks';

    try {
      const { data, error } = await supabase.functions.invoke('stock-search', {
        body: { query },
      });

      if (error) throw error;

      const apiResults: ScreenerResult[] = (data?.results ?? []).map((result: StockSearchResultRow) => ({
        symbol: result.symbol,
        name: result.name,
        exchange: result.exchange,
        instrumentType: result.instrumentType,
        source: data?.source ?? 'alpaca',
      }));

      const normalized = apiResults.slice(0, 9);

      if (!normalized.length) {
        setStatusMessage('Screener ran successfully but returned no matches.');
      } else {
        setStatusMessage(`Loaded ${normalized.length} candidates.`);
      }

      setResults(normalized);

      const cacheKey = `screener:${user.id}:${Date.now()}`;
      const { error: upsertError } = await supabase.from('stock_cache').upsert(
        [
          {
            cache_key: cacheKey,
            data: {
              filters,
              results: normalized,
            },
            last_updated: new Date().toISOString(),
          },
        ],
        { onConflict: 'cache_key' }
      );

      if (upsertError) {
        console.error('Unable to cache screener results', upsertError);
      } else {
        await loadRuns();
      }
    } catch (err) {
      console.error('Screener run failed', err);
      setError(err instanceof Error ? err.message : 'Unable to execute screener');
    } finally {
      setIsRunning(false);
    }
  };

  const handleLoadRun = (run: ScreenerRun) => {
    setFilters(run.filters);
    setResults(run.results);
    setStatusMessage(`Loaded screener from ${new Date(run.lastUpdated).toLocaleString()}`);
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
        title="Sign in to save screener runs"
        description="Your filters and results are saved in Supabase so you can revisit high-conviction setups later."
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Discovery Engine</p>
        <h2 className="text-3xl font-semibold text-slate-50">Advanced Stock Screener</h2>
        <p className="text-slate-400 max-w-3xl">
          Combine technical, fundamental, and behavioral signals to surface actionable trade ideas tailored to your playbook.
        </p>
      </header>

      {statusMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-200">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <form className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Filter className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Screening Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="text-sm text-slate-400 space-y-2">
            Sector
            <select
              value={filters.sector}
              onChange={(e) => handleChange('sector', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="technology">Technology</option>
              <option value="consumer">Consumer Discretionary</option>
              <option value="healthcare">Healthcare</option>
              <option value="energy">Energy</option>
            </select>
          </label>
          <label className="text-sm text-slate-400 space-y-2">
            Market Cap
            <select
              value={filters.marketCap}
              onChange={(e) => handleChange('marketCap', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="large">Large (&gt;$10B)</option>
              <option value="mid">Mid ($2B - $10B)</option>
              <option value="small">Small (&lt;$2B)</option>
            </select>
          </label>
          <label className="text-sm text-slate-400 space-y-2">
            Price Range
            <select
              value={filters.price}
              onChange={(e) => handleChange('price', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="under-25">Under $25</option>
              <option value="25-50">$25 - $50</option>
              <option value="50-200">$50 - $200</option>
              <option value="200-plus">Over $200</option>
            </select>
          </label>
          <label className="text-sm text-slate-400 space-y-2">
            Performance Window
            <select
              value={filters.performance}
              onChange={(e) => handleChange('performance', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="1W">1 Week</option>
              <option value="1M">1 Month</option>
              <option value="3M">3 Months</option>
              <option value="6M">6 Months</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Reset filters
          </button>
          <span>Results update automatically</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleRunScreener}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Rocket className="w-4 h-4" aria-hidden="true" />}
            Run Screener
          </button>
          <span className="text-slate-500">
            Results and filters are stored in Supabase as part of your research history.
          </span>
        </div>
      </form>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <History className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Saved Runs
        </div>
        {savedRuns.length === 0 ? (
          <p className="text-sm text-slate-400">No saved runs yet. Execute the screener to create your first entry.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {savedRuns.map((run) => (
              <button
                key={run.cacheKey}
                onClick={() => handleLoadRun(run)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:border-blue-500 transition-colors"
              >
                {run.filters.sector} • {new Date(run.lastUpdated).toLocaleDateString()}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">
            Screened Opportunities ({results.length})
          </h3>
          <InternalLink to="/alerts" className="text-blue-400 hover:text-blue-300 text-sm">
            Create alert from filter →
          </InternalLink>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {results.length === 0 && (
            <div className="col-span-full text-sm text-slate-400">
              Run the screener to generate symbols that match your filters.
            </div>
          )}
          {results.map((result) => (
            <article
              key={result.symbol}
              className="border border-slate-800 rounded-2xl p-4 bg-slate-900/50 flex flex-col gap-2"
            >
              <StockLink symbol={result.symbol} className="text-xl font-semibold text-slate-100">
                {result.symbol}
              </StockLink>
              <p className="text-sm text-slate-400">{result.name}</p>
              <div className="text-xs text-slate-500 uppercase tracking-widest">
                {result.exchange || 'Unspecified'} • {result.instrumentType ?? 'equity'}
              </div>
              <div className="text-xs text-slate-500">Source: {result.source ?? 'alpaca'}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
