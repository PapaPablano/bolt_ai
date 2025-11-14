import { useEffect } from 'react';
import { InternalLink } from '../../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../../lib/seo';
import { ROUTES } from '../../lib/urlHelpers';

const FOCUS_PATTERNS = [
  {
    title: 'Skip links & heading order',
    detail: 'Global skip links allow screen reader users to jump directly to the main region or watchlist. Every page preserves semantic heading hierarchy (H1 → H2) for predictable navigation.'
  },
  {
    title: 'Managed chart tooling',
    detail: 'Drawing toolbar buttons announce their state with `aria-pressed`, and we verbally describe the current tool using the focus management hook.'
  },
  {
    title: 'Dialog / sheet controls',
    detail: 'Comparison mode and alert editors trap focus within the modal, restore focus to the originating trigger, and expose accessible labels for every field.'
  }
];

export function HelpFocusManagementPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('help-focus-management'));
  }, []);

  return (
    <article className="space-y-10" aria-labelledby="help-focus-management-title">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Help · Accessibility</p>
        <h1 id="help-focus-management-title" className="text-3xl font-semibold text-slate-50">
          Focus Management & Accessibility Checklist
        </h1>
        <p className="text-slate-400 max-w-3xl">
          WCAG 2.1 AA guardrails are built into every surface. Use this checklist when extending components so new interactions inherit the same predictable focus behavior.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3" aria-label="Focus management patterns">
        {FOCUS_PATTERNS.map((pattern) => (
          <div key={pattern.title} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100">{pattern.title}</h2>
            <p className="text-sm text-slate-400 mt-2">{pattern.detail}</p>
          </div>
        ))}
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3" aria-labelledby="implementation-notes">
        <h2 id="implementation-notes" className="text-2xl font-semibold text-slate-100">Implementation notes</h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Use the shared <code>useAnnouncement</code> hook for polite or assertive SR updates instead of ad-hoc alerts.</li>
          <li>Never hide actionable content behind hover-only states. Provide a keyboard equivalent and test with the Tab key.</li>
          <li>Before shipping, run the <code>npm run lint --prefix frontend</code> task plus the built-in accessibility quick scan in your browser devtools.</li>
        </ul>
        <p className="text-sm text-slate-400">
          When you add new docs or marketing surfaces, reference the{' '}
          <InternalLink to={ROUTES.helpLinkingStrategy()} className="text-blue-400 hover:text-blue-300">
            internal linking strategy
          </InternalLink>
          {' '}to keep anchor text predictable.
        </p>
      </section>
    </article>
  );
}
