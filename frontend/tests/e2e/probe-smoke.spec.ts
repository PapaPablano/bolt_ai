import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, readProbeBoot } from './utils';

test('probe namespace and series are available on first paint', async ({ page }) => {
  await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });

  // Deterministic boot: ensures probe namespace, stages, and series are live
  const snap = await waitForCharts(page, { timeoutMs: 15_000, requireSeries: false });
  
  const boot = await readProbeBoot(page);
  expect(boot?.gate).toBeTruthy();

  expect(['seed-bars-ready', 'candle-series-created']).toContain(snap.stage);
  expect(snap.seriesCount ?? 0).toBeGreaterThan(0);
});
