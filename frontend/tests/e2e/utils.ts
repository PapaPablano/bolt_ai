import { Page } from '@playwright/test';

export const TEST_SYMBOL = 'AAPL';

const resolveSymbol = (symbol?: string) => (symbol ?? TEST_SYMBOL).toUpperCase();

export async function resetClientState(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.databases?.().then((dbs) => dbs?.forEach((db) => db?.name && indexedDB.deleteDatabase(db.name!)));
    } catch {
      // best-effort cleanup
    }
  });
}

export async function gotoChart(
  page: Page,
  { symbol = TEST_SYMBOL, mock = true, seed = 1337, mockEnd }: { symbol?: string; mock?: boolean; seed?: number; mockEnd?: number } = {},
) {
  const qs = new URLSearchParams();
  qs.set('symbol', resolveSymbol(symbol));
  if (mock) {
    qs.set('mock', '1');
    qs.set('seed', String(seed));
    if (mockEnd) qs.set('mockEnd', String(mockEnd));
  }
  await page.goto(`/?${qs.toString()}`);
}

export async function waitForCharts(page: Page, opts: { symbol?: string } = {}) {
  const symbol = opts.symbol ? resolveSymbol(opts.symbol) : undefined;
  await page.waitForFunction(
    ({ symbol: sym }: { symbol?: string }) => {
      const root = (window as any).__probe;
      if (!root) return false;
      if (sym) return !!root[sym];
      return Object.keys(root).length > 0;
    },
    { symbol },
    { polling: 100, timeout: 10_000 },
  );
}

export async function probeKeys(page: Page) {
  return page.evaluate(() => Object.keys((window as any).__probe ?? {}));
}

export async function getSeriesCount(page: Page, symbol?: string) {
  const target = symbol ? resolveSymbol(symbol) : undefined;
  return page.evaluate(
    ({ symbol: sym }: { symbol?: string }) => {
      const root = (window as any).__probe ?? {};
      const key = sym ?? Object.keys(root)[0];
      return key && root[key] ? root[key].seriesCount ?? null : null;
    },
    { symbol: target },
  );
}

export async function getMacdSpacing(page: Page, symbol?: string) {
  const target = symbol ? resolveSymbol(symbol) : undefined;
  return page.evaluate(
    ({ symbol: sym }: { symbol?: string }) => {
      const root = (window as any).__probe ?? {};
      const key = sym ?? Object.keys(root)[0];
      return key && root[key] ? root[key].macdBarSpacing ?? null : null;
    },
    { symbol: target },
  );
}

export async function setMacdThickness(page: Page, thickness: 'thin' | 'normal' | 'wide', symbol?: string) {
  const target = symbol ? resolveSymbol(symbol) : undefined;
  await page.evaluate(
    ({ t, symbol: sym }: { t: 'thin' | 'normal' | 'wide'; symbol?: string }) => {
      const root = (window as any).__probe ?? {};
      const key = sym ?? Object.keys(root)[0];
      if (key && root[key]) root[key].setMacdThickness(t);
    },
    { t: thickness, symbol: target },
  );
}

export async function getVisibleRanges(page: Page, symbol?: string) {
  const target = resolveSymbol(symbol);
  return page.evaluate(
    ({ symbol: sym }: { symbol: string }) => {
      const root = (window as any).__probe ?? {};
      const entry = root[sym];
      if (!entry) return { vis: null, all: null };
      return {
        vis: entry.visibleLogicalRange ?? null,
        all: entry.dataLogicalRange ?? null,
      };
    },
    { symbol: target },
  );
}
