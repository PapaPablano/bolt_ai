import { test, expect } from '@playwright/test';
import { waitForCharts, getMacdSpacing, resetClientState, TEST_SYMBOL, TEST_URL, getVisibleRanges } from './utils';

test('Reset view restores full range without spacing drift', async ({ page }) => {
  await resetClientState(page);
  await page.goto(TEST_URL);
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  await page.mouse.wheel(0, 1200);
  await page.mouse.wheel(0, -400);

  const resetButton = page.getByTestId('btn-reset-view');
  await expect(resetButton).toBeVisible();

  const before = await getVisibleRanges(page, TEST_SYMBOL);
  expect(before.visible).not.toBeNull();
  expect(before.data).not.toBeNull();
  expect(before.visible).not.toEqual(before.data);

  await resetButton.click();
  await waitForCharts(page, { symbol: TEST_SYMBOL });
  await page.waitForTimeout(100);

  const after = await getVisibleRanges(page, TEST_SYMBOL);
  expect(after.visible).not.toBeNull();
  expect(after.data).not.toBeNull();
  expect(after.visible).toEqual(after.data);

  const macdPane = page.getByTestId('pane-macd');
  if (await macdPane.count()) {
    const spacing = await getMacdSpacing(page, TEST_SYMBOL);
    expect([5, 7, 9, null]).toContain(spacing);
  }
});
