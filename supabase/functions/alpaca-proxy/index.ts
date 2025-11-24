import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name",
};

const ALPACA_DATA_URL = "https://data.alpaca.markets";

async function logApiCall(
  supabase: ReturnType<typeof createClient>,
  action: string,
  status: number,
  durationMs: number,
  errorMessage?: string,
  requestParams?: unknown,
) {
  try {
    await supabase.from("api_logs").insert({
      provider: "alpaca",
      action,
      response_status: status,
      response_time_ms: durationMs,
      error_message: errorMessage ?? null,
      request_params: requestParams ?? null,
    });
  } catch (e) {
    console.error("api_logs insert failed (alpaca-proxy)", e);
  }
}

async function alpacaRequest(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
  const keyId = Deno.env.get("ALPACA_KEY_ID");
  const secretKey = Deno.env.get("ALPACA_SECRET_KEY");

  if (!keyId || !secretKey) {
    throw new Error("ALPACA_KEY_ID or ALPACA_SECRET_KEY not configured in Supabase secrets");
  }

  const url = new URL(path, ALPACA_DATA_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "APCA-API-KEY-ID": keyId,
      "APCA-API-SECRET-KEY": secretKey,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "Alpaca request failed", status: res.status, details: text }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { action, params } = (await req.json()) as {
      action?: string;
      params?: Record<string, unknown>;
    };

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing 'action' in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: unknown;

    if (action === "get_bars") {
      const symbol = String(params?.symbol ?? "");
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await alpacaRequest(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, {
        timeframe: (params?.timeframe as string | undefined) ?? "1Day",
        start: params?.start as string | undefined,
        end: params?.end as string | undefined,
        limit: params?.limit as number | undefined,
      });
    } else if (action === "get_latest_quote") {
      const symbol = String(params?.symbol ?? "");
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await alpacaRequest(`/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`);
    } else if (action === "get_latest_trade") {
      const symbol = String(params?.symbol ?? "");
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await alpacaRequest(`/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`);
    } else if (action === "get_snapshot") {
      const symbolsInput = params?.symbols;
      const symbols = Array.isArray(symbolsInput)
        ? symbolsInput.map(String)
        : [String(symbolsInput ?? "")].filter(Boolean);

      if (!symbols.length) {
        return new Response(JSON.stringify({ error: "symbols is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await alpacaRequest("/v2/stocks/snapshots", {
        symbols: symbols.join(","),
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration = Date.now() - startedAt;
    await logApiCall(supabase, action, 200, duration, undefined, params);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const duration = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error";

    const status = err instanceof Response ? err.status : 500;

    await logApiCall(supabase, "error", status, duration, message);

    if (err instanceof Response) {
      return err;
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
