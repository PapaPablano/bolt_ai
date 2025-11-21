import { test, expect, Page } from '@playwright/test';
import { resetClientState, waitForCharts, getSeriesCount, getMacdSpacing, setMacdThickness } from './utils';

const SYMBOL_A = 'AAPL';
const SYMBOL_B = 'MSFT';
const urlFor = (symbol: string) => `/?symbol=${symbol}`;

const ensureToggleState = async (page: Page, testId: string, desired: boolean) => {
  const toggle = page.getByTestId(testId);
  await toggle.waitFor({ state: 'attached' });
  if ((await toggle.isChecked()) !== desired) {
    await toggle.click();
  }
};

const waitForMacdProbe = async (page: Page, symbol: string) => {
  await page.waitForFunction(
    ({ symbol: sym }) => {
      const root = (window as any).__probe ?? {};
      return root[sym]?.macdBarSpacing != null;
    },
    { symbol },
    { timeout: 10_000 },
  );
};

test('indicator toggles and probe mutations stay isolated per chart', async ({ page, context }) => {
  await resetClientState(page);
  await page.goto(urlFor(SYMBOL_A));
  await waitForCharts(page, { symbol: SYMBOL_A });

  const secondary = await context.newPage();
  await resetClientState(secondary);
  await secondary.goto(urlFor(SYMBOL_B));
  await waitForCharts(secondary, { symbol: SYMBOL_B });

  await ensureToggleState(page, 'toggle-macd', true);
  await ensureToggleState(page, 'toggle-kdj', true);
  await ensureToggleState(secondary, 'toggle-macd', true);
  await ensureToggleState(secondary, 'toggle-kdj', true);

  await waitForMacdProbe(page, SYMBOL_A);
  await waitForMacdProbe(secondary, SYMBOL_B);

  const baselineSeriesA = await getSeriesCount(page, SYMBOL_A);
  const baselineSeriesB = await getSeriesCount(secondary, SYMBOL_B);
  const baselineSpacingB = await getMacdSpacing(secondary, SYMBOL_B);
  expect(baselineSpacingB).not.toBeNull();

  await page.getByTestId('toggle-macd').click();
  await page.getByTestId('toggle-kdj').click();
  await waitForCharts(page, { symbol: SYMBOL_A });
  await page.waitForTimeout(150);

  expect(await getSeriesCount(page, SYMBOL_A)).not.toBe(baselineSeriesA);
  expect(await getSeriesCount(secondary, SYMBOL_B)).toBe(baselineSeriesB);
  expect(await getMacdSpacing(secondary, SYMBOL_B)).toBe(baselineSpacingB);

  const spacingABefore = await getMacdSpacing(page, SYMBOL_A);
  expect(spacingABefore).not.toBeNull();
  await setMacdThickness(page, 'wide', SYMBOL_A);
  await page.waitForTimeout(200);
  const spacingAAfter = await getMacdSpacing(page, SYMBOL_A);
  expect(spacingAAfter).not.toBe(spacingABefore);
  expect(await getMacdSpacing(secondary, SYMBOL_B)).toBe(baselineSpacingB);
});
