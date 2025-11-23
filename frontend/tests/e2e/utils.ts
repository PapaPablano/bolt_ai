import { test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

export const TEST_SYMBOL = 'AAPL';

const resolveSymbol = (symbol?: string) => (symbol ?? TEST_SYMBOL).toUpperCase();
const trackedProbePages = new Set<Page>();

export async function enableProbe(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as any;
    w.__QA_PROBE__ = '1';
    delete w.__probe;
    delete w.__probeBoot;
  });
}

type ChartSnapshot = {
  stage: string | null;
  seriesCount: number | null;
};

type WaitForChartsResult = {
  symbol: string;
} & ChartSnapshot;

export type ProbeRange = { from: number; to: number };

export type ProbeMetrics = {
  fps: number;
  logicalRange: ProbeRange | null;
  secondsRange: ProbeRange | null;
  dataRange: ProbeRange | null;
};

export function trackProbePage(page: Page) {
  trackedProbePages.add(page);
}

export async function hoverMainChart(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const chart = page.getByTestId('chart-root');
  await chart.hover();
  const box = await chart.boundingBox();
  if (!box) throw new Error('chart bounding box unavailable');
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  return box;
}

export function clearTrackedProbePages() {
  trackedProbePages.clear();
}

test.afterAll(() => {
  clearTrackedProbePages();
});

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
  await enableProbe(page.context());
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
  await page.goto(`/?${qs.toString()}`, { waitUntil: 'networkidle' });
  await page.getByTestId('chart-root').waitFor({ state: 'visible' });
}

export async function waitForProbe(page: Page, timeoutMs = 15_000) {
  const pollMs = 100;
  const deadline = Date.now() + timeoutMs;

  // Explicit polling loop instead of page.waitForFunction to avoid flakiness
  // around navigation/step lifetimes in Playwright.
  // "Ready" means either:
  // - __probe has at least one namespace, OR
  // - __probeBoot.stages contains 'seed-bars-ready', OR
  // - __probeBoot exists at all (boot contract is wired; waitForCharts will
  //   perform stricter, symbol-scoped checks).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let ready = false;
    try {
      ready = await page.evaluate(() => {
        const w = window as any;
        const hasProbe = !!w.__probe && Object.keys(w.__probe).length > 0;
        const bootReady =
          Array.isArray(w.__probeBoot?.stages) &&
          w.__probeBoot.stages.some((s: any) => s?.stage === 'seed-bars-ready');
        const bootPresent = !!w.__probeBoot;
        return hasProbe || bootReady || bootPresent;
      });
    } catch {
      // If the page navigated between polls, just retry until timeout.
      ready = false;
    }

    if (ready) return;

    if (Date.now() >= deadline) {
      try {
        // Best-effort probe snapshot to aid debugging when readiness never materializes.
        await debugProbe(page, 'waitForProbe-timeout');
      } catch {
        // ignore logging errors
      }
      throw new Error(`waitForProbe: probe did not become ready within ${timeoutMs}ms`);
    }

    await page.waitForTimeout(pollMs);
  }
}

export async function waitForCharts(
  page: Page,
  opts: {
    symbol?: string;
    timeoutMs?: number;
    pollMs?: number;
    /** If false, skip waiting for seriesCount>0 and only gate on boot stages. */
    requireSeries?: boolean;
    /** Override for the seriesCount gate timeout; defaults to timeoutMs. */
    seriesGateMs?: number;
    /** Minimum series count to consider ready; defaults to 1. */
    minSeries?: number;
  } = {},
): Promise<WaitForChartsResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const pollMs = opts.pollMs ?? 100;
  const requireSeries = opts.requireSeries ?? true;
  const seriesGateMs = opts.seriesGateMs ?? timeoutMs;
  const minSeries = opts.minSeries ?? 1;

  await waitForProbe(page, timeoutMs);

  const preferredSymbol = opts.symbol ? resolveSymbol(opts.symbol) : undefined;
  const symbol = await resolveChartSymbol(page, preferredSymbol);

  // 1) Wait for deterministic boot stages scoped to the symbol
  {
    const deadline = Date.now() + timeoutMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let ready = false;
      try {
        ready = await page.evaluate(({ sym }: { sym: string }) => {
          const entry = (window as any).__probe?.[sym];
          if (!entry) return false;
          const bootStage = entry.bootStage ?? null;
          return bootStage === 'candle-series-created' || bootStage === 'seed-bars-ready';
        }, { sym: symbol });
      } catch {
        ready = false;
      }

      if (ready) break;

      if (Date.now() >= deadline) {
        await debugProbe(page, 'waitForCharts-stage');
        throw new Error(`waitForCharts: boot stage did not reach ready state within ${timeoutMs}ms`);
      }

      await page.waitForTimeout(pollMs);
    }
  }

  // 2) Optionally wait for seriesCount>=minSeries
  if (requireSeries) {
    const deadline = Date.now() + seriesGateMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let ready = false;
      try {
        ready = await page.evaluate(({ sym, min }: { sym: string; min: number }) => {
          const entry = (window as any).__probe?.[sym];
          if (!entry) return false;
          const count = entry.seriesCount;
          return typeof count === 'number' && count >= min;
        }, { sym: symbol, min: minSeries });
      } catch {
        ready = false;
      }

      if (ready) break;

      if (Date.now() >= deadline) {
        await debugProbe(page, 'waitForCharts-series');
        throw new Error(`waitForCharts: seriesCount did not reach >=${minSeries} within ${seriesGateMs}ms`);
      }

      await page.waitForTimeout(pollMs);
    }
  }

  const snapshot = await readChartSnapshot(page, symbol);
  return { symbol, ...snapshot };
}

async function resolveChartSymbol(page: Page, preferred?: string): Promise<string> {
  const result = await page.evaluate<
    { symbol: string | null; namespaces: string[] },
    { prefer?: string }
  >(
    ({ prefer }) => {
      const w = window as any;
      const root = w.__probe ?? {};
      const namespaces = Object.keys(root);
      if (prefer) {
        return { symbol: root[prefer] ? prefer : null, namespaces };
      }
      const mounted = Array.isArray(w.__probeBoot?.mounted) ? w.__probeBoot.mounted : [];
      const mountedSymbol = mounted[0]?.symbol;
      if (mountedSymbol && root[mountedSymbol]) {
        return { symbol: mountedSymbol, namespaces };
      }
      if (namespaces.length === 1) {
        return { symbol: namespaces[0], namespaces };
      }
      return { symbol: null, namespaces };
    },
    { prefer: preferred },
  );

  if (result.symbol) return result.symbol;

  await debugProbe(page, 'waitForCharts-no-symbol');
  const namespaceList = result.namespaces.length ? result.namespaces.join(', ') : 'none';
  if (preferred) {
    throw new Error(
      `waitForCharts: symbol "${preferred}" not found in probe namespaces (${namespaceList}).`,
    );
  }
  throw new Error(
    `waitForCharts: could not resolve target symbol automatically (namespaces: ${namespaceList}). Pass opts.symbol.`,
  );
}

async function readChartSnapshot(page: Page, symbol: string): Promise<ChartSnapshot> {
  return page.evaluate<ChartSnapshot, { sym: string }>(
    ({ sym }) => {
      const entry = (window as any).__probe?.[sym];
      return {
        stage: entry?.bootStage ?? null,
        seriesCount: typeof entry?.seriesCount === 'number' ? entry.seriesCount : null,
      };
    },
    { sym: symbol },
  );
}

export async function probeKeys(page: Page) {
  return page.evaluate(() => Object.keys((window as any).__probe ?? {}));
}

export async function readProbeBoot(page: Page) {
  return page.evaluate(() => (window as any).__probeBoot ?? null);
}

export async function debugProbe(page: Page, label = 'probe-debug') {
  try {
    if (typeof page.isClosed === 'function' && page.isClosed()) {
      // eslint-disable-next-line no-console
      console.log(`[${label}] page is closed; skipping probe debug`);
      return;
    }

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[${label}] failed to read probe`, error);
  }
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

export async function readProbeMetrics(page: Page, symbol?: string): Promise<ProbeMetrics> {
  const target = resolveSymbol(symbol);
  return page.evaluate<ProbeMetrics, { symbol: string }>(
    ({ symbol: sym }) => {
      const entry = (window as any).__probe?.[sym];
      return {
        fps: typeof entry?.fps === 'number' ? entry.fps : 0,
        logicalRange: entry?.visibleLogicalRange ?? null,
        secondsRange: entry?.visibleSecondsRange ?? null,
        dataRange: entry?.dataLogicalRange ?? null,
      };
    },
    { symbol: target },
  );
}
