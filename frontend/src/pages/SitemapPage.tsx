import { useEffect } from 'react';
import { InternalLink } from '../components/InternalLink';
import { ROUTES } from '../lib/urlHelpers';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

interface SitemapLink {
  label: string;
  description: string;
  to: string;
}

interface SitemapSection {
  title: string;
  links: SitemapLink[];
}

const SECTIONS: SitemapSection[] = [
  {
    title: 'Core Experiences',
    links: [
      { label: 'Dashboard', description: 'Real-time quote stream, charts, and pattern detection.', to: ROUTES.home() },
      { label: 'Markets Overview', description: 'Indices, heat maps, and macro watchlists.', to: ROUTES.markets() },
      { label: 'Stock Screener', description: 'Filter equities by performance or indicator signals.', to: ROUTES.screener() },
      { label: 'Portfolio Tracker', description: 'Monitor holdings with P/L context.', to: ROUTES.portfolio() }
    ]
  },
  {
    title: 'Research & Tools',
    links: [
      { label: 'Watchlist', description: 'Your saved symbols with live refresh.', to: ROUTES.watchlist() },
      { label: 'Compare Stocks', description: 'Side-by-side indicator stacking.', to: ROUTES.compare() },
      { label: 'Price Alerts', description: 'Trigger Supabase functions when targets hit.', to: ROUTES.alerts() },
      { label: 'Sector Performance', description: 'Dive into industries and subsectors.', to: ROUTES.marketSectors() }
    ]
  },
  {
    title: 'Help Center',
    links: [
      { label: 'Help Overview', description: 'Entry point to docs and FAQs.', to: ROUTES.help() },
      { label: 'Getting Started', description: 'Environment setup and workflows.', to: ROUTES.helpGettingStarted() },
      { label: 'Technical Indicators', description: 'RSI, MACD, and KDJ reference.', to: ROUTES.helpIndicators() },
      { label: 'Focus Management', description: 'Accessibility and keyboard guidance.', to: ROUTES.helpFocusManagement() },
      { label: 'Internal Linking Strategy', description: 'Anchor text and navigation standards.', to: ROUTES.helpLinkingStrategy() }
    ]
  },
  {
    title: 'Company & Policies',
    links: [
      { label: 'About', description: 'Mission, stack, and roadmap context.', to: ROUTES.about() },
      { label: 'Privacy Policy', description: 'Data retention and analytics posture.', to: ROUTES.privacy() },
      { label: 'Terms of Service', description: 'Usage terms and responsibilities.', to: ROUTES.terms() }
    ]
  }
];

export function SitemapPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('sitemap'));
  }, []);

  return (
    <article className="space-y-8" aria-labelledby="sitemap-title">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Site Directory</p>
        <h1 id="sitemap-title" className="text-3xl font-semibold text-slate-50">
          Explore Every Stock Whisperer Page
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Quickly navigate to any trading workspace, help article, or policy document. Every link below uses the same routes that power breadcrumbs and internal navigation, so URLs stay consistent.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.title} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" aria-labelledby={`section-${section.title}`}>
            <h2 id={`section-${section.title}`} className="text-xl font-semibold text-slate-100 mb-4">
              {section.title}
            </h2>
            <ul className="space-y-4" role="list">
              {section.links.map((link) => (
                <li key={link.label}>
                  <InternalLink to={link.to} className="text-blue-400 hover:text-blue-300 font-medium">
                    {link.label}
                  </InternalLink>
                  <p className="text-sm text-slate-400">{link.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
