import { useEffect } from 'react';
import { InternalLink } from '../../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../../lib/seo';
import { ROUTES } from '../../lib/urlHelpers';

export function HelpGettingStartedPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('help-getting-started'));
  }, []);

  return (
    <article className="space-y-10" aria-labelledby="help-getting-started-title">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Help · Onboarding</p>
        <h1 id="help-getting-started-title" className="text-3xl font-semibold text-slate-50">
          Getting Started with Stock Whisperer
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Set up your environment, connect Supabase functions, and learn the fastest navigation patterns so you can reach production data with confidence in minutes.
        </p>
      </header>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4" aria-labelledby="environment-prep">
        <h2 id="environment-prep" className="text-2xl font-semibold text-slate-100">
          1. Environment preparation
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>Install dependencies once at the repo root (`npm install`). The postinstall hook provisions the Vite frontend.</li>
          <li>Copy `frontend/.env.example` to `.env.local` and fill in Supabase project keys plus the Schwab auth secret.</li>
          <li>Start the dev server with `npm run dev --prefix frontend` to load the dashboard + Edge Functions proxy.</li>
        </ol>
        <p className="text-sm text-slate-400">
          Need a refresher on the platform anatomy? Visit the{' '}
          <InternalLink to={ROUTES.helpFocusManagement()} className="text-blue-400 hover:text-blue-300">
            accessibility checklist
          </InternalLink>
          {' '}or{' '}
          <InternalLink to={ROUTES.helpLinkingStrategy()} className="text-blue-400 hover:text-blue-300">
            internal linking playbook
          </InternalLink>
          {' '}for UI-level guardrails.
        </p>
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4" aria-labelledby="workflows">
        <h2 id="workflows" className="text-2xl font-semibold text-slate-100">
          2. Essential workflows
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-slate-100">Market navigation</h3>
            <p className="text-sm text-slate-400">
              Use the global search or watchlist chips to jump to any symbol. Chart state, comparison pairs, and selected indicators sync to the URL so you can share or persist a view quickly.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-slate-100">Data workflows</h3>
            <p className="text-sm text-slate-400">
              Alerts, screener filters, and comparison layouts all write to Supabase Edge Functions. Run <code>npm run lint --prefix frontend</code> before deploying to catch API typing gaps.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          When you are ready to dive deeper into chart overlays or oscillator tuning, continue with the{' '}
          <InternalLink to={ROUTES.helpIndicators()} className="text-blue-400 hover:text-blue-300">
            technical indicators guide
          </InternalLink>
          .
        </p>
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3" aria-labelledby="troubleshooting">
        <h2 id="troubleshooting" className="text-2xl font-semibold text-slate-100">
          3. Troubleshooting checklist
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Missing `react/jsx-dev-runtime` errors typically mean the root install step was skipped—rerun `npm install` at repo root.</li>
          <li>API calls failing? Confirm Supabase service role + anon keys exist in `.env.local` and Supabase Edge Functions are deployed.</li>
          <li>Lint warnings about hooks or <code>any</code> types block deploy previews; clean them via `npm run lint --prefix frontend`.</li>
        </ul>
        <p className="text-sm text-slate-400">
          Still stuck? Email <a href="mailto:support@stockwhisperer.app" className="text-blue-400 hover:text-blue-300">support@stockwhisperer.app</a> or open an issue referencing the failing route.
        </p>
      </section>
    </article>
  );
}
