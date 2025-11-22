import './env';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { pwaManager } from './lib/pwa';

const queryClient = new QueryClient();

pwaManager.register().then((registration) => {
  if (registration) {
    console.log('[PWA] Service worker registered successfully');
  }
}).catch((error) => {
  console.error('[PWA] Service worker registration failed:', error);
});

if (typeof window !== 'undefined') {
  const w = window as typeof window & {
    __QA_PROBE__?: string;
    __probe?: Record<string, Record<string, unknown>>;
    __probeBoot?: {
      bootTs: number;
      gate: 'env' | 'runtime' | 'query' | 'unknown';
      mounted: Array<{ symbol: string; ts: number }>;
      unmounted: Array<{ symbol: string; ts: number }>;
      stages: Array<{ stage: 'none' | 'container-mounted' | 'chart-created' | 'candle-series-created' | 'seed-bars-ready'; ts: number }>;
    };
  };
  const sp = new URLSearchParams(window.location.search);
  const gateViaEnv = import.meta.env.DEV || import.meta.env.VITE_QA_PROBE === '1';
  const gateViaRuntime = w.__QA_PROBE__ === '1';
  const gateViaQuery = sp.get('probe') === '1';
  const qaGate = gateViaEnv || gateViaRuntime || gateViaQuery;

  if (qaGate) {
    const gate: 'env' | 'runtime' | 'query' | 'unknown' = gateViaEnv ? 'env' : gateViaRuntime ? 'runtime' : gateViaQuery ? 'query' : 'unknown';
    w.__probeBoot = {
      bootTs: Date.now(),
      gate,
      mounted: [] as Array<{ symbol: string; ts: number }>,
      unmounted: [] as Array<{ symbol: string; ts: number }>,
      stages: [] as Array<{ stage: 'none' | 'container-mounted' | 'chart-created' | 'candle-series-created' | 'seed-bars-ready'; ts: number }>,
    };

    const sym = sp.get('symbol') || (import.meta.env.VITE_DEFAULT_SYMBOL ?? 'AAPL');
    const root = (w.__probe ??= {});
    const entry = (root[sym] ??= {});
    const defineIfMissing = (key: string, get: () => unknown) => {
      if (!Object.getOwnPropertyDescriptor(entry, key)) {
        Object.defineProperty(entry, key, { configurable: true, get });
      }
    };

    defineIfMissing('seriesCount', () => 0);
    defineIfMissing('macdBarSpacing', () => null);
    defineIfMissing('visibleLogicalRange', () => null);
    defineIfMissing('dataLogicalRange', () => null);
    defineIfMissing('econEventCount', () => 0);
    defineIfMissing('econMarkerCount', () => 0);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
