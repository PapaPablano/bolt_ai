---
description: FE visible-range decimation and workerized indicators rollout
auto_execution_mode: 1
---

---
title: FE visible-range decimation rollout
description: Implement visible-range decimation and workerized indicators safely
---

# FE visible-range decimation and workerized indicators rollout

1. Inspect current chart + worker wiring
   - Read `frontend/src/components/chart/AdvancedCandleChart.tsx` to understand `downsampleOhlcVisible` and indicator toggles.
   - Review `frontend/src/hooks/useIndicatorWorker.ts` and `frontend/src/workers/indicator.worker.ts` for message contracts and LTTB helpers.

2. Bind visible-range listener to worker window updates
   - Derive `{from,to}` via `chart.timeScale().getVisibleRange()`.
   - Debounce/rAF throttle updates before calling `indicatorWorker.setWindow({ from, to, maxPoints })`.
   - Persist last window in a ref so workers recovering from reload receive current bounds immediately.

3. Extend worker protocol for windowed decimation
   - Add `SET_WINDOW` message type storing `{from,to,maxPoints}` in worker state.
   - When recomputing indicators, slice `state.hist` to that window and run `decimateForVisibleRange` (cap ~5k points default).
   - Skip recomputation when hist/window unchanged to avoid thrash.

4. Enforce delta-only live messages
   - Keep `OVERLAY_PATCH[_MULTI]` payloads to single points; guard against accidental arrays.
   - If incoming live bar sits outside window, buffer until visible window shifts to include it.

5. Testing + perf validation
   - Add Playwright script (reuse `frontend/tests/e2e/probe-smoke.spec.ts`) that pans/zooms through chart, asserting probe FPS ≥ 60.
   - Capture single artifact (screenshot/log) as evidence.
   - Unit-test `decimateForVisibleRange` window behavior.

6. Feature flag & acceptance
   - Gate worker-window flow behind dev/preview flag, default-off in prod env.
   - Acceptance: ≤5k points/series, indicators only from worker outputs, FPS ≥60 trace, tests passing.
