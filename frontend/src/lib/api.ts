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
    body: { symbol, timeframe, interval: '1Day' }
  });

  if (error) throw error;
  return data.bars || [];
}
