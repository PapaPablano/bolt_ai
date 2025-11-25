// Deno Edge Function: Supertrend AI bands + factor stream
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supertrendAI, type Bar } from "./_stai.ts";

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // server-side
const supabase = createClient(url, key);

const tfTable = (tf: string) => ({
  '1m': 'candles', '5m': 'candles_5m', '10m': 'candles_10m', '1h': 'candles_1h', '4h': 'candles_4h', '1d': 'candles_1d'
}[tf] ?? 'candles');

async function symbolId(ticker: string): Promise<number | null> {
  const { data, error } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle();
  if (error) return null; return data?.id ?? null;
}

serve(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const tf = searchParams.get('tf') ?? '1h';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    const sid = await symbolId(symbol);
    if (!sid) return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });

    const table = tfTable(tf);
    let q = supabase.from(table).select('ts, open, high, low, close').eq('symbol_id', sid).order('ts', { ascending: true }).limit(5000);
    if (from) q = q.gte('ts', from); if (to) q = q.lte('ts', to);
    const { data: rows, error } = await q;
    if (error) throw error;

    const bars: Bar[] = (rows ?? []).map((r: any) => ({ t: new Date(r.ts).getTime(), o: +r.open, h: +r.high, l: +r.low, c: +r.close }));
    if (bars.length < 50) return new Response(JSON.stringify({ error: 'insufficient data' }), { status: 422 });

    const atrPeriod = +(searchParams.get('atr') ?? 10);
    const fmin = +(searchParams.get('fmin') ?? 1);
    const fmax = +(searchParams.get('fmax') ?? 5);
    const fstep = +(searchParams.get('fstep') ?? 0.5);
    const alpha = +(searchParams.get('alpha') ?? 0.2);

    const out = supertrendAI(bars, { atrPeriod, factorMin: fmin, factorMax: fmax, factorStep: fstep, perfAlpha: alpha, k: 3 });
    return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
