import { test, expect } from '@playwright/test';
import { gotoChart, waitForCharts, readProbeCounts, resetClientState } from './utils';

test('Economic calendar overlay enforces density cap (<= 50)', async ({ page }) => {
  await resetClientState(page);

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
  await waitForCharts(page, { symbol: 'AAPL' });

  const toggle = page.getByTestId('toggle-calendar');
  await toggle.click();

  await expect.poll(async () => (await readProbeCounts(page, 'AAPL')).markers).toBeGreaterThan(0);
  const counts = await readProbeCounts(page, 'AAPL');
  expect(counts.markers).toBeLessThanOrEqual(50);
});
