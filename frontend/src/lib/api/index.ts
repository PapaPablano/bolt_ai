import { env } from '../env';
import { normalizeBarsPayload } from '../bars';
import { supabase } from '../supabase';
import { isValidSymbol, normalizeSymbol } from '../symbols';
import { buildRangeBounds, fetchOHLC, windowFromDays } from './ohlc';
import { api } from '../api-client';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface BarData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const quoteFunction = env.quoteFunction || 'stock-quote';
  const { data, error } = await supabase.functions.invoke(quoteFunction, {
    body: { symbol }
  });

  if (error) throw error;
  return data;
}

export async function fetchHistoricalData(symbol: string, range: string = '1D'): Promise<BarData[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!isValidSymbol(normalizedSymbol)) {
    throw new Error('Invalid symbol');
  }

  const upper = range.toUpperCase();
  const nowMs = Date.now();
  let params: ReturnType<typeof buildRangeBounds>;

  if (upper === '1D') {
    params = windowFromDays('5Min', 2, nowMs);
  } else if (upper === '5D') {
    params = windowFromDays('15Min', 7, nowMs);
  } else {
    params = buildRangeBounds('1Day', upper, nowMs);
  }

  const bars = await fetchOHLC(normalizedSymbol, params.tf, params.startMs, params.endMs);
  return normalizeBarsPayload({ bars });
}

interface SchwabQuote {
  symbol: string;
  [key: string]: unknown;
}

export async function fetchSchwabQuotes(symbols: string[]): Promise<SchwabQuote[]> {
  const { data, error } = await supabase.functions.invoke('schwab-quote', {
    body: { symbols }
  });

  if (error) throw error;
  return data.quotes || [];
}

export async function fetchSchwabHistoricalData(
  symbol: string,
  params: {
    periodType?: string;
    period?: number;
    frequencyType?: string;
    frequency?: number;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<BarData[]> {
  const { data, error } = await supabase.functions.invoke('schwab-historical', {
    body: { symbol, ...params }
  });

  if (error) throw error;

  interface SchwabCandle {
    datetime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }

  return (data.candles || []).map((candle: SchwabCandle) => ({
    time: new Date(candle.datetime).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

// --- Proxy-based helpers (new) ----------------------------------------------

export const proxyApi = {
  schwab: {
    getQuote: (symbols: string[] | string) => api.schwab.getQuote(symbols),
    getPriceHistory: (
      symbol: string,
      options: { periodType?: string; period?: string; frequencyType?: string; frequency?: string } = {},
    ) => api.schwab.getPriceHistory(symbol, options),
    getMarketHours: (markets?: string, date?: string) => api.schwab.getMarketHours(markets, date),
  },
  alpaca: {
    getBars: (
      symbol: string,
      options: { timeframe?: string; start?: string; end?: string; limit?: number } = {},
    ) => api.alpaca.getBars(symbol, options),
    getLatestQuote: (symbol: string) => api.alpaca.getLatestQuote(symbol),
    getLatestTrade: (symbol: string) => api.alpaca.getLatestTrade(symbol),
    getSnapshot: (symbols: string[] | string) => api.alpaca.getSnapshot(symbols),
  },
  news: {
    getEconomicCalendar: (options: { date?: string; currency?: string; impact?: string } = {}) =>
      api.news.getEconomicCalendar(options),
    getTodayEvents: () => api.news.getTodayEvents(),
    getHighImpactEvents: (startDate?: string) => api.news.getHighImpactEvents(startDate),
  },
};
