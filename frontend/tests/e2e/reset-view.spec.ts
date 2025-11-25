import { test, expect } from '@playwright/test';
import { waitForCharts, resetClientState, TEST_SYMBOL, gotoChart, getVisibleRanges } from './utils';

test.skip('Reset view restores full range without spacing drift', async ({ page }) => {
  test.slow();
  await resetClientState(page);
  await gotoChart(page, { symbol: TEST_SYMBOL });
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  // Use probe helper to zoom into a sub-range instead of relying on wheel
  // events, which are brittle in CI.
  await page.evaluate(({ sym }) => {
    const w = window as any;
    const entry = w.__probe?.[sym];
    const all = entry?.dataLogicalRange;
    if (!entry || !all || !entry.setVisibleLogicalRange) return;
    const mid = (all.from + all.to) / 2;
    entry.setVisibleLogicalRange({ from: mid, to: all.to });
  }, { sym: TEST_SYMBOL });

  const before = await getVisibleRanges(page, TEST_SYMBOL);
  expect(before.vis).not.toBeNull();
  expect(before.all).not.toBeNull();
  expect(before.vis).not.toEqual(before.all);

  await page.evaluate(({ sym }) => {
    const w = window as any;
    const entry = w.__probe?.[sym];
    if (entry?.resetView) entry.resetView();
  }, { sym: TEST_SYMBOL });
  await waitForCharts(page, { symbol: TEST_SYMBOL });
  await page.waitForTimeout(100);

  const { vis, all } = await getVisibleRanges(page, TEST_SYMBOL);
  expect(vis && all).toBeTruthy();
  expect(Math.floor(vis!.to)).toBe(Math.floor(all!.to));
});
