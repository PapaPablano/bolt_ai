import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, resetClientState, debugTrackedProbePages, clearTrackedProbePages, readProbeCounts } from './utils';

test.afterEach(async (_ctx, testInfo) => {
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
  const snap = await waitForCharts(page, { symbol: 'AAPL', timeoutMs: 15_000, seriesGateMs: 15_000 });
  expect(snap.seriesCount ?? 0).toBeGreaterThan(0);

  const toggle = page.getByTestId('toggle-calendar');

  await toggle.click();
  await expect.poll(async () => (await readProbeCounts(page, 'AAPL')).markers).toBeGreaterThan(0);

  await toggle.click();
  await expect.poll(async () => (await readProbeCounts(page, 'AAPL')).markers).toBe(0);
});
