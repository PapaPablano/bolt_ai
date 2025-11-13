import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

type NewsArticle = {
  id: number
  headline: string
  summary: string
  author: string
  created_at: string
  updated_at: string
  url: string
  images?: {
    size: string
    url: string
  }[]
  symbols: string[]
  source: string
}

type AlpacaNewsResponse = {
  news: NewsArticle[]
  next_page_token?: string
}

const CACHE_PREFIX = 'news'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachePayload {
  articles: NewsArticle[]
  symbol?: string
  limit: number
  cachedAt: string
}

const cacheKeyFor = (symbol?: string, limit?: number) => {
  if (symbol) {
    return `${CACHE_PREFIX}:${symbol.toUpperCase()}:${limit || 10}`
  }
  return `${CACHE_PREFIX}:all:${limit || 10}`
}

type AlpacaFetchParams = {
  symbols?: string
  start?: string
  end?: string
  limit?: number
  sort?: 'asc' | 'desc'
  include_content?: boolean
  exclude_contentless?: boolean
  page_token?: string
}

const alpacaFetch = async (params: AlpacaFetchParams) => {
  const url = new URL('https://data.alpaca.markets/v1beta1/news');
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

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
    console.error(`Alpaca News API Error: ${errorText}`);
    throw new Error(`Failed to fetch news from Alpaca: ${response.status} ${response.statusText}`);
  }
  return response.json();
};


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
    console.error('news cache read failed', error)
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
    console.error('news cache write failed', error)
  }
}

const fetchAlpacaNews = async (params: AlpacaFetchParams): Promise<AlpacaNewsResponse> => {
  const response = await alpacaFetch(params);
  return response as AlpacaNewsResponse;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as {
      symbol?: string
      symbols?: string[]
      start?: string
      end?: string
      limit?: number
      sort?: 'asc' | 'desc'
      includeContent?: boolean
      excludeContentless?: boolean
    } | null

    const symbolInput = body?.symbol
    const symbolsInput = body?.symbols
    const start = body?.start
    const end = body?.end
    const limit = body?.limit ?? 10
    const sort = body?.sort ?? 'desc'
    const includeContent = body?.includeContent ?? false
    const excludeContentless = body?.excludeContentless ?? false

    // Build symbols string for API
    let symbolsParam: string | undefined
    if (symbolInput) {
      symbolsParam = symbolInput.toUpperCase()
    } else if (symbolsInput && symbolsInput.length > 0) {
      symbolsParam = symbolsInput.map(s => s.toUpperCase()).join(',')
    }

    const cacheKey = cacheKeyFor(symbolInput, limit)

    // Try cache first for simple queries (no date filters)
    if (!start && !end && !includeContent) {
      const cached = await readCache(cacheKey)
      if (cached) {
        console.log(`Serving news cache hit for ${symbolInput || 'all'}`)
        return new Response(
          JSON.stringify({
            articles: cached.articles,
            symbol: symbolInput,
            limit,
            cacheHit: true,
            cachedAt: cached.cachedAt,
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=60'
            } 
          },
        )
      }
    }

    const newsResponse = await fetchAlpacaNews({
      symbols: symbolsParam,
      start,
      end,
      limit,
      sort,
      include_content: includeContent,
      exclude_contentless: excludeContentless,
    })

    if (!newsResponse.news || newsResponse.news.length === 0) {
      return new Response(
        JSON.stringify({ 
          articles: [],
          message: 'No news articles found'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        },
      )
    }

    console.log(`Alpaca returned ${newsResponse.news.length} news articles for ${symbolInput || 'all'}`)

    // Cache simple queries
    if (!start && !end && !includeContent) {
      const payload: CachePayload = {
        articles: newsResponse.news,
        symbol: symbolInput,
        limit,
        cachedAt: new Date().toISOString(),
      }

      await writeCache(cacheKey, payload)
    }

    return new Response(
      JSON.stringify({
        articles: newsResponse.news,
        symbol: symbolInput,
        limit,
        next_page_token: newsResponse.next_page_token,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60'
        } 
      },
    )
  } catch (error) {
    console.error('Error fetching Alpaca news:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Check if it's a credentials error
    if (errorMessage.includes('Missing Alpaca credentials')) {
      return new Response(
        JSON.stringify({ 
          error: 'Alpaca API credentials not configured',
          details: 'Please set APCA_API_KEY_ID and APCA_API_SECRET_KEY environment variables'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        },
      )
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
