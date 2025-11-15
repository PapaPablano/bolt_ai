import { SupabaseClient } from '@supabase/supabase-js'
import { Candle, FutureQuote, OptionChain, Quote } from '../schwab-api/types.js'

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

type PriceHistoryRow = {
  datetime: string | null
  open_price: number | null
  high_price: number | null
  low_price: number | null
  close_price: number | null
  volume: number | null
}

export class MarketDataDB {
  constructor(private readonly client: SupabaseClient) {}

  async saveQuotes(quotes: Quote[]): Promise<void> {
    if (quotes.length === 0) {
      return
    }

    const rows = quotes.map((quote) => ({
      symbol: quote.symbol,
      bid_price: quote.bidPrice,
      ask_price: quote.askPrice,
      last_price: quote.lastPrice,
      volume: quote.volume,
      timestamp: toIso(quote.timestamp),
    }))

    const { error } = await this.client
      .from('market_quotes')
      .upsert(rows, { onConflict: 'symbol,timestamp' })

    if (error) {
      throw new Error(`Failed to save quotes: ${error.message}`)
    }
  }

  async saveFuturesData(data: FutureQuote[]): Promise<void> {
    if (data.length === 0) {
      return
    }

    const rows = data.map((future) => ({
      symbol: future.symbol,
      bid_price: future.bidPrice,
      ask_price: future.askPrice,
      last_price: future.lastPrice,
      open_price: future.openPrice,
      high_price: future.highPrice,
      low_price: future.lowPrice,
      volume: future.volume,
      open_interest: future.openInterest,
      timestamp: toIso(Date.now()),
    }))

    const { error } = await this.client
      .from('futures_data')
      .insert(rows)

    if (error) {
      throw new Error(`Failed to save futures data: ${error.message}`)
    }
  }

  async saveOptionChain(chain: OptionChain[]): Promise<void> {
    if (chain.length === 0) {
      return
    }

    const rows = chain.map((option) => ({
      underlying_symbol: option.underlyingSymbol,
      option_symbol: option.optionSymbol,
      strike_price: option.strikePrice,
      expiration_date: option.expirationDate,
      contract_type: option.contractType,
      bid_price: option.bidPrice,
      ask_price: option.askPrice,
      last_price: option.lastPrice,
      volume: option.volume,
      open_interest: option.openInterest,
      implied_volatility: option.impliedVolatility,
      delta: option.greeks.delta,
      gamma: option.greeks.gamma,
      theta: option.greeks.theta,
      vega: option.greeks.vega,
      rho: option.greeks.rho,
      timestamp: toIso(Date.now()),
    }))

    const { error } = await this.client
      .from('options_chains')
      .insert(rows)

    if (error) {
      throw new Error(`Failed to save option chain: ${error.message}`)
    }
  }

  async savePriceHistory(history: Candle[]): Promise<void> {
    if (history.length === 0) {
      return
    }

    const rows = history.map((candle) => {
      if (!candle.symbol) {
        throw new Error('Candle symbol is required to persist price history')
      }
      return {
        symbol: candle.symbol,
        open_price: candle.open,
        high_price: candle.high,
        low_price: candle.low,
        close_price: candle.close,
        volume: candle.volume,
        datetime: toIso(candle.datetime),
      }
    })

    const { error } = await this.client
      .from('price_history')
      .upsert(rows, { onConflict: 'symbol,datetime' })

    if (error) {
      throw new Error(`Failed to save price history: ${error.message}`)
    }
  }

  async getLatestQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) {
      return []
    }

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const { data, error } = await this.client
          .from('market_quotes')
          .select('symbol,bid_price,ask_price,last_price,volume,timestamp')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: false })
          .limit(1)
        if (error) {
          throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`)
        }
        if (!data || data.length === 0) {
          return null
        }
        const row = data[0]
        return {
          symbol: row.symbol,
          bidPrice: Number(row.bid_price ?? 0),
          askPrice: Number(row.ask_price ?? 0),
          lastPrice: Number(row.last_price ?? 0),
          volume: Number(row.volume ?? 0),
          timestamp: new Date(row.timestamp as string).getTime(),
        }
      }),
    )

    return results.filter((row): row is Quote => row !== null)
  }

  async getHistoricalData(symbol: string, from: Date, to: Date): Promise<Candle[]> {
    const { data, error } = await this.client
      .from('price_history')
      .select('datetime,open_price,high_price,low_price,close_price,volume')
      .eq('symbol', symbol)
      .gte('datetime', from.toISOString())
      .lte('datetime', to.toISOString())
      .order('datetime', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch historical data: ${error.message}`)
    }

    if (!data) {
      return []
    }

    const rows = data as PriceHistoryRow[]

    return rows.map((row) => ({
      datetime: new Date(row.datetime ?? '').getTime(),
      open: Number(row.open_price ?? 0),
      high: Number(row.high_price ?? 0),
      low: Number(row.low_price ?? 0),
      close: Number(row.close_price ?? 0),
      volume: Number(row.volume ?? 0),
      symbol,
    }))
  }
}
