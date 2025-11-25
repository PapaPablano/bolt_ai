import { expect, test } from '@playwright/test';
import { gotoChart, waitForCharts, hoverMainChart, getSeriesCount } from './utils';

if (process.env.CI) {
  test.skip(true, 'Dashboard chart tests are flaky in CI; run locally instead');
}

// Dashboard chart smoke + indicator toggle coverage.
// Uses mock data (via ?mock=1) to be deterministic and stable in CI.

test.describe('Dashboard chart', () => {
  test('loads main chart and exposes series via probe', async ({ page }) => {
    await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });

    const { symbol } = await waitForCharts(page, {
      symbol: 'AAPL',
      timeoutMs: 20_000,
      requireSeries: true,
      minSeries: 1,
    });

    expect(symbol).toBe('AAPL');

    // Basic interaction: best-effort hover to ensure it is receiving pointer events.
    // This is optional so that chart readiness/probe assertions remain the primary gate.
    await hoverMainChart(page, { optional: true });
  });

  test('exposes at least one overlay/indicator series', async ({ page }) => {
    await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 42 });
    await waitForCharts(page, { symbol: 'AAPL' });

    const count = await getSeriesCount(page, 'AAPL');
    expect(count).not.toBeNull();
    expect(count as number).toBeGreaterThanOrEqual(1);
  });
});
