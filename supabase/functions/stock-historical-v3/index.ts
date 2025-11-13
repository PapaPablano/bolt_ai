import { createClient } from '@supabase/supabase-js'
// We are removing the Alpaca SDK and using native fetch instead.
// import Alpaca from '@alpacahq/alpaca-trade-api'
// import { type Bar } from '@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2.js'
import { SMA, EMA, RSI } from 'technicalindicators'

// Define the Bar type manually, matching the Alpaca API v2 response
interface Bar {
  t: string;  // Timestamp
  o: number;  // OpenPrice
  h: number;  // HighPrice
  l: number;  // LowPrice
  c: number;  // ClosePrice
  v: number;  // Volume
  n: number;  // TradeCount
  vw: number; // VWAP
}

type InstrumentType = 'equity' | 'future'
const DEFAULT_INSTRUMENT_TYPE: InstrumentType = 'equity'


const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

const CACHE_PREFIX = 'historical'

const getCacheKey = (symbol: string, range: string, instrumentType: InstrumentType) =>
  `${CACHE_PREFIX}:${instrumentType}:${symbol.toUpperCase()}:${range}`

const getDateRange = (range: string) => {
  const endDate = new Date()
  const startDate = new Date()

  switch(range) {
    case '1d':
      startDate.setDate(endDate.getDate() - 2); // Go back a bit more to be safe
      break
    case '5d':
      startDate.setDate(endDate.getDate() - 7);
      break
    case '1mo':
      startDate.setMonth(endDate.getMonth() - 1);
      break
    case '3mo':
      startDate.setMonth(endDate.getMonth() - 3);
      break
    case '6mo':
      startDate.setMonth(endDate.getMonth() - 6);
      break
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break
    case '5y':
      startDate.setFullYear(endDate.getFullYear() - 5);
      break
    default:
      startDate.setMonth(endDate.getMonth() - 1);
  }

  // Alpaca API requires RFC3339 format (a full ISO 8601 string)
  // We set the time to the beginning of the day for the start date.
  startDate.setUTCHours(0, 0, 0, 0);

  return {
    fromDate: startDate.toISOString(),
    toDate: endDate.toISOString(),
  }
}

type HistoricalPoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

interface CachePayload {
  data?: HistoricalPoint[];
  source?: string;
  cachedAt?: string;
  lastUpdated?: string;
  cacheHit?: boolean;
  instrumentType?: InstrumentType;
}

const getCachedPayload = async (cacheKey: string): Promise<CachePayload | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_cache')
      .select('data, last_updated')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    if (error || !data?.data) {
      return null
    }

    return {
      ...data.data,
      lastUpdated: data.last_updated,
    }
  } catch (error) {
    console.error('Cache read error (historical):', error)
    return null
  }
}

const setCachedPayload = async (cacheKey: string, payload: CachePayload) => {
  try {
    await supabaseAdmin
      .from('stock_cache')
      .upsert({
        cache_key: cacheKey,
        data: payload,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'cache_key' })
  } catch (error) {
    console.error('Cache write error (historical):', error)
  }
}

const STOCK_FEED = (Deno.env.get('ALPACA_STOCK_FEED') ?? 'iex').toLowerCase() === 'sip' ? 'sip' : 'iex'
const MAX_DAILY_BARS = 10_000
const FUTURES_BASE_URL = 'https://data.alpaca.markets/v1beta3/futures/us'

const requireAlpacaCredentials = () => {
  const keyId = Deno.env.get('ALPACA_KEY_ID')
  const secretKey = Deno.env.get('ALPACA_SECRET_KEY')

  if (!keyId || !secretKey) {
    throw new Error('Missing Alpaca credentials in environment variables')
  }

  return { keyId, secretKey }
}

const fetchEquityDailyBars = async (params: {
  symbol: string
  startDate: string
  endDate: string
}): Promise<Bar[]> => {
  const { symbol, startDate, endDate } = params
  const { keyId, secretKey } = requireAlpacaCredentials()

  const url = new URL('https://data.alpaca.markets/v2/stocks/bars')
  url.searchParams.set('symbols', symbol)
  url.searchParams.set('timeframe', '1Day')
  url.searchParams.set('start', startDate)
  url.searchParams.set('end', endDate)
  url.searchParams.set('limit', String(MAX_DAILY_BARS))
  url.searchParams.set('feed', STOCK_FEED)
  url.searchParams.set('sort', 'asc')

  const response = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Alpaca equity bars request failed with status ${response.status} on URL ${url.toString()}: ${errorBody}`)
  }

  const data = await response.json()
  return data?.bars?.[symbol] ?? []
}

const fetchFuturesDailyBars = async (params: {
  symbol: string
  startDate: string
  endDate: string
}): Promise<Bar[]> => {
  const { symbol, startDate, endDate } = params
  const { keyId, secretKey } = requireAlpacaCredentials()

  const collected: Bar[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${FUTURES_BASE_URL}/bars`)
    url.searchParams.set('symbols', symbol)
    url.searchParams.set('timeframe', '1Day')
    url.searchParams.set('start', startDate)
    url.searchParams.set('end', endDate)
    url.searchParams.set('limit', String(MAX_DAILY_BARS))
    url.searchParams.set('adjustment', 'raw')
    url.searchParams.set('sort', 'asc')

    if (pageToken) {
      url.searchParams.set('page_token', pageToken)
    }

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Alpaca futures bars request failed with status ${response.status} on URL ${url.toString()}: ${errorBody}`)
    }

    const data = await response.json()
    const bars = Array.isArray(data?.bars)
      ? data.bars
      : Array.isArray(data?.bars?.[symbol])
        ? data.bars[symbol]
        : []

    if (Array.isArray(bars)) {
      collected.push(...bars)
    }

    pageToken = data?.next_page_token ?? undefined

    if (collected.length >= MAX_DAILY_BARS) {
      break
    }
  } while (pageToken)

  return collected.slice(0, MAX_DAILY_BARS)
}

const fetchAlpacaDailyBars = async (params: {
  symbol: string
  startDate: string
  endDate: string
  instrumentType: InstrumentType
}): Promise<Bar[]> => {
  const { instrumentType, ...rest } = params

  if (instrumentType === 'future') {
    return fetchFuturesDailyBars(rest)
  }

  return fetchEquityDailyBars(rest)
}

const barsToHistoricalPoints = (bars: Bar[]): HistoricalPoint[] =>
  bars.map<HistoricalPoint>((bar) => ({
    date: new Date(bar.t).toISOString().split('T')[0],
    open: bar.o ?? null,
    high: bar.h ?? null,
    low: bar.l ?? null,
    close: bar.c ?? null,
    volume: bar.v ?? null,
  }))

const saveTrainingData = async (symbol: string, bars: Bar[]) => {
  if (bars.length === 0) return;

  const closePrices = bars.map(b => b.c as number).filter(p => p !== null);

  if (closePrices.length < 200) {
    console.log(`Not enough data for ${symbol} to calculate all indicators (need 200, got ${closePrices.length}). Skipping ML data ingestion.`);
    return;
  }

  const sma20 = SMA.calculate({ period: 20, values: closePrices });
  const sma50 = SMA.calculate({ period: 50, values: closePrices });
  const sma200 = SMA.calculate({ period: 200, values: closePrices });
  const ema12 = EMA.calculate({ period: 12, values: closePrices });
  const ema26 = EMA.calculate({ period: 26, values: closePrices });
  const rsi14 = RSI.calculate({ period: 14, values: closePrices });

  const dataToInsert = [];
  const barCount = bars.length;
  // Start from the first bar where a 200-period SMA is available
  const sma200Offset = barCount - sma200.length;

  for (let i = sma200Offset; i < barCount; i++) {
    const bar = bars[i];
    
    const sma20Index = i - (barCount - sma20.length);
    const sma50Index = i - (barCount - sma50.length);
    const sma200Index = i - sma200Offset;
    const ema12Index = i - (barCount - ema12.length);
    const ema26Index = i - (barCount - ema26.length);
    const rsi14Index = i - (barCount - rsi14.length);

    dataToInsert.push({
      symbol: symbol.toUpperCase(),
      date: new Date(bar.t).toISOString().split('T')[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      sma20: sma20Index >= 0 ? sma20[sma20Index] : null,
      sma50: sma50Index >= 0 ? sma50[sma50Index] : null,
      sma200: sma200Index >= 0 ? sma200[sma200Index] : null,
      ema12: ema12Index >= 0 ? ema12[ema12Index] : null,
      ema26: ema26Index >= 0 ? ema26[ema26Index] : null,
      rsi14: rsi14Index >= 0 ? rsi14[rsi14Index] : null,
    });
  }

  if (dataToInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('ml_training_data')
      .upsert(dataToInsert, { onConflict: 'symbol,date' });

    if (error) {
      console.error(`Failed to save training data for ${symbol}:`, error);
    } else {
      console.log(`Successfully saved ${dataToInsert.length} training data points for ${symbol}.`);
    }
  }
};





Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as { symbol?: string; range?: string; instrumentType?: InstrumentType } | null
    const symbolInput = body?.symbol
    const range = body?.range ?? '1mo'
    const instrumentType = body?.instrumentType === 'future' ? 'future' : DEFAULT_INSTRUMENT_TYPE

    if (!symbolInput) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const symbol = String(symbolInput).toUpperCase()
    const cacheKey = getCacheKey(symbol, range, instrumentType)

    console.log(`Fetching Alpaca historical data for ${symbol} (${range})`)

    const cachedPayload = await getCachedPayload(cacheKey)
    if (cachedPayload?.data) {
      console.log(`Historical cache hit for ${symbol} (${range})`)
      return new Response(
        JSON.stringify({ ...cachedPayload, cacheHit: true, instrumentType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { fromDate, toDate } = getDateRange(range)

    const dailyBars = await fetchAlpacaDailyBars({
      symbol,
      startDate: fromDate,
      endDate: toDate,
      instrumentType,
    })

    if (!dailyBars.length) {
      return new Response(
        JSON.stringify({ error: 'No historical data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const historicalData = barsToHistoricalPoints(dailyBars)
    const source = instrumentType === 'future' ? 'alpaca:futures' : 'alpaca:stocks'

    // Do not await this, let it run in the background
    if (instrumentType === 'equity') {
      saveTrainingData(symbol, dailyBars).catch(console.error)
    }

    await setCachedPayload(cacheKey, {
      data: historicalData,
      source,
      cachedAt: new Date().toISOString(),
      instrumentType,
    })

    return new Response(
      JSON.stringify({ data: historicalData, source, instrumentType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Alpaca historical fetch failed', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    // Also include the stack trace in the response for better debugging
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available'
    return new Response(
      JSON.stringify({ 
        error: 'Function failed during execution.',
        details: errorMessage,
        stack: errorStack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
