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
      const { data, error } = await supabase.functions.invoke(barsFunction, {
        body: { symbol, timeframe, range: normalizeRange(range) },
      });
      if (error) throw error;
      return normalizeBarsPayload(data);
    },
  });
}
