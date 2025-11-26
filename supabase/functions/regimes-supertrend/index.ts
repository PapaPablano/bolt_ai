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

    const labels: ('TREND_UP' | 'TREND_DOWN' | 'CHOP')[] = [];
    const feat: any[] = [];
    for (let i = 0; i < bars.length; i++) {
      const b = out.bands[i];
      const f = out.factor[i];
      const prevClose = i > 0 ? bars[i - 1].c : bars[i].c;

      if (!b || !Number.isFinite(b.upper) || !Number.isFinite(b.lower)) {
        labels.push('CHOP');
        feat.push(null);
        continue;
      }

      const effFactor = Number.isFinite(f) && f > 0 ? f : 3;
      const width = Math.abs(b.upper - b.lower);
      const atrEff = width > 0 && effFactor > 0 ? width / (2 * effFactor) : 0;
      const atrNorm = atrEff > 0 && Number.isFinite(bars[i].c)
        ? atrEff / Math.max(1e-12, Math.abs(bars[i].c))
        : 0;
      const distUpper = (bars[i].c - b.upper) / Math.max(1e-12, atrEff || 1);
      const distLower = (bars[i].c - b.lower) / Math.max(1e-12, atrEff || 1);
      const ret1 = Math.log(
        Math.max(1e-12, bars[i].c) / Math.max(1e-12, prevClose),
      );

      let lab: 'TREND_UP' | 'TREND_DOWN' | 'CHOP' = 'CHOP';
      if (b.trend === 1 && distLower > -1 && distLower < 2 && atrNorm < 0.02) {
        lab = 'TREND_UP';
      } else if (b.trend === -1 && distUpper < 1 && distUpper > -2 && atrNorm < 0.02) {
        lab = 'TREND_DOWN';
      }

      labels.push(lab);
      feat.push({
        dist_upper: distUpper,
        dist_lower: distLower,
        atr_norm: atrNorm,
        ret_1: ret1,
      });
    }

    const persist = u.searchParams.get('persist') === '1';
    const persistClusters = u.searchParams.get('persist_clusters') === '1';
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

    if (persistClusters && rows && rows.length === labels.length) {
      const clusterInserts: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const lab = labels[i];
        if (!lab) continue;
        clusterInserts.push({
          symbol_id: sid,
          timeframe: tf,
          ts: rows[i].ts,
          label: lab,
          features_json: feat[i],
          model_version: 'stai_stub_v1',
        });
      }

      if (clusterInserts.length) {
        const { error: cErr } = await supabase
          .from('ta_clusters')
          .upsert(clusterInserts, { onConflict: 'symbol_id,timeframe,ts' });
        if (cErr) {
          // eslint-disable-next-line no-console
          console.warn('ta_clusters upsert error', cErr);
        }
      }
    }

    return new Response(JSON.stringify({ ...out, labels }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
