import { useEffect, useLayoutEffect, useRef } from 'react';
import * as LWC from 'lightweight-charts';
import type { ISeriesApi } from 'lightweight-charts';
import type { TF, Range } from '@/types/prefs';
import type { Bar } from '@/types/bars';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import { useProbeToggle } from '@/hooks/useProbeToggle';
import { sma, ema, bollinger, rsi, toSec } from '@/utils/indicators';
import { IndicatorMenu } from './IndicatorMenu';
import { IntervalBar } from './IntervalBar';
import { RangeBar } from './RangeBar';
import { Button } from '@/components/ui/button';
import ChartProbe from '@/dev/ChartProbe';

const TF_TO_SEC: Record<string, number> = {
  '1Min': 60,
  '5Min': 300,
  '10Min': 600,
  '15Min': 900,
  '1Hour': 3600,
  '4Hour': 14_400,
  '1Day': 86_400,
};
const tfToBucketSec = (tf: string) => TF_TO_SEC[tf] ?? 60;
const alignToBucketStartSec = (tsSec: number, bucketSec: number) => Math.floor(tsSec / bucketSec) * bucketSec;

type Props = { symbol: string; initialTf?: TF; initialRange?: Range; height?: number };

export default function AdvancedCandleChart({ symbol, initialTf = '1Hour', initialRange = '1Y', height = 520 }: Props) {
  const { enabled: probeEnabled } = useProbeToggle();
  const { loading: prefsLoading, prefs, getTfPreset, setDefaultTf, setDefaultRange } = useChartPrefs();
  const tf: TF = prefs.default_timeframe ?? initialTf;
  const range: Range = prefs.default_range ?? initialRange;
  const preset = getTfPreset(tf);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlays = useRef<{ sma?: ISeriesApi<'Line'>; ema?: ISeriesApi<'Line'>; bbu?: ISeriesApi<'Line'>; bbm?: ISeriesApi<'Line'>; bbl?: ISeriesApi<'Line'> }>({});
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const mainChartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const rsiChartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const lastTimeSecRef = useRef<number | null>(null);
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const bucketSizeRef = useRef<number>(tfToBucketSec(tf));

  const { data: history, isLoading, error } = useHistoricalBars(symbol, tf, range);
  const { bar: liveBar } = useLiveBars(symbol, tf);

  useLayoutEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    if (mainChartRef.current) return;

    try {
      const forcedWidth = Math.max(container.clientWidth || 0, 800);
      const mainHeight = preset.useRSI ? Math.floor(height * 0.72) : height;

      if (typeof LWC.createChart !== 'function') {
        throw new Error('[LWC] createChart undefined — import/version issue');
      }

      const chart = LWC.createChart(container, {
        width: forcedWidth,
        height: mainHeight,
        rightPriceScale: { borderVisible: false },
        timeScale: { secondsVisible: tf !== '1Day' },
        layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
      });

      console.log('[LWC] version:', (LWC as unknown as { version?: string }).version);
      console.log('[LWC] chart API methods:', Object.keys(chart as unknown as Record<string, unknown>));

      const chartApi = chart as unknown as { addCandlestickSeries?: () => unknown; addLineSeries?: (opts?: unknown) => unknown; applyOptions?: (opts: unknown) => void; remove?: () => void };
      if (typeof chartApi.addCandlestickSeries !== 'function') {
        throw new Error('[LWC] addCandlestickSeries missing — build/import mismatch');
      }

      const cs = chartApi.addCandlestickSeries() as ISeriesApi<'Candlestick'>;
      seriesRef.current = cs;
      mainChartRef.current = chart;

      overlays.current = {};
      if (preset.useSMA) overlays.current.sma = chartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
      if (preset.useEMA) overlays.current.ema = chartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
      if (preset.useBB) {
        overlays.current.bbu = chartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
        overlays.current.bbm = chartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
        overlays.current.bbl = chartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
      }

      if (preset.useRSI && rsiRef.current) {
        const rchart = LWC.createChart(rsiRef.current, {
          width: forcedWidth,
          height: Math.floor(height * 0.28),
          rightPriceScale: { borderVisible: false },
          layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
        });
        const rchartApi = rchart as unknown as { addLineSeries?: (opts?: unknown) => unknown; applyOptions?: (opts: unknown) => void; remove?: () => void };
        rsiSeriesRef.current = rchartApi.addLineSeries?.({ lineWidth: 1 }) as ISeriesApi<'Line'>;
        rsiChartRef.current = rchart;
      }

      const onResize = () => {
        const w = Math.max(container.clientWidth || 0, 480);
        chartApi.applyOptions?.({ width: w });
        if (preset.useRSI && rsiRef.current) rsiChartRef.current && (rsiChartRef.current as unknown as { applyOptions?: (opts: unknown) => void }).applyOptions?.({ width: w });
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        (rsiChartRef.current as unknown as { remove?: () => void })?.remove?.();
        chartApi.remove?.();
        seriesRef.current = null;
        rsiSeriesRef.current = null;
        mainChartRef.current = null;
      };
    } catch (err) {
      console.error('[chart] init failed:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, tf, preset.useSMA, preset.useEMA, preset.useBB, preset.useRSI, prefsLoading, isLoading]);

  useEffect(() => {
    if (!history || !seriesRef.current) return;
    const toCandle = (b: Bar) => ({ time: toSec(b.time), open: b.open, high: b.high, low: b.low, close: b.close });
    seriesRef.current.setData(history.map(toCandle));

    if (preset.useSMA && overlays.current.sma) overlays.current.sma.setData(sma(history, preset.smaPeriod));
    if (preset.useEMA && overlays.current.ema) overlays.current.ema.setData(ema(history, preset.emaPeriod));
    if (preset.useBB && overlays.current.bbu && overlays.current.bbm && overlays.current.bbl) {
      const bb = bollinger(history, preset.bbPeriod, preset.bbMult);
      overlays.current.bbu.setData(bb.upper);
      overlays.current.bbm.setData(bb.middle);
      overlays.current.bbl.setData(bb.lower);
    }
    if (preset.useRSI && rsiSeriesRef.current) rsiSeriesRef.current.setData(rsi(history, preset.rsiPeriod));

    const focusBars = focusWindowCount(tf);
    const lastIdx = history.length - 1;
    const from = Math.max(0, lastIdx - focusBars);
    mainChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    if (preset.useRSI && rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to: lastIdx });

    // Seed last-known bar for live handling
    const last = history[lastIdx];
    const tSec = toSec(last.time);
    lastTimeSecRef.current = tSec;
    lastBarRef.current = { time: tSec, open: last.open, high: last.high, low: last.low, close: last.close };
    bucketSizeRef.current = tfToBucketSec(tf);
  }, [history, tf, preset]);

  useEffect(() => {
    bucketSizeRef.current = tfToBucketSec(tf);
    lastTimeSecRef.current = null;
    lastBarRef.current = null;
  }, [tf]);

  useEffect(() => {
    if (!liveBar || !seriesRef.current) return;

    const bucketSec = bucketSizeRef.current;
    const tSecAligned = alignToBucketStartSec(toSec(liveBar.time), bucketSec);
    const s = seriesRef.current;
    const lastT = lastTimeSecRef.current;

    // No history seeded yet: accept first bar
    if (lastT == null) {
      const first = { time: tSecAligned, open: liveBar.open, high: liveBar.high, low: liveBar.low, close: liveBar.close };
      s.update(first);
      lastTimeSecRef.current = tSecAligned;
      lastBarRef.current = first;
      return;
    }

    // Ignore stale/out-of-order updates
    if (tSecAligned < lastT) return;

    // Same bucket: merge into current candle
    if (tSecAligned === lastT) {
      const prev = lastBarRef.current!;
      const merged = {
        time: lastT,
        open: prev.open,
        high: Math.max(prev.high, liveBar.high),
        low: Math.min(prev.low, liveBar.low),
        close: liveBar.close,
      };
      s.update(merged);
      lastBarRef.current = merged;
      return;
    }

    // New bucket(s)
    const prev = lastBarRef.current!;
    const gapBuckets = Math.floor((tSecAligned - lastT) / bucketSec) - 1;
    const maxBackfill = 5;

    if (gapBuckets > 0 && gapBuckets <= maxBackfill) {
      for (let i = 1; i <= gapBuckets; i++) {
        const ts = lastT + i * bucketSec;
        const px = prev.close;
        s.update({ time: ts, open: px, high: px, low: px, close: px });
      }
    }

    const next = { time: tSecAligned, open: liveBar.open, high: liveBar.high, low: liveBar.low, close: liveBar.close };
    s.update(next);
    lastTimeSecRef.current = tSecAligned;
    lastBarRef.current = next;
  }, [liveBar]);

  const showOverlay = isLoading || prefsLoading;

  return (
    <div className="grid gap-3 relative">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <IntervalBar value={tf} onChange={(v) => setDefaultTf(v)} />
          <RangeBar value={range} onChange={(v) => setDefaultRange(v)} />
        </div>
        <div className="flex gap-2">
          <IndicatorMenu timeframe={tf} />
          <Button variant="secondary" onClick={() => mainChartRef.current?.timeScale().fitContent()}>
            Reset view
          </Button>
        </div>
      </div>
      <div ref={mainRef} className="w-full" style={{ minHeight: preset.useRSI ? Math.floor(height * 0.72) : height }} />
      {preset.useRSI && <div ref={rsiRef} className="w-full" style={{ minHeight: Math.floor(height * 0.28) }} />}

      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-slate-400 text-sm bg-slate-900/60 px-3 py-2 rounded">Loading…</div>
        </div>
      )}

      {import.meta.env.DEV && probeEnabled && <ChartProbe title="Chart Probe" containerRef={mainRef} chartRef={mainChartRef} />}

      {error && <div className="text-red-400 text-sm">Failed to load data.</div>}
    </div>
  );
}

function focusWindowCount(tf: TF) {
  const per: Record<TF, number> = { '1Min': 360, '5Min': 72, '10Min': 36, '15Min': 24, '1Hour': 240, '4Hour': 180, '1Day': 250 };
  return per[tf];
}
