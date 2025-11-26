/// <reference lib="deno.ns" />

import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { rankOptions, type Contract, type Side } from "../../../packages/options-math-ts/index.ts";

type IVRow = { iv_30d: number };

type QuoteRow = {
  bid: number | null;
  ask: number | null;
  iv: number | null;
  delta: number | null;
  oi: number | null;
  vol: number | null;
  updated_at?: string | null; // NEW
};

type OptionRow = {
  id: number;
  right: "C" | "P";
  strike: number;
  expiry: string;
  options_quotes: QuoteRow | QuoteRow[] | null;
};

// helper type so we can carry lastQuoteAt through filters
type Mapped = Contract & { lastQuoteAt?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const side = (url.searchParams.get("side") || "call") as Side;
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const dteMin = Number(url.searchParams.get("dteMin") ?? 45);
    const dteMax = Number(url.searchParams.get("dteMax") ?? 90);
    const top = Number(url.searchParams.get("top") ?? 30);
    const spotParam = Number(url.searchParams.get("spot") ?? "0");
    const r = Number(url.searchParams.get("r") ?? "0.045");

    if (!symbol) return json({ ok: false, error: "missing symbol" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sym, error: symErr } = await supabase
      .from("symbols")
      .select("id")
      .eq("ticker", symbol)
      .maybeSingle();

    if (symErr) return json({ ok: false, error: String(symErr) }, 500);
    if (!sym) return json({ ok: false, error: "unknown symbol" }, 404);

    const today = new Date().toISOString().slice(0, 10);

    const { data: earn } = await supabase
      .from("earnings_events")
      .select("announce_date")
      .eq("symbol_id", sym.id)
      .gte("announce_date", today)
      .order("announce_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const daysToEarnings = earn
      ? Math.round((Date.parse(earn.announce_date) - Date.now()) / 86400000)
      : null;

    const { data: ivh, error: ivErr } = await supabase
      .from("iv_history")
      .select("iv_30d")
      .eq("symbol_id", sym.id)
      .order("as_of", { ascending: true })
      .limit(252);

    if (ivErr) return json({ ok: false, error: String(ivErr) }, 500);

    const ivHistory = ((ivh as IVRow[] | null) ?? []).map((x) => x.iv_30d);

    const { data: rows, error: rowsErr } = await supabase
      .from("options_contracts")
      .select(
        "id, right, strike, expiry, options_quotes!options_quotes_contract_fk!inner(bid,ask,iv,delta,oi,vol,updated_at)",
      )
      .eq("symbol_id", sym.id);

    if (rowsErr) return json({ ok: false, error: rowsErr }, 500);

    const now = new Date();
    const rawRows = ((rows as OptionRow[] | null) ?? []);

    const staleMaxMinRaw = url.searchParams.get("staleMaxMin");
    const staleMaxMin = staleMaxMinRaw ? Number(staleMaxMinRaw) : NaN;
    const dropStale = Number.isFinite(staleMaxMin) && staleMaxMin > 0;

    const debug = url.searchParams.get("debug") === "1";
    const counters = {
      total: rawRows.length,
      sideFiltered: 0,
      dteFiltered: 0,
      quotePresent: 0,
      quoteQualityPass: 0,
      dropped: {
        noQuote: 0,
        zeroAsk: 0,
        zeroIv: 0,
        zeroOi: 0,
        stale: 0,
      },
    };

    const sideWanted = side === "call" ? "C" : "P";
    const sideRows = rawRows.filter((r) => r.right === sideWanted);
    counters.sideFiltered = sideRows.length;

    const mapped: Mapped[] = sideRows.map((r) => {
      const dte = Math.max(
        0,
        Math.round((Date.parse(r.expiry) - now.getTime()) / 86400000),
      );

      const oq = r.options_quotes as QuoteRow | QuoteRow[] | null;
      const q: QuoteRow | null = Array.isArray(oq) ? (oq[0] ?? null) : (oq ?? null);

      if (!q) counters.dropped.noQuote++;
      else counters.quotePresent++;

      const bid = q?.bid ?? 0;
      const ask = q?.ask ?? 0;
      const iv = q?.iv ?? 0;
      const oi = q?.oi ?? 0;
      const vol = q?.vol ?? 0;
      const delta = q?.delta ?? undefined;
      const lastQuoteAt = q?.updated_at ?? undefined;

      return {
        id: r.id,
        strike: r.strike,
        expiry: r.expiry,
        dte,
        bid,
        ask,
        iv,
        oi,
        vol,
        delta,
        lastQuoteAt,
      } as Mapped;
    });

    const inWindow: Mapped[] = mapped.filter((c) => c.dte >= dteMin && c.dte <= dteMax);
    counters.dteFiltered = inWindow.length;

    const quality: Mapped[] = inWindow.filter((c) => {
      if (c.ask <= 0) {
        counters.dropped.zeroAsk++;
        return false;
      }
      if (c.iv <= 0) {
        counters.dropped.zeroIv++;
        return false;
      }
      if (c.oi <= 0) {
        counters.dropped.zeroOi++;
        return false;
      }
      if (dropStale) {
        const ageMin = c.lastQuoteAt
          ? (now.getTime() - Date.parse(c.lastQuoteAt)) / 60000
          : Infinity;
        if (ageMin > staleMaxMin) {
          counters.dropped.stale++;
          return false;
        }
      }
      return true;
    });
    counters.quoteQualityPass = quality.length;

    let spot = spotParam || 0;

    if (!spot) {
      const { data: px } = await supabase
        .from("price_history")
        .select("close_price, datetime")
        .eq("symbol", symbol)
        .order("datetime", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (px?.close_price) spot = Number(px.close_price) || 0;
    }

    const ranked = rankOptions({
      side,
      contracts: quality,
      spot,
      r,
      ivHistory,
      daysToEarnings,
      correlationGuard: true,
      emMode: "bonus",
    }).slice(0, top);

    return json({
      ok: true,
      symbol,
      side,
      dteMin,
      dteMax,
      count: ranked.length,
      spotUsed: spot,
      ...(debug ? { debug: counters } : {}),
      results: ranked,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
