import { useEffect } from 'react';
import { Activity, BarChart3, Compass, Flame } from 'lucide-react';
import { InternalLink, StockLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

const MARKET_STORIES = [
  {
    title: 'AI Infrastructure',
    summary: 'Semiconductors and hyperscale cloud providers continue to lead capital expenditures.',
    symbols: ['NVDA', 'MSFT', 'AMD'],
    path: '/markets/sectors/technology',
  },
  {
    title: 'Consumer Resilience',
    summary: 'Premium retail and travel names outperform as discretionary spending normalizes.',
    symbols: ['LULU', 'ABNB', 'BKNG'],
    path: '/markets/sectors/consumer-discretionary',
  },
  {
    title: 'Rates & Yield Curve',
    summary: 'Financials react to evolving Fed guidance with steepening bets returning.',
    symbols: ['JPM', 'GS', 'MS'],
    path: '/markets/sectors/financials',
  },
];

const ACTIVE_THEMES = [
  { label: 'Earnings Season', description: 'Follow multi-day reactions and guidance shifts.', to: '/markets' },
  { label: 'Sector Rotation', description: 'Measure flows with advanced relative strength.', to: '/markets/sectors' },
  { label: 'Market Breadth', description: 'Track advancers/decliners & new highs/lows.', to: '/markets/indices' },
];

export function MarketsPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('markets'));
  }, []);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-[0.35em]">
          <Compass className="w-4 h-4" aria-hidden="true" />
          Market Navigator
        </div>
        <h2 className="text-3xl font-semibold text-slate-50">Macro & Market Structure</h2>
        <p className="text-slate-400 max-w-3xl">
          Quantify index momentum, sector leadership, and macro cross-currents to frame every trade with institutional context.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MARKET_STORIES.map((story) => (
          <article
            key={story.title}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4"
          >
            <header>
              <h3 className="text-xl font-semibold text-slate-100">{story.title}</h3>
              <p className="text-sm text-slate-400">{story.summary}</p>
            </header>
            <div className="flex flex-wrap gap-2">
              {story.symbols.map((symbol) => (
                <StockLink key={symbol} symbol={symbol} className="px-3 py-1 bg-slate-900 rounded-full text-sm" />
              ))}
            </div>
            <InternalLink
              to={story.path}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-auto"
              aria-label={`Dive deeper into ${story.title}`}
            >
              Explore details →
            </InternalLink>
          </article>
        ))}
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-blue-400" aria-hidden="true" />
          <h3 className="text-xl font-semibold text-slate-100">Market Overview Toolkit</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InternalLink
            to="/markets/indices"
            className="border border-slate-800 rounded-2xl p-4 hover:border-blue-500 transition-colors"
          >
            <h4 className="font-semibold text-slate-100 mb-2">Indices</h4>
            <p className="text-sm text-slate-400">
              Track SPX, NDX, RUT, and global benchmarks with breadth, volatility, and trend data.
            </p>
          </InternalLink>
          <InternalLink
            to="/markets/sectors"
            className="border border-slate-800 rounded-2xl p-4 hover:border-blue-500 transition-colors"
          >
            <h4 className="font-semibold text-slate-100 mb-2">Sectors</h4>
            <p className="text-sm text-slate-400">
              Visualize capital rotation with heat maps, rolling performance, and ETF flows.
            </p>
          </InternalLink>
          <InternalLink
            to="/compare"
            className="border border-slate-800 rounded-2xl p-4 hover:border-blue-500 transition-colors"
          >
            <h4 className="font-semibold text-slate-100 mb-2">Relative Strength</h4>
            <p className="text-sm text-slate-400">
              Compare leaders vs laggards to confirm narratives before committing capital.
            </p>
          </InternalLink>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ACTIVE_THEMES.map((theme) => (
          <InternalLink
            key={theme.label}
            to={theme.to}
            className="border border-slate-800 rounded-2xl p-5 hover:border-blue-500 transition-colors bg-slate-900/40 flex items-start gap-3"
          >
            <Flame className="w-5 h-5 text-orange-400 mt-1" aria-hidden="true" />
            <div>
              <h4 className="text-slate-100 font-semibold">{theme.label}</h4>
              <p className="text-sm text-slate-400">{theme.description}</p>
            </div>
          </InternalLink>
        ))}
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-100">Market Health Checklist</h3>
        </div>
        <ul className="space-y-2 text-slate-300">
          <li>✅ Breadth &gt; 60% advancing across NYSE &amp; NASDAQ.</li>
          <li>✅ VIX trending below 18 confirming constructive risk appetite.</li>
          <li>⚠️ Leadership concentrated in top 10 mega caps — monitor rotation.</li>
          <li>⚠️ Credit spreads stable but watch high-yield issuance next week.</li>
        </ul>
      </section>
    </div>
  );
}
