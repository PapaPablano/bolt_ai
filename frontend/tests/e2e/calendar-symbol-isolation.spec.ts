import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, readProbeCounts, resetClientState, debugTrackedProbePages, clearTrackedProbePages } from './utils';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await debugTrackedProbePages(testInfo.title);
  }
  clearTrackedProbePages();
});

test('Calendar markers are isolated per symbol namespace', async ({ browser }) => {
  const ctx = await browser.newContext();
  const aapl = await ctx.newPage();
  const msft = await ctx.newPage();

  await Promise.all([resetClientState(aapl), resetClientState(msft)]);

  await aapl.route('**/v1/calendar**', async (route) => {
    const now = Math.floor(Date.now() / 1000);
    const body = [
      { id: 'a1', source: 'forexfactory', ts: now - 600, title: 'A-1', impact: 'high' as const },
      { id: 'a2', source: 'forexfactory', ts: now + 600, title: 'A-2', impact: 'medium' as const },
      { id: 'a3', source: 'forexfactory', ts: now + 1200, title: 'A-3', impact: 'medium' as const },
    ];
    await route.fulfill({ status: 200, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  });

  await msft.route('**/v1/calendar**', async (route) => {
    const now = Math.floor(Date.now() / 1000);
    const body = [{ id: 'm1', source: 'forexfactory', ts: now + 300, title: 'M-1', impact: 'high' as const }];
    await route.fulfill({ status: 200, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  });

  await gotoChart(aapl, { symbol: 'AAPL', mock: true, seed: 42 });
  await gotoChart(msft, { symbol: 'MSFT', mock: true, seed: 43 });
  await Promise.all([waitForCharts(aapl, { symbol: 'AAPL' }), waitForCharts(msft, { symbol: 'MSFT' })]);

  await Promise.all([aapl.getByTestId('toggle-calendar').click(), msft.getByTestId('toggle-calendar').click()]);

  await expect.poll(async () => (await readProbeCounts(aapl, 'AAPL')).markers).toBeGreaterThan(1);
  await expect.poll(async () => (await readProbeCounts(msft, 'MSFT')).markers).toBeGreaterThanOrEqual(1);

  const [aaplCounts, msftCounts] = await Promise.all([readProbeCounts(aapl, 'AAPL'), readProbeCounts(msft, 'MSFT')]);
  expect(aaplCounts.markers).toBeGreaterThan(msftCounts.markers);
  expect(msftCounts.markers).toBeGreaterThanOrEqual(1);
});
