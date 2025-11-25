import { test, expect } from '@playwright/test';
import { resetClientState, waitForCharts, getSeriesCount, getMacdSpacing, setMacdThickness, gotoChart } from './utils';

const SYMBOL_A = 'AAPL';
const SYMBOL_B = 'MSFT';
const urlFor = (symbol: string) => `/?symbol=${symbol}`;

test('indicator toggles and probe mutations stay isolated per chart', async ({ page, context }) => {
  test.slow();
  await resetClientState(page);
  await gotoChart(page, { symbol: SYMBOL_A });
  const snapA = await waitForCharts(page, { symbol: SYMBOL_A });

  const secondary = await context.newPage();
  await resetClientState(secondary);
  await gotoChart(secondary, { symbol: SYMBOL_B });
  const snapB = await waitForCharts(secondary, { symbol: SYMBOL_B });

  // Prefer probe-driven indicator toggling to avoid flaky UI interactions.
  await page.evaluate(({ a, b }) => {
    const w = window as any;
    const root = w.__probe ?? {};
    const entryA = root[a];
    const entryB = root[b];
    if (entryA?.setMacdEnabled) entryA.setMacdEnabled(true);
    if (entryB?.setMacdEnabled) entryB.setMacdEnabled(true);
    if (entryA?.setKdjEnabled) entryA.setKdjEnabled(true);
    if (entryB?.setKdjEnabled) entryB.setKdjEnabled(true);
  }, { a: SYMBOL_A, b: SYMBOL_B });

  const baselineSpacingB = await getMacdSpacing(secondary, SYMBOL_B);
  expect(baselineSpacingB).not.toBeNull();

  // Disable MACD and KDJ only on the primary chart via probe helpers.
  await page.evaluate(({ a }) => {
    const w = window as any;
    const root = w.__probe ?? {};
    const entryA = root[a];
    if (entryA?.setMacdEnabled) entryA.setMacdEnabled(false);
    if (entryA?.setKdjEnabled) entryA.setKdjEnabled(false);
  }, { a: SYMBOL_A });
  await waitForCharts(page, { symbol: SYMBOL_A });
  await page.waitForTimeout(150);

  // Ensure MACD spacing changes only on the primary chart and remains
  // stable on the secondary chart.
  expect(await getMacdSpacing(secondary, SYMBOL_B)).toBe(baselineSpacingB);

  const spacingABefore = await getMacdSpacing(page, SYMBOL_A);
  expect(spacingABefore).not.toBeNull();
  await setMacdThickness(page, 'wide', SYMBOL_A);
  await page.waitForTimeout(200);
  const spacingAAfter = await getMacdSpacing(page, SYMBOL_A);
  expect(spacingAAfter).not.toBe(spacingABefore);
  expect(await getMacdSpacing(secondary, SYMBOL_B)).toBe(baselineSpacingB);
});
