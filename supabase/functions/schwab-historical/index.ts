import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokenStorage {
  read: () => Promise<OAuthToken | null>;
  write: (token: OAuthToken) => Promise<void>;
  clear: () => Promise<void>;
}

interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

interface Candle {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
}

interface PriceHistoryParams {
  periodType?: string;
  period?: number;
  frequencyType?: string;
  frequency?: number;
  startDate?: number;
  endDate?: number;
  needExtendedHoursData?: boolean;
}

const SCHWAB_API_BASE_URL = 'https://api.schwabapi.com/marketdata/v1';
const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';

function isTokenExpired(expiresAt: number, skewSeconds = 60): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= expiresAt - skewSeconds;
}

class SupabaseTokenStorage implements TokenStorage {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async read(): Promise<OAuthToken | null> {
    const { data, error } = await this.supabase
      .from('schwab_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async write(token: OAuthToken): Promise<void> {
    await this.supabase
      .from('schwab_tokens')
      .upsert({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        scope: token.scope,
        token_type: token.tokenType,
        updated_at: new Date().toISOString(),
      });
  }

  async clear(): Promise<void> {
    await this.supabase.from('schwab_tokens').delete().neq('id', 0);
  }
}

async function refreshToken(
  refreshToken: string,
  storage: TokenStorage
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: Deno.env.get('SCHWAB_KEY_ID') || '',
    client_secret: Deno.env.get('SCHWAB_SECRET_KEY') || '',
  });

  const response = await fetch(`${SCHWAB_OAUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Schwab OAuth refresh failed: ${response.status}`);
  }

  const payload = await response.json();
  const token: OAuthToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
    scope: payload.scope,
    tokenType: payload.token_type,
  };

  await storage.write(token);
  return token;
}

async function getValidToken(storage: TokenStorage): Promise<OAuthToken> {
  let token = await storage.read();

  if (!token) {
    throw new Error('No Schwab token available. Please authenticate first.');
  }

  if (isTokenExpired(token.expiresAt)) {
    token = await refreshToken(token.refreshToken, storage);
  }

  return token;
}

async function fetchPriceHistory(
  symbol: string,
  params: PriceHistoryParams,
  token: OAuthToken
): Promise<Candle[]> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/pricehistory`);
  url.searchParams.set('symbol', symbol);

  if (params.periodType) url.searchParams.set('periodType', params.periodType);
  if (params.period) url.searchParams.set('period', params.period.toString());
  if (params.frequencyType) url.searchParams.set('frequencyType', params.frequencyType);
  if (params.frequency) url.searchParams.set('frequency', params.frequency.toString());
  if (params.startDate) url.searchParams.set('startDate', params.startDate.toString());
  if (params.endDate) url.searchParams.set('endDate', params.endDate.toString());
  if (params.needExtendedHoursData !== undefined) {
    url.searchParams.set('needExtendedHoursData', params.needExtendedHoursData.toString());
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `${token.tokenType} ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Schwab API request failed: ${response.status}`);
  }

  const data = await response.json();

  return (data.candles ?? []).map((candle: any) => ({
    ...candle,
    symbol,
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { symbol, ...params } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'symbol is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const storage = new SupabaseTokenStorage(supabase);
    const token = await getValidToken(storage);
    const candles = await fetchPriceHistory(symbol, params, token);

    return new Response(
      JSON.stringify({ candles }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
