import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { updateMetaTags } from '../lib/seo';

export function AboutPage() {
  useEffect(() => {
    updateMetaTags({
      title: 'About Stock Whisperer',
      description: 'Learn about the mission and team behind the Stock Whisperer trading platform.',
      canonical: '/about',
    });
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Our Mission</p>
        <h2 className="text-3xl font-semibold text-slate-50">Human + Quant Synergy</h2>
        <p className="text-slate-400 max-w-3xl">
          We build elite-grade tooling so every trader can act with institutional confidence, backed by transparent data pipelines.
        </p>
      </header>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <Users className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Principles
        </div>
        <ul className="list-disc list-inside text-slate-300 space-y-2">
          <li>Accessibility and WCAG compliance are treated as core product features.</li>
          <li>Edge functions and databases remain transparent — see `supabase/` for schema definitions.</li>
          <li>We document every UX system: focus management, SEO, PWA, internal linking.</li>
        </ul>
      </section>

      <p className="text-sm text-slate-400">
        Want to partner? Email <a className="text-blue-400 hover:text-blue-300" href="mailto:hello@stockwhisperer.app">hello@stockwhisperer.app</a> or review our <InternalLink to="/PWA_GUIDE.md" className="text-blue-400 hover:text-blue-300">engineering guides</InternalLink>.
      </p>
    </div>
  );
}
