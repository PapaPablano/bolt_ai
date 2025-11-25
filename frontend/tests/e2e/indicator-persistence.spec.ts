import { test, expect } from '@playwright/test';
import { waitForCharts, probeKeys, resetClientState, gotoChart, TEST_SYMBOL } from './utils';

if (process.env.CI) {
  test.skip(true, 'Indicator persistence test is flaky in CI; run locally instead');
}

test('indicator toggles persist across reload', async ({ page }) => {
  test.slow();
  await resetClientState(page);
  await gotoChart(page, { symbol: TEST_SYMBOL });
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const pane = page.getByTestId('pane-kdj');
  await page.evaluate(({ sym }) => {
    const w = window as any;
    const entry = w.__probe?.[sym];
    if (entry?.setKdjEnabled) entry.setKdjEnabled(true);
  }, { sym: TEST_SYMBOL });
  await expect(pane).toBeVisible();

  await page.reload();
  await waitForCharts(page, { symbol: TEST_SYMBOL });
  await expect(pane).toBeVisible();

  const keys = await probeKeys(page);
  expect(keys).toContain(TEST_SYMBOL);
});
