import { Page } from '@playwright/test';

export const TEST_SYMBOL = 'AAPL';

const resolveSymbol = (symbol?: string) => (symbol ?? TEST_SYMBOL).toUpperCase();
const trackedProbePages = new Set<Page>();

export function trackProbePage(page: Page) {
  trackedProbePages.add(page);
}

export function clearTrackedProbePages() {
  trackedProbePages.clear();
}

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

export async function prepareProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__QA_PROBE__ = '1';
    delete w.__probe;
    delete w.__probeBoot;
  });
}

export async function gotoChart(
  page: Page,
  { symbol = TEST_SYMBOL, mock = true, seed = 1337, mockEnd }: { symbol?: string; mock?: boolean; seed?: number; mockEnd?: number } = {},
) {
  await prepareProbe(page);
  trackProbePage(page);
  const qs = new URLSearchParams();
  qs.set('symbol', resolveSymbol(symbol));
  qs.set('mock', mock ? '1' : '0');
  if (seed !== undefined) qs.set('seed', String(seed));
  if (mock && mockEnd) qs.set('mockEnd', String(mockEnd));
  await page.goto(`/?${qs.toString()}`, { waitUntil: 'domcontentloaded' });
}

export async function waitForProbe(page: Page, timeoutMs = 15_000) {
  await page.waitForFunction(
    () => {
      const root = (window as any).__probe;
      return !!root && Object.keys(root).length > 0;
    },
    undefined,
    { timeout: timeoutMs, polling: 100 },
  );
}

export async function waitForCharts(page: Page, opts: { symbol?: string; timeoutMs?: number } = {}) {
  const symbol = opts.symbol ? resolveSymbol(opts.symbol) : undefined;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  await waitForProbe(page, timeoutMs);

  const stageTimeout = timeoutMs;
  try {
    await page.waitForFunction(
      ({ symbol: sym }: { symbol?: string }) => {
        const root = (window as any).__probe;
        if (!root) return false;
        const key = sym ?? Object.keys(root)[0];
        if (!key) return false;
        const stage = root[key]?.bootStage ?? 'none';
        return stage === 'candle-series-created' || stage === 'seed-bars-ready';
      },
      { symbol },
      { polling: 100, timeout: stageTimeout },
    );
  } catch (error) {
    await debugProbe(page, 'waitForCharts-stage');
    throw error;
  }

  try {
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
      { polling: 100, timeout: Math.min(5_000, timeoutMs) },
    );
  } catch (error) {
    await debugProbe(page, 'waitForCharts-series');
    throw error;
  }
}

export async function probeKeys(page: Page) {
  return page.evaluate(() => Object.keys((window as any).__probe ?? {}));
}

export async function readProbeBoot(page: Page) {
  return page.evaluate(() => (window as any).__probeBoot ?? null);
}

export async function debugProbe(page: Page, label = 'probe-debug') {
  const info = await page.evaluate(() => {
    const w = window as any;
    const root = w.__probe ?? {};
    const firstKey = Object.keys(root)[0];
    const entry = firstKey ? root[firstKey] : undefined;
    return {
      hasProbe: !!w.__probe,
      nsKeys: Object.keys(root),
      stage: entry?.bootStage ?? null,
      seriesCount: entry?.seriesCount ?? null,
      boot: w.__probeBoot ?? null,
    };
  });
  // eslint-disable-next-line no-console
  console.log(`[${label}]`, JSON.stringify(info));
}

export async function debugTrackedProbePages(label = 'probe-debug') {
  let idx = 0;
  for (const page of trackedProbePages) {
    let derived = `${label}[${idx}]`;
    try {
      const url = page.url();
      if (url) derived = `${derived}:${url}`;
    } catch {
      /* ignore */
    }
    await debugProbe(page, derived);
    idx += 1;
  }
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
