import { supabase } from './supabase';

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
  const { data, error } = await supabase.functions.invoke('stock-quote', {
    body: { symbol }
  });

  if (error) throw error;
  return data;
}

export async function fetchHistoricalData(
  symbol: string,
  timeframe: string = '1D'
): Promise<BarData[]> {
  const { data, error } = await supabase.functions.invoke('stock-historical-v3', {
    // Backend expects `range`; keep timeframe string for UI but map to range here if needed.
    body: { symbol, range: timeframe === '1D' ? '1mo' : timeframe.toLowerCase() }
  });

  if (error) throw error;
  return data?.data || [];
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
