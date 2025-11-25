// Evaluate active alerts for a symbol/tf and insert alert_events.
// Supports: kdj_cross (J vs D), bb_squeeze, supertrend_flip.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supertrendAI, type Bar } from "../regimes-supertrend/_stai.ts";

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(url, key);

const tfTable = (tf: string) => ({ '1m':'candles','5m':'candles_5m','10m':'candles_10m','1h':'candles_1h','4h':'candles_4h','1d':'candles_1d' }[tf] ?? 'candles');

async function getSymbolId(ticker: string) {
  const { data } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle();
  return data?.id as number | undefined;
}

async function loadBars(symbolId: number, tf: string, lookback = 400): Promise<Bar[]> {
  const table = tfTable(tf);
  const { data, error } = await supabase
    .from(table)
    .select('ts, open, high, low, close')
    .eq('symbol_id', symbolId)
    .order('ts', { ascending: false })
    .limit(lookback);
  if (error) throw error;
  const rows = (data ?? []).reverse();
  return rows.map((r: any) => ({ t: new Date(r.ts).getTime(), o: +r.open, h: +r.high, l: +r.low, c: +r.close }));
}

function kdjEdge(high:number[], low:number[], close:number[], n=9, m=3, l=3) {
  const len=close.length; const rsv=new Array(len).fill(0);
  for(let i=0;i<len;i++){ const a=Math.max(0,i-n+1); let hi=-Infinity, lo=Infinity; for(let j=a;j<=i;j++){hi=Math.max(hi, high[j]); lo=Math.min(lo, low[j]);}
    const den=Math.max(1e-12, hi-lo); rsv[i]=100*(close[i]-lo)/den; }
  const ema=(src:number[], p:number)=>{ const out:number[]=[]; const a=2/(p+1); let prev=src[0]; for(let i=0;i<src.length;i++){ prev = i?(a*src[i]+(1-a)*prev):src[i]; out.push(prev);} return out; };
  const K=ema(rsv,m), D=ema(K,l), J=K.map((k,i)=>3*k-2*D[i]);
  return {K,D,J};
}

function bollingerEdge(close:number[], n=20, k=2){
  const mid:number[]=[], up:number[]=[], lo:number[]=[], bw:number[]=[];
  for(let i=0;i<close.length;i++){
    if(i+1<n){mid.push(NaN); up.push(NaN); lo.push(NaN); bw.push(NaN); continue;}
    const s=i-n+1; let mean=0; for(let j=s;j<=i;j++) mean+=close[j]; mean/=n;
    let v=0; for(let j=s;j<=i;j++) v+=(close[j]-mean)**2; v/=n; const sd=Math.sqrt(v);
    const U=mean+k*sd, L=mean-k*sd; mid.push(mean); up.push(U); lo.push(L); bw.push((U-L)/Math.max(1e-12, mean));
  }
  return { mid, up, lo, bw };
}

serve(async (req) => {
  try {
    const body = req.method === 'POST' ? await req.json() : Object.fromEntries(new URL(req.url).searchParams);
    const symbol = String(body.symbol ?? 'AAPL');
    const tf = String(body.tf ?? '1h');
    const sid = await getSymbolId(symbol);
    if (!sid) return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });

    const bars = await loadBars(sid, tf, 500);
    if (bars.length < 40) return new Response(JSON.stringify({ error: 'insufficient data' }), { status: 422 });

    // Gather active alerts (in production filter by user_id/target)
    const { data: alerts } = await supabase.from('alerts')
      .select('id, user_id, condition_json')
      .eq('active', true);

    const events: any[] = [];
    for (const a of (alerts ?? [])) {
      const cond = a.condition_json as any;
      if (cond?.tf && cond.tf !== tf) continue;
      if (cond?.type === 'kdj_cross') {
        const high = bars.map(b => b.h), low = bars.map(b => b.l), close = bars.map(b => b.c);
        const { K, D, J } = kdjEdge(high, low, close, cond.n ?? 9, cond.m ?? 3, cond.l ?? 3);
        const i = J.length - 1; const prev = (J[i-1] - D[i-1]); const cur = (J[i] - D[i]);
        const crossUp = prev <= 0 && cur > 0; const crossDown = prev >= 0 && cur < 0;
        const wantUp = (cond.when ?? 'J_crosses_D') === 'J_crosses_D';
        if ((wantUp && crossUp) || (!wantUp && crossDown)) {
          events.push({ alert_id: a.id, payload_json: { symbol, tf, type: 'kdj_cross', when: wantUp? 'up':'down', t: bars[bars.length-1].t } });
        }
      }
      if (cond?.type === 'bb_squeeze') {
        const close = bars.map(b => b.c); const { bw } = bollingerEdge(close, cond.n ?? 20, cond.k ?? 2);
        const finite = bw.filter(x => Number.isFinite(x)).slice(-252);
        if (finite.length >= 10) {
          const sorted = [...finite].sort((a,b)=>a-b); const cut = sorted[Math.floor((cond.bw_pctile ?? 5) / 100 * sorted.length)];
          const last = bw[bw.length-1]; const prev = bw[bw.length-2];
          if (last <= cut && prev > cut) {
            events.push({ alert_id: a.id, payload_json: { symbol, tf, type: 'bb_squeeze', bw:last, pctile: cond.bw_pctile ?? 5, t: bars[bars.length-1].t } });
          }
        }
      }
      if (cond?.type === 'supertrend_flip') {
        const out = supertrendAI(bars, { atrPeriod: cond.atr ?? 10, factorMin: cond.fmin ?? 1, factorMax: cond.fmax ?? 5, factorStep: cond.fstep ?? 0.5, perfAlpha: cond.alpha ?? 0.2, k: 3 });
        const b = out.bands; if (b.length >= 2) {
          const prev = b[b.length-2].trend, cur = b[b.length-1].trend;
          if (prev !== cur) events.push({ alert_id: a.id, payload_json: { symbol, tf, type: 'supertrend_flip', dir: cur, t: bars[bars.length-1].t } });
        }
      }
    }

    // Insert events
    for (const e of events) await supabase.from('alert_events').insert({ alert_id: e.alert_id, payload_json: e.payload_json });

    return new Response(JSON.stringify({ inserted: events.length }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
