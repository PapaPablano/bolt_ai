import { useEffect } from 'react';
import { InternalLink } from '../../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../../lib/seo';
import { ROUTES } from '../../lib/urlHelpers';

const INDICATORS = [
  {
    title: 'Relative Strength Index (RSI)',
    summary: 'Momentum oscillator that signals overbought/oversold conditions over configurable lookback windows.',
    defaults: '14-period, plotted under each primary chart with color-coded thresholds.',
    tip: 'Use 20/80 bands for volatile tickers and pair with MACD to confirm reversals.'
  },
  {
    title: 'Moving Average Convergence Divergence (MACD)',
    summary: 'Trend-following momentum indicator using fast / slow EMAs and a signal line.',
    defaults: '12 / 26 EMA with 9-period signal. Histogram renders inside comparison mode as well.',
    tip: 'Watch for signal crossovers near zero line plus price/indicator divergence.'
  },
  {
    title: 'KDJ & Stochastic Variants',
    summary: 'Three-line stochastic oscillator with smoothing constants for better intraday confirmation.',
    defaults: 'K=9, D=3, J auto-derived with adaptive clamping to avoid visual spikes.',
    tip: 'Enable in tandem with Pattern Detector to validate breakout probability.'
  }
];

export function HelpIndicatorsPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('help-indicators'));
  }, []);

  return (
    <article className="space-y-10" aria-labelledby="help-indicators-title">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Help · Technical Indicators</p>
        <h1 id="help-indicators-title" className="text-3xl font-semibold text-slate-50">
          Technical Indicators Reference
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Every oscillator, overlay, and detector ships with safe defaults plus accessible descriptions. Use this page as a quick refresher when configuring custom workspaces.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Indicator breakdown">
        {INDICATORS.map((indicator) => (
          <div key={indicator.title} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-100">{indicator.title}</h2>
            <p className="text-sm text-slate-400">{indicator.summary}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-1">Studio defaults</p>
              <p className="text-sm text-slate-300">{indicator.defaults}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-1">Desk tip</p>
              <p className="text-sm text-slate-300">{indicator.tip}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3" aria-labelledby="workflow-tips">
        <h2 id="workflow-tips" className="text-2xl font-semibold text-slate-100">Workflow tips</h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Use the comparison workspace to overlay up to three indicators per symbol without performance hits.</li>
          <li>Chart toolbar states persist per-symbol, so you can experiment on a sandbox ticker before switching to production names.</li>
          <li>Pair indicators with the <InternalLink to={ROUTES.helpGettingStarted()} className="text-blue-400 hover:text-blue-300">getting started guide</InternalLink> when onboarding new contributors.</li>
        </ul>
      </section>
    </article>
  );
}
