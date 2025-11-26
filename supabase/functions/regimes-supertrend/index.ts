import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supertrendAI } from "./_indicators/supertrend_ai.js";

type Bar = { t: number; o: number; h: number; l: number; c: number };

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

    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    }
    const sid = await symbolId(supabase, symbol);
    if (!sid) {
      return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from(tfTable(tf))
      .select('ts, open, high, low, close')
      .eq('symbol_id', sid)
      .order('ts', { ascending: true })
      .limit(5000);
    if (error) throw error;

    const bars: Bar[] = (rows ?? []).map((r: any) => ({
      t: new Date(r.ts).getTime(),
      o: +r.open,
      h: +r.high,
      l: +r.low,
      c: +r.close,
    }));
    if (bars.length < 50) {
      return new Response(JSON.stringify({ error: 'insufficient data' }), {
        status: 422,
      });
    }

    const atr = +(u.searchParams.get('atr') ?? 10);
    const fmin = +(u.searchParams.get('fmin') ?? 1);
    const fmax = +(u.searchParams.get('fmax') ?? 5);
    const fstep = +(u.searchParams.get('fstep') ?? 0.5);
    const alpha = +(u.searchParams.get('alpha') ?? 0.2);

    const out = supertrendAI(bars, {
      atrPeriod: atr,
      factorMin: fmin,
      factorMax: fmax,
      factorStep: fstep,
      perfAlpha: alpha,
      k: 3,
      seed: 42,
    });

    const persist = u.searchParams.get('persist') === '1';
    if (persist && rows && rows.length === bars.length) {
      const inserts: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const b = out.bands[i];
        const f = out.factor[i];
        const p = out.perf[i];
        const c = (out.cluster[i] as 'LOW' | 'AVG' | 'TOP') ?? 'AVG';

        if (!b || !Number.isFinite(f) || !Number.isFinite(p)) continue;
        if (!Number.isFinite(b.upper) || !Number.isFinite(b.lower)) continue;

        inserts.push({
          symbol_id: sid,
          timeframe: tf,
          ts: rows[i].ts,
          factor: f,
          perf: p,
          cluster: c,
        });
      }

      if (inserts.length) {
        const { error: upErr } = await supabase
          .from('ta_supertrend_ai')
          .upsert(inserts, { onConflict: 'symbol_id,timeframe,ts' });
        if (upErr) {
          // eslint-disable-next-line no-console
          console.warn('ta_supertrend_ai upsert error', upErr);
        }
      }
    }

    return new Response(JSON.stringify(out), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
