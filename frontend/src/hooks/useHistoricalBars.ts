import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import { normalizeBarsPayload } from '@/lib/bars';
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
      const barsFunction = env.barsFunction || 'get-bars';
      const normalizedTimeframe = timeframe?.trim?.();
      const { data, error } = await supabase.functions.invoke(barsFunction, {
        body: { symbol: normalizedSymbol, timeframe: normalizedTimeframe, range: normalizedRange },
      });
      if (error) throw error;
      return normalizeBarsPayload(data);
    },
  });
}
