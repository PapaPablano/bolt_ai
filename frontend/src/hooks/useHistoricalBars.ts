import { useQuery } from '@tanstack/react-query';
import { normalizeBarsPayload } from '@/lib/bars';
import { fetchOHLC, buildRangeBounds } from '@/lib/api/ohlc';
import { isValidSymbol, normalizeSymbol } from '@/lib/symbols';
import type { Bar } from '@/types/bars';

const normalizeRange = (range?: string) => {
  const map: Record<string, string> = {
    '1D': '1M',
    '5D': '1M',
    '1M': '1M',
    '3M': '3M',
    '6M': '6M',
    '1Y': '1Y',
    '2Y': '2Y',
    '5Y': '5Y',
    '10Y': '10Y',
    'MAX': 'MAX',
  };
  return map[range?.toUpperCase?.() ?? ''] ?? '6M';
};

export function useHistoricalBars(symbol: string, timeframe: string, range = '6M') {
  const normalizedRange = normalizeRange(range);
  const normalizedSymbol = normalizeSymbol(symbol);
  return useQuery<Bar[]>({
    queryKey: ['hist-bars', normalizedSymbol, timeframe, normalizedRange],
    enabled: isValidSymbol(symbol),
    staleTime: 15_000,
    queryFn: async () => {
      const normalizedTimeframe = timeframe?.trim?.() || '1Day';
      const params = buildRangeBounds(normalizedTimeframe, normalizedRange);
      const bars = await fetchOHLC(normalizedSymbol, params.tf, params.startMs, params.endMs);
      return normalizeBarsPayload({ bars });
    },
  });
}
