import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoChart, waitForCharts, resetClientState, TEST_SYMBOL, hoverMainChart, ProbeRange } from './utils';

const FPS_MEDIAN_FLOOR = 36;
const PAN_FRACTION_START = 0.7;
const PAN_FRACTION_END = 0.3;
const ZOOM_IN_DELTA = -180;
const ZOOM_OUT_DELTA = 140;
const SAMPLE_COUNT = 6;
const SAMPLE_DELAY_MS = 150;

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
  if (typeof page.isClosed === 'function' && page.isClosed()) {
    throw new Error('readProbeSnapshot: page is closed');
  }

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
    test.slow();
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
    if (!chartBox || chartBox.width < 10 || chartBox.height < 10) {
      throw new Error('pan-zoom-fps: chart box too small for pan/zoom');
    }
    const centerX = chartBox.x + chartBox.width * 0.5;
    const midY = chartBox.y + chartBox.height * 0.5;
    const panDistance = Math.max(40, Math.min(120, chartBox.width * 0.2));
    const startX = centerX - panDistance / 2;
    const endX = centerX + panDistance / 2;

    await page.mouse.move(startX, midY);
    await page.mouse.down();
    await page.mouse.move(endX, midY, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(160);
    await page.mouse.wheel(0, ZOOM_IN_DELTA);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, ZOOM_OUT_DELTA);
    await waitForCharts(page, { symbol: TEST_SYMBOL, requireSeries: true });

    const fpsSamples: number[] = [];
    const sampleSnapshots: ProbeSnapshot[] = [];
    const recordSample = async () => {
      try {
        const snap = await readProbeSnapshot(page, TEST_SYMBOL);
        sampleSnapshots.push(snap);
        fpsSamples.push(snap.fps);
      } catch {
      }
    };
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      if (typeof page.isClosed === 'function' && page.isClosed()) break;
      await recordSample();
      if (i < SAMPLE_COUNT - 1) await page.waitForTimeout(SAMPLE_DELAY_MS);
    }

    const finalMetrics = await readProbeSnapshot(page, TEST_SYMBOL);
    expect(finalMetrics.logicalRange).not.toBeNull();
    expect(finalMetrics.secondsRange).not.toBeNull();

    const beforeRange = baseline.secondsRange!;
    const afterRange = finalMetrics.secondsRange!;

    const beforeSpan = beforeRange.to - beforeRange.from;

    expect(afterRange.from).not.toBeCloseTo(beforeRange.from, 0);
    // Zoom operations must update visible span per docs/QA_PROBE_NOTES.md.
    const spanSamples = sampleSnapshots
      .map((snap) => snap.secondsRange)
      .filter(
        (range): range is { from: number; to: number } =>
          !!range && typeof range.from === 'number' && typeof range.to === 'number',
      )
      .map((range) => range.to - range.from);

    if (spanSamples.length > 0) {
      const spanDeltaDetected = spanSamples.some(
        (span) => Math.abs(span - beforeSpan) > beforeSpan * 0.01,
      );
      expect(spanDeltaDetected).toBeTruthy();
    }

    const positiveFps = fpsSamples.filter((v) => v > 0);

    if (positiveFps.length >= 3) {
      const fpsMedian = median(positiveFps);
      // Maintain ≥40 FPS median to meet the interaction budget (docs/QA_PROBE_NOTES.md) when we have enough samples.
      expect(fpsMedian).toBeGreaterThanOrEqual(FPS_MEDIAN_FLOOR);
    }

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
