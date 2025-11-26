import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kdj } from "./_indicators/kdj.js";
import { bollinger } from "./_indicators/bollinger.js";
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

function barOpen(tsStr: string, _tf: string): string {
  // Adjust here if your DB stores bar-close timestamps instead of bar-open.
  return tsStr;
}

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(url, key);
    const body =
      req.method === 'POST'
        ? await req.json()
        : Object.fromEntries(new URL(req.url).searchParams);
    const symbol = String(body.symbol ?? 'AAPL');
    const tf = String(body.tf ?? '1h');

    const sid = await symbolId(supabase, symbol);
    if (!sid) {
      return new Response(JSON.stringify({ error: 'symbol not found' }), {
        status: 404,
      });
    }

    const { data: rows, error } = await supabase
      .from(tfTable(tf))
      .select('ts, open, high, low, close')
      .eq('symbol_id', sid)
      .order('ts', { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!rows || rows.length < 40) {
      return new Response(JSON.stringify({ error: 'insufficient data' }), {
        status: 422,
      });
    }

    const bars: Bar[] = rows.map((r: any) => ({
      t: new Date(r.ts).getTime(),
      o: +r.open,
      h: +r.high,
      l: +r.low,
      c: +r.close,
    }));
    const lastBarTs = barOpen(rows[rows.length - 1].ts, tf);

    const { data: alerts } = await supabase
      .from('alerts')
      .select('id, user_id, symbol_id, condition_json')
      .eq('active', true)
      .eq('symbol_id', sid);

    const toInsert: any[] = [];

    for (const a of alerts ?? []) {
      const cond = a.condition_json ?? {};

      if (cond.type === 'kdj_cross' && (!cond.tf || cond.tf === tf)) {
        const high = bars.map((b) => b.h);
        const low = bars.map((b) => b.l);
        const close = bars.map((b) => b.c);
        const { K, D, J } = kdj(
          high,
          low,
          close,
          cond.n ?? 9,
          cond.m ?? 3,
          cond.l ?? 3,
          'ema',
        );
        const i = J.length - 1;
        const prev = J[i - 1] - D[i - 1];
        const cur = J[i] - D[i];
        const crossUp = prev <= 0 && cur > 0;
        const crossDown = prev >= 0 && cur < 0;
        const wantUp = (cond.when ?? 'J_crosses_D') === 'J_crosses_D';
        if ((wantUp && crossUp) || (!wantUp && crossDown)) {
          toInsert.push({
            alert_id: a.id,
            symbol_id: sid,
            timeframe: tf,
            bar_ts: lastBarTs,
            payload_json: {
              symbol,
              tf,
              type: 'kdj_cross',
              when: wantUp ? 'up' : 'down',
            },
            fired_at: new Date().toISOString(),
          });
        }
      }

      if (cond.type === 'bb_squeeze' && (!cond.tf || cond.tf === tf)) {
        const close = bars.map((b) => b.c);
        const { bw } = bollinger(close, cond.n ?? 20, cond.k ?? 2);
        const finite = bw
          .filter((x: number) => Number.isFinite(x))
          .slice(-252);
        if (finite.length >= 10) {
          const sorted = [...finite].sort((a, b) => a - b);
          const cut = sorted[Math.floor(((cond.bw_pctile ?? 5) / 100) * sorted.length)];
          const last = bw[bw.length - 1];
          const prev = bw[bw.length - 2];
          if (last <= cut && prev > cut) {
            toInsert.push({
              alert_id: a.id,
              symbol_id: sid,
              timeframe: tf,
              bar_ts: lastBarTs,
              payload_json: {
                symbol,
                tf,
                type: 'bb_squeeze',
                bw: last,
                pctile: cond.bw_pctile ?? 5,
              },
              fired_at: new Date().toISOString(),
            });
          }
        }
      }

      if (cond.type === 'supertrend_flip' && (!cond.tf || cond.tf === tf)) {
        const out = supertrendAI(bars, {
          atrPeriod: cond.atr ?? 10,
          factorMin: cond.fmin ?? 1,
          factorMax: cond.fmax ?? 5,
          factorStep: cond.fstep ?? 0.5,
          perfAlpha: cond.alpha ?? 0.2,
          k: 3,
          seed: 42,
        });
        const b = out.bands;
        if (b.length >= 2) {
          const prev = b[b.length - 2].trend;
          const cur = b[b.length - 1].trend;
          if (prev !== cur) {
            toInsert.push({
              alert_id: a.id,
              symbol_id: sid,
              timeframe: tf,
              bar_ts: lastBarTs,
              payload_json: {
                symbol,
                tf,
                type: 'supertrend_flip',
                dir: cur,
              },
              fired_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    for (const rec of toInsert) {
      await supabase
        .from('alert_events')
        .upsert(rec, {
          onConflict: 'alert_id,symbol_id,timeframe,bar_ts',
          ignoreDuplicates: true,
        });
    }

    return new Response(JSON.stringify({ inserted: toInsert.length }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
