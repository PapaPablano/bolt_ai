import { useEffect } from 'react';
import { useTickerDataStore } from '@/store/tickerDataStore';
import type { Interval, Range } from '@/store/tickerDataStore';
import { normalizeSymbol } from '@/lib/symbols';

const normalizeRange = (range: string): Range => {
  const map: Record<string, Range> = {
    '1D': '1d',
    '5D': '5d',
    '1M': '1mo',
    '3M': '3mo',
    '6M': '6mo',
    '1Y': '1y',
    '2Y': '2y',
    '5Y': '5y',
    '10Y': '10y',
    MAX: 'max',
  };
  return map[range?.toUpperCase?.() ?? ''] ?? '6mo';
};

export const useHookPrice = (ticker: string, interval: Interval, range: string) => {
  const { fetchTickerData, backfillHistorical, data } = useTickerDataStore();
  const normalizedTicker = normalizeSymbol(ticker);
  const normalizedRange = normalizeRange(range);

  useEffect(() => {
    if (normalizedTicker) {
      fetchTickerData(normalizedTicker, interval, normalizedRange);
      backfillHistorical(normalizedTicker);
    }
  }, [normalizedTicker, interval, normalizedRange, fetchTickerData, backfillHistorical]);

  const tickerData = normalizedTicker ? data[normalizedTicker] : undefined;
  const candles = tickerData?.candles ?? null;
  const loading = tickerData?.status.candlesLoading;
  const meta = tickerData?.meta.candles;

  return { candles, loading, meta };
};
