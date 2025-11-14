# Stock Whisperer – Full-Stack Trading Application

A powerful stock trading and analysis platform with real-time market data, interactive charts, and ML-powered insights.

## Languages and frameworks

Bolt focuses on JavaScript-based web technologies. It supports:
- Node.js for the backend.
- Browser-native code: any JavaScript framework that runs on the frontend.

## 🚀 Quick Start

```bash
# Install all dependencies
npm run install:all

# Set up environment variables
cp .env.example frontend/.env.local
# Edit frontend/.env.local with your Supabase credentials

# Run the development server
npm run dev
```

Visit `http://localhost:5173` to see the app!

**📖 Having trouble?** See [SETUP.md](./SETUP.md) for detailed setup instructions and troubleshooting.

**For Bolt.new deployment**, see [BOLT_DEPLOYMENT.md](./BOLT_DEPLOYMENT.md) for detailed instructions.

---

## 📁 Repository Layout

- `frontend/` – React + Vite frontend application with trading UI
  - `src/components/` – Trading charts, stock cards, news panels, and more
  - `src/lib/` – API integrations and utility functions
  - Fully responsive with dark mode and modern UI components
- `supabase/` – Edge Functions, migrations, and project config (Deno)
  - `functions/` – Serverless API endpoints for stock data
  - `migrations/` – Database schema and setup SQL
- `project/src/schwab-api/` – Schwab API OAuth client and streaming
- `scripts/` – Testing utilities for Edge Functions
- `docs/` – Architecture notes, API references, and integration guides

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

## Troubleshooting

### Dependencies Not Installing?

This project has a **multi-package structure** (root + frontend). Common issues:

- **Multiple package managers**: Use **npm only** (not yarn). Both `package-lock.json` and `yarn.lock` exist, but npm is the standard.
- **Incomplete installation**: Run `npm run install:all` to install both root and frontend dependencies.
- **Missing environment variables**: Copy `.env.example` to `frontend/.env.local` and add your Supabase credentials.

**See [SETUP.md](./SETUP.md) for comprehensive troubleshooting guide.**

---

## Next Steps

1. Wire these backend services into your preferred UI or automation layer.
2. Extend the Supabase Edge Functions to cover any additional Alpaca, Schwab, or ML workloads.
3. Keep Supabase migrations (`supabase/migrations`) in sync with schema changes before deploying.

With the front-end removed, this repository is ready to serve as the authoritative backend for Stock Whisperer.
