import { createClient } from '@supabase/supabase-js'

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
const SCHWAB_API_BASE_URL = 'https://api.schwabapi.com/marketdata/v1'
const SCHWAB_TOKEN_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/token'
const SCHWAB_TOKEN_ROW_ID = 1

// --- Start of new fetch functions ---
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
// --- End of new fetch functions ---



// --- Schwab Fallback Helpers ---
interface SchwabOAuthToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope?: string | null
  tokenType?: string | null
}

interface SchwabConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

const getSchwabConfig = (): SchwabConfig | null => {
  const clientId = Deno.env.get('SCHWAB_CLIENT_ID')
  const clientSecret = Deno.env.get('SCHWAB_CLIENT_SECRET')
  const redirectUri = Deno.env.get('SCHWAB_REDIRECT_URI')

  if (!clientId || !clientSecret || !redirectUri) {
    return null
  }

  return { clientId, clientSecret, redirectUri }
}

const readSchwabToken = async (): Promise<SchwabOAuthToken | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('oauth_tokens')
      .select('id, access_token, refresh_token, expires_at, scope, token_type')
      .eq('id', SCHWAB_TOKEN_ROW_ID)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at ? Math.floor(new Date(data.expires_at).getTime() / 1000) : 0,
      scope: data.scope ?? null,
      tokenType: data.token_type ?? 'Bearer',
    }
  } catch (error) {
    console.error('Failed to read Schwab token from storage', error)
    return null
  }
}

const persistSchwabToken = async (token: SchwabOAuthToken) => {
  const basePayload = {
    id: SCHWAB_TOKEN_ROW_ID,
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_at: new Date(token.expiresAt * 1000).toISOString(),
  }

  try {
    const { error } = await supabaseAdmin
      .from('oauth_tokens')
      .upsert({
        ...basePayload,
        scope: token.scope ?? 'readonly',
        token_type: token.tokenType ?? 'Bearer',
      }, { onConflict: 'id' })

    if (error) {
      console.warn('Schwab token persistence failed with extended fields, retrying without optional columns', error)
      const { error: retryError } = await supabaseAdmin
        .from('oauth_tokens')
        .upsert(basePayload, { onConflict: 'id' })
      if (retryError) {
        console.error('Failed to persist Schwab token', retryError)
      }
    }
  } catch (error) {
    console.error('Unexpected error while persisting Schwab token', error)
  }
}

const clearSchwabToken = async () => {
  try {
    const { error } = await supabaseAdmin
      .from('oauth_tokens')
      .delete()
      .eq('id', SCHWAB_TOKEN_ROW_ID)
    if (error) {
      console.error('Failed to clear Schwab token', error)
    }
  } catch (error) {
    console.error('Unexpected error while clearing Schwab token', error)
  }
}

const isTokenExpired = (expiresAt: number, skewSeconds = 60) => {
  const now = Math.floor(Date.now() / 1000)
  return now >= expiresAt - skewSeconds
}

const refreshSchwabToken = async (token: SchwabOAuthToken, config: SchwabConfig): Promise<SchwabOAuthToken> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch(SCHWAB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Schwab token refresh failed', errorBody)
    await clearSchwabToken()
    throw new Error(`Schwab token refresh failed: ${response.status}`)
  }

  const payload = await response.json()
  const refreshed: SchwabOAuthToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 1800),
    scope: payload.scope ?? token.scope ?? 'readonly',
    tokenType: payload.token_type ?? token.tokenType ?? 'Bearer',
  }

  await persistSchwabToken(refreshed)
  return refreshed
}

const toNullableNumber = (value: unknown): number | null => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const parseSchwabQuote = (symbol: string, payload: unknown): QuotePayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const data = payload as Record<string, unknown>
  const upperSymbol = symbol.toUpperCase()

  const extractEntry = (): Record<string, unknown> | null => {
    const quotesValue = data['quotes']
    if (Array.isArray(quotesValue)) {
      const match = quotesValue.find((item) => {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          const candidate = (obj.symbol ?? obj.symbolId ?? obj.Symbol) as string | undefined
          return candidate?.toUpperCase() === upperSymbol
        }
        return false
      })
      if (match && typeof match === 'object') {
        return match as Record<string, unknown>
      }
    }

    const keyed = data[upperSymbol] ?? data[symbol] ?? data[upperSymbol.toLowerCase()]
    if (keyed && typeof keyed === 'object') {
      return keyed as Record<string, unknown>
    }

    const dataArray = data['data']
    if (Array.isArray(dataArray)) {
      const match = dataArray.find((item) => {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          const candidate = (obj.symbol ?? obj.symbolId ?? obj.Symbol) as string | undefined
          return candidate?.toUpperCase() === upperSymbol
        }
        return false
      })
      if (match && typeof match === 'object') {
        return match as Record<string, unknown>
      }
    }

    return null
  }

  const entry = extractEntry()
  if (!entry) {
    return null
  }

  const nestedQuote = typeof entry.quote === 'object' && entry.quote !== null
    ? (entry.quote as Record<string, unknown>)
    : null

  // Extract nestedQuote properties for readability
  const nestedLastPrice = nestedQuote?.lastPrice
  const nestedLast = nestedQuote?.last
  const nestedClose = nestedQuote?.close
  const nestedOpenPrice = nestedQuote?.openPrice
  const nestedOpen = nestedQuote?.open
  const nestedHighPrice = nestedQuote?.highPrice
  const nestedHigh = nestedQuote?.high
  const nestedLowPrice = nestedQuote?.lowPrice
  const nestedLow = nestedQuote?.low
  const nestedPreviousClose = nestedQuote?.previousClose
  const nestedPrevClose = nestedQuote?.prevClose
  const nestedTotalVolume = nestedQuote?.totalVolume
  const nestedVolume = nestedQuote?.volume
  const nestedBidPrice = nestedQuote?.bidPrice
  const nestedBid = nestedQuote?.bid
  const nestedAskPrice = nestedQuote?.askPrice
  const nestedAsk = nestedQuote?.ask

  const lastPrice = toNullableNumber(
    entry.lastPrice ?? nestedLastPrice ?? entry.last ?? nestedLast ?? entry.close ?? nestedClose
  )
  const openPrice = toNullableNumber(
    entry.openPrice ?? nestedOpenPrice ?? entry.open ?? nestedOpen
  )
  const highPrice = toNullableNumber(
    entry.highPrice ?? nestedHighPrice ?? entry.high ?? nestedHigh
  )
  const lowPrice = toNullableNumber(
    entry.lowPrice ?? nestedLowPrice ?? entry.low ?? nestedLow
  )
  const prevClose = toNullableNumber(
    entry.previousClose ?? nestedPreviousClose ?? entry.prevClose ?? nestedPrevClose ?? entry.close
  )
  const volume = toNullableNumber(
    entry.totalVolume ?? nestedTotalVolume ?? entry.volume ?? nestedVolume
  )
  const bidPrice = toNullableNumber(
    entry.bidPrice ?? nestedBidPrice ?? entry.bid ?? nestedBid
  )
  const askPrice = toNullableNumber(
    entry.askPrice ?? nestedAskPrice ?? entry.ask ?? nestedAsk
  )
  const price = lastPrice ?? openPrice ?? prevClose ?? 0
  const change = prevClose != null ? price - prevClose : 0
  const changePercent = prevClose && prevClose !== 0 ? (change / prevClose) * 100 : 0

  const tradeTimestamp = toOptionalString(
    entry.tradeTime ?? entry.quoteTime ?? entry.timestamp ?? nestedQuote?.tradeTime ?? nestedQuote?.quoteTime,
  )

  const descriptionRaw = entry.description ?? nestedQuote?.description ?? entry.name
  const description = typeof descriptionRaw === 'string' && descriptionRaw.length > 0 ? descriptionRaw : symbol

  return {
    symbol: upperSymbol,
    name: description,
    price,
    change,
    changePercent,
    volume: volume ?? null,
    high: highPrice ?? null,
    low: lowPrice ?? null,
    open: openPrice ?? null,
    previousClose: prevClose ?? null,
    source: 'schwab',
    cachedAt: new Date().toISOString(),
    bid: bidPrice ?? null,
    ask: askPrice ?? null,
    tradeTimestamp,
    cacheHit: false,
  }
}

const requestSchwabQuote = async (
  symbol: string,
  token: SchwabOAuthToken,
  config: SchwabConfig,
  allowRefresh: boolean,
): Promise<QuotePayload | null> => {
  const url = new URL(`${SCHWAB_API_BASE_URL}/quotes`)
  url.searchParams.set('symbols', symbol)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `${token.tokenType ?? 'Bearer'} ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 401 && allowRefresh) {
    console.warn(`Schwab access token expired for ${symbol}, refreshing`)
    const refreshed = await refreshSchwabToken(token, config)
    return requestSchwabQuote(symbol, refreshed, config, false)
  }

  if (!response.ok) {
    const body = await response.text()
    console.error(`Schwab quote request failed (${response.status}): ${body}`)
    return null
  }

  const payload = await response.json()
  return parseSchwabQuote(symbol, payload)
}

const fetchQuoteFromSchwab = async (symbol: string): Promise<QuotePayload | null> => {
  const config = getSchwabConfig()
  if (!config) {
    console.warn('Schwab fallback unavailable: missing credentials')
    return null
  }

  let token = await readSchwabToken()
  if (!token) {
    console.warn('Schwab fallback unavailable: no stored OAuth token')
    return null
  }

  try {
    if (isTokenExpired(token.expiresAt)) {
      console.log('Refreshing Schwab token before quote request')
      token = await refreshSchwabToken(token, config)
    }

    const quote = await requestSchwabQuote(symbol, token, config, true)
    if (!quote) {
      console.warn(`Schwab fallback returned no data for ${symbol}`)
    }
    return quote
  } catch (error) {
    console.error('Schwab fallback failed', error)
    return null
  }
}
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

    let quote: QuotePayload | null = null
    let primaryError: unknown = null

    try {
      quote = await fetchQuoteFromAlpaca(normalizedSymbol)
      console.log(`Successfully fetched from Alpaca: ${normalizedSymbol}`)
    } catch (error) {
      primaryError = error
      console.error(`Alpaca quote fetch failed for ${normalizedSymbol}`, error)
      console.log(`Attempting Schwab fallback for ${normalizedSymbol}`)
      quote = await fetchQuoteFromSchwab(normalizedSymbol)
    }

    if (!quote) {
      const errorMessage = primaryError instanceof Error
        ? `Alpaca unavailable and Schwab fallback failed: ${primaryError.message}`
        : 'Alpaca unavailable and Schwab fallback failed'
      throw new Error(errorMessage)
    }

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
