import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

// JWT-verified function: we use the caller's access token
// so RLS applies as the user.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/?options-watchlist\/?/, "");
    const method = req.method.toUpperCase();
    const auth = req.headers.get("authorization") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Routes:
    // GET /            → lists user watchlists + items
    // POST /           → { name } → create list
    // POST /:id/items  → { contract_ids: number[], note? } → add items
    // DELETE /:id      → delete list
    // DELETE /:id/items → { contract_ids: number[] } → remove items

    if (method === "GET" && (path === "" || path === "/")) {
      const { data: lists, error } = await supabase
        .from("options_watchlist")
        .select(`
          id, name, created_at,
          items:options_watchlist_items(
            id, contract_id, note, created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, lists });
    }

    if (method === "POST" && (path === "" || path === "/")) {
      const { name } = await req.json().catch(() => ({} as { name?: string }));
      if (!name) return json({ ok: false, error: "name required" }, 400);

      const { data, error } = await supabase
        .from("options_watchlist")
        .insert({ name })
        .select("id, name, created_at")
        .single();

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, list: data });
    }

    const mItems = path.match(/^\/?([^/]+)\/items\/?$/);
    const mList = path.match(/^\/?([^/]+)\/?$/);

    if (method === "POST" && mItems) {
      const id = mItems[1];
      const body = await req.json().catch(() => ({} as { contract_ids?: number[]; note?: string }));
      const ids = body.contract_ids ?? [];
      if (!ids.length) return json({ ok: false, error: "contract_ids required" }, 400);

      const rows = ids.map((cid: number) => ({ watchlist_id: id, contract_id: cid, note: body.note ?? null }));
      const { data, error } = await supabase
        .from("options_watchlist_items")
        .insert(rows)
        .select("id, contract_id, note, created_at");

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, added: data });
    }

    if (method === "DELETE" && mItems) {
      const id = mItems[1];
      const body = await req.json().catch(() => ({} as { contract_ids?: number[] }));
      const ids = body.contract_ids ?? [];
      if (!ids.length) return json({ ok: false, error: "contract_ids required" }, 400);

      const { error } = await supabase
        .from("options_watchlist_items")
        .delete()
        .in("contract_id", ids)
        .eq("watchlist_id", id);

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, removed: ids.length });
    }

    if (method === "DELETE" && mList) {
      const id = mList[1];
      const { error } = await supabase
        .from("options_watchlist")
        .delete()
        .eq("id", id);

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, deleted: id });
    }

    return json({ ok: false, error: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
