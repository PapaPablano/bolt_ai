import { test, expect } from '@playwright/test';
import { waitForCharts, getMacdSpacing } from './utils';

const TARGETS = { thin: 5, normal: 7, wide: 9 } as const;

test('MACD spacing is idempotent and matches targets', async ({ page }) => {
  await page.goto('/');
  await waitForCharts(page);

  const macdPane = page.getByTestId('pane-macd');
  if ((await macdPane.count()) === 0) {
    const macdToggle = page
      .getByRole('switch', { name: /macd/i })
      .first()
      .or(page.getByRole('checkbox', { name: /macd/i }));
    await macdToggle.click();
    await expect(macdPane).toBeVisible();
  }

  for (const key of ['thin', 'wide', 'normal'] as const) {
    await page.evaluate((k) => (window as any).__probe?.setMacdThickness(k), key);
    await page.waitForTimeout(150);
    const spacing = await getMacdSpacing(page);
    expect(spacing).toBe(TARGETS[key]);
  }

  await page.mouse.wheel(0, 800);
  await page.mouse.wheel(0, -800);
  await page.evaluate(() => (window as any).__probe?.setMacdThickness('wide'));
  await page.waitForTimeout(150);
  expect(await getMacdSpacing(page)).toBe(TARGETS.wide);
});
