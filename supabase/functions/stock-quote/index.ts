import { createClient } from 'npm:@supabase/supabase-js@2.80.0'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

// --- Start of new interfaces ---
interface AlpacaTrade {
  t: string; // Timestamp
  p: number; // Price
  s: number; // Size
}

interface AlpacaQuote {
  t: string; // Timestamp
  bp: number; // Bid Price
  bs: number; // Bid Size
  ap: number; // Ask Price
  as: number; // Ask Size
}

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaTickerDetails {
  name?: string;
}
// --- End of new interfaces ---

const CACHE_PREFIX = 'quote'
const QUOTE_TTL_MS = 60 * 1000

const getCacheKey = (symbol: string) => `${CACHE_PREFIX}:${symbol.toUpperCase()}`

const isFresh = (lastUpdated: string | null, ttlMs: number) => {
  if (!lastUpdated) return false
  const age = Date.now() - new Date(lastUpdated).getTime()
  return age <= ttlMs
}

const getCachedQuote = async (cacheKey: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_cache')
      .select('data, last_updated')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (error || !data?.data) {
      return null
    }

    if (!isFresh(data.last_updated, QUOTE_TTL_MS)) {
      return null
    }

    return {
      ...data.data,
      cacheHit: true,
      lastUpdated: data.last_updated,
    }
  } catch (error) {
    console.error('Cache read error (quote):', error)
    return null
  }
}

const setCachedQuote = async (cacheKey: string, payload: Record<string, unknown>) => {
  try {
    await supabaseAdmin
      .from('stock_cache')
      .upsert({
        cache_key: cacheKey,
        data: payload,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'cache_key' })
  } catch (error) {
    console.error('Cache write error (quote):', error)
  }
}

type QuotePayload = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  source: string;
  cachedAt: string;
  bid?: number | null;
  ask?: number | null;
  tradeTimestamp?: string;
  cacheHit?: boolean;
};

const STOCK_FEED = (Deno.env.get('ALPACA_STOCK_FEED') ?? 'iex').toLowerCase() === 'sip' ? 'sip' : 'iex'

const alpacaFetch = async (endpoint: string, apiType: 'data' | 'api' = 'data') => {
  const host = apiType === 'data' ? 'data.alpaca.markets' : 'api.alpaca.markets';
  const url = `https://${host}${endpoint}`;
  
  const options = {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': Deno.env.get('ALPACA_KEY_ID')!,
      'APCA-API-SECRET-KEY': Deno.env.get('ALPACA_SECRET_KEY')!,
    },
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Alpaca API Error for ${url}: ${errorText}`);
    throw new Error(`Failed to fetch from Alpaca: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const getLatestTrade = (symbol: string): Promise<{ trade: AlpacaTrade }> => 
  alpacaFetch(`/v2/stocks/${symbol}/trades/latest?feed=${STOCK_FEED}`);

const getLatestQuote = (symbol: string): Promise<{ quote: AlpacaQuote }> =>
  alpacaFetch(`/v2/stocks/${symbol}/quotes/latest?feed=${STOCK_FEED}`);

const getLatestBars = (symbol: string): Promise<{ bars: AlpacaBar[] }> =>
  alpacaFetch(`/v2/stocks/${symbol}/bars?timeframe=1Day&limit=2&sort=desc&adjustment=split&feed=${STOCK_FEED}`);

const getTickerDetails = (symbol: string): Promise<{ ticker: AlpacaTickerDetails }> =>
  alpacaFetch(`/v2/tickers/${symbol}`, 'api');

const fetchQuoteFromAlpaca = async (symbol: string): Promise<QuotePayload> => {
  const normalized = symbol.toUpperCase()

  const [tradeResp, quoteResp, barsResp] = await Promise.all([
    getLatestTrade(normalized),
    getLatestQuote(normalized),
    getLatestBars(normalized),
  ]);

  const latestBar = barsResp.bars?.[0] ?? null;
  const previousBar = barsResp.bars?.[1] ?? null;

  let metadataName = normalized;
  try {
    const metadata = await getTickerDetails(normalized);
    metadataName = metadata.ticker?.name ?? normalized;
  } catch (error) {
    console.warn(`Alpaca ticker metadata fetch failed for ${normalized}`, error)
  }

  const lastPrice = tradeResp.trade?.p ?? latestBar?.c ?? 0
  const referencePrice = previousBar?.c ?? latestBar?.o ?? lastPrice
  const change = lastPrice - (referencePrice ?? lastPrice)
  const changePercent = referencePrice ? (change / referencePrice) * 100 : 0

  return {
    symbol: normalized,
    name: metadataName,
    price: lastPrice,
    change,
    changePercent,
    volume: latestBar?.v ?? null,
    high: latestBar?.h ?? null,
    low: latestBar?.l ?? null,
    open: latestBar?.o ?? null,
    previousClose: previousBar?.c ?? latestBar?.o ?? null,
    source: 'alpaca',
    cachedAt: new Date().toISOString(),
    bid: quoteResp.quote?.bp ?? null,
    ask: quoteResp.quote?.ap ?? null,
    tradeTimestamp: tradeResp.trade?.t ?? null,
    cacheHit: false,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as { symbol?: string } | null
    const symbol = body?.symbol
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedSymbol = String(symbol).toUpperCase()
    const cacheKey = getCacheKey(normalizedSymbol)

    console.log(`Fetching quote for ${normalizedSymbol}`)

    const cachedQuote = await getCachedQuote(cacheKey)
    if (cachedQuote) {
      console.log(`Cache hit for ${normalizedSymbol}`)
      return new Response(
        JSON.stringify(cachedQuote),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const quote = await fetchQuoteFromAlpaca(normalizedSymbol)
    console.log(`Successfully fetched from Alpaca: ${normalizedSymbol}`)

    await setCachedQuote(cacheKey, quote)

    return new Response(
      JSON.stringify(quote),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fetching stock quote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})