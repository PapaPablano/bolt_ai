import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
const getSessionMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/env', () => ({
  env: {
    supabaseAnonKey: 'anon-key',
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

const loadApi = async () => {
  const mod = await import('./client');
  return mod.api;
};

describe('api wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockClear();
    getSessionMock.mockReset();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('uses session token when available and keeps /api paths intact', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tkn' } } });
    const api = await loadApi();

    await api('/api/stock-search?q=AAPL');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/stock-search?q=AAPL');
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer tkn');
    expect(headers.get('apikey')).toBe('anon-key');
  });

  it('prefixes non-/api paths and falls back to anon key auth', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const api = await loadApi();

    await api('/stock-search?q=AAPL');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/stock-search?q=AAPL');
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer anon-key');
    expect(headers.get('apikey')).toBe('anon-key');
  });
});
