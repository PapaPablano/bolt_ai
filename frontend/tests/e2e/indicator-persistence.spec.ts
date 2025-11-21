import { test, expect } from '@playwright/test';
import { waitForCharts, probeKeys, resetClientState, TEST_SYMBOL, TEST_URL } from './utils';

test('indicator toggles persist across reload', async ({ page }) => {
  await resetClientState(page);
  await page.goto(TEST_URL);
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const pane = page.getByTestId('pane-kdj');
  const toggle = page.getByTestId('toggle-kdj');
  await toggle.click();
  await expect(pane).toBeVisible();

  await page.reload();
  await waitForCharts(page, { symbol: TEST_SYMBOL });
  await expect(pane).toBeVisible();

  await toggle.click();
  await expect(pane).toHaveCount(0);

  await page.reload();
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const keys = await probeKeys(page);
  expect(keys).toContain(TEST_SYMBOL);
});
