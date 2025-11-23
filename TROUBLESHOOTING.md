# Troubleshooting Guide

This guide centralizes common problems and points to the more detailed
troubleshooting docs in `docs/`.

## 1. Installation & Dependencies

If dependencies fail to install or behave inconsistently:

- **Use npm only** (no Yarn)
  - See `SETUP.md` → *Package Manager* and *Dependencies Not Installing Completely*.
- **Reset Node modules and reinstall**
  - Remove `node_modules` and `frontend/node_modules`.
  - Run `npm run install:all`.
- **Check Node version**
  - Use Node 18+.

For full instructions and recovery steps, see `SETUP.md`.

## 2. Dev Server / Frontend Issues

Symptoms:
- `npm run dev` fails.
- Blank page or runtime errors.

Checklist:
- Verify `frontend/.env.local` exists and has valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Ensure port **5173** is free (or use `vite --port <other>`).
- Run `cd frontend && npm run build` to surface TypeScript errors.

See:
- `SETUP.md` → *Development Server Won't Start*.
- `CONTRIBUTING.md` → *Common Issues*.

## 3. Date Range / Chart Data Problems

Symptoms:
- Date range buttons change highlight but charts don’t update.
- X‑axis shows the wrong date range.
- Indicators (e.g., SMA 200) are empty on short ranges.

Actions:
- Follow the step‑by‑step checks and console expectations in:
  - `docs/DATE_RANGE_TROUBLESHOOTING.md`
  - `docs/TESTING_GUIDE.md` (Two‑tier data fetching)
- Verify:
  - React Query isn’t serving stale data.
  - Supabase Edge Functions return the expected number of points.
  - Mock data paths aren’t always triggered.

## 4. Supabase / Edge Function Failures

Symptoms:
- `Failed to fetch stock quote` or historical data.
- 4xx/5xx responses from `stock-quote` or `stock-historical-v3`.

Checklist:
- Confirm Supabase environment variables are set in `.env` and `frontend/.env.local`.
- Ensure Edge Functions are deployed for your project ref.
- Test functions directly via `curl` as shown in:
  - `BOLT_DEPLOYMENT.md`
  - `docs/DATE_RANGE_TROUBLESHOOTING.md`
- Check Supabase function logs for detailed stack traces.

## 5. Timescale / Database Seeding Issues

For local Timescale + continuous aggregates problems (no data, empty
stitched views, or validation failures), see:

- `SETUP.md` → *Seeding Timescale OHLCV (Local Dev & CI)*.
- `scripts/sql/validate_ca.sql` for validation queries.

Key points:
- Ensure `DATABASE_URL`/`SUPABASE_DB_URL` is correct.
- Run `scripts/seed_ohlcv.py` with appropriate symbols and days.
- Refresh and validate continuous aggregates.

## 6. Testing & QA Issues

If you’re unsure whether behavior is correct or regressions have been
introduced:

- Start with the high‑level `TESTING.md`.
- Use `docs/TESTING_GUIDE.md` for detailed UI/indicator verification.
- For date‑range specific problems, use `docs/DATE_RANGE_TROUBLESHOOTING.md`.

## 7. When to Open an Issue

Open a GitHub issue when:
- You’ve followed the relevant steps above and the problem persists.
- You can provide:
  - Exact steps to reproduce.
  - Relevant logs or console output.
  - Environment details (Node version, OS, local vs hosted).

For potential **security vulnerabilities**, follow the instructions in
`SECURITY.md` instead of opening a public issue.
