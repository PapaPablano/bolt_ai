# Supabase Executive Summary

This document is a self-contained, executive-level overview of every Supabase touchpoint in this project. It is written for an assistant running inside the Supabase environment so it can understand end-to-end flows and troubleshoot issues.

---

## 1. Core Supabase Roles

- **Authentication and user data**
  - Supabase Auth issues JWTs used by the frontend.
  - Row Level Security (RLS) ensures each user can access only their own data.
  - User-specific entities are stored in Supabase (watchlists, portfolios, alerts, preferences, transactions).

- **Market and analytics data hub**
  - Supabase databases store symbols, price history, options contracts/quotes, earnings, ML outputs, and cached market data.
  - Edge Functions ingest/normalize data from external providers (Schwab, Alpaca, news, macro) into these tables.

- **Edge Functions platform**
  - Deno-based functions in `supabase/functions/*` expose a serverless API surface.
  - Frontend calls these functions via `supabase.functions.invoke(...)` using the anon key.
  - Functions themselves connect back to Supabase using the service role key for privileged operations.

---

## 2. Frontend → Supabase Touchpoints

The frontend is a Vite + React app that interacts with Supabase through a shared client and Edge Functions.

- **Supabase client (anon key)**
  - Implemented in `frontend/src/lib/supabaseClient.ts` via `@supabase/supabase-js`.
  - Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `frontend/.env.local`.
  - Used for:
    - Auth flows (sign up, sign in, sign out, current user).
    - CRUD on watchlists, portfolios, holdings, transactions.
    - CRUD on price alerts and user preferences.
    - Any direct table queries that depend on RLS-enforced user isolation.

- **Edge Function calls from the UI**
  - All of the following are invoked through `supabase.functions.invoke(<name>, { body: {...} })`:
    - `schwab-proxy`  
      - Triggered via `frontend/src/lib/api-client.ts`.  
      - Provides:
        - Real-time and historical Schwab quotes (`get_quote`).
        - Price history (`get_price_history`).
        - Market hours (`get_market_hours`).
    - `alpaca-proxy`  
      - Also via `api-client.ts`.  
      - Provides:
        - Historical bars (`get_bars`).
        - Latest quote/trade (`get_latest_quote`, `get_latest_trade`).
        - Snapshots for multiple symbols (`get_snapshot`).
    - `news-proxy`  
      - Also via `api-client.ts`.  
      - Provides:
        - Economic calendar (`get_economic_calendar`).
        - Daily events (`get_today_events`).
        - High-impact events (`get_high_impact_events`).
    - `stock-quote` (or an override via `env.quoteFunction`)  
      - Used by `frontend/src/hooks/useLiveBars.ts`.  
      - Returns latest price for a symbol.  
      - Used to synthesize intraday OHLC candles when WebSocket streaming is unavailable.
    - `stock-search`  
      - Used in `frontend/src/pages/ScreenerPage.tsx` and `frontend/src/components/SearchBar.tsx`.  
      - Provides symbol search and screener results.
    - `stock-news`  
      - Used in `frontend/src/components/NewsPanel.tsx`.  
      - Returns symbol-specific news articles with metadata and timestamps.
    - Additional Edge Functions (not always called directly by the UI but available):
      - `stock-intraday`, `stock-historical-v3`, `stock-stream` for richer OHLC and streaming data.
      - `ml-signals`, `regimes-supertrend`, `indicators-*` for technical/ML analytics.
      - `alerts-evaluate` for alert processing.

---

## 3. Edge Functions → Supabase Touchpoints

Every Edge Function uses Supabase as its system of record and often as its configuration store. They share several patterns:

- **Service role client pattern**
  - Each function constructs a Supabase client using:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
  - This enables:
    - Access to internal tables that are not directly exposed to the frontend.
    - Execution of security-sensitive RPCs (e.g., token storage).
    - Bulk writes/updates without RLS constraints.

- **Key functions and their Supabase usage**

  - `options-rank` (`supabase/functions/options-rank/index.ts`)
    - Inputs: URL query parameters `symbol`, `side`, `dteMin`, `dteMax`, `top`, `spot`, `r`.
    - Supabase queries:
      - `symbols` to resolve `ticker` → internal `symbol_id`.
      - `earnings_events` to get next `announce_date` and compute days until earnings.
      - `iv_history` to fetch the last N observations of `iv_30d`.
      - `options_contracts` with joined `options_quotes` (bid, ask, iv, delta, oi, vol).
      - Optional `price_history` lookup for `close_price` when `spot` input is missing.
    - Processing:
      - Filters contracts by side (call/put) and days-to-expiration window.
      - Drops contracts with missing quotes, zero ask, zero implied volatility, or zero open interest.
      - Uses `packages/options-math-ts` to score/rank contracts using IV history and earnings timing.
    - Output:
      - Returns ranked contracts plus debug counters (optional) and metadata like `spotUsed`, `dteMin`, `dteMax`.

  - `schwab-proxy` (`supabase/functions/schwab-proxy/index.ts`)
    - Supabase usage:
      - RPCs:
        - `get_api_token` to read stored access/refresh tokens for provider `"schwab"`.
        - `upsert_api_token` to persist updated access/refresh tokens and expiry.
      - Tables:
        - `api_logs` to insert logs for each provider call:
          - Provider name (`schwab`).
          - Action name (`get_quote`, `get_price_history`, `get_market_hours`, or `"error"`).
          - HTTP status code, response time, optional error message, and request parameters.
    - External calls:
      - Schwab OAuth endpoint for token refresh.
      - Schwab Market Data endpoints for quotes, price history, and market hours.
    - Output:
      - JSON payloads mirroring Schwab responses, suitable for direct consumption by the frontend.

  - `alpaca-proxy`
    - Supabase usage:
      - Similar logging pattern to `schwab-proxy` (via `api_logs`).
      - May use configuration tables for Alpaca credentials or routing if they exist.
    - External calls:
      - Alpaca REST endpoints for bars, latest quote/trade, and symbol snapshots.

  - `stock-quote`, `stock-intraday`, `stock-historical-v3`, `stock-stream`
    - Supabase usage (typical pattern):
      - Read from `price_history`, `stock_cache`, and related tables for price and OHLC data.
      - Optionally write back to cache tables for fast subsequent reads.
    - Output:
      - Normalized quote or bar series for UI components and tools.

  - `stock-news`, `news-proxy`
    - Supabase usage:
      - Read/write tables that store:
        - News articles, sources, symbol tags, timestamps.
        - Economic event records and impact levels.
      - May log provider calls in `api_logs`.
    - External calls:
      - News and macro-economic APIs.
    - Output:
      - Symbol-annotated articles and/or event lists for display in panels like `NewsPanel`.

  - `ml-signals`, `regimes-supertrend`, `indicators-*`
    - Supabase usage:
      - Read input features from price/indicator tables.
      - Write ML regimes, signals, and indicator values back to dedicated tables.
    - Output:
      - Model-ready signals and indicators used by the frontend or other jobs.

  - `alerts-evaluate`
    - Supabase usage:
      - Reads user-defined alerts from a price alerts table (thresholds, directions, active flags).
      - Reads current or recent prices from cached price tables.
      - Writes updates when alerts fire (e.g., mark inactive, record triggered timestamps).
    - Output:
      - May call notification mechanisms or return a summary to orchestrating jobs.

---

## 4. Database & Schema: Logical View

Even without listing every column, the logical structure of the Supabase database can be summarized as follows:

- **Market reference data**
  - `symbols`: canonical list of tickers and metadata.
  - Option-related tables:
    - `options_contracts`: contract definitions (id, symbol_id, strike, expiry, right).
    - `options_quotes`: bid, ask, implied volatility, delta, open interest, volume.
  - `earnings_events`: upcoming and historical earnings dates per symbol.

- **Price and volatility history**
  - `price_history`: time series of prices (e.g., close_price, datetime, symbol).
  - `stock_cache` or similar cache tables: recent prices or computed OHLC windows.
  - `iv_history`: implied volatility history (e.g., `iv_30d`).

- **User-centric entities**
  - `watchlists` and `watchlist_items`.
  - `portfolios` and `portfolio_holdings`.
  - `stock_transactions` for historical trades.
  - `price_alerts` for alert definitions and state.
  - `user_preferences` for UI and strategy settings.
  - All of these tables are protected by RLS and keyed by user id.

- **Integration and control tables**
  - `api_logs`: audit log of outbound provider calls (provider, action, status, latency, errors, params).
  - Token storage tables accessed by `get_api_token` / `upsert_api_token` for credentials like Schwab access/refresh tokens.

---

## 5. End-to-End Data Flow (Process View)

1. **User opens the app**
   - Frontend loads and configures the Supabase client with anon key and project URL.
   - If authenticated, the client loads user-specific data (watchlists, portfolios, alerts, preferences) via direct table queries.

2. **User views a chart or ticker**
   - Frontend calls:
     - `stock-quote` (or other quote function) to get latest price.
     - `stock-intraday` / `stock-historical-v3` for OHLC series, or a WebSocket stream if configured.
   - Edge Functions:
     - Read from `price_history` and cache tables.
     - Fill/request missing data from providers (Schwab/Alpaca) and optionally write back.
   - Response returns normalized JSON used directly by chart components.

3. **User searches for a symbol or uses a screener**
   - Frontend calls `stock-search` with search parameters.
   - Edge Function queries symbol and derived metrics tables and returns ranked/filtered results.

4. **User checks news or macro events**
   - Frontend calls:
     - `stock-news` for symbol-specific news.
     - `news-proxy` for economic calendar and macro events.
   - Edge Functions:
     - Call external news/macro APIs.
     - Cache results in Supabase tables for reuse and historical analysis.

5. **User configures watchlists, portfolios, and alerts**
   - Frontend uses the Supabase client (anon key) to:
     - Insert/update `watchlists`, `watchlist_items`.
     - Insert/update `portfolios`, `portfolio_holdings`, `stock_transactions`.
     - Insert/update `price_alerts` and `user_preferences`.
   - RLS ensures users cannot access each other’s rows.

6. **Backend jobs/Edge Functions evaluate alerts and ML signals**
   - Functions like `alerts-evaluate` and `ml-signals`:
     - Read user definitions and market data from Supabase tables.
     - Compute triggers, signals, or regimes.
     - Write results and state changes back to Supabase.

7. **Schwab/Alpaca integration lifecycle**
   - `schwab-proxy` and `alpaca-proxy`:
     - Pull tokens from Supabase via RPC and token tables.
     - Refresh tokens when expired and store new ones.
     - Log every call to `api_logs` with timing and error info.
   - This makes Supabase the single source of truth for external provider tokens and call history.

8. **Options ranking workflow**
   - Frontend or tools call `options-rank` with a symbol and configuration (side, date window, top N).
   - Function:
     - Resolves `symbol_id` from `symbols`.
     - Loads earnings dates (`earnings_events`), IV history (`iv_history`), and options data (`options_contracts` + `options_quotes`).
     - Optionally reads `price_history` to infer spot price.
     - Scores and ranks contracts and returns a sliced list with optional debug counters.

---

## 6. Environment and Deployment Snapshot

- **Environment variables (frontend)**
  - `VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>` (not committed).

- **Environment variables (Supabase project secrets)**
  - `SUPABASE_SERVICE_ROLE_KEY` (for Edge Functions).
  - Provider keys such as:
    - `SCHWAB_KEY_ID`, `SCHWAB_SECRET_KEY`, `SCHWAB_REDIRECT_URI`.
    - Alpaca API keys.
    - News/macro provider keys.

- **Deployment**
  - Edge Functions are deployed from this repo using:
    - `supabase functions deploy <function-name> --project-ref iwwdxshzrxilpzehymeu`
  - Secrets are synchronized via:
    - `supabase secrets set --env-file ./supabase/.env.production`
  - Database migrations are applied via:
    - `supabase db push --project-ref iwwdxshzrxilpzehymeu`  
    - or by running the SQL in each migration file in the Supabase SQL Editor.

---

## 7. How to Use This Summary for Troubleshooting

- If a **frontend action fails**:
  - Check which Edge Function or table it touches (see Section 2).
  - Inspect the corresponding function logs and `api_logs` rows in Supabase.

- If an **Edge Function fails**:
  - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.
  - Check referenced tables and RPCs (`get_api_token`, `upsert_api_token`, etc.) exist and have expected schemas.
  - Confirm external provider credentials in Supabase secrets.

- If **data looks stale or inconsistent**:
  - Inspect cache tables (`stock_cache`, price tables, IV history).
  - Confirm ingest functions (`stock-*`, `ml-*`, `regimes-*`, `news-proxy`) are running and writing correctly.

This document is intended to stand alone as the single, high-level map of every Supabase integration point for this project.

