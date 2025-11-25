import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, waitForCalendar, readProbeCounts, resetClientState, debugTrackedProbePages, clearTrackedProbePages } from './utils';

test.beforeEach(async ({ page }) => {
  await resetClientState(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__config = { ...(w.__config ?? {}), CALENDAR_ENABLED: true };
  });
});

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await debugTrackedProbePages(testInfo.title);
  }
  clearTrackedProbePages();
});

test('Economic calendar overlay enforces density cap (<= 50)', async ({ page }) => {
  test.slow();
  await page.route('**/v1/calendar**', async (route) => {
    const now = Math.floor(Date.now() / 1000);
    const body = Array.from({ length: 500 }, (_, idx) => ({
      id: `e-${idx}`,
      source: 'forexfactory' as const,
      ts: now - (500 - idx) * 60,
      title: `E-${idx}`,
      impact: idx % 3 === 0 ? 'high' : idx % 3 === 1 ? 'medium' : 'low',
    }));
    await route.fulfill({
      status: 200,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  });

  await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 1337 });
  const snap = await waitForCharts(page, { symbol: 'AAPL', timeoutMs: 15_000, seriesGateMs: 15_000 });
  await waitForCalendar(page, { symbol: 'AAPL' });
  await page.evaluate(() => {
    const w = window as any;
    const entry = w.__probe?.AAPL;
    if (entry?.setCalendarEnabled) entry.setCalendarEnabled(true);
  });

  const counts = await readProbeCounts(page, 'AAPL');
  expect(counts.markers).toBeLessThanOrEqual(50);
});
