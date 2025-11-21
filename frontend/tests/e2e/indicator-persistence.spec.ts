import { test, expect } from '@playwright/test';
import { waitForCharts } from './utils';

test('indicator toggles persist across reload', async ({ page }) => {
  await page.goto('/');
  await waitForCharts(page);

  const kdjSwitch = page.getByRole('switch', { name: /kdj/i }).first();
  const kdjCheckbox = page.getByRole('checkbox', { name: /kdj/i }).first();
  const kdjToggle = (await kdjSwitch.count()) ? kdjSwitch : kdjCheckbox;
  await kdjToggle.click();

  const pane = page.getByTestId('pane-kdj');
  await expect(pane).toBeVisible();

  await page.reload();
  await waitForCharts(page);
  await expect(pane).toBeVisible();

  await kdjToggle.click();
  await expect(pane).toHaveCount(0);

  await page.reload();
  await waitForCharts(page);
  await expect(pane).toHaveCount(0);
});
