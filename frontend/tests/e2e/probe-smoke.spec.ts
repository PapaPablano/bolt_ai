import { test, expect } from '@playwright/test';
import { gotoChart } from './utils';

test('QA probe mounts on first paint', async ({ page }) => {
  // Navigate with runtime probe injection (utils ensures addInitScript runs first)
  await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });

  // __QA_PROBE__ must exist immediately after navigation
  await expect
    .poll(async () => page.evaluate(() => (window as any).__QA_PROBE__ === '1'))
    .toBeTruthy();

  // __probe namespace should be initialized by the chart effect
  await expect
    .poll(async () => page.evaluate(() => Object.keys((window as any).__probe ?? {}).length))
    .toBeGreaterThan(0);

  // Namespace should expose a seriesCount getter even if it returns 0 initially
  const hasSeriesCount = await page.evaluate(() => {
    const root = (window as any).__probe;
    const key = Object.keys(root ?? {})[0];
    return !!(root?.[key] && typeof root[key].seriesCount !== 'undefined');
  });
  expect(hasSeriesCount).toBeTruthy();
});
