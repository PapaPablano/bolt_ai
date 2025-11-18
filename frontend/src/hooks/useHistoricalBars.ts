import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import { normalizeBarsPayload } from '@/lib/bars';
import type { Bar } from '@/types/bars';

const normalizeRange = (range?: string) => range?.toLowerCase?.() ?? '5d';

export function useHistoricalBars(symbol: string, timeframe: string, range = '5D') {
  return useQuery<Bar[]>({
    queryKey: ['hist-bars', symbol?.toUpperCase(), timeframe, range],
    enabled: Boolean(symbol),
    staleTime: 10_000,
    queryFn: async () => {
      const barsFunction = env.barsFunction || 'stock-historical-v3';
      const rangeMap: Record<string, string> = {
        '1D': '1d',
        '5D': '5d',
        '1M': '1mo',
        '3M': '3mo',
        '6M': '6mo',
        '1Y': '1y',
        '5Y': '5y',
      };
      const normalizedRange = rangeMap[range.toUpperCase?.() ?? ''] ?? normalizeRange(range);
      const { data, error } = await supabase.functions.invoke(barsFunction, {
        body: { symbol, timeframe, range: normalizedRange },
      });
      if (error) throw error;
      return normalizeBarsPayload(data);
    },
  });
}
