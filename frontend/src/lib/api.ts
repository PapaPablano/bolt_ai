import { env } from './env';
import { normalizeBarsPayload } from './bars';
import { supabase } from './supabase';
import { isValidSymbol, normalizeSymbol } from './symbols';

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

export async function fetchHistoricalData(symbol: string, timeframe: string = '1D'): Promise<BarData[]> {
  const barsFunction = env.barsFunction || 'get-bars';
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!isValidSymbol(normalizedSymbol)) {
    throw new Error('Invalid symbol');
  }

  const upper = timeframe.toUpperCase();
  const now = new Date();
  const nowIso = now.toISOString();

  // Map UI selections (which represent range) into API shape.
  // Short ranges use intraday bars; longer ranges use daily bars.
  let body: Record<string, unknown> = { symbol: normalizedSymbol, range: '6M', timeframe: '1Day' };

  switch (upper) {
    case '1D': {
      const start = new Date(now.getTime() - 2 * 86_400_000).toISOString();
      body = { symbol: normalizedSymbol, timeframe: '5Min', start, end: nowIso };
      break;
    }
    case '5D': {
      const start = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      body = { symbol: normalizedSymbol, timeframe: '15Min', start, end: nowIso };
      break;
    }
    case '1M':
    case '3M':
    case '6M':
    case '1Y':
    case '2Y':
    case '5Y':
    case '10Y':
    case 'MAX': {
      body = { symbol: normalizedSymbol, timeframe: '1Day', range: upper };
      break;
    }
    default: {
      body = { symbol: normalizedSymbol, timeframe: '1Day', range: '6M' };
    }
  }

  const { data, error } = await supabase.functions.invoke(barsFunction, { body });

  if (error) throw error;
  return normalizeBarsPayload(data);
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
