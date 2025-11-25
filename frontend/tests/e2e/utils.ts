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

export async function hoverMainChart(
  page: Page,
  options: { optional?: boolean; timeoutMs?: number } = {},
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const { optional = false, timeoutMs = 8_000 } = options;

  // If the page is already closed (for example due to an outer test timeout),
  // avoid raising a secondary error from this helper.
  if (typeof page.isClosed === 'function' && page.isClosed()) {
    if (optional) return null;
    throw new Error('hoverMainChart: page is already closed');
  }

  const deadline = Date.now() + timeoutMs;
  const pollMs = 120;

  // Explicit polling loop using document.querySelector instead of locator.waitFor
  // to avoid testId auto-wait quirks on dynamic canvas/TV charts.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (typeof page.isClosed === 'function' && page.isClosed()) {
      if (optional) return null;
      throw new Error('hoverMainChart: page closed while waiting for chart-root');
    }

    try {
      const box = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="chart-root"]') as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });

      if (box && typeof box.width === 'number' && typeof box.height === 'number' && box.width > 0 && box.height > 0) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        await page.mouse.move(centerX, centerY);
        return box;
      }
    } catch (err) {
      if (!optional) {
        // For strict callers, treat unexpected evaluation errors as fatal.
        throw err;
      }
      // Optional callers can ignore transient evaluation issues and keep polling
      // until timeout.
    }

    if (Date.now() >= deadline) {
      if (optional) {
        // eslint-disable-next-line no-console
        console.warn('hoverMainChart: chart-root bounding box unavailable within timeout');
        return null;
      }
      throw new Error(`hoverMainChart: chart-root did not become interactable within ${timeoutMs}ms`);
    }

    try {
      await page.waitForTimeout(pollMs);
    } catch {
      if (optional) return null;
      throw new Error('hoverMainChart: wait aborted while polling for chart-root');
    }
  }
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

  // Best-effort DOM sync: prefer probe-driven readiness (waitForCharts) over
  // strict DOM attachment checks, but a short wait here can help with
  // navigation races in fast environments.
  try {
    await page.getByTestId('chart-root').waitFor({ state: 'attached', timeout: 3_000 });
  } catch {
    // Swallow the timeout and rely on probe readiness without dumping the
    // full TimeoutError object into the logs.
    // eslint-disable-next-line no-console
    console.warn('gotoChart: chart-root wait timed out; proceeding with probe readiness only');
  }
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
        const hasChartRoot = !!document.querySelector('[data-testid="chart-root"]');
        return hasProbe || bootReady || bootPresent || hasChartRoot;
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

  const symbol = opts.symbol ? resolveSymbol(opts.symbol) : await resolveChartSymbol(page, undefined);

  // 1) Wait for deterministic boot stages scoped to the symbol
  {
    const deadline = Date.now() + timeoutMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let ready = false;
      try {
        ready = await page.evaluate(({ sym }: { sym: string }) => {
          const w = window as any;
          const metaRoot = w.__probeMeta ?? {};
          const meta = metaRoot[sym];
          if (meta && meta.chartReady && meta.seriesReady) return true;
          const entry = w.__probe?.[sym];
          return !!entry;
        }, { sym: symbol });
      } catch {
        ready = false;
      }

      if (ready) break;

      if (Date.now() >= deadline) {
        await debugProbe(page, 'waitForCharts-stage');
        throw new Error(`waitForCharts: boot stage did not reach ready state within ${timeoutMs}ms`);
      }

      try {
        await page.waitForTimeout(pollMs);
      } catch {
        // Page/context may have been closed by an outer timeout; bail out.
        break;
      }
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

      try {
        await page.waitForTimeout(pollMs);
      } catch {
        // Page/context may have been closed by an outer timeout; bail out.
        break;
      }
    }
  }

  const snapshot = await readChartSnapshot(page, symbol);
  return { symbol, ...snapshot };
}

export async function waitForCalendar(
  page: Page,
  opts: { symbol?: string; timeoutMs?: number; pollMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const pollMs = opts.pollMs ?? 100;
  const symbol = resolveSymbol(opts.symbol);
  const deadline = Date.now() + timeoutMs;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let ready = false;
    try {
      ready = await page.evaluate(({ sym }: { sym: string }) => {
        const w = window as any;
        const metaRoot = w.__probeMeta ?? {};
        const root = w.__probe ?? {};
        const meta = metaRoot[sym];
        const entry = root[sym];

        // If there is no meta entry yet, fall back to probe counts.
        if (!meta) {
          if (!entry) return false;
          const hasCounts =
            typeof entry.econEventCount === 'number' || typeof entry.econMarkerCount === 'number';
          return hasCounts;
        }

        // If calendar is explicitly disabled, do not block tests waiting for it.
        if (meta.calendarEnabled === false) return true;

        const hasReadyFlag = !!meta.calendarEnabled && !!meta.calendarReady;
        const hasCounts =
          typeof entry?.econEventCount === 'number' || typeof entry?.econMarkerCount === 'number';
        return hasReadyFlag || hasCounts;
      }, { sym: symbol });
    } catch {
      ready = false;
    }

    if (ready) return;

    if (Date.now() >= deadline) {
      try {
        await debugProbe(page, 'waitForCalendar-timeout');
      } catch {
        // ignore logging errors
      }
      // Treat calendar readiness as best-effort to avoid cascading timeouts; callers
      // will still assert on marker/event counts where needed.
      return;
    }

    try {
      await page.waitForTimeout(pollMs);
    } catch {
      // Page/context may have been closed by an outer timeout; bail out quietly.
      return;
    }
  }
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
      // 1) If the caller provided a preferred symbol, trust it and let later
      //    stages/series gates wait for the corresponding probe entry.
      if (prefer) {
        return { symbol: prefer, namespaces };
      }
      // 2) Otherwise, if __probeBoot.mounted has a symbol, use it even if the
      //    __probe entry has not yet been created. Subsequent waits will poll
      //    until the entry appears.
      const mounted = Array.isArray(w.__probeBoot?.mounted) ? w.__probeBoot.mounted : [];
      const mountedSymbol = mounted[0]?.symbol;
      if (mountedSymbol) {
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
  try {
    return await page.evaluate<ChartSnapshot, { sym: string }>(
      ({ sym }) => {
        const w = window as any;
        const entry = w.__probe?.[sym];
        let stage = entry?.bootStage ?? null;
        if (stage == null && Array.isArray(w.__probeBoot?.stages) && w.__probeBoot.stages.length) {
          const last = w.__probeBoot.stages[w.__probeBoot.stages.length - 1];
          stage = last?.stage ?? null;
        }
        return {
          stage,
          seriesCount: typeof entry?.seriesCount === 'number' ? entry.seriesCount : null,
        };
      },
      { sym: symbol },
    );
  } catch {
    // If the page/context is already closed (e.g. due to an outer timeout),
    // return a neutral snapshot so callers can still surface a meaningful error.
    return { stage: null, seriesCount: null };
  }
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
