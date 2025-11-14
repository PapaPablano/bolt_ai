# Action Plan Helper _11_14

This plan groups every outstanding recommendation into execution phases so work streams stay focused and traceable.

## Phase 1 – Supabase Foundations
- **Session & auth flow**: Build a shared Supabase provider (wrapping `useSupabaseUser`, new context, and route guards) so every protected page shares loading/error state. Document the email/password setup flow in `frontend/ENV_SETUP.md` and `README.md` with copy/paste env values and screen shots from the Supabase console.
- **Auth UI polish**: Expand `SupabaseAuthPanel` with success/error banners, forgot-password links, and redirect hints so the in-app experience matches the documented flow.
- **Helper layer**: Re-create `src/lib/supabaseHelpers.ts` to centralize CRUD, typed responses, and error normalization. Pages such as `WatchlistPage`, `AlertsPage`, `ScreenerPage`, and future modules should consume these helpers (ideally through React Query hooks for caching/optimistic updates).
- **Validation & schemas**: Introduce zod models for each Supabase table (watchlists, watchlist_items, price_alerts, stock_cache) and validate every response before the UI consumes it.
- **Loading/error boundaries**: Wrap routed content in a reusable error boundary + fallback UI (new `src/components/ErrorBoundary.tsx`) so auth failures or Supabase outages never blank the page.

## Phase 2 – Product UX, Accessibility & SEO
- **Accessibility regression audit**: Re-run axe + keyboard-only passes on the new router layout (`src/App.tsx`, `src/components/SkipLinks.tsx`, `src/components/FocusIndicator.tsx`). Wire `useAnnouncement` / `LiveRegion` feedback into watchlist, alert, and screener CRUD flows, and add automated checks (Playwright + axe or Storybook + axe).
- **UI consistency**: Add Storybook stories for all reusable primitives (Modal, SearchBar, SupabaseAuthPanel, InternalLink, Breadcrumbs) to guard against regressions and provide visual documentation.
- **SEO/internal-link verification**: Crawl the production build (`npm run build && npx linkinator dist/index.html`) to confirm every route exposes breadcrumbs, canonical tags, and skip links. Expand `generateStructuredData` tests (Jest + `@google-cloud/schema-dts`) and ensure docs (`frontend/SEO_IMPLEMENTATION_GUIDE.md`, `frontend/ANCHOR_TEXT_GUIDE.md`, `frontend/LINKING_SUMMARY.md`) match the router-based layout. Instrument analytics hooks so link performance is measurable post-deploy.
- **Analytics & monitoring**: Add lightweight page-level analytics (Segment, PostHog, etc.) to capture navigation funnels and conversion metrics tied to internal links.

## Phase 3 – Testing & Automation
- **CI workflow**: Create a GitHub Action (or equivalent) that runs ESLint, Vitest, and `npm run build` for both root and `frontend/`. Add Husky + lint-staged (or simple pre-commit scripts) so lint/tests run locally before pushing.
- **Test coverage**: Expand unit tests for helpers (`src/lib/urlHelpers.ts`, `src/lib/seo.ts`, `src/lib/focusManagement.ts`, Supabase helper utilities). Add integration tests (Vitest + MSW / Playwright) for watchlist CRUD, screener runs, and alert pauses using mocked Supabase + edge functions. Document the test matrix in `PRE_PUSH_CHECKLIST.md` and `STARTUP_VERIFICATION.md` (include manual steps: start Vite, log in, create watchlist item, run screener, set alert).
- **Fixtures & seeds**: Introduce `supabase/seed/watchlists.sql` (and similar) so CI/previews have deterministic data. Provide npm scripts (`npm run supabase:start|stop|seed`) to streamline local development.

## Phase 4 – Performance, API & PWA Readiness
- **Data fetching consistency**: Consolidate polling/fetching in `frontend/src/lib/api.ts` and the new Supabase helper layer using React Query/SWR to prevent duplicate intervals. Add exponential backoff + toast notifications for `fetchStockQuote`/`fetchHistoricalData`.
- **PWA/asset audit**: Review `manifest.json`, `sw.js`, `frontend/src/lib/pwa.ts`, and asset sizes. Add Lighthouse CI checks, ensure hashed filenames and compression (svgo/imagemin) for `frontend/src/assets`, and update `frontend/PWA_GUIDE.md` with verified testing steps (install, offline, push/bgsync when ready).
- **Error boundary & suspense**: Implement Suspense boundaries for data-heavy components (TradingChart, ComparisonWorkbench) so loading states stay consistent with the PWA/offline story.

## Phase 5 – Edge Functions & Observability
- **Edge reliability**: Standardize logging/error responses across `supabase/functions/*` via shared utilities in `_shared`, add rate limiting/auth checks (especially for `stock-search`, `stock-news`), and list required headers in `SCHWAB_API_ENDPOINTS.md`.
- **Edge tests**: Add Deno-based integration tests (referencing `supabase/functions/deno.json`) so every critical function is validated locally before deployment.
- **Monitoring & security**: Enable error monitoring (Sentry, LogRocket, Supabase log drains), add secret scanning (`gitleaks`), and review scripts like `insert_alpaca_debug.sh` to avoid leaking credentials. Document incident response / rollback steps in `BOLT_DEPLOYMENT.md`.

## Phase 6 – Database & Environment Management
- **Seeds & migrations**: Create a `supabase/seed` directory with fixtures (users, watchlists, alerts). Document migration verification steps in `BOLT_DEPLOYMENT.md` and ensure rollback instructions exist for recent schema changes.
- **RLS & cascading rules**: Revisit `supabase/migrations/20251114011649_20250114_initialize_database.sql` to guarantee `stock_cache` screener keys are scoped per user and cascading deletes cover new relationships (e.g., removing a watchlist clears cached symbols).
- **Dev tooling**: Provide scripts to start/stop Supabase locally (`npm run supabase:start`) and describe the workflow in `SETUP.md` / `ENV_SETUP.md`.

## Phase 7 – Documentation & Knowledge Sharing
- **Unified onboarding**: Consolidate overlapping setup docs (`SETUP.md`, `frontend/ENV_SETUP.md`, `docs/ENVIRONMENT_VARIABLES.md`) into a single canonical guide with screenshots. Ensure `README.md` ties together Supabase auth, focus management, SEO, and PWA resources.
- **Architecture diagrams**: Update `docs/DATA_FLOW_DIAGRAM.md` (frontend ↔ Supabase ↔ edge functions) and link it from the README for quick context.
- **Contribution examples**: Expand `CONTRIBUTING.md` with practical workflows (run Supabase locally, execute tests, submit PRs) and highlight required checks (CI, lint, unit/integration tests).

These phases collectively cover every outstanding recommendation; as items complete, update this helper with owners/dates or spin tasks into your tracker of choice.
