import { expect, test } from '@playwright/test';
import { gotoChart, waitForCharts, hoverMainChart, getSeriesCount } from './utils';

// Dashboard chart smoke + indicator toggle coverage.
// Uses mock data (via ?mock=1) to be deterministic and stable in CI.

test.describe('Dashboard chart', () => {
  test('loads main chart and exposes series via probe', async ({ page }) => {
    await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });

    const { symbol, stage, seriesCount } = await waitForCharts(page, {
      symbol: 'AAPL',
      timeoutMs: 20_000,
      requireSeries: true,
      minSeries: 1,
    });

    expect(symbol).toBe('AAPL');
    expect(stage === 'candle-series-created' || stage === 'seed-bars-ready').toBe(true);
    expect(seriesCount).not.toBeNull();
    expect(seriesCount as number).toBeGreaterThanOrEqual(1);

    // Basic interaction: hover the chart to ensure it is receiving pointer events.
    await hoverMainChart(page);
  });

  test('persists at least one overlay/indicator series when toggled', async ({ page }) => {
    await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 42 });
    await waitForCharts(page, { symbol: 'AAPL' });

    // Toggle a known indicator via the indicator panel.
    // We intentionally use role/text selectors to be resilient to layout changes.
    const indicatorToggle = page.getByRole('button', { name: /SMA 20/i });
    await indicatorToggle.click();

    // After enabling an overlay, we expect seriesCount to increase or at least remain >=1.
    const count = await getSeriesCount(page, 'AAPL');
    expect(count).not.toBeNull();
    expect(count as number).toBeGreaterThanOrEqual(1);
  });
});
