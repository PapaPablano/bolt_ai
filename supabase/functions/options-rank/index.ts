/// <reference lib="deno.ns" />

import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { rankOptions, type Contract, type Side } from "../../../packages/options-math-ts/index.ts";

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

    const ivHistory = (ivh ?? []).map((x: any) => x.iv_30d as number);

    const { data: rows, error: rowsErr } = await supabase
      .from("options_contracts")
      .select(
        "id, right, strike, expiry, options_quotes(bid,ask,iv,delta,oi,vol)",
      )
      .eq("symbol_id", sym.id);

    if (rowsErr) return json({ ok: false, error: String(rowsErr) }, 500);

    const now = new Date();
    const contracts: Contract[] = (rows ?? [])
      .filter((r: any) => r.right === (side === "call" ? "C" : "P"))
      .map((r: any) => {
        const dte = Math.max(
          0,
          Math.round((Date.parse(r.expiry) - now.getTime()) / 86400000),
        );
        return {
          id: r.id,
          strike: r.strike,
          expiry: r.expiry,
          dte,
          bid: r.options_quotes?.bid ?? 0,
          ask: r.options_quotes?.ask ?? 0,
          iv: r.options_quotes?.iv ?? 0,
          oi: r.options_quotes?.oi ?? 0,
          vol: r.options_quotes?.vol ?? 0,
          delta: r.options_quotes?.delta ?? undefined,
        } satisfies Contract;
      })
      .filter((c: Contract) => c.dte >= dteMin && c.dte <= dteMax);

    const spot = spotParam || 0;

    const ranked = rankOptions({
      side,
      contracts,
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
      results: ranked,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
