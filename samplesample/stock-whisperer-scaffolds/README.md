# Stock Whisperer Scaffolds

This bundle contains paste-ready scaffolds we discussed, split to avoid canvas length limits.

## Contents
- `packages/indicators-ts/`: `bollinger.ts`, `kdj.ts`, `supertrend.ts`, `supertrend_ai.ts`
- `supabase/functions/regimes-supertrend/`: `_stai.ts`, `index.ts`
- `supabase/functions/alerts-evaluate/`: `index.ts`
- `apps/alerts-notifier/`: `index.ts` (optional Web Push worker)
- `supabase/migrations/`: `20xx_push_subscriptions.sql`
- `frontend/src/components/`: `ChartSTAI.tsx`, `OscKDJ.tsx`, `ChartBollinger.tsx`
- `frontend/src/service/`: `stai.ts`
- `packages/indicators-ts/__tests__/`: `bb_kdj.spec.ts`

## Notes
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Edge Functions.
- Expose cagg tables in `public` schema for PostgREST reads.
- Weighted top-2 cluster factor selection is the default in `supertrend_ai.ts`.

Generated: 2025-11-25T16:56:56.541957Z
