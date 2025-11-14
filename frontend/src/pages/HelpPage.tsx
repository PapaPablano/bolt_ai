import { useEffect } from 'react';
import { BookOpen, HelpCircle, Compass } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';
import { ROUTES } from '../lib/urlHelpers';

const FAQS = [
  {
    question: 'How do I add symbols to the dashboard?',
    answer: 'Use the global search bar or watchlist page. Selecting a symbol automatically loads chart data and updates the URL.',
  },
  {
    question: 'Can I export data?',
    answer: 'Yes. Use the comparison workspace or portfolio table actions to download CSV snapshots of visible data.',
  },
  {
    question: 'Where are news and edge functions hosted?',
    answer: 'All market data is powered by Supabase Edge Functions documented in SCHWAB_API_ENDPOINTS.md.',
  },
];

export function HelpPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('help'));
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Knowledge Center</p>
        <h2 className="text-3xl font-semibold text-slate-50">Help & Documentation</h2>
        <p className="text-slate-400 max-w-3xl">
          Practical playbooks, WCAG-compliant UX guides, and troubleshooting steps keep the platform transparent and supportable.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InternalLink
          to={ROUTES.helpFocusManagement()}
          className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 hover:border-blue-500 transition-colors"
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Focus Management</h3>
          <p className="text-sm text-slate-400">Review keyboard handling, skip links, and SR announcements implemented across the SPA.</p>
        </InternalLink>
        <InternalLink
          to={ROUTES.helpLinkingStrategy()}
          className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 hover:border-blue-500 transition-colors"
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Internal Linking Strategy</h3>
          <p className="text-sm text-slate-400">Anchor text variations, contextual linking recipes, and SEO guardrails.</p>
        </InternalLink>
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <HelpCircle className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Frequently Asked Questions
        </div>
        <dl className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.question} className="border border-slate-800 rounded-xl p-4 bg-slate-900/30">
              <dt className="font-semibold text-slate-100">{faq.question}</dt>
              <dd className="text-sm text-slate-400">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <BookOpen className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Need deeper guidance?
        </div>
        <p className="text-sm text-slate-400">
          Start with the{' '}
          <InternalLink to={ROUTES.helpGettingStarted()} className="text-blue-400 hover:text-blue-300">
            getting started guide
          </InternalLink>
          {' '}or reach out to support@stockwhisperer.app for escalations.
        </p>
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6" aria-labelledby="policy-links">
        <div className="flex items-center gap-2 text-slate-100 font-semibold mb-3">
          <Compass className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Policies & Site Map
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm text-slate-300">
          <InternalLink to={ROUTES.about()} className="hover:text-blue-300">About Stock Whisperer</InternalLink>
          <InternalLink to={ROUTES.privacy()} className="hover:text-blue-300">Privacy Policy</InternalLink>
          <InternalLink to={ROUTES.terms()} className="hover:text-blue-300">Terms of Service</InternalLink>
          <InternalLink to={ROUTES.sitemap()} className="hover:text-blue-300">Browse full sitemap</InternalLink>
        </div>
      </section>
    </div>
  );
}
