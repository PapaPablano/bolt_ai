import { useEffect } from 'react';
import { Shield } from 'lucide-react';
import { updateMetaTags } from '../lib/seo';

export function PrivacyPage() {
  useEffect(() => {
    updateMetaTags({
      title: 'Privacy Policy | Stock Whisperer',
      description: 'Understand how Stock Whisperer collects, stores, and secures your information.',
      canonical: '/privacy',
    });
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Trust & Safety</p>
        <h2 className="text-3xl font-semibold text-slate-50">Privacy Policy</h2>
        <p className="text-slate-400">
          We minimize data collection, encrypt in transit and at rest, and never sell user information.
        </p>
      </header>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 text-sm text-slate-300">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <Shield className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Data Practices
        </div>
        <p>We store only the environment variables and watchlist preferences necessary to operate the dashboard.</p>
        <p>Edge functions log anonymized metrics for debugging; no PII is shared with third parties.</p>
      </section>
    </div>
  );
}
