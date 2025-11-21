import { Page, expect } from '@playwright/test';

export async function waitForCharts(page: Page) {
  await page.waitForFunction(
    () => (window as any).__probe?.seriesCount > 0,
    null,
    { polling: 100, timeout: 10_000 },
  );
}

export async function getMacdSpacing(page: Page) {
  return page.evaluate(() => (window as any).__probe?.macdBarSpacing ?? null);
}
