import { useState } from 'react';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';
import { ROUTES } from '../lib/urlHelpers';

export function SchwabConnectPage() {
  const [error, setError] = useState<string | null>(null);

  // Update meta tags once on mount
  if (typeof window !== 'undefined') {
    updateMetaTags(
      generatePageMetadata('schwab-connect', {
        title: 'Connect Schwab | Stock Whisperer',
        description: 'Connect your Schwab account to enable Schwab-backed market data via secure Supabase Edge Functions.',
        canonical: ROUTES.schwabConnect(),
      }),
    );
  }

  const handleConnect = () => {
    setError(null);

    const clientId = import.meta.env.VITE_SCHWAB_CLIENT_ID as string | undefined;
    const redirectPath = (import.meta.env.VITE_SCHWAB_REDIRECT_PATH as string | undefined) ?? ROUTES.schwabCallback();

    if (!clientId) {
      setError('Missing VITE_SCHWAB_CLIENT_ID in frontend .env.local');
      return;
    }

    if (typeof window === 'undefined') {
      setError('Schwab OAuth redirect must be initiated in a browser context');
      return;
    }

    const redirectUri = `${window.location.origin}${redirectPath}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
    });

    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?${params.toString()}`;
    window.location.href = authUrl;
  };

  return (
    <article className="space-y-6 max-w-xl" aria-labelledby="schwab-connect-title">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.35em] text-blue-400">Integrations · Schwab</p>
        <h1 id="schwab-connect-title" className="text-3xl font-semibold text-slate-50">
          Connect your Schwab account
        </h1>
        <p className="text-slate-400">
          This flow redirects you to Schwab&apos;s secure OAuth page. After you approve access, you will return to
          Stock Whisperer and we&apos;ll store encrypted API tokens in Supabase for use by the Schwab proxy.
        </p>
      </header>

      <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-slate-100">Before you begin</h2>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
          <li>
            Ensure your Schwab app&apos;s redirect URI matches
            {' '}
            <code className="break-all">&lt;frontend-origin&gt;{ROUTES.schwabCallback()}</code>
            {' '}and is also configured as <code>SCHWAB_REDIRECT_URI</code> in Supabase function secrets.
          </li>
          <li>
            Set <code>VITE_SCHWAB_CLIENT_ID</code> (and optionally <code>VITE_SCHWAB_REDIRECT_PATH</code>) in
            <code>frontend/.env.local</code>.
          </li>
        </ul>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleConnect}
        className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Connect Schwab
      </button>
    </article>
  );
}

export default SchwabConnectPage;
