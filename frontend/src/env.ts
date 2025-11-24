type AppEnv = {
  QA_PROBE: boolean;
  DEFAULT_SYMBOL: string;
  API_URL: string;
  WS_URL: string;
  CALENDAR_ENABLED: boolean;
};

type BoolLike = string | number | boolean | undefined | null;

const raw = import.meta.env as Record<string, string | boolean | undefined> & {
  DEV?: boolean;
};

const coerceBool = (value: BoolLike): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return undefined;
};

const fromVite = coerceBool(raw.VITE_CALENDAR_ENABLED as BoolLike);
const fromRuntime =
  typeof window !== 'undefined'
    ? coerceBool((window as unknown as { __config?: { CALENDAR_ENABLED?: BoolLike } }).__config?.CALENDAR_ENABLED)
    : undefined;

export const env: AppEnv = {
  QA_PROBE: raw.VITE_QA_PROBE === '1' || raw.DEV === true,
  DEFAULT_SYMBOL: (raw.VITE_DEFAULT_SYMBOL as string | undefined) ?? 'AAPL',
  API_URL: (raw.VITE_API_URL as string | undefined) ?? 'http://localhost:8001',
  WS_URL: (raw.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8001/ws',
  CALENDAR_ENABLED: (fromRuntime ?? fromVite) === true,
};

if (raw.DEV) {
  const missing: string[] = [];
  if (!raw.VITE_API_URL) missing.push('VITE_API_URL');
  if (!raw.VITE_WS_URL) missing.push('VITE_WS_URL');
  if (!raw.VITE_DEFAULT_SYMBOL) missing.push('VITE_DEFAULT_SYMBOL');
  if (!raw.VITE_QA_PROBE) missing.push('VITE_QA_PROBE');
  if (!raw.VITE_CALENDAR_ENABLED) missing.push('VITE_CALENDAR_ENABLED');

  if (missing.length) {
    console.warn(
      `[env] Missing ${missing.join(
        ', ',
      )}; using safe defaults (API_URL=${env.API_URL}, WS_URL=${env.WS_URL}, DEFAULT_SYMBOL=${env.DEFAULT_SYMBOL}, QA_PROBE=${env.QA_PROBE}, CALENDAR_ENABLED=${env.CALENDAR_ENABLED})`,
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
