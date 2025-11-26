# SPEC-1B — Edge Functions & Alerts (Hybrid Vendor)

## Goal
Ship production-ready Supabase Edge Functions for Bollinger, KDJ, Supertrend AI, and an idempotent alerts evaluator, using a hybrid vendor pipeline so Deno bundles stay small and deterministic while keeping a single TypeScript source of truth (`packages/indicators-ts`).

## Why Hybrid Vendor?

- **Single source of truth**: indicators live in `packages/indicators-ts` with tests.
- **Edge-safe output**: build to pure ESM and vendor the compiled JS into each function’s `/_indicators/` folder.
- **Tiny, predictable bundles**: Deno imports local ESM, no Node deps or path alias issues.

---

## Scope

### Endpoints

- `GET /indicators/bbands` → `{ ts, mid, upper, lower, pct_b, bandwidth }[]`
- `GET /indicators/kdj` → `{ ts, k, d, j }[]`
- `GET /regimes/supertrend` → `{ bands, factor, perf, cluster }`
- `POST|GET /alerts-evaluate` → upserts into `alert_events` (idempotent per bar)

### Database

- Optional TA caches: `ta_bbands`, `ta_kdj`, `ta_supertrend_ai`
- Idempotency: unique index on `alert_events (alert_id, symbol_id, timeframe, bar_ts)`

### Build & Deploy

- `pnpm edge:vendor` to build & copy ESM indicators into functions
- `supabase functions deploy …` to push all endpoints

---

## Repo Changes

### 1) Root `package.json` additions

```jsonc
{
  "name": "stock-whisperer",
  "private": true,
  "workspaces": ["frontend", "packages/*"],
  "scripts": {
    "edge:vendor": "pnpm -w --silent --filter ./packages/indicators-ts build:edge && node scripts/vendor-indicators.js",
    "deploy:functions": "pnpm edge:vendor && supabase functions deploy indicators-bbands indicators-kdj regimes-supertrend alerts-evaluate"
  }
}
```

If you already have scripts/workspaces, just merge these entries.

### 2) `packages/indicators-ts` edge build

Create `packages/indicators-ts/tsconfig.edge.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ES2020",
    "target": "ES2020",
    "moduleResolution": "Bundler",
    "outDir": "dist/edge",
    "declaration": true,
    "declarationMap": false,
    "sourceMap": false,
    "lib": ["ES2020"],
    "types": [],
    "skipLibCheck": true,
    "noEmitOnError": true
  },
  "include": ["**/*.ts"],
  "exclude": ["dist", "**/__tests__/**"]
}
```

Add a `build:edge` script to `packages/indicators-ts/package.json`:

```jsonc
{
  "name": "@indicators/ts",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build:edge": "tsc -p tsconfig.edge.json"
  }
}
```

Assumes your indicators (Bollinger, KDJ, Supertrend, Supertrend AI) are already implemented and tested in `packages/indicators-ts`.

### 3) Vendor script

Create `scripts/vendor-indicators.js`:

```js
// scripts/vendor-indicators.js
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "packages", "indicators-ts", "dist", "edge");

const functions = [
  "indicators-bbands",
  "indicators-kdj",
  "regimes-supertrend",
  "alerts-evaluate"
];

for (const fn of functions) {
  const dest = path.join(repoRoot, "supabase", "functions", fn, "_indicators");
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith(".js") || file.endsWith(".d.ts") || file.endsWith(".map")) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dest, file));
    }
  }
  console.log(`[vendor] Copied indicators to ${dest}`);
}
```

---

## Edge Functions (paste-ready)

All functions expect `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Edge env.

Timeframe mapping assumes tables: `candles`, `candles_5m`, `candles_10m`, `candles_1h`, `candles_4h`, `candles_1d`.

### Shared helpers (inline per function)

```ts
const tfTable = (tf: string) => ({
  '1m': 'candles',
  '5m': 'candles_5m',
  '10m': 'candles_10m',
  '1h': 'candles_1h',
  '4h': 'candles_4h',
  '1d': 'candles_1d'
}[tf] ?? 'candles');

async function symbolId(supabase: any, ticker: string) {
  const { data, error } = await supabase
    .from('symbols')
    .select('id')
    .eq('ticker', ticker)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}
```

### A) `supabase/functions/indicators-bbands/index.ts`

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bollinger } from "./_indicators/bollinger.js";

const tfTable = (tf: string) => ({ '1m':'candles','5m':'candles_5m','10m':'candles_10m','1h':'candles_1h','4h':'candles_4h','1d':'candles_1d' }[tf] ?? 'candles');
async function symbolId(supabase: any, ticker: string) { const { data } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle(); return data?.id ?? null; }

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

    if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    const sid = await symbolId(supabase, symbol);
    if (!sid) return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });

    const table = tfTable(tf);
    const { data: rows, error } = await supabase
      .from(table)
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
```

### B) `supabase/functions/indicators-kdj/index.ts`

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kdj } from "./_indicators/kdj.js";

const tfTable = (tf: string) => ({ '1m':'candles','5m':'candles_5m','10m':'candles_10m','1h':'candles_1h','4h':'candles_4h','1d':'candles_1d' }[tf] ?? 'candles');
async function symbolId(supabase: any, ticker: string) { const { data } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle(); return data?.id ?? null; }

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(url, key);
    const u = new URL(req.url);
    const symbol = u.searchParams.get('symbol');
    const tf = u.searchParams.get('tf') ?? '1h';
    const n = +(u.searchParams.get('n') ?? 9);
    const m = +(u.searchParams.get('m') ?? 3);
    const l = +(u.searchParams.get('l') ?? 3);
    const mode = (u.searchParams.get('mode') ?? 'ema') as 'ema' | 'rma';

    if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    const sid = await symbolId(supabase, symbol);
    if (!sid) return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });

    const table = tfTable(tf);
    const { data: rows, error } = await supabase
      .from(table)
      .select('ts, high, low, close')
      .eq('symbol_id', sid)
      .order('ts', { ascending: true })
      .limit(5000);
    if (error) throw error;

    const ts = (rows ?? []).map((r: any) => r.ts);
    const high = (rows ?? []).map((r: any) => +r.high);
    const low = (rows ?? []).map((r: any) => +r.low);
    const close = (rows ?? []).map((r: any) => +r.close);

    const out = kdj(high, low, close, n, m, l, mode);
    const merged = ts.map((t: string, i: number) => ({
      ts: t,
      k: out.K[i],
      d: out.D[i],
      j: out.J[i],
    }));

    return new Response(JSON.stringify(merged), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
```

### C) `supabase/functions/regimes-supertrend/index.ts` (uses Supertrend AI)

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supertrendAI } from "./_indicators/supertrend_ai.js";

type Bar = { t: number; o: number; h: number; l: number; c: number };
const tfTable = (tf: string) => ({ '1m':'candles','5m':'candles_5m','10m':'candles_10m','1h':'candles_1h','4h':'candles_4h','1d':'candles_1d' }[tf] ?? 'candles');
async function symbolId(supabase: any, ticker: string) { const { data } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle(); return data?.id ?? null; }

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(url, key);
    const u = new URL(req.url);
    const symbol = u.searchParams.get('symbol');
    const tf = u.searchParams.get('tf') ?? '1h';

    if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
    const sid = await symbolId(supabase, symbol);
    if (!sid) return new Response(JSON.stringify({ error: 'symbol not found' }), { status: 404 });

    const table = tfTable(tf);
    const { data: rows, error } = await supabase
      .from(table)
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
    if (bars.length < 50)
      return new Response(JSON.stringify({ error: 'insufficient data' }), {
        status: 422,
      });

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
    return new Response(JSON.stringify(out), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
```

### D) `supabase/functions/alerts-evaluate/index.ts` (idempotent upsert)

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kdj } from "./_indicators/kdj.js";
import { bollinger } from "./_indicators/bollinger.js";
import { supertrendAI } from "./_indicators/supertrend_ai.js";

type Bar = { t: number; o: number; h: number; l: number; c: number };
const tfTable = (tf: string) => ({ '1m':'candles','5m':'candles_5m','10m':'candles_10m','1h':'candles_1h','4h':'candles_4h','1d':'candles_1d' }[tf] ?? 'candles');
async function symbolId(supabase: any, ticker: string) { const { data } = await supabase.from('symbols').select('id').eq('ticker', ticker).maybeSingle(); return data?.id ?? null; }
function barOpen(tsStr: string, tf: string): string { return tsStr; } // adjust if DB holds bar-close

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
    if (!sid)
      return new Response(JSON.stringify({ error: 'symbol not found' }), {
        status: 404,
      });

    const table = tfTable(tf);
    const { data: rows, error } = await supabase
      .from(table)
      .select('ts, open, high, low, close')
      .eq('symbol_id', sid)
      .order('ts', { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!rows || rows.length < 40)
      return new Response(JSON.stringify({ error: 'insufficient data' }), {
        status: 422,
      });

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
          const_sorted = [...finite].sort((a, b) => a - b);
          const cut = _sorted[Math.floor(((cond.bw_pctile ?? 5) / 100) * _sorted.length)];
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
              payload_json: { symbol, tf, type: 'supertrend_flip', dir: cur },
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
```

---

## Database Migration (paste-ready SQL)

Create `supabase/migrations/20xx_1B_ta_and_alerts.sql`:

```sql
-- TA caches (optional)
create table if not exists public.ta_bbands (
  symbol_id bigint not null,
  timeframe text not null,
  ts timestamptz not null,
  mid numeric(18,6), upper numeric(18,6), lower numeric(18,6),
  pct_b numeric(12,8), bandwidth numeric(12,8),
  primary key (symbol_id, timeframe, ts)
);

create table if not exists public.ta_kdj (
  symbol_id bigint not null,
  timeframe text not null,
  ts timestamptz not null,
  k numeric(12,8), d numeric(12,8), j numeric(12,8),
  primary key (symbol_id, timeframe, ts)
);

create table if not exists public.ta_supertrend_ai (
  symbol_id bigint not null references public.symbols(id) on delete cascade,
  timeframe text not null,
  ts timestamptz not null,
  factor numeric(12,6) not null,
  perf numeric(18,8) not null,
  cluster text not null check (cluster in ('LOW','AVG','TOP')),
  primary key (symbol_id, timeframe, ts)
);

create index if not exists ta_stai_idx
  on public.ta_supertrend_ai(symbol_id, timeframe, ts desc);

-- Alert idempotency
alter table public.alert_events
  add column if not exists symbol_id bigint,
  add column if not exists timeframe text,
  add column if not exists bar_ts timestamptz;

create unique index if not exists alert_events_uniq
  on public.alert_events (alert_id, symbol_id, timeframe, bar_ts);
```

---

## Deploy & Test

### Build + Vendor

```bash
pnpm edge:vendor
```

### Deploy

```bash
supabase functions deploy indicators-bbands indicators-kdj regimes-supertrend alerts-evaluate
```

### Quick Checks (curl)

```bash
curl "$EDGE_BASE_URL/indicators-bbands?symbol=AAPL&tf=4h&n=20&k=2"
curl "$EDGE_BASE_URL/indicators-kdj?symbol=AAPL&tf=10m&n=9&m=3&l=3&mode=ema"
curl "$EDGE_BASE_URL/regimes-supertrend?symbol=AAPL&tf=1h&atr=10&fmin=1&fmax=5&fstep=0.5&alpha=0.2"
curl -X POST "$EDGE_BASE_URL/alerts-evaluate" -H 'content-type: application/json' \
  --data '{"symbol":"AAPL","tf":"1h"}'
```

---

## Operational Notes

- **Env secrets**: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for each function.
- **Bar timestamp (`bar_ts`)**: we assume your candle `ts` is bar-open UTC. If it’s bar-close, normalize in `barOpen()` to avoid duplicate event keys.
- **Limits**: functions cap at 5k bars per request; tune if needed.
- **Security**: never expose service role key to the client; call via server or Edge only.
- **Observability**: log symbol, tf, count of rows, and elapsed ms per request (add minimal logging as needed).
- **Cron**: schedule `alerts-evaluate` by TF using `pg_cron` or your preferred scheduler (e.g., every 1 min for 1m/5m; 5–10 min for 10m/1h/4h; daily for 1d).
- **Idempotency**: guaranteed by DB unique index + upsert; safe for retries.

---

## Appendix — API Contracts

### `/indicators/bbands` (GET)

- **Query**: `symbol`, `tf`, `n=20`, `k=2`
- **Response**: `[{ ts, mid, upper, lower, pct_b, bandwidth }]`

### `/indicators/kdj` (GET)

- **Query**: `symbol`, `tf`, `n=9`, `m=3`, `l=3`, `mode=ema|rma`
- **Response**: `[{ ts, k, d, j }]`

### `/regimes/supertrend` (GET)

- **Query**: `symbol`, `tf`, `atr=10`, `fmin=1`, `fmax=5`, `fstep=0.5`, `alpha=0.2`
- **Response**: `{ bands: {t,upper,lower,trend}[], factor:number[], perf:number[], cluster:('LOW'|'AVG'|'TOP')[] }`

### `/alerts-evaluate` (POST/GET)

- **Body/Query**: `{ symbol, tf }`
- **Effect**: Upserts rows into `alert_events` keyed by `(alert_id, symbol_id, timeframe, bar_ts)`.

---

## What’s Next

- Optional frontend API proxies (`/api/indicators/*`) to avoid CORS in dev.
- Add lightweight rate limiting on public endpoints.
- Persist STAI per-bar `f*` to `ta_supertrend_ai` if you want historical audit of factor selection.
- Wire push notifications if you’re ready (use your existing notifier worker).

---

_End of SPEC-1B (Hybrid Vendor) – PR-ready._
