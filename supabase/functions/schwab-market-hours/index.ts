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
}

interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

interface MarketHoursParams {
  markets?: string[]; // e.g., ['equity', 'option', 'bond', 'future', 'forex']
  date?: string; // YYYY-MM-DD format
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

async function fetchMarketHours(
  params: MarketHoursParams,
  token: OAuthToken
): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/markets`);
  
  if (params.markets && params.markets.length > 0) {
    url.searchParams.set('markets', params.markets.join(','));
  }
  if (params.date) {
    url.searchParams.set('date', params.date);
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

  return response.json();
}

async function fetchSingleMarketHours(
  marketId: string,
  date: string | undefined,
  token: OAuthToken
): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/markets/${encodeURIComponent(marketId)}`);
  
  if (date) {
    url.searchParams.set('date', date);
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

  return response.json();
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

    const body = await req.json();
    const params = body as MarketHoursParams & { marketId?: string };

    const storage = new SupabaseTokenStorage(supabase);
    const token = await getValidToken(storage);

    let result;
    if (params.marketId) {
      // Get hours for specific market
      result = await fetchSingleMarketHours(params.marketId, params.date, token);
    } else {
      // Get hours for all markets or specified markets
      result = await fetchMarketHours(params, token);
    }

    return new Response(
      JSON.stringify(result),
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
