import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_SYMBOL_REGEX = new RegExp(Deno.env.get("APP_ALLOWED_SYMBOL_REGEX") ?? "^[A-Z.\\-]{1,10}$");
const STOCK_FEED = (Deno.env.get("ALPACA_STOCK_FEED") ?? "iex").toLowerCase() === "sip" ? "sip" : "iex";

const Body = z.object({
  symbol: z.string().regex(ALLOWED_SYMBOL_REGEX),
  timeframe: z.enum(["1Min", "5Min", "10Min", "15Min", "1Hour", "4Hour", "1Day"]),
  range: z.string().default("6M"),
  start: z.string().optional(),
  end: z.string().optional(),
});

type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number };
type NormalizedBar = { time: string; open: number; high: number; low: number; close: number; volume: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = Body.parse(await req.json());

    const { start, end, hardCapDays } = computeWindow(body.range, body.start, body.end, body.timeframe);
    const { baseTf, composite } = resolveBaseTimeframe(body.timeframe);

    const bars = await fetchAllBars(body.symbol.toUpperCase(), baseTf, start, end, hardCapDays);
    const normalized = normalizeBars(bars);
    const result = composite ? aggregateBars(normalized, composite.sizeMinutes) : normalized;

    return json(
      { bars: result, baseTimeframe: baseTf, aggregated: Boolean(composite) },
      200,
      { "Cache-Control": "public, max-age=15" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad Request";
    return json({ error: message }, 400);
  }
});

function json(obj: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...headers },
  });
}

function resolveBaseTimeframe(tf: string): { baseTf: string; composite?: { sizeMinutes: number } } {
  if (tf === "10Min") return { baseTf: "1Min", composite: { sizeMinutes: 10 } };
  if (tf === "4Hour") return { baseTf: "1Hour", composite: { sizeMinutes: 240 } };
  return { baseTf: tf };
}

function computeWindow(range: string, start?: string, end?: string, tf?: string) {
  if (start && end) {
    const bounded = boundWindow(start, end, tf);
    return { start: bounded.start, end: bounded.end, hardCapDays: bounded.hardCapDays };
  }

  const now = new Date();
  const endIso = now.toISOString();
  const map: Record<string, number> = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "2Y": 730,
    "5Y": 1825,
    "10Y": 3650,
    "MAX": 3650,
  };
  const days = map[range.toUpperCase?.() ?? ""] ?? 180;

  // Cap granular timeframes so pagination stays bounded.
  const cap =
    tf === "1Min" || tf === "5Min" || tf === "10Min" || tf === "15Min"
      ? Math.min(days, 90)
      : tf === "1Hour" || tf === "4Hour"
        ? Math.min(days, 365)
        : days;

  const startIso = new Date(now.getTime() - cap * 86_400_000).toISOString();
  return { start: startIso, end: endIso, hardCapDays: cap };
}

function boundWindow(start: string, end: string, tf?: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid date range");
  }
  const msPerDay = 86_400_000;
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay));
  const cap =
    tf === "1Min" || tf === "5Min" || tf === "10Min" || tf === "15Min"
      ? Math.min(diffDays, 90)
      : tf === "1Hour" || tf === "4Hour"
        ? Math.min(diffDays, 365)
        : Math.min(diffDays, 3650);
  const boundedStart = new Date(endDate.getTime() - cap * msPerDay).toISOString();
  return { start: boundedStart, end: endDate.toISOString(), hardCapDays: cap };
}

async function fetchAllBars(symbol: string, timeframe: string, start: string, end: string, hardCapDays: number) {
  const base = Deno.env.get("ALPACA_BASE") ?? "https://data.alpaca.markets";
  const key = Deno.env.get("ALPACA_KEY_ID");
  const secret = Deno.env.get("ALPACA_SECRET_KEY");
  if (!key || !secret) throw new Error("Missing Alpaca credentials");

  const url = new URL(`${base}/v2/stocks/${encodeURIComponent(symbol)}/bars`);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  url.searchParams.set("limit", "10000");
  url.searchParams.set("adjustment", "split");
  url.searchParams.set("feed", STOCK_FEED);
  url.searchParams.set("sort", "asc");

  const out: AlpacaBar[] = [];
  let page: string | null = null;
  let rounds = 0;
  const maxRounds = Math.max(5, Math.ceil(hardCapDays / 30));

  while (true) {
    const u = new URL(url);
    if (page) u.searchParams.set("page_token", page);

    const res = await fetch(u.toString(), {
      headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
    });
    if (!res.ok) throw new Error(`Alpaca ${res.status}`);

    const json = await res.json();
    if (Array.isArray(json?.bars)) out.push(...json.bars);
    page = json?.next_page_token ?? null;
    rounds++;

    if (!page || rounds >= maxRounds) break;
  }

  return out;
}

function normalizeBars(bars: AlpacaBar[]): NormalizedBar[] {
  return bars.map((b) => ({
    time: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v ?? 0,
  }));
}

function aggregateBars(bars: NormalizedBar[], sizeMinutes: number) {
  const bucketMs = sizeMinutes * 60_000;
  const agg: NormalizedBar[] = [];
  let cur: NormalizedBar | null = null;

  for (const b of bars) {
    const t = new Date(b.time);
    const bucketStart = Math.floor(t.getTime() / bucketMs) * bucketMs;
    const bucketIso = new Date(bucketStart).toISOString();

    if (!cur || cur.time !== bucketIso) {
      if (cur) agg.push(cur);
      cur = { time: bucketIso, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume ?? 0;
    }
  }

  if (cur) agg.push(cur);
  return agg;
}
