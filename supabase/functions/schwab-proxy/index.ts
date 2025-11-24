import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name",
};

const SCHWAB_API_BASE_URL = "https://api.schwabapi.com/marketdata/v1";
const SCHWAB_OAUTH_BASE_URL = "https://api.schwabapi.com/v1/oauth";

interface RpcTokenRow {
  token_value: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
}

async function logApiCall(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  action: string,
  status: number,
  durationMs: number,
  errorMessage?: string,
  requestParams?: unknown,
) {
  try {
    await supabase.from("api_logs").insert({
      provider,
      action,
      response_status: status,
      response_time_ms: durationMs,
      error_message: errorMessage ?? null,
      request_params: requestParams ?? null,
    });
  } catch (e) {
    console.error("api_logs insert failed", e);
  }
}

async function getTokenRow(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  tokenType: string,
): Promise<RpcTokenRow | null> {
  const { data, error } = await supabase.rpc("get_api_token", {
    p_provider: provider,
    p_token_type: tokenType,
  });

  if (error) {
    console.error("get_api_token RPC error", error);
    throw error;
  }

  const row = (data as RpcTokenRow[] | null)?.[0] ?? null;
  return row;
}

async function upsertToken(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  tokenType: string,
  value: string,
  expiresAt: string | null,
) {
  const { error } = await supabase.rpc("upsert_api_token", {
    p_provider: provider,
    p_token_type: tokenType,
    p_token_value: value,
    p_expires_at: expiresAt,
  });
  if (error) {
    console.error("upsert_api_token RPC error", error);
    throw error;
  }
}

function isExpired(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return true;
  const ts = Date.parse(expiresAtIso);
  if (Number.isNaN(ts)) return true;
  const now = Date.now();
  const skewMs = 60_000; // 60s skew
  return now >= ts - skewMs;
}

async function refreshSchwabAccessToken(
  supabase: ReturnType<typeof createClient>,
  refreshToken: string,
): Promise<string> {
  const clientId = Deno.env.get("SCHWAB_KEY_ID") ?? "";
  const clientSecret = Deno.env.get("SCHWAB_SECRET_KEY") ?? "";
  const redirectUri = Deno.env.get("SCHWAB_REDIRECT_URI") ?? "https://localhost";

  if (!clientId || !clientSecret) {
    throw new Error("SCHWAB_KEY_ID or SCHWAB_SECRET_KEY not configured in secrets");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${SCHWAB_OAUTH_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Schwab refresh failed", res.status, text);
    throw new Error(`Schwab token refresh failed: ${res.status}`);
  }

  const json = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const now = Date.now();
  const expiresInSec = json.expires_in ?? 1800;
  const expiresAtIso = new Date(now + expiresInSec * 1000).toISOString();

  await upsertToken(supabase, "schwab", "access", json.access_token, expiresAtIso);

  if (json.refresh_token) {
    await upsertToken(supabase, "schwab", "refresh", json.refresh_token, null);
  }

  return json.access_token;
}

async function getValidSchwabAccessToken(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const accessRow = await getTokenRow(supabase, "schwab", "access");

  if (accessRow?.token_value && !isExpired(accessRow.expires_at)) {
    return accessRow.token_value;
  }

  const refreshRow = await getTokenRow(supabase, "schwab", "refresh");
  if (!refreshRow?.token_value) {
    throw new Error("No Schwab refresh token available. Run schwab-auth flow first.");
  }

  return refreshSchwabAccessToken(supabase, refreshRow.token_value);
}

async function schwabGetQuote(accessToken: string, symbols: string[]): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/quotes`);
  url.searchParams.set("symbols", symbols.join(","));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "Schwab quotes failed", status: res.status, details: text }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return res.json();
}

async function schwabGetPriceHistory(
  accessToken: string,
  symbol: string,
  params: {
    periodType?: string;
    period?: string;
    frequencyType?: string;
    frequency?: string;
  },
): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/pricehistory/${encodeURIComponent(symbol)}`);
  if (params.periodType) url.searchParams.set("periodType", params.periodType);
  if (params.period) url.searchParams.set("period", params.period);
  if (params.frequencyType) url.searchParams.set("frequencyType", params.frequencyType);
  if (params.frequency) url.searchParams.set("frequency", params.frequency);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "Schwab price history failed", status: res.status, details: text }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return res.json();
}

async function schwabGetMarketHours(
  accessToken: string,
  markets?: string,
  date?: string,
): Promise<unknown> {
  const url = new URL(`${SCHWAB_API_BASE_URL}/markets`);
  if (markets) url.searchParams.set("markets", markets);
  if (date) url.searchParams.set("date", date);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "Schwab market hours failed", status: res.status, details: text }), {
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const startedAt = Date.now();

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

    const accessToken = await getValidSchwabAccessToken(supabase);

    let result: unknown;

    if (action === "get_quote") {
      const symbolsInput = params?.symbols ?? params?.symbol;
      const symbols = Array.isArray(symbolsInput)
        ? symbolsInput.map(String)
        : [String(symbolsInput ?? "")].filter(Boolean);

      if (!symbols.length) {
        return new Response(JSON.stringify({ error: "symbols or symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await schwabGetQuote(accessToken, symbols);
    } else if (action === "get_price_history") {
      const symbol = String(params?.symbol ?? "");
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      result = await schwabGetPriceHistory(accessToken, symbol, {
        periodType: params?.periodType as string | undefined,
        period: params?.period as string | undefined,
        frequencyType: params?.frequencyType as string | undefined,
        frequency: params?.frequency as string | undefined,
      });
    } else if (action === "get_market_hours") {
      result = await schwabGetMarketHours(
        accessToken,
        params?.markets as string | undefined,
        params?.date as string | undefined,
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration = Date.now() - startedAt;
    await logApiCall(supabase, "schwab", action, 200, duration, undefined, params);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const duration = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error";

    await logApiCall(supabase, "schwab", "error", 500, duration, message);

    if (err instanceof Response) {
      // Error thrown as Response from helper
      return err;
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
