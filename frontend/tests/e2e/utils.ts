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

export async function readProbeCounts(page: Page, symbol?: string) {
  const target = symbol ? resolveSymbol(symbol) : undefined;
  return page.evaluate(
    ({ symbol: sym }: { symbol?: string }) => {
      const root = (window as any).__probe ?? {};
      const key = sym ?? Object.keys(root)[0];
      const entry = key ? root[key] ?? {} : {};
      return {
        events: entry.econEventCount ?? 0,
        markers: entry.econMarkerCount ?? 0,
      };
    },
    { symbol: target },
  );
}

export async function gotoChart(
  page: Page,
  { symbol = TEST_SYMBOL, mock = true, seed = 1337, mockEnd }: { symbol?: string; mock?: boolean; seed?: number; mockEnd?: number } = {},
) {
  await page.addInitScript(() => {
    try {
      (window as any).__QA_PROBE__ = '1';
    } catch {
      /* ignore */
    }
  });
  const qs = new URLSearchParams();
  qs.set('symbol', resolveSymbol(symbol));
  qs.set('mock', mock ? '1' : '0');
  if (seed !== undefined) qs.set('seed', String(seed));
  if (mock && mockEnd) qs.set('mockEnd', String(mockEnd));
  await page.goto(`/?${qs.toString()}`, { waitUntil: 'domcontentloaded' });
}

export async function waitForProbe(page: Page) {
  await page.waitForFunction(
    () => {
      const root = (window as any).__probe;
      return !!root && Object.keys(root).length > 0;
    },
    undefined,
    { timeout: 10_000 },
  );
}

export async function waitForCharts(page: Page, opts: { symbol?: string } = {}) {
  const symbol = opts.symbol ? resolveSymbol(opts.symbol) : undefined;
  await waitForProbe(page);
  await page.waitForFunction(
    ({ symbol: sym }: { symbol?: string }) => {
      const root = (window as any).__probe;
      if (!root) return false;
      const key = sym ?? Object.keys(root)[0];
      if (!key) return false;
      const count = root[key]?.seriesCount ?? null;
      return typeof count === 'number' && count > 0;
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
