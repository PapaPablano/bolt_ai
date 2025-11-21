import { Page } from '@playwright/test';

export const TEST_SYMBOL = 'AAPL';
export const TEST_URL = `/?symbol=${TEST_SYMBOL}`;

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
      if (!entry) return { visible: null, data: null };
      return {
        visible: entry.visibleLogicalRange ?? null,
        data: entry.dataLogicalRange ?? null,
      };
    },
    { symbol: target },
  );
}
