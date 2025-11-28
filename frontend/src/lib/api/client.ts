import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type ApiInit = RequestInit & { skipAuth?: boolean };

const anonKey = env.supabaseAnonKey;

const baseHeaders: Record<string, string> = {};
if (anonKey) baseHeaders.apikey = anonKey;

async function resolveAuthHeader() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    /* ignore */
  }
  if (anonKey) {
    return { Authorization: `Bearer ${anonKey}` };
  }
  return {};
}

export async function api(path: string, init: ApiInit = {}) {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  const headers = new Headers(init.headers || {});

  if (!init.skipAuth) {
    if (baseHeaders.apikey && !headers.has('apikey')) {
      headers.set('apikey', baseHeaders.apikey);
    }
    if (!headers.has('Authorization')) {
      const auth = await resolveAuthHeader();
      for (const [k, v] of Object.entries(auth)) headers.set(k, v);
    }
  }

  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...init, headers });
}

// Expose the authenticated api wrapper on window in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).api = api;
}
