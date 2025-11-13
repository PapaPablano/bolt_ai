# Stock Whisperer – Backend & Data Services

This repository contains the backend-only portion of Stock Whisperer.  
All browser-facing code has been removed so the project now focuses on:

- Supabase Edge Functions for quotes, news, signals, and caching
- Schwab API OAuth, REST, and streaming clients
- Supabase persistence helpers and schema
- Local TypeScript utilities and smoke-test scripts

If you are looking for the React dashboard or any Lovable-generated UI, use the original `stock-whisperer-ai-04` repo instead.

---

## Repository Layout

- `supabase/` – Edge Functions, migrations, and project config (Deno)
- `project/src/schwab-api/` – OAuth client, REST helpers, and WebSocket streamer
- `project/src/supabase/` – Database helpers and SQL schema for market data tables
- `project/src/config/` – Environment-driven configuration for Schwab integrations
- `scripts/` – Node/TypeScript utilities for invoking and smoke-testing functions
- `docs/` – Architecture notes, API references, and integration guides
- `insert_alpaca_debug.sh` – Helper to inject Alpaca env diagnostics into Edge Functions

Front-end directories such as `src/`, `public/`, Vite config, Tailwind config, and UI components have been removed.

---

## Getting Started

```bash
git clone <new-backend-repo-url>
cd stock-whisperer-backend
npm install

# Copy env template if needed
cp .env.local .env
```

Populate the following environment variables locally (and inside Supabase secrets):

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
SCHWAB_CLIENT_ID=<schwab-app-id>
SCHWAB_CLIENT_SECRET=<schwab-app-secret>
SCHWAB_REDIRECT_URI=<https://127.0.0.1:8080/callback>
```

Refer to `docs/ALPACA_INTEGRATION.md` and `docs/SUPABASE_SETUP.md` for the full list of Alpaca/Supabase variables.

---

## Useful Scripts

| Command | Description |
| ------- | ----------- |
| `npm run smoke` | Invokes a suite of Supabase Edge Functions (quotes, news, ML signals, etc.) via the hosted project. |
| `npm run invoke stock-quote '{"symbol":"AAPL"}'` | Manually call any deployed Edge Function with a JSON payload. |
| `npm run lint` | Type-checks and lints the TypeScript sources for scripts and Schwab helpers. |

Scripts rely on `@supabase/supabase-js` and `dotenv`, so ensure your `.env` file mirrors the Supabase project secrets.

---

## Supabase Edge Functions

Each function lives under `supabase/functions/<name>` with its own `deno.json`/`import_map.json`.  
Deploy using the Supabase CLI from this repository:

```bash
supabase functions deploy stock-quote --project-ref <project-ref>
supabase secrets set --env-file ./supabase/.env.production
```

`insert_alpaca_debug.sh` can be run locally to inject a diagnostic helper into any function before redeploying.

---

## Schwab Integration Toolkit

The `project/src/schwab-api` package provides:

- `SchwabOAuth` – Authorization Code + refresh-token helpers with pluggable storage
- `SchwabAPIClient` – High-level client for quotes, price history, movers, and futures
- `SchwabStreamer` – WebSocket client for real-time equities, options, and futures feeds

See `project/src/supabase/database.ts` for examples of persisting Schwab data back into Supabase.

---

## Next Steps

1. Wire these backend services into your preferred UI or automation layer.
2. Extend the Supabase Edge Functions to cover any additional Alpaca, Schwab, or ML workloads.
3. Keep Supabase migrations (`supabase/migrations`) in sync with schema changes before deploying.

With the front-end removed, this repository is ready to serve as the authoritative backend for Stock Whisperer.
