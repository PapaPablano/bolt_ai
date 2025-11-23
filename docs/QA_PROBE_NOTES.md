# QA Probe + Playwright Notes

This note tracks the expectations around our chart probe metrics and how we persist diagnostics in CI.

## FPS + Range Expectations

- **Median FPS ≥ 40**: The pan/zoom scenario must keep the median of sampled FPS values at or above 40 to stay within our interaction budget.
- **Zoom span reduction**: After zooming in, the visible seconds span must shrink relative to the pre-zoom span to prove the zoom gesture actually tightened the window.
- Both thresholds are enforced in `frontend/tests/e2e/pan-zoom-fps.spec.ts`, and the reasoning is documented inline to keep the spec self-contained.

## Probe Metric Attachments

- Each FPS spec run collects per-sample probe metrics plus a final snapshot from `window.__probe` via `page.evaluate`.
- The JSON payload is attached with `test.info().attach('probe-metrics', ...)`, which Playwright stores alongside the HTML report under `frontend/playwright-report/`.
- The `frontend-ci` workflow already uploads `frontend/playwright-report` as an artifact (`.github/workflows/frontend-ci.yml`), so no extra CI changes are required to preserve these attachments.

## Reference Commands

- Local run with probe enabled: `npm run -w frontend e2e`
- Preview build with probe: `VITE_QA_PROBE=1 npm run -w frontend build && npm run -w frontend preview -- --host --port 5174`
