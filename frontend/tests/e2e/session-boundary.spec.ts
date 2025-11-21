import { test, expect } from '@playwright/test';
import { resetClientState, waitForCharts, TEST_SYMBOL, getVisibleRanges, getMacdSpacing, gotoChart } from './utils';

const RUN_ON_REAL_BACKEND = false;

const HORIZONTAL_SWEEPS = [400, 400, -200, 300];

async function hoverChart(page: import('@playwright/test').Page) {
  const chart = page.getByTestId('chart-root');
  await chart.hover();
  const box = await chart.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
}

(RUN_ON_REAL_BACKEND ? test : test.skip)('1m session boundary prevents overscroll and keeps spacing stable', async ({ page }) => {
  await resetClientState(page);
  await gotoChart(page, { symbol: TEST_SYMBOL, mock: !RUN_ON_REAL_BACKEND });
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const tfButton = page.getByTestId('tf-1Min');
  if (await tfButton.count()) {
    await tfButton.click();
    await waitForCharts(page, { symbol: TEST_SYMBOL });
  }

  await hoverChart(page);
  const before = await getVisibleRanges(page, TEST_SYMBOL);
  expect(before.vis).not.toBeNull();
  expect(before.all).not.toBeNull();

  for (const delta of HORIZONTAL_SWEEPS) {
    await page.mouse.wheel(delta, 0);
    await page.waitForTimeout(60);
  }
  await page.mouse.wheel(0, -600);
  await waitForCharts(page, { symbol: TEST_SYMBOL });

  const after = await getVisibleRanges(page, TEST_SYMBOL);
  expect(after.vis).not.toBeNull();
  expect(after.all).not.toBeNull();
  expect(after.vis!.to).toBeLessThanOrEqual(after.all!.to + 0.5);
  expect(after.vis!.from).toBeGreaterThanOrEqual(0);
  expect(after.vis!.to).toBeGreaterThan(before.vis!.to);

  const spacing = await getMacdSpacing(page, TEST_SYMBOL);
  if (spacing !== null) {
    expect([5, 7, 9]).toContain(spacing);
  }
});
