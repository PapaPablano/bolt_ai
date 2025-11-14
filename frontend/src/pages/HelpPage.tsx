import { useEffect } from 'react';
import { BookOpen, HelpCircle } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

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
          to="/FOCUS_MANAGEMENT_GUIDE"
          className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 hover:border-blue-500 transition-colors"
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Focus Management</h3>
          <p className="text-sm text-slate-400">Review keyboard handling, focus traps, and skip links implemented across the SPA.</p>
        </InternalLink>
        <InternalLink
          to="/ANCHOR_TEXT_GUIDE"
          className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 hover:border-blue-500 transition-colors"
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Internal Linking Strategy</h3>
          <p className="text-sm text-slate-400">Anchor text variations, structured data usage, and implementation checklists.</p>
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
          Start with <InternalLink to="/IMPLEMENTATION_CHECKLIST" className="text-blue-400 hover:text-blue-300">implementation checklist</InternalLink> or reach out to support@stockwhisperer.app for escalations.
        </p>
      </section>
    </div>
  );
}
