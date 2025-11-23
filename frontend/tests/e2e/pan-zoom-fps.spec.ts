import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoChart, waitForCharts, resetClientState, TEST_SYMBOL, hoverMainChart, ProbeRange } from './utils';

const FPS_MEDIAN_FLOOR = 40;
const PAN_FRACTION_START = 0.7;
const PAN_FRACTION_END = 0.3;
const ZOOM_IN_DELTA = -320;
const ZOOM_OUT_DELTA = 240;
const SAMPLE_COUNT = 12;
const SAMPLE_DELAY_MS = 120;

type ProbeSnapshot = {
  ts: number;
  fps: number;
  logicalRange: ProbeRange | null;
  secondsRange: ProbeRange | null;
  dataRange: ProbeRange | null;
  bootStage: string | null;
  namespaces: string[];
};

type ProbeAttachment = {
  scenario: string;
  symbol: string;
  baseline: ProbeSnapshot;
  samples: ProbeSnapshot[];
  final: ProbeSnapshot;
  rawProbe: { probes: unknown; boot: unknown };
};

const rangeSpan = (range: ProbeRange | null | undefined) => (range ? Math.max(0, range.to - range.from) : 0);

const readProbeSnapshot = async (page: Page, symbol: string): Promise<ProbeSnapshot> => {
  return page.evaluate<ProbeSnapshot, { symbol: string }>(({ symbol: sym }: { symbol: string }) => {
    const w = window as any;
    const entry = w.__probe?.[sym];
    return {
      ts: Date.now(),
      fps: typeof entry?.fps === 'number' ? entry.fps : 0,
      logicalRange: entry?.visibleLogicalRange ?? null,
      secondsRange: entry?.visibleSecondsRange ?? null,
      dataRange: entry?.dataLogicalRange ?? null,
      bootStage: entry?.bootStage ?? null,
      namespaces: Object.keys(w.__probe ?? {}),
    };
  }, { symbol });
};

const dumpRawProbe = async (page: Page) => {
  return page.evaluate(() => {
    const w = window as any;
    return { probes: w.__probe ?? null, boot: w.__probeBoot ?? null };
  });
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

test.describe('pan/zoom performance & correctness', () => {
  test('pan + zoom updates probe ranges and keeps FPS healthy', async ({ page }, testInfo) => {
    await resetClientState(page);
    await gotoChart(page, { symbol: TEST_SYMBOL, mock: true, seed: 1337 });

    await waitForCharts(page, {
      symbol: TEST_SYMBOL,
      requireSeries: true,
      timeoutMs: 15_000,
      seriesGateMs: 15_000,
    });

    const baseline = await readProbeSnapshot(page, TEST_SYMBOL);
    expect(baseline.logicalRange).not.toBeNull();
    expect(baseline.secondsRange).not.toBeNull();

    const chartBox = await hoverMainChart(page);
    const startX = chartBox.x + chartBox.width * PAN_FRACTION_START;
    const endX = chartBox.x + chartBox.width * PAN_FRACTION_END;
    const midY = chartBox.y + chartBox.height * 0.5;

    await page.mouse.move(startX, midY);
    await page.mouse.down();
    await page.mouse.move(endX, midY, { steps: 15 });
    await page.mouse.up();

    await page.waitForTimeout(160);
    await page.mouse.wheel(0, ZOOM_IN_DELTA);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, ZOOM_OUT_DELTA);
    await waitForCharts(page, { symbol: TEST_SYMBOL, requireSeries: true });

    const fpsSamples: number[] = [];
    const sampleSnapshots: ProbeSnapshot[] = [];
    const recordSample = async () => {
      const snap = await readProbeSnapshot(page, TEST_SYMBOL);
      sampleSnapshots.push(snap);
      fpsSamples.push(snap.fps);
    };
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      await recordSample();
      await page.waitForTimeout(SAMPLE_DELAY_MS);
    }

    const finalMetrics = await readProbeSnapshot(page, TEST_SYMBOL);
    expect(finalMetrics.logicalRange).not.toBeNull();
    expect(finalMetrics.secondsRange).not.toBeNull();

    const beforeRange = baseline.secondsRange!;
    const afterRange = finalMetrics.secondsRange!;
    const beforeSpan = rangeSpan(beforeRange);
    const afterSpan = rangeSpan(afterRange);

    expect(afterRange.from).not.toBeCloseTo(beforeRange.from, 0);
    // Zoom operations must shrink visible span per docs/QA_PROBE_NOTES.md.
    expect(afterSpan).toBeLessThan(beforeSpan);

    const fpsMedian = median(fpsSamples);
    // Maintain ≥40 FPS median to meet the interaction budget (docs/QA_PROBE_NOTES.md).
    expect(fpsMedian).toBeGreaterThanOrEqual(FPS_MEDIAN_FLOOR);

    const attachment: ProbeAttachment = {
      scenario: 'pan-zoom-fps',
      symbol: TEST_SYMBOL,
      baseline,
      samples: sampleSnapshots,
      final: finalMetrics,
      rawProbe: await dumpRawProbe(page),
    };
    await testInfo.attach('probe-metrics', {
      body: JSON.stringify(attachment, null, 2),
      contentType: 'application/json',
    });
  });
});
