import { supabase } from '@/lib/supabaseClient';

// Local alias to avoid overly strict generic types when using the test/mock client union.
const client: any = supabase;

export type TF = '10m' | '1h' | '4h' | '1d';

export type AlertCondition =
  | {
      type: 'kdj_cross';
      tf: TF;
      when: 'J_crosses_D' | 'J_crosses_below_D';
      n?: number;
      m?: number;
      l?: number;
    }
  | {
      type: 'bb_squeeze';
      tf: TF;
      n?: number;
      k?: number;
      bw_pctile?: number;
    }
  | {
      type: 'supertrend_flip';
      tf: TF;
      atr?: number;
      fmin?: number;
      fmax?: number;
      fstep?: number;
      alpha?: number;
    };

export async function fetchSymbolId(ticker: string): Promise<number | null> {
  const { data, error } = await client
    .from('symbols')
    .select('id')
    .eq('ticker', ticker)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function createAlert(params: {
  ticker: string;
  condition: AlertCondition;
  active?: boolean;
}) {
  const symbol_id = await fetchSymbolId(params.ticker);
  if (!symbol_id) throw new Error(`Unknown symbol: ${params.ticker}`);

  const { error } = await client.from('alerts').insert({
    symbol_id,
    condition_json: params.condition,
    active: params.active ?? true,
  });
  if (error) throw error;
  return true;
}

export async function listAlerts() {
  const { data, error } = await client
    .from('alerts')
    .select('id, symbol_id, condition_json, active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
