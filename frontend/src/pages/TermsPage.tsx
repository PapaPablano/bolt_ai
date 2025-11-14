import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { updateMetaTags } from '../lib/seo';

export function TermsPage() {
  useEffect(() => {
    updateMetaTags({
      title: 'Terms of Service | Stock Whisperer',
      description: 'Review the acceptable use policy for Stock Whisperer.',
      canonical: '/terms',
    });
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Usage Guidelines</p>
        <h2 className="text-3xl font-semibold text-slate-50">Terms of Service</h2>
        <p className="text-slate-400">
          By using Stock Whisperer you agree to responsible data usage and compliance with brokerage agreements.
        </p>
      </header>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 text-sm text-slate-300">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <FileText className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Key Clauses
        </div>
        <p>Platform output is informational only and not a solicitation to buy or sell securities.</p>
        <p>API keys and credentials must remain confidential and rotated per SETUP.md instructions.</p>
      </section>
    </div>
  );
}
