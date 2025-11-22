import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, resetClientState, debugTrackedProbePages, clearTrackedProbePages } from './utils';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await debugTrackedProbePages(testInfo.title);
  }
  clearTrackedProbePages();
});

test('calendar toggle applies and clears markers (mocked)', async ({ page }) => {
  await resetClientState(page);

  await page.route('**/v1/calendar**', async (route) => {
    const now = Math.floor(Date.now() / 1000);
    const body = [
      { id: 'e1', source: 'forexfactory', ts: now - 600, title: 'CPI', impact: 'high' },
      { id: 'e2', source: 'forexfactory', ts: now + 1200, title: 'Retail', impact: 'medium' },
    ];
    await route.fulfill({
      status: 200,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  });

  await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });
  await waitForCharts(page, { symbol: 'AAPL' });

  const toggle = page.getByTestId('toggle-calendar');

  await toggle.click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const probe = (window as any).__probe ?? {};
        const key = Object.keys(probe)[0];
        if (!key) return 0;
        return probe[key]?.econMarkerCount ?? 0;
      }),
    )
    .toBeGreaterThan(0);

  await toggle.click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const probe = (window as any).__probe ?? {};
        const key = Object.keys(probe)[0];
        if (!key) return 0;
        return probe[key]?.econMarkerCount ?? 999;
      }),
    )
    .toBe(0);
});
