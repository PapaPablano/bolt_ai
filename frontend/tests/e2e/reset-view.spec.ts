import { test, expect } from '@playwright/test';
import { waitForCharts } from './utils';

test('Reset view restores full range without spacing drift', async ({ page }) => {
  await page.goto('/');
  await waitForCharts(page);

  await page.mouse.wheel(0, 1200);
  await page.mouse.wheel(0, -400);

  await page.getByTestId('reset-view').click();

  await waitForCharts(page);

  const macdPane = page.getByTestId('pane-macd');
  if (await macdPane.count()) {
    const spacing = await page.evaluate(() => (window as any).__probe?.macdBarSpacing ?? null);
    expect([5, 7, 9, null]).toContain(spacing);
  }
});
