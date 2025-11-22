# Economic Calendar Integration (ForexFactory via JBlanked)

## Design Decisions (Sparring Checkpoints)
- **Events ≠ markers:** Events rarely land exactly on bar timestamps. We snap to the nearest bar within a tolerance and cap marker density (50). We expose both `econEventCount` (raw) and `econMarkerCount` (rendered) via the QA probe to detect divergence.
- **Debounce + Abort > “faster” polling:** Rapid TF/range changes can thrash the endpoint and UI. We debounce (~200 ms) and abort the prior request to maintain responsiveness and avoid redundant marker churn.
- **Calendar is panel-only, not a worker indicator:** Pushing it through the worker would add compute, create coupling, and caused TS drift. We filter via `isWorkerIndicator`.
- **Namespace isolation:** The QA probe is namespaced by symbol to prevent cross-talk in multi-chart contexts.
- **Prod hygiene:** The probe is gated by `DEV || VITE_QA_PROBE`. CI sets `VITE_QA_PROBE=1` for preview tests; production releases must keep it off.

## Failure Modes & Mitigations
- **Backend outage:** UI displays a non-blocking banner (`data-testid="calendar-error"`). Chart remains functional.
- **Marker overload:** We cap at 50 latest snapped events and skip re-apply if the event signature hasn’t changed.
- **Race on first paint / width=0:** Existing one-shot `ResizeObserver` in the chart re-applies decimation once width is non-zero (covered elsewhere).

## Runbook
- **Local dev (dev server managed by Playwright):** `npm run -w frontend e2e`
- **Manual dev:** `npm run -w frontend dev -- --host --port 5173` → open `/?symbol=AAPL&mock=1&seed=1337`
- **Preview test:** `VITE_QA_PROBE=1 npm run -w frontend build && npm run -w frontend preview -- --host --port 5174`
- **Probe sanity:** `Object.keys(window.__probe || {})` → `['AAPL']`, then `window.__probe.AAPL.econMarkerCount`

## Test Matrix
- **Unit:** session resolver DST/holidays; mock generation determinism.
- **E2E (mocked):**
  - `calendar-toggle.spec.ts` — toggle on/off applies/clears markers.
  - `calendar-density-cap.spec.ts` — 500 events ⇒ ≤ 50 markers.
  - `calendar-symbol-isolation.spec.ts` — AAPL vs MSFT namespaced counts.
