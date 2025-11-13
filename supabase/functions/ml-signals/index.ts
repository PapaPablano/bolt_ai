import { createClient } from '@supabase/supabase-js';
import { calculateRSI } from '../_shared/technicalIndicators.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

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

const alpacaFetch = async (endpoint: string, params: Record<string, string>) => {
  const url = new URL(`https://data.alpaca.markets${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const options = {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': Deno.env.get('ALPACA_KEY_ID')!,
      'APCA-API-SECRET-KEY': Deno.env.get('ALPACA_SECRET_KEY')!,
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as { symbol?: string } | null;
    const symbol = body?.symbol;

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const bars = await fetchAlpacaDailyBars(symbol.toUpperCase());
    if (bars.length < 15) { // Need at least 14 periods for default RSI
      return new Response(
        JSON.stringify({ error: 'Not enough historical data to generate a signal.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const closePrices = bars.map((bar) => bar.c);
    const rsiResult = calculateRSI(closePrices, 14);
    
    // Get the last valid RSI value from the array
    const latestRsi = rsiResult.filter(r => r !== null).pop();

    if (latestRsi === undefined) {
      return new Response(
        JSON.stringify({ error: 'Could not calculate RSI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const signal = generateSignal(latestRsi);

    const responsePayload = {
      symbol: symbol.toUpperCase(),
      signal,
      rsi: latestRsi,
      timestamp: new Date().toISOString(),
      source: 'rsi_14_day',
    };

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('ML Signal generation failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
