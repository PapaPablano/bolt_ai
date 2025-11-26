import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supertrendAI } from "./_indicators/supertrend_ai.js";

type TF = "10m" | "1h" | "4h" | "1d";

type Bar = { t: number; o: number; h: number; l: number; c: number };

type STAIOptions = {
  atrPeriod: number;
  factorMin: number;
  factorMax: number;
  factorStep: number;
  perfAlpha: number;
  k: number;
  seed: number;
};

const tfTable = (tf: TF): string => ({
  "10m": "candles_10m",
  "1h": "candles_1h",
  "4h": "candles_4h",
  "1d": "candles_1d",
}[tf] ?? "candles_1h");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const DEFAULT_TF: TF[] = ["10m", "1h", "4h"];

const DEFAULT_TICKERS = (Deno.env.get("JOBS_TICKERS") ?? "AAPL,MSFT,SPY")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const DEFAULT_STAI: STAIOptions = {
  atrPeriod: 10,
  factorMin: 1,
  factorMax: 5,
  factorStep: 0.5,
  perfAlpha: 0.2,
  k: 3,
  seed: 42,
};

function labelRegime(
  trend: 1 | -1,
  perf: number,
  price: number,
  thresh = 0.002,
): "TREND_UP" | "TREND_DOWN" | "CHOP" {
  const norm = price > 0 ? Math.abs(perf) / price : 0;
  if (!Number.isFinite(norm) || norm < thresh) return "CHOP";
  return trend === 1 ? "TREND_UP" : "TREND_DOWN";
}

const LOCK_KEY = 70422691; // derived from 'jobs-stai-batch'

async function fetchSymbolId(ticker: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("symbols")
    .select("id")
    .eq("ticker", ticker)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

async function persistSTAI(
  symbolId: number,
  tf: TF,
  rows: { ts: string }[],
  out: any,
) {
  const inserts: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const b = out.bands?.[i];
    const f = out.factor?.[i];
    const p = out.perf?.[i];
    const c = (out.cluster?.[i] as "LOW" | "AVG" | "TOP") ?? "AVG";

    if (!b || !Number.isFinite(f) || !Number.isFinite(p)) continue;
    if (!Number.isFinite(b.upper) || !Number.isFinite(b.lower)) continue;

    inserts.push({
      symbol_id: symbolId,
      timeframe: tf,
      ts: rows[i].ts,
      factor: f,
      perf: p,
      cluster: c,
    });
  }

  if (!inserts.length) return 0;

  const { error } = await supabase
    .from("ta_supertrend_ai")
    .upsert(inserts, { onConflict: "symbol_id,timeframe,ts" });

  if (error) throw error;
  return inserts.length;
}

async function persistClusters(
  symbolId: number,
  tf: TF,
  rawRows: { ts: string; open?: number; high?: number; low?: number; close?: number }[],
  out: any,
  modelVersion = "stai_v1",
) {
  const inserts: any[] = [];
  const bands = out?.bands ?? [];
  const perfArr = out?.perf ?? [];
  const factorArr = out?.factor ?? [];
  const n = Math.min(rawRows.length, bands.length, perfArr.length);

  for (let i = 1; i < n; i++) {
    const band = bands[i];
    const perf = perfArr[i];
    const row = rawRows[i] as any;
    const price = row.close;

    if (!band || !Number.isFinite(perf) || !Number.isFinite(price)) continue;

    const trend = (band.trend === -1 ? -1 : 1) as 1 | -1;
    const label = labelRegime(trend, perf, price);

    inserts.push({
      symbol_id: symbolId,
      timeframe: tf,
      ts: row.ts,
      label,
      features_json: {
        trend,
        factor: factorArr[i],
        perf,
        price,
      },
      model_version: modelVersion,
    });
  }

  if (!inserts.length) return 0;

  const { error } = await supabase
    .from("ta_clusters")
    .upsert(inserts, { onConflict: "symbol_id,timeframe,ts" });

  if (error) throw error;
  return inserts.length;
}

serve(async (req) => {
  const token = req.headers.get("x-job-token");
  const expected = Deno.env.get("JOBS_TOKEN");
  if (!expected || token !== expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "forbidden" }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const { data: gotLock, error: lockErr } = await supabase
    .rpc("try_advisory_lock", { key: LOCK_KEY } as any);

  if (lockErr) {
    return new Response(
      JSON.stringify({ ok: false, error: "lock-error", detail: String(lockErr) }),
      { status: 429 },
    );
  }

  if (!gotLock) {
    return new Response(
      JSON.stringify({ ok: false, error: "lock-busy" }),
      { status: 429 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      tickers?: string[];
      tfs?: TF[];
      limit?: number;
      stai?: Partial<STAIOptions>;
    };

    const tickers = (body.tickers?.length ? body.tickers : DEFAULT_TICKERS).map(
      (t) => t.toUpperCase(),
    );
    const tfs = (body.tfs?.length ? body.tfs : DEFAULT_TF) as TF[];
    const limit = Math.min(Math.max(body.limit ?? 600, 200), 2000);
    const staiOpts: STAIOptions = { ...DEFAULT_STAI, ...(body.stai ?? {}) };

    const results: Array<{ ticker: string; tf: TF; bars: number; inserted: number }>
      = [];

    for (const ticker of tickers) {
      const symbolId = await fetchSymbolId(ticker);
      if (!symbolId) {
        results.push({ ticker, tf: "1h", bars: 0, inserted: 0 });
        continue;
      }

      for (const tf of tfs) {
        const table = tfTable(tf);
        const { data: rows, error } = await supabase
          .from(table)
          .select("ts, open, high, low, close")
          .eq("symbol_id", symbolId)
          .order("ts", { ascending: true })
          .limit(limit);

        if (error || !rows?.length) {
          results.push({ ticker, tf, bars: 0, inserted: 0 });
          continue;
        }

        const bars: Bar[] = rows.map((r: any) => ({
          t: new Date(r.ts).getTime(),
          o: +r.open,
          h: +r.high,
          l: +r.low,
          c: +r.close,
        }));

        if (bars.length < 50) {
          results.push({ ticker, tf, bars: bars.length, inserted: 0 });
          continue;
        }

        const out = supertrendAI(bars, staiOpts);
        const inserted = await persistSTAI(symbolId, tf, rows, out);
        const clustersInserted = await persistClusters(symbolId, tf, rows as any[], out);

        results.push({
          ticker,
          tf,
          bars: rows.length,
          inserted,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }, null, 2),
      { status: 500 },
    );
  } finally {
    try {
      await supabase.rpc("advisory_unlock", { key: LOCK_KEY } as any);
    } catch {
      // ignore unlock errors
    }
  }
});
