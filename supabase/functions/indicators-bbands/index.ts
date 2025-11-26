import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bollinger } from "./_indicators/bollinger.js";

const tfTable = (tf: string) => ({
  '1m': 'candles',
  '5m': 'candles_5m',
  '10m': 'candles_10m',
  '1h': 'candles_1h',
  '4h': 'candles_4h',
  '1d': 'candles_1d',
}[tf] ?? 'candles');

async function symbolId(supabase: any, ticker: string) {
  const { data } = await supabase
    .from('symbols')
    .select('id')
    .eq('ticker', ticker)
    .maybeSingle();
  return data?.id ?? null;
}

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(url, key);
    const u = new URL(req.url);
    const symbol = u.searchParams.get('symbol');
    const tf = u.searchParams.get('tf') ?? '1h';
    const n = +(u.searchParams.get('n') ?? 20);
    const k = +(u.searchParams.get('k') ?? 2);

    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    }
    const sid = await symbolId(supabase, symbol);
    if (!sid) {
      return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from(tfTable(tf))
      .select('ts, close')
      .eq('symbol_id', sid)
      .order('ts', { ascending: true })
      .limit(5000);
    if (error) throw error;

    const ts = (rows ?? []).map((r: any) => r.ts);
    const close = (rows ?? []).map((r: any) => +r.close);
    const out = bollinger(close, n, k);
    const merged = ts.map((t: string, i: number) => ({
      ts: t,
      mid: out.mid[i],
      upper: out.upper[i],
      lower: out.lower[i],
      pct_b: out.pctB[i],
      bandwidth: out.bw[i],
    }));

    return new Response(JSON.stringify(merged), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
