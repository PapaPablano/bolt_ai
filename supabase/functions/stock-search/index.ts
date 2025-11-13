const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

interface YahooSearchResponse {
  quotes: Array<{
    symbol: string
    shortname?: string
    longname?: string
    quoteType?: string
    exchange?: string
  }>
}

const alpacaFetch = async (endpoint: string, params: Record<string, string>) => {
  const url = new URL(`https://api.alpaca.markets${endpoint}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value))

  const options = {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': Deno.env.get('ALPACA_KEY_ID')!,
      'APCA-API-SECRET-KEY': Deno.env.get('ALPACA_SECRET_KEY')!,
    },
  }

  const response = await fetch(url.toString(), options)
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Alpaca API Error for ${url}: ${errorText}`)
    throw new Error(`Failed to fetch from Alpaca: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

interface AlpacaAssetAttributes {
  expiration?: string
  [key: string]: unknown
}

interface AlpacaAsset {
  symbol: string
  name: string
  asset_class: string
  exchange: string
  attributes?: AlpacaAssetAttributes
  expiration?: string
}

interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
  instrumentType: 'equity' | 'future'
  expiration?: string
}

const SUPPORTED_ASSET_CLASSES: Array<{
  assetClass: 'us_equity' | 'futures'
  instrumentType: 'equity' | 'future'
}> = [
  { assetClass: 'us_equity', instrumentType: 'equity' },
  { assetClass: 'futures', instrumentType: 'future' },
]

const MAX_RESULTS = 10

const searchAlpacaAssets = async (query: string): Promise<SearchResult[]> => {
  const lowerCaseQuery = query.toLowerCase()
  const results = new Map<string, SearchResult>()

  for (const { assetClass, instrumentType } of SUPPORTED_ASSET_CLASSES) {
    // Break early if we already have enough results
    // Check if we already have enough results before fetching more assets
    if (results.size >= MAX_RESULTS) {
      break
    }

    const assets: AlpacaAsset[] = await alpacaFetch('/v2/assets', {
      status: 'active',
      asset_class: assetClass,
    })

    for (const asset of assets) {
      if (
        asset.symbol.toLowerCase().includes(lowerCaseQuery) ||
        asset.name.toLowerCase().includes(lowerCaseQuery)
      ) {
        if (!results.has(asset.symbol)) {
          const expiration =
            typeof asset.expiration === 'string'
              ? asset.expiration
              : typeof asset.attributes?.expiration === 'string'
              ? asset.attributes.expiration
              : undefined

          results.set(asset.symbol, {
            symbol: asset.symbol,
            name: asset.name,
            type: asset.asset_class,
            exchange: asset.exchange,
            instrumentType,
            expiration,
          })
        }
      }

      if (results.size >= MAX_RESULTS) {
        break
      }
    }
  }

  return Array.from(results.values()).slice(0, MAX_RESULTS)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as { query?: string } | null
    const query = body?.query

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`Searching for: ${query}`)

    try {
      const alpacaAssets = await searchAlpacaAssets(query)

      const alpacaResults = alpacaAssets.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        exchange: asset.exchange,
        instrumentType: asset.instrumentType,
        expiration: asset.expiration,
      }))

      if (alpacaResults.length) {
        console.log(`Found ${alpacaResults.length} results from Alpaca`)
        return new Response(
          JSON.stringify({ results: alpacaResults, source: 'alpaca' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    } catch (alpacaError) {
      console.warn('Alpaca ticker search failed, falling back to Yahoo Finance', alpacaError)
    }

    try {
      const yahooResponse = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
      )

      if (yahooResponse.ok) {
        const yahooData = (await yahooResponse.json()) as YahooSearchResponse
        const fallbackResults = (yahooData.quotes ?? []).map((quote) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname || quote.symbol,
          type: quote.quoteType,
          exchange: quote.exchange,
        }))

        if (fallbackResults.length) {
          console.log(`Found ${fallbackResults.length} results from Yahoo Finance`)
          return new Response(
            JSON.stringify({ results: fallbackResults, source: 'yahoo' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
    } catch (yahooError) {
      console.warn('Yahoo Finance search fallback failed', yahooError)
    }

    console.log('No Alpaca or Yahoo results available')
    return new Response(
      JSON.stringify({ results: [], source: 'none' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error searching stocks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
