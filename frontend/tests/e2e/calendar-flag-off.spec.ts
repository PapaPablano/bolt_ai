import { test, expect } from '@playwright/test';
import {
  gotoChart,
  waitForCharts,
  readProbeCounts,
  resetClientState,
  debugTrackedProbePages,
  clearTrackedProbePages,
} from './utils';

let calendarCalls = 0;

test.beforeEach(async ({ page }) => {
  calendarCalls = 0;
  await resetClientState(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__QA_PROBE__ = '1';
    w.__config = { ...(w.__config ?? {}), CALENDAR_ENABLED: false };
  });

  await page.route('**/v1/calendar**', async (route) => {
    calendarCalls += 1;
    await route.abort('failed');
  });
});

test.afterEach(async (_ctx, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await debugTrackedProbePages(testInfo.title);
  }
  clearTrackedProbePages();
});

// Ensures calendar flag OFF disables UI + prevents fetches/markers.
test('calendar feature OFF gates UI and network', async ({ page }) => {
  await gotoChart(page, { symbol: 'AAPL', mock: true, seed: 42 });
  await waitForCharts(page, { symbol: 'AAPL' });

  const toggle = page.getByTestId('toggle-calendar');
  await expect(toggle).toBeDisabled();

  const counts = await readProbeCounts(page, 'AAPL');
  expect(counts.events).toBe(0);
  expect(counts.markers).toBe(0);

  expect(calendarCalls).toBe(0);
});
