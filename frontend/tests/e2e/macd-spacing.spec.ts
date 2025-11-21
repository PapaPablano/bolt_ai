import { test, expect } from '@playwright/test';
import { waitForCharts, getMacdSpacing, setMacdThickness, resetClientState, gotoChart, TEST_SYMBOL } from './utils';

const TARGETS = { thin: 5, normal: 7, wide: 9 } as const;

test('MACD spacing is idempotent and matches targets', async ({ page }) => {
  await resetClientState(page);
  await gotoChart(page, { symbol: TEST_SYMBOL });
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const macdPane = page.getByTestId('pane-macd');
  const macdToggle = page.getByTestId('toggle-macd');
  if ((await macdPane.count()) === 0) {
    await macdToggle.click();
    await expect(macdPane).toBeVisible();
  }

  for (const key of ['thin', 'wide', 'normal'] as const) {
    await setMacdThickness(page, key, TEST_SYMBOL);
    await page.waitForTimeout(150);
    const spacing = await getMacdSpacing(page, TEST_SYMBOL);
    expect(spacing).toBe(TARGETS[key]);
  }

  await page.mouse.wheel(0, 800);
  await page.mouse.wheel(0, -800);
  await setMacdThickness(page, 'wide', TEST_SYMBOL);
  await page.waitForTimeout(150);
  expect(await getMacdSpacing(page, TEST_SYMBOL)).toBe(TARGETS.wide);
});
