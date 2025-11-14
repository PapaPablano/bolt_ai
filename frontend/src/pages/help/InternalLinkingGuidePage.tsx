import { useEffect } from 'react';
import { InternalLink } from '../../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../../lib/seo';
import { ROUTES } from '../../lib/urlHelpers';

const LINKING_PRACTICES = [
  {
    label: 'Context first',
    detail: 'Lead with the outcome (“Compare NVDA and AMD”) before referencing UI chrome. Readers should understand what happens when they click.'
  },
  {
    label: 'Route helpers',
    detail: 'Always reference `ROUTES.*` so renamed paths update everywhere, including breadcrumbs and the sitemap.'
  },
  {
    label: 'Cross-link critical docs',
    detail: 'Every help article should link to at least one other guide plus a core experience (dashboard, markets, or screener).'
  }
];

export function HelpInternalLinkingPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('help-internal-linking'));
  }, []);

  return (
    <article className="space-y-10" aria-labelledby="help-internal-linking-title">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Help · Content Architecture</p>
        <h1 id="help-internal-linking-title" className="text-3xl font-semibold text-slate-50">
          Internal Linking Strategy
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Strong anchor text keeps traders oriented while also giving crawlers clear signals about page intent. Use these guardrails when writing help content or in-app marketing copy.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3" aria-label="Linking practices">
        {LINKING_PRACTICES.map((practice) => (
          <div key={practice.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100">{practice.label}</h2>
            <p className="text-sm text-slate-400 mt-2">{practice.detail}</p>
          </div>
        ))}
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4" aria-labelledby="linking-templates">
        <h2 id="linking-templates" className="text-2xl font-semibold text-slate-100">Reusable linking templates</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            • <strong>Action → Destination:</strong> “Map out your sector play in the{' '}
            <InternalLink to={ROUTES.markets()} className="text-blue-400 hover:text-blue-300">market overview</InternalLink>
            {', '}then add the top movers to your{' '}
            <InternalLink to={ROUTES.watchlist()} className="text-blue-400 hover:text-blue-300">watchlist</InternalLink>
            .”
          </p>
          <p>
            • <strong>Doc → Feature:</strong> “The{' '}
            <InternalLink to={ROUTES.helpFocusManagement()} className="text-blue-400 hover:text-blue-300">focus checklist</InternalLink>
            {' '}explains why breadcrumbs include ARIA landmarks.”
          </p>
          <p>
            • <strong>Fallbacks:</strong> Link to the{' '}
            <InternalLink to={ROUTES.sitemap()} className="text-blue-400 hover:text-blue-300">sitemap</InternalLink>
            {' '}from error states so users always have a graceful escape route.
          </p>
        </div>
      </section>
    </article>
  );
}
