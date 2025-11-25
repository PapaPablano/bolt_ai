import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, waitForCalendar, resetClientState, debugTrackedProbePages, clearTrackedProbePages, readProbeCounts } from './utils';

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

test.skip('calendar toggle applies and clears markers (mocked)', async ({ page }) => {
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
  await waitForCalendar(page, { symbol: 'AAPL' });
  expect(snap.seriesCount ?? 0).toBeGreaterThan(0);

  await page.evaluate(() => {
    const w = window as any;
    const entry = w.__probe?.AAPL;
    if (entry?.setCalendarEnabled) entry.setCalendarEnabled(true);
  });

  await expect.poll(async () => (await readProbeCounts(page, 'AAPL')).markers).toBeGreaterThan(0);

  await page.evaluate(() => {
    const w = window as any;
    const entry = w.__probe?.AAPL;
    if (entry?.setCalendarEnabled) entry.setCalendarEnabled(false);
  });

  await expect.poll(async () => (await readProbeCounts(page, 'AAPL')).markers).toBe(0);
});
