# Schwab Options and Futures Integration

This package provides the scaffolding required to integrate the Charles Schwab API for options, futures, and streaming market data inside the Stock Whisperer project.

## Getting Started

1. **Register a Schwab Developer App**
   - Visit [developer.schwab.com](https://developer.schwab.com/) and create the `ML_LOVEABLE` application.
   - Configure the redirect URI (example: `https://127.0.0.1:8080/callback`).
   - Copy the app key and secret.

2. **Configure Environment Variables**
   - Duplicate `.env.local` and fill in your keys.
   - Supply the Supabase project credentials if you plan to persist market data.

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Database Setup**
   - Apply `src/supabase/schema.sql` to your Supabase instance.
   - Create Supabase Edge Functions under `src/supabase/functions` to proxy Schwab requests if needed.

5. **Run OAuth Flow**
   - Use `SchwabAPIClient.getAuthorizationUrl()` to initiate the Authorization Code flow.
   - Exchange the returned code with `exchangeCodeForToken` and store the token via Supabase Vault or another secure store.

6. **Consume Market Data**
   - `SchwabAPIClient` covers quotes, price history, movers, option chains, and futures.
   - `SchwabStreamer` manages the WebSocket services (e.g., `LEVELONE_EQUITIES`, `LEVELONE_FUTURES`).
   - Persist snapshots using `MarketDataDB`.

7. **UI Components**
   - Use the React components in `src/components` to render quotes, options chains, futures dashboards, and sparkline charts.

## Files

- `src/schwab-api/` — OAuth, REST, streaming clients, and shared types.
- `src/supabase/` — Database utilities, schema, and Edge Function placeholders.
- `src/components/` — Ready-to-wire UI components for the Schwab data feeds.
- `src/config/schwab.config.ts` — Loads Schwab credentials from environment variables.

## Next Steps

- Implement secure credential storage with Supabase secrets.
- Add Edge Functions to handle OAuth exchanges server-side.
- Expand UI components with live updates from the streaming client.
