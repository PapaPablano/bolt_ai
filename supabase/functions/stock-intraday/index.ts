import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

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

type IntradayPoint = {
  datetime: string;
  date: string;
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

const CACHE_PREFIX = 'intraday'
const CACHE_TTL_MS = 45 * 1000

interface CachePayload {
  data: IntradayPoint[]
  source: string
  interval: string
  symbol: string
  range: string
  cachedAt: string
  instrumentType: InstrumentType
}

const cacheKeyFor = (symbol: string, interval: string, range: string, instrumentType: InstrumentType) =>
  `${CACHE_PREFIX}:${instrumentType}:${symbol.toUpperCase()}:${interval}:${range}`

const readCache = async (key: string): Promise<CachePayload | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stock_cache')
      .select('data, last_updated')
      .eq('cache_key', key)
      .maybeSingle()

    if (error || !data?.data) {
      return null
    }

    const lastUpdated = data.last_updated ? new Date(data.last_updated).getTime() : 0
    if (!lastUpdated) {
      return null
    }

    if (Date.now() - lastUpdated > CACHE_TTL_MS) {
      return null
    }

    return data.data as CachePayload
  } catch (error) {
    console.error('intraday cache read failed', error)
    return null
  }
}

const writeCache = async (key: string, payload: CachePayload) => {
  try {
    await supabaseAdmin
      .from('stock_cache')
      .upsert(
        {
          cache_key: key,
          data: payload,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'cache_key' },
      )
  } catch (error) {
    console.error('intraday cache write failed', error)
  }
}

const STOCK_FEED = (Deno.env.get('ALPACA_STOCK_FEED') ?? 'iex').toLowerCase() === 'sip' ? 'sip' : 'iex'
const PAGE_LIMIT = 10_000
const MAX_TOTAL_BARS = 50_000
const FUTURES_BASE_URL = 'https://data.alpaca.markets/v1beta3/futures/us'

const INTERVAL_MINUTES = new Map<string, number>([
  ['1m', 1],
  ['5m', 5],
  ['10m', 10],
  ['15m', 15],
  ['30m', 30],
  ['1h', 60],
  ['4h', 240],
  ['1d', 1_440],
])

type FetchPlan = {
  timeframe: `${number}${'Min' | 'Hour' | 'Day'}`;
  resultInterval: string;
  requiresAggregation: boolean;
};

const FETCH_TIMEFRAME = new Map<string, FetchPlan>([
  ['1m', { timeframe: '1Min', resultInterval: '1m', requiresAggregation: false }],
  ['5m', { timeframe: '5Min', resultInterval: '5m', requiresAggregation: false }],
  ['10m', { timeframe: '5Min', resultInterval: '10m', requiresAggregation: true }],
  ['15m', { timeframe: '15Min', resultInterval: '15m', requiresAggregation: false }],
  ['30m', { timeframe: '30Min', resultInterval: '30m', requiresAggregation: false }],
  ['1h', { timeframe: '1Hour', resultInterval: '1h', requiresAggregation: false }],
  ['4h', { timeframe: '1Hour', resultInterval: '4h', requiresAggregation: true }],
  ['1d', { timeframe: '1Day', resultInterval: '1d', requiresAggregation: false }],
])

const getFetchPlan = (interval: string): FetchPlan => {
  const normalized = (interval ?? '').toLowerCase()
  const plan = FETCH_TIMEFRAME.get(normalized)
  if (!plan) {
    throw new Error(`Unsupported interval: ${interval}`)
  }
  return plan
}

type NormalizedBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const toNormalizedBar = (bar: Bar): NormalizedBar => ({
  timestamp: new Date(bar.t).getTime(),
  open: bar.o,
  high: bar.h,
  low: bar.l,
  close: bar.c,
  volume: bar.v,
})

const aggregateNormalizedBars = (bars: NormalizedBar[], intervalMinutes: number): NormalizedBar[] => {
  if (bars.length === 0) {
    return []
  }
  const bucketMs = intervalMinutes * 60_000
  const aggregated = new Map<number, NormalizedBar>()
  for (const bar of bars) {
    const bucketStart = Math.floor(bar.timestamp / bucketMs) * bucketMs
    const existing = aggregated.get(bucketStart)
    if (!existing) {
      aggregated.set(bucketStart, { ...bar, timestamp: bucketStart })
    } else {
      existing.high = Math.max(existing.high, bar.high)
      existing.low = Math.min(existing.low, bar.low)
      existing.close = bar.close
      existing.volume += bar.volume
    }
  }
  return Array.from(aggregated.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value)
}

const shiftDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const computeRangeStart = (range: string, endDate: Date): Date => {
  switch (range) {
    case '1d':
      return shiftDays(endDate, 1)
    case '5d':
      return shiftDays(endDate, 7)
    case '1w':
      return shiftDays(endDate, 8)
    case '1mo': {
      const copy = new Date(endDate)
      copy.setMonth(copy.getMonth() - 1)
      return copy
    }
    case '3mo': {
      const copy = new Date(endDate)
      copy.setMonth(copy.getMonth() - 3)
      return copy
    }
    case '6mo': {
      const copy = new Date(endDate)
      copy.setMonth(copy.getMonth() - 6)
      return copy
    }
    case '1y': {
      const copy = new Date(endDate)
      copy.setFullYear(copy.getFullYear() - 1)
      return copy
    }
    case '2y': {
      const copy = new Date(endDate)
      copy.setFullYear(copy.getFullYear() - 2)
      return copy
    }
    default: {
      const copy = new Date(endDate)
      copy.setMonth(copy.getMonth() - 1)
      return copy
    }
  }
}

const mapBarsToIntradayPoints = (bars: NormalizedBar[]): IntradayPoint[] =>
  bars.map((bar) => {
    const iso = new Date(bar.timestamp).toISOString()
    return {
      datetime: iso,
      date: iso.split('T')[0],
      time: iso.split('T')[1]?.replace('Z', '') ?? '',
      open: Number.isFinite(bar.open) ? bar.open : null,
      high: Number.isFinite(bar.high) ? bar.high : null,
      low: Number.isFinite(bar.low) ? bar.low : null,
      close: Number.isFinite(bar.close) ? bar.close : null,
      volume: Number.isFinite(bar.volume) ? bar.volume : null,
    }
  })

const requireAlpacaCredentials = () => {
  const keyId = Deno.env.get('ALPACA_KEY_ID')
  const secretKey = Deno.env.get('ALPACA_SECRET_KEY')

  if (!keyId || !secretKey) {
    throw new Error('Missing Alpaca credentials in environment variables')
  }

  return { keyId, secretKey }
}

const fetchEquityBars = async (
  symbol: string,
  startDate: string,
  endDate: string,
  timeframe: string,
): Promise<Bar[]> => {
  const { keyId, secretKey } = requireAlpacaCredentials()
  const collected: Bar[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars`)
    url.searchParams.set('timeframe', timeframe)
    url.searchParams.set('start', startDate)
    url.searchParams.set('end', endDate)
    url.searchParams.set('adjustment', 'split')
    url.searchParams.set('feed', STOCK_FEED)
    url.searchParams.set('sort', 'asc')
    url.searchParams.set('limit', String(PAGE_LIMIT))

    if (pageToken) {
      url.searchParams.set('page_token', pageToken)
    }

    console.log(`Fetching equity bars from URL: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Alpaca equity API error: ${errorText}`)
      throw new Error(
        `Failed to fetch equity data from Alpaca: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const data = await response.json()
    if (Array.isArray(data?.bars)) {
      collected.push(...data.bars)
    }

    pageToken = data?.next_page_token ?? undefined

    if (collected.length >= MAX_TOTAL_BARS) {
      break
    }
  } while (pageToken)

  return collected.slice(0, MAX_TOTAL_BARS)
}

const fetchFuturesBars = async (
  symbol: string,
  startDate: string,
  endDate: string,
  timeframe: string,
): Promise<Bar[]> => {
  const { keyId, secretKey } = requireAlpacaCredentials()
  const collected: Bar[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${FUTURES_BASE_URL}/bars`)
    url.searchParams.set('symbols', symbol)
    url.searchParams.set('timeframe', timeframe)
    url.searchParams.set('start', startDate)
    url.searchParams.set('end', endDate)
    url.searchParams.set('limit', String(PAGE_LIMIT))
    url.searchParams.set('sort', 'asc')
    url.searchParams.set('adjustment', 'raw')

    if (pageToken) {
      url.searchParams.set('page_token', pageToken)
    }

    console.log(`Fetching futures bars from URL: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Alpaca futures API error: ${errorText}`)
      throw new Error(
        `Failed to fetch futures data from Alpaca: ${response.status} ${response.statusText} - ${errorText}`,
      )
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

    if (collected.length >= MAX_TOTAL_BARS) {
      break
    }
  } while (pageToken)

  return collected.slice(0, MAX_TOTAL_BARS)
}

const fetchAlpacaBars = async (
  symbol: string,
  startDate: string,
  endDate: string,
  timeframe: string,
  instrumentType: InstrumentType,
): Promise<Bar[]> => {
  if (instrumentType === 'future') {
    return fetchFuturesBars(symbol, startDate, endDate, timeframe)
  }

  return fetchEquityBars(symbol, startDate, endDate, timeframe)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as {
      symbol?: string
      interval?: string
      range?: string
      instrumentType?: InstrumentType
    } | null
    const symbolInput = body?.symbol
    const intervalInput = body?.interval ?? '1m'
    const range = body?.range ?? '1d'
    const instrumentInput = (body?.instrumentType as InstrumentType | undefined) ?? DEFAULT_INSTRUMENT_TYPE

    if (instrumentInput !== 'equity' && instrumentInput !== 'future') {
      return new Response(
        JSON.stringify({ error: 'Unsupported instrument type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const instrumentType: InstrumentType = instrumentInput

    if (!symbolInput) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let plan: FetchPlan
    try {
      plan = getFetchPlan(intervalInput)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unsupported interval'
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const symbol = symbolInput.toUpperCase()
    const cacheKey = cacheKeyFor(symbol, plan.resultInterval, range, instrumentType)

    const cached = await readCache(cacheKey)
    if (cached) {
      console.log(
        `Serving Alpaca API intraday cache hit for ${instrumentType} ${symbol} ${plan.resultInterval} ${range}`,
      )
      return new Response(
        JSON.stringify({
          data: cached.data,
          source: cached.source,
          interval: cached.interval,
          symbol: cached.symbol,
          instrumentType: cached.instrumentType,
          cacheHit: true,
          cachedAt: cached.cachedAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } },
      )
    }

    const endDate = new Date()
    const startDate = computeRangeStart(range, endDate)

    const rawBars = await fetchAlpacaBars(
      symbol,
      startDate.toISOString(),
      endDate.toISOString(),
      plan.timeframe,
      instrumentType,
    )

    if (!rawBars.length) {
      return new Response(
        JSON.stringify({ error: 'No intraday data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const normalizedBars = rawBars.map(toNormalizedBar)

    let finalBars: NormalizedBar[]
    if (plan.requiresAggregation) {
      const intervalMinutes = INTERVAL_MINUTES.get(plan.resultInterval)
      if (!intervalMinutes) {
        throw new Error(`Invalid interval for aggregation: ${plan.resultInterval}`)
      }
      finalBars = aggregateNormalizedBars(normalizedBars, intervalMinutes)
    } else {
      finalBars = normalizedBars
    }

    const intradayData = mapBarsToIntradayPoints(finalBars)
    console.log(`Alpaca API returned ${intradayData.length} intraday points for ${instrumentType} ${symbol}`)

    const payload: CachePayload = {
      data: intradayData,
      source: `alpaca:${instrumentType}:${plan.timeframe}`,
      interval: plan.resultInterval,
      symbol,
      range,
      cachedAt: new Date().toISOString(),
      instrumentType,
    }

    await writeCache(cacheKey, payload)

    return new Response(
      JSON.stringify({
        data: intradayData,
        source: payload.source,
        interval: payload.interval,
        symbol,
        instrumentType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error fetching Alpaca API intraday data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
