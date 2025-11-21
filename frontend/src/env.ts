type AppEnv = {
  QA_PROBE: boolean;
  DEFAULT_SYMBOL: string;
  API_URL: string;
  WS_URL: string;
};

const raw = import.meta.env as Record<string, string | boolean | undefined> & {
  DEV?: boolean;
};

export const env: AppEnv = {
  QA_PROBE: raw.VITE_QA_PROBE === '1' || raw.DEV === true,
  DEFAULT_SYMBOL: (raw.VITE_DEFAULT_SYMBOL as string | undefined) ?? 'AAPL',
  API_URL: (raw.VITE_API_URL as string | undefined) ?? 'http://localhost:8000',
  WS_URL: (raw.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000/ws',
};

if (raw.DEV) {
  const missing: string[] = [];
  if (!raw.VITE_API_URL) missing.push('VITE_API_URL');
  if (!raw.VITE_WS_URL) missing.push('VITE_WS_URL');
  if (!raw.VITE_DEFAULT_SYMBOL) missing.push('VITE_DEFAULT_SYMBOL');
  if (!raw.VITE_QA_PROBE) missing.push('VITE_QA_PROBE');

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Missing ${missing.join(
        ', ',
      )}; using safe defaults (API_URL=${env.API_URL}, WS_URL=${env.WS_URL}, DEFAULT_SYMBOL=${env.DEFAULT_SYMBOL}, QA_PROBE=${env.QA_PROBE})`,
    );
  }
}

declare global {
  interface Window {
    __config?: Readonly<AppEnv>;
  }
}

if (typeof window !== 'undefined' && env.QA_PROBE) {
  window.__config = Object.freeze({ ...env });
}
