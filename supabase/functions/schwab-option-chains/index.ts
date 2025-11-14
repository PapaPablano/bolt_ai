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

interface OptionChainParams {
  symbol: string;
  strikeCount?: number;
  includeQuotes?: boolean;
  strategy?: string;
  interval?: number;
  strike?: number;
  contractType?: 'CALL' | 'PUT' | 'ALL';
  expMonth?: string;
  optionType?: 'STANDARD' | 'NON_STANDARD' | 'ALL';
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

async function fetchOptionChain(
  params: OptionChainParams,
  token: OAuthToken
): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/chains`);
  url.searchParams.set('symbol', params.symbol);
  
  if (params.strikeCount) url.searchParams.set('strikeCount', params.strikeCount.toString());
  if (params.includeQuotes !== undefined) url.searchParams.set('includeQuotes', params.includeQuotes.toString());
  if (params.strategy) url.searchParams.set('strategy', params.strategy);
  if (params.interval) url.searchParams.set('interval', params.interval.toString());
  if (params.strike) url.searchParams.set('strike', params.strike.toString());
  if (params.contractType) url.searchParams.set('contractType', params.contractType);
  if (params.expMonth) url.searchParams.set('expMonth', params.expMonth);
  if (params.optionType) url.searchParams.set('optionType', params.optionType);

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

async function saveOptionChainToDB(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  data: any
): Promise<void> {
  const options: any[] = [];
  const callExpDateMap = data?.callExpDateMap || {};
  const putExpDateMap = data?.putExpDateMap || {};

  // Process calls
  Object.entries(callExpDateMap).forEach(([expDate, strikes]: [string, any]) => {
    Object.entries(strikes).forEach(([strikePrice, contracts]: [string, any]) => {
      contracts.forEach((contract: any) => {
        options.push({
          underlying_symbol: symbol,
          option_symbol: contract.symbol,
          strike_price: parseFloat(strikePrice),
          expiration_date: expDate.split(':')[0],
          contract_type: 'C',
          bid_price: contract.bid || 0,
          ask_price: contract.ask || 0,
          last_price: contract.last || 0,
          volume: contract.totalVolume || 0,
          open_interest: contract.openInterest || 0,
          implied_volatility: contract.volatility || 0,
          delta: contract.delta || 0,
          gamma: contract.gamma || 0,
          theta: contract.theta || 0,
          vega: contract.vega || 0,
          rho: contract.rho || 0,
        });
      });
    });
  });

  // Process puts
  Object.entries(putExpDateMap).forEach(([expDate, strikes]: [string, any]) => {
    Object.entries(strikes).forEach(([strikePrice, contracts]: [string, any]) => {
      contracts.forEach((contract: any) => {
        options.push({
          underlying_symbol: symbol,
          option_symbol: contract.symbol,
          strike_price: parseFloat(strikePrice),
          expiration_date: expDate.split(':')[0],
          contract_type: 'P',
          bid_price: contract.bid || 0,
          ask_price: contract.ask || 0,
          last_price: contract.last || 0,
          volume: contract.totalVolume || 0,
          open_interest: contract.openInterest || 0,
          implied_volatility: contract.volatility || 0,
          delta: contract.delta || 0,
          gamma: contract.gamma || 0,
          theta: contract.theta || 0,
          vega: contract.vega || 0,
          rho: contract.rho || 0,
        });
      });
    });
  });

  if (options.length > 0) {
    const { error } = await supabase
      .from('options_chains')
      .upsert(options, { onConflict: 'option_symbol,timestamp' });

    if (error) {
      console.error('Failed to save option chains:', error);
    }
  }
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

    const params = await req.json() as OptionChainParams;

    if (!params.symbol) {
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
    const chainData = await fetchOptionChain(params, token);

    // Save to database if requested
    if (params.includeQuotes !== false) {
      await saveOptionChainToDB(supabase, params.symbol, chainData);
    }

    return new Response(
      JSON.stringify(chainData),
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
