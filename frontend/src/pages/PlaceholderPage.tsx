import { ReactNode, useEffect } from 'react';
import { InternalLink } from '../components/InternalLink';
import { updateMetaTags, generatePageMetadata, type SEOMetadata } from '../lib/seo';

interface PlaceholderPageProps {
  title: string;
  description: string;
  pageKey?: string;
  metadata?: SEOMetadata;
  children?: ReactNode;
}

export function PlaceholderPage({
  title,
  description,
  pageKey,
  metadata,
  children,
}: PlaceholderPageProps) {
  useEffect(() => {
    if (metadata) {
      updateMetaTags(metadata);
      return;
    }

    if (pageKey) {
      updateMetaTags(generatePageMetadata(pageKey));
    }
  }, [metadata, pageKey]);

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-slate-200 shadow-2xl">
      <div className="max-w-3xl space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-400 mb-2">Coming Soon</p>
          <h2 className="text-3xl font-semibold text-slate-50">{title}</h2>
        </div>
        <p className="text-slate-400 leading-relaxed">{description}</p>
        {children && <div className="space-y-2">{children}</div>}
        <div className="pt-4 border-t border-slate-800">
          <InternalLink
            to="/"
            className="text-blue-400 hover:text-blue-300 font-medium"
            aria-label="Return to dashboard"
          >
            ← Back to dashboard
          </InternalLink>
        </div>
      </div>
    </section>
  );
}
