import { test, expect } from '@playwright/test';
import { waitForCharts, resetClientState, TEST_SYMBOL, gotoChart, getVisibleRanges } from './utils';

test('Reset view restores full range without spacing drift', async ({ page }) => {
  await resetClientState(page);
  await gotoChart(page, { symbol: TEST_SYMBOL });
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  await page.mouse.wheel(0, 1200);
  await page.mouse.wheel(0, -400);

  const resetButton = page.getByTestId('btn-reset-view');
  await expect(resetButton).toBeVisible();

  const before = await getVisibleRanges(page, TEST_SYMBOL);
  expect(before.vis).not.toBeNull();
  expect(before.all).not.toBeNull();
  expect(before.vis).not.toEqual(before.all);

  await resetButton.click();
  await waitForCharts(page, { symbol: TEST_SYMBOL });
  await page.waitForTimeout(100);

  const { vis, all } = await getVisibleRanges(page, TEST_SYMBOL);
  expect(vis && all).toBeTruthy();
  expect(Math.floor(vis!.from)).toBe(0);
  expect(Math.floor(vis!.to)).toBe(Math.floor(all!.to));
});
