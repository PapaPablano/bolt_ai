import { createClient } from 'npm:@supabase/supabase-js@2.80.0';
import { calculateRSI } from '../_shared/technicalIndicators.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ALPACA_KEY_ID = Deno.env.get('ALPACA_KEY_ID');
const ALPACA_SECRET_KEY = Deno.env.get('ALPACA_SECRET_KEY');

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
};

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const STOCK_FEED = (Deno.env.get('ALPACA_STOCK_FEED') ?? 'iex').toLowerCase() === 'sip' ? 'sip' : 'iex';
const MAX_DAILY_BARS = 100; // We need enough data for indicators

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const alpacaFetch = async (endpoint: string, params: Record<string, string>) => {
  const url = new URL(`https://data.alpaca.markets${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const options = {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': ALPACA_KEY_ID!,
      'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY!,
    },
  };

  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Alpaca API Error for ${url}: ${errorText}`);
    throw new Error(`Failed to fetch from Alpaca: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const fetchAlpacaDailyBars = async (symbol: string): Promise<AlpacaBar[]> => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - MAX_DAILY_BARS * 1.5); // Fetch more to be safe

  const response = await alpacaFetch(`/v2/stocks/${symbol}/bars`, {
    timeframe: '1Day',
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    limit: String(MAX_DAILY_BARS),
    feed: STOCK_FEED,
    sort: 'asc',
  });

  return response.bars || [];
};

const generateSignal = (rsi: number) => {
  if (rsi > 70) return 'Sell';
  if (rsi < 30) return 'Buy';
  return 'Hold';
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ALPACA_KEY_ID || !ALPACA_SECRET_KEY) {
      console.error('Missing required env for ml-signals', {
        hasSupabaseUrl: Boolean(SUPABASE_URL),
        hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        hasAlpacaId: Boolean(ALPACA_KEY_ID),
        hasAlpacaSecret: Boolean(ALPACA_SECRET_KEY),
      });
      return jsonResponse({ error: 'Server configuration error: missing env.' }, 500);
    }

    if (!supabaseAdmin) {
      return jsonResponse({ error: 'Supabase client unavailable.' }, 500);
    }

    const body = (await req.json()) as { symbol?: string } | null;
    const symbol = body?.symbol;

    if (!symbol) {
      return jsonResponse({ error: 'Symbol is required' }, 400);
    }

    const bars = await fetchAlpacaDailyBars(symbol.toUpperCase());
    if (bars.length < 15) { // Need at least 14 periods for default RSI
      return jsonResponse({ error: 'Not enough historical data to generate a signal.' }, 404);
    }

    const closePrices = bars.map((bar) => bar.c);
    const rsiResult = calculateRSI(closePrices, 14);
    
    // Get the last valid RSI value from the array
    const latestRsi = rsiResult.filter(r => r !== null).pop();

    if (latestRsi === undefined) {
      return jsonResponse({ error: 'Could not calculate RSI.' }, 500);
    }

    const signal = generateSignal(latestRsi);

    const responsePayload = {
      symbol: symbol.toUpperCase(),
      signal,
      rsi: latestRsi,
      timestamp: new Date().toISOString(),
      source: 'rsi_14_day',
    };

    return jsonResponse(responsePayload);

  } catch (error) {
    console.error('ML Signal generation failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
