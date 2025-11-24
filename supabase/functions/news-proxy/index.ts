import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name",
};

// JBlanked calendar API base host.
// See https://www.jblanked.com/news/api/docs/calendar/
const JBLANKED_BASE_URL = "https://www.jblanked.com";

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
      provider: "jblanked",
      action,
      response_status: status,
      response_time_ms: durationMs,
      error_message: errorMessage ?? null,
      request_params: requestParams ?? null,
    });
  } catch (e) {
    console.error("api_logs insert failed (news-proxy)", e);
  }
}

async function jblankedRequest(path: string, params: Record<string, string | undefined> = {}): Promise<unknown> {
  const apiKey = Deno.env.get("JBLANKED_API_KEY");
  if (!apiKey) {
    throw new Error("JBLANKED_API_KEY not configured in Supabase secrets");
  }

  const url = new URL(path, JBLANKED_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      // JBlanked expects the API key provided as Authorization: Api-Key <key>.
      "Authorization": `Api-Key ${apiKey}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "JBlanked request failed", status: res.status, details: text }), {
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

    if (action === "get_economic_calendar") {
      // Map to JBlanked Forex Factory calendar range endpoint.
      // If a specific date is provided, use it for both from/to.
      const date = (params?.date as string | undefined) ?? new Date().toISOString().split("T")[0];
      result = await jblankedRequest("/news/api/forex-factory/calendar/range/", {
        from: date,
        to: date,
      });
    } else if (action === "get_today_events") {
      // Todays Forex Factory calendar events.
      result = await jblankedRequest("/news/api/forex-factory/calendar/today/");
    } else if (action === "get_high_impact_events") {
      // High-impact events for a given start date; use range endpoint and
      // filter by impact when that query param is supported.
      const startDate = (params?.startDate as string | undefined) ?? new Date().toISOString().split("T")[0];
      result = await jblankedRequest("/news/api/forex-factory/calendar/range/", {
        from: startDate,
        to: startDate,
        impact: "high",
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
