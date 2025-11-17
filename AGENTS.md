# AGENTS

## Purpose
Guidance for AI agents working on this repo.

## Environment
- Frontend dev server: `npm run dev -- --host --port 5173`
- Backend (Supabase Edge Functions): deployed to project `iwwdxshzrxilpzehymeu`; functions include `stock-quote`, `stock-news`, `stock-stream`, `stock-intraday`, `stock-historical-v3`, `ml-signals`, etc.
- Frontend env (prod): `frontend/.env.local`
  - `VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<provided by user; do not commit secrets>`
- Local Supabase (optional): `supabase start`; local URL `http://127.0.0.1:54321`, anon key printed by CLI.

## How to run locally
1) `npm install && npm install --prefix frontend`
2) Ensure `frontend/.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3) Start frontend: `npm run dev -- --host --port 5173`.

## Notes
- Service worker is disabled in dev (see `frontend/src/lib/pwa.ts`).
- Functions are live; avoid altering secrets. Recent key values were provided out of band—agents must not commit or expose secrets.
- Main files: `frontend/src/lib/api.ts`, `frontend/src/components/NewsPanel.tsx`, `frontend/src/lib/pwa.ts`, Supabase functions under `supabase/functions/`.
- Pinggy tunnel (when needed): `ssh -p 443 -R0:localhost:5173 a.pinggy.io` (URL printed on connect; expires after 60m).
