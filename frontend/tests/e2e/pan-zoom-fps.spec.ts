import { test, expect } from '@playwright/test';
import {
  gotoChart,
  waitForCharts,
  resetClientState,
  TEST_SYMBOL,
  hoverMainChart,
  readProbeMetrics,
  ProbeRange,
} from './utils';

const FPS_MEDIAN_FLOOR = 40;
const PAN_FRACTION_START = 0.7;
const PAN_FRACTION_END = 0.3;
const ZOOM_IN_DELTA = -320;
const ZOOM_OUT_DELTA = 240;
const SAMPLE_COUNT = 12;
const SAMPLE_DELAY_MS = 120;

const rangeSpan = (range: ProbeRange | null | undefined) => (range ? Math.max(0, range.to - range.from) : 0);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

test.describe('pan/zoom performance & correctness', () => {
  test('pan + zoom updates probe ranges and keeps FPS healthy', async ({ page }) => {
    await resetClientState(page);
    await gotoChart(page, { symbol: TEST_SYMBOL, mock: true, seed: 1337 });

    await waitForCharts(page, {
      symbol: TEST_SYMBOL,
      requireSeries: true,
      timeoutMs: 15_000,
      seriesGateMs: 15_000,
    });

    const baseline = await readProbeMetrics(page, TEST_SYMBOL);
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

    const samples: number[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const probe = await readProbeMetrics(page, TEST_SYMBOL);
      samples.push(probe.fps);
      await page.waitForTimeout(SAMPLE_DELAY_MS);
    }

    const finalMetrics = await readProbeMetrics(page, TEST_SYMBOL);
    expect(finalMetrics.logicalRange).not.toBeNull();
    expect(finalMetrics.secondsRange).not.toBeNull();

    const beforeRange = baseline.secondsRange!;
    const afterRange = finalMetrics.secondsRange!;
    const beforeSpan = rangeSpan(beforeRange);
    const afterSpan = rangeSpan(afterRange);

    expect(afterRange.from).not.toBeCloseTo(beforeRange.from, 0);
    expect(afterSpan).toBeLessThan(beforeSpan);

    const fpsMedian = median(samples);
    expect(fpsMedian).toBeGreaterThanOrEqual(FPS_MEDIAN_FLOOR);
  });
});
