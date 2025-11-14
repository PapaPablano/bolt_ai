import { useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { InternalLink, StockLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

interface ScreenerFilters {
  sector: string;
  marketCap: string;
  price: string;
  performance: string;
}

const INITIAL_FILTERS: ScreenerFilters = {
  sector: 'technology',
  marketCap: 'large',
  price: '50-200',
  performance: '1M',
};

const MOCK_RESULTS = [
  { symbol: 'MDB', name: 'MongoDB Inc.', sector: 'Technology', momentum: '+14%', marketCap: 'Mid' },
  { symbol: 'DDOG', name: 'Datadog Inc.', sector: 'Technology', momentum: '+12%', marketCap: 'Large' },
  { symbol: 'SMCI', name: 'Super Micro Computer', sector: 'Technology', momentum: '+40%', marketCap: 'Mid' },
];

export function ScreenerPage() {
  const [filters, setFilters] = useState<ScreenerFilters>(INITIAL_FILTERS);

  useEffect(() => {
    updateMetaTags(generatePageMetadata('screener'));
  }, []);

  const filteredResults = useMemo(() => MOCK_RESULTS, [filters]);

  const handleChange = (key: keyof ScreenerFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Discovery Engine</p>
        <h2 className="text-3xl font-semibold text-slate-50">Advanced Stock Screener</h2>
        <p className="text-slate-400 max-w-3xl">
          Combine technical, fundamental, and behavioral signals to surface actionable trade ideas tailored to your playbook.
        </p>
      </header>

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
      </form>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">Screened Opportunities ({filteredResults.length})</h3>
          <InternalLink to="/alerts" className="text-blue-400 hover:text-blue-300 text-sm">
            Create alert from filter →
          </InternalLink>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredResults.map((result) => (
            <article
              key={result.symbol}
              className="border border-slate-800 rounded-2xl p-4 bg-slate-900/50 flex flex-col gap-2"
            >
              <StockLink symbol={result.symbol} className="text-xl font-semibold text-slate-100">
                {result.symbol}
              </StockLink>
              <p className="text-sm text-slate-400">{result.name}</p>
              <div className="text-xs text-slate-500 uppercase tracking-widest">{result.sector}</div>
              <div className="font-semibold text-green-400">{result.momentum} momentum</div>
              <div className="text-xs text-slate-500">Market Cap: {result.marketCap}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
