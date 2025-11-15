import { SchwabOAuth } from './oauth.js'
import {
  Candle,
  FutureQuote,
  Mover,
  MoversParams,
  OAuthToken,
  OptionChain,
  OptionChainParams,
  PriceHistoryParams,
  Quote,
  StreamerCredentials,
  SchwabRequestOptions,
} from './types.js'
import { SchwabStreamer, SchwabStreamerOptions } from './streaming.js'
import { SCHWAB_API_BASE_URL, buildUrl, delay } from './utils.js'

type FetchLike = typeof fetch

const SCHWAB_TRADER_API_BASE_URL = 'https://api.schwabapi.com/trader/v1'

export interface SchwabAPIClientOptions {
  oauth: SchwabOAuth
  userAgent?: string
  fetchImpl?: FetchLike
  maxRetries?: number
}

export class SchwabAPIClient {
  private oauth: SchwabOAuth
  private userAgent: string
  private fetchImpl: FetchLike
  private maxRetries: number
  private streamer: SchwabStreamer | null = null

  constructor(options: SchwabAPIClientOptions) {
    this.oauth = options.oauth
    this.userAgent = options.userAgent ?? 'stock-whisperer-schwab-client/0.1.0'
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxRetries = options.maxRetries ?? 3
  }

  getAuthorizationUrl(state?: string): string {
    return this.oauth.buildAuthorizationUrl(state)
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    return this.oauth.exchange(code)
  }

  async refreshAccessToken(): Promise<OAuthToken> {
    const token = await this.oauth.getToken()
    return this.oauth.refresh(token.refreshToken)
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const response = await this.request<Record<string, unknown>>({
      path: 'quotes',
      query: { symbols: symbols.join(',') },
    })

    return symbols
      .map((symbol) => this.transformQuote(symbol, response?.[symbol]))
      .filter((quote): quote is Quote => Boolean(quote))
  }

  async getOptionChain(symbol: string, params: OptionChainParams = {}): Promise<OptionChain[]> {
    const response = await this.request<Record<string, unknown>>({
      path: 'chains',
      query: { symbol, ...params },
    })

    return this.transformOptionChain(symbol, response)
  }

  async getPriceHistory(symbol: string, params: PriceHistoryParams): Promise<Candle[]> {
    const response = await this.request<{ candles: Candle[] }>({
      path: 'pricehistory',
      query: { symbol, ...params },
    })

    return (response.candles ?? []).map((candle) => ({
      ...candle,
      symbol,
    }))
  }

  async getMovers(index: string, params: MoversParams = {}): Promise<Mover[]> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(params.sort ? { sort: params.sort } : {}),
      ...(params.frequency !== undefined ? { frequency: params.frequency } : {}),
    }

    const response = await this.request<{ movers: Mover[] | undefined }>({
      path: `movers/${encodeURIComponent(index)}`,
      query,
    })

    return response.movers ?? []
  }

  async getFuturesQuotes(symbols: string[]): Promise<FutureQuote[]> {
    const response = await this.request<Record<string, unknown>>({
      path: 'quotes',
      query: { symbols: symbols.join(','), assetType: 'FUTURE' },
    })

    return symbols
      .map((symbol) => this.transformFutureQuote(symbol, response?.[symbol]))
      .filter((quote): quote is FutureQuote => quote !== null)
  }

  async connectStreamer(options: Partial<Omit<SchwabStreamerOptions, 'credentials'>> = {}): Promise<WebSocket> {
    const [token, baseCredentials] = await Promise.all([
      this.oauth.getToken(),
      this.getStreamerCredentials(),
    ])
    const credentials = { ...baseCredentials, accessToken: token.accessToken }
    const streamer = new SchwabStreamer({
      credentials,
      heartbeatMs: options.heartbeatMs,
      wsFactory: options.wsFactory,
      onMessage: options.onMessage,
      onError: options.onError,
      onClose: options.onClose,
    })

    await streamer.connect()
    this.streamer = streamer
    const socket = streamer.getSocket()
    if (!socket) {
      throw new Error('Streamer connection failed')
    }
    return socket as unknown as WebSocket
  }

  async subscribeEquities(symbols: string[], fields: number[]): Promise<void> {
    const streamer = this.requireStreamer()
    streamer.subscribe('LEVELONE_EQUITIES', symbols, fields, 'SUBS')
  }

  async subscribeFutures(symbols: string[], fields: number[]): Promise<void> {
    const streamer = this.requireStreamer()
    streamer.subscribe('LEVELONE_FUTURES', symbols, fields, 'SUBS')
  }

  async subscribeOptions(symbols: string[], fields: number[]): Promise<void> {
    const streamer = this.requireStreamer()
    streamer.subscribe('LEVELONE_OPTIONS', symbols, fields, 'SUBS')
  }

  disconnectStreamer(): void {
    this.streamer?.disconnect()
    this.streamer = null
  }

  private async request<T>(options: SchwabRequestOptions, attempt = 0): Promise<T> {
    const token = await this.oauth.getToken()
    const url = buildUrl({ ...options }, SCHWAB_API_BASE_URL)
    const response = await this.fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `${token.tokenType} ${token.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (response.status === 401 && attempt < this.maxRetries) {
      await this.oauth.refresh(token.refreshToken)
      return this.request<T>(options, attempt + 1)
    }

    if (response.status === 429 && attempt < this.maxRetries) {
      await delay(Math.pow(2, attempt) * 500)
      return this.request<T>(options, attempt + 1)
    }

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Schwab request failed ${response.status}: ${errorBody}`)
    }

    return response.json() as Promise<T>
  }

  private requireStreamer(): SchwabStreamer {
    if (!this.streamer) {
      throw new Error('Streaming connection is not established. Please call connectStreamer() before subscribing to streams.')
    }
    return this.streamer
  }

  private async getStreamerCredentials(): Promise<Omit<StreamerCredentials, 'accessToken'>> {
    const response = await this.request<Record<string, unknown>>({
      path: 'userPreference',
      baseUrl: SCHWAB_TRADER_API_BASE_URL,
    })

    const streamerInfo = (response.streamerInfo as Record<string, unknown>) ?? {}

    return {
      schwabClientCustomerId: String(response.schwabClientCustomerId ?? ''),
      schwabClientCorrelId: String(response.schwabClientCorrelId ?? ''),
      schwabClientChannel: String(streamerInfo.schwabClientChannel ?? ''),
      schwabClientFunctionId: String(streamerInfo.schwabClientFunctionId ?? ''),
      streamerUrl: String(streamerInfo.streamerSocketUrl ?? streamerInfo.streamerUrl ?? ''),
    }
  }

  private transformQuote(symbol: string, payload: unknown): Quote | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }

    const data = payload as Record<string, unknown>
    return {
      symbol,
      bidPrice: Number(data.bidPrice ?? data.bid ?? 0),
      askPrice: Number(data.askPrice ?? data.ask ?? 0),
      lastPrice: Number(data.lastPrice ?? data.last ?? 0),
      volume: Number(data.totalVolume ?? data.volume ?? 0),
      timestamp: Number(data.quoteTime ?? data.timestamp ?? Date.now()),
    }
  }

  private transformFutureQuote(symbol: string, payload: unknown): FutureQuote | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }

    const data = payload as Record<string, unknown>
    return {
      symbol,
      bidPrice: Number(data.bidPrice ?? data.bid ?? 0),
      askPrice: Number(data.askPrice ?? data.ask ?? 0),
      lastPrice: Number(data.lastPrice ?? data.last ?? 0),
      openPrice: Number(data.openPrice ?? 0),
      highPrice: Number(data.highPrice ?? 0),
      lowPrice: Number(data.lowPrice ?? 0),
      volume: Number(data.totalVolume ?? data.volume ?? 0),
      openInterest: Number(data.openInterest ?? 0),
    }
  }

  private transformOptionChain(symbol: string, payload: unknown): OptionChain[] {
    const data = payload as Record<string, unknown>
    const callExpDateMap = (data?.callExpDateMap as Record<string, Record<string, Array<Record<string, unknown>>>>) ?? {}
    const putExpDateMap = (data?.putExpDateMap as Record<string, Record<string, Array<Record<string, unknown>>>>) ?? {}

    return [callExpDateMap, putExpDateMap]
      .flatMap((expDateMap, index) => {
        const contractType: 'C' | 'P' = index === 0 ? 'C' : 'P'
        return Object.entries(expDateMap).flatMap(([expirationDate, strikes]) =>
          Object.entries(strikes).flatMap(([strikePrice, entries]) =>
            entries.map((entry) => ({
              underlyingSymbol: symbol,
              optionSymbol: String(entry.symbol ?? ''),
              strikePrice: Number(strikePrice),
              expirationDate: expirationDate.split(':')[0] ?? expirationDate,
              contractType,
              bidPrice: Number(entry.bid ?? entry.bidPrice ?? 0),
              askPrice: Number(entry.ask ?? entry.askPrice ?? 0),
              lastPrice: Number(entry.last ?? entry.lastPrice ?? 0),
              volume: Number(entry.totalVolume ?? entry.volume ?? 0),
              openInterest: Number(entry.openInterest ?? 0),
              impliedVolatility: Number(entry.volatility ?? entry.impliedVolatility ?? 0),
              greeks: {
                delta: Number(entry.delta ?? 0),
                gamma: Number(entry.gamma ?? 0),
                theta: Number(entry.theta ?? 0),
                vega: Number(entry.vega ?? 0),
                rho: Number(entry.rho ?? 0),
              },
            }))
          )
        )
      })
  }
}
