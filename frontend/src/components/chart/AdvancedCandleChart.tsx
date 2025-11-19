import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as LWC from 'lightweight-charts';
import type { HistogramData, ISeriesApi } from 'lightweight-charts';
import type { TF, Range, TfPreset } from '@/types/prefs';
import type { Bar as ApiBar } from '@/types/bars';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import { useProbeToggle } from '@/hooks/useProbeToggle';
import { sma, ema, bollinger, rsi } from '@/utils/indicators';
import { normalizeHistoricalBars, type Bar as ChartBar } from '@/utils/bars';
import { alignNYSEBucketStartUtcSec, bucketSec, toSec } from '@/utils/nyseTime';
import { preprocessOhlcv } from '@/utils/preprocessOhlcv';
import { supertrendAiSeries, supertrendAiStep, type StAiState } from '@/utils/indicators-supertrend-ai';
import { vwapSeries, vwapStep, vwapInit, type VwapState, macdSeries, macdInit, macdStep, type MacdState } from '@/utils/indicators-core';
import { supertrendPerfSeries, supertrendPerfStep, type StPerfParams, type StPerfState } from '@/utils/indicators-supertrend-perf';
import { assertBucketInvariant } from '@/utils/devInvariants';
import { ChartProbe } from './ChartProbe';
import { IndicatorMenu } from './IndicatorMenu';
import { IntervalBar } from './IntervalBar';
import { RangeBar } from './RangeBar';
import { Button } from '@/components/ui/button';

type Props = { symbol: string; initialTf?: TF; initialRange?: Range; height?: number };
type ProbeState = { ok: boolean; error?: string; lastEvent?: string };

const envVars = import.meta.env as Record<string, string | undefined>;
const tvFlag = (envVars.VITE_CHART_VENDOR ?? envVars.VITE_USE_TRADINGVIEW ?? '').toLowerCase();
const USING_TV = tvFlag === 'tradingview' || tvFlag === 'true';

export default function AdvancedCandleChart({ symbol, initialTf = '1Hour', initialRange = '1Y', height = 520 }: Props) {
  const { enabled: probeEnabled } = useProbeToggle();
  const { loading: prefsLoading, prefs, getTfPreset, setDefaultTf, setDefaultRange } = useChartPrefs();
  const tf: TF = prefs.default_timeframe ?? initialTf;
  const range: Range = prefs.default_range ?? initialRange;
  const preset = getTfPreset(tf);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const macdChartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const rsiChartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlays = useRef<{
    sma?: ISeriesApi<'Line'>;
    ema?: ISeriesApi<'Line'>;
    bbu?: ISeriesApi<'Line'>;
    bbm?: ISeriesApi<'Line'>;
    bbl?: ISeriesApi<'Line'>;
    stai?: ISeriesApi<'Line'>;
    vwap?: ISeriesApi<'Line'>;
  }>({});
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSigRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const stRawRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stAmaRef = useRef<ISeriesApi<'Line'> | null>(null);

  const lastTimeSecRef = useRef<number | null>(null);
  const lastBarRef = useRef<ChartBar | null>(null);
  const seedBarsRef = useRef<ChartBar[]>([]);

  const stAiState = useRef<StAiState | null>(null);
  const stPerfStateRef = useRef<StPerfState | null>(null);
  const vwapState = useRef<VwapState>(vwapInit());
  const macdState = useRef<MacdState>(
    macdInit({ fast: preset.macdFast ?? 12, slow: preset.macdSlow ?? 26, signal: preset.macdSignal ?? 9 }),
  );
  const [probeState, setProbeState] = useState<ProbeState>({ ok: false, lastEvent: 'idle' });
  const logProbeEvent = (msg: string) => {
    if (import.meta.env.DEV) console.debug('[chart]', msg);
    setProbeState((prev) => ({ ...prev, lastEvent: msg }));
  };
  const lwcInfo = LWC as unknown as { version?: string; Version?: string };
  const lwcVersion = lwcInfo.version ?? lwcInfo.Version;
  const showProbe = import.meta.env.DEV && probeEnabled;

  const { data: history, isLoading, error } = useHistoricalBars(symbol, tf, range);
  const { bar: liveBar } = useLiveBars(symbol, tf);

  const isChartLoading = isLoading || prefsLoading;
  const auxPanelHeight = (preset.useMACD ? 180 : 0) + (preset.useRSI ? 140 : 0);
  const chartAreaHeight = Math.max(height - auxPanelHeight, 320);

  useLayoutEffect(() => {
    if (isChartLoading) return;
    const container = mainRef.current;
    if (!container) {
      console.warn('[chart] missing container');
      setProbeState((prev) => ({ ...prev, ok: false, error: 'no-container' }));
      logProbeEvent('no-container');
      return;
    }

    chartRef.current?.remove();
    macdChartRef.current?.remove();
    rsiChartRef.current?.remove();
    chartRef.current = null;
    macdChartRef.current = null;
    rsiChartRef.current = null;
    candleRef.current = null;
    overlays.current = {};
    rsiSeriesRef.current = null;
    macdLineRef.current = null;
    macdSigRef.current = null;
    macdHistRef.current = null;

    try {
      const width = Math.max(container.clientWidth || 0, 800);
      const mainHeight = chartAreaHeight;
      if (typeof LWC.createChart !== 'function') throw new Error('LWC.createChart missing');

      const chart = LWC.createChart(container, {
        width,
        height: mainHeight,
        rightPriceScale: { borderVisible: false },
        timeScale: { secondsVisible: tf !== '1Day', timeVisible: true },
        layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
      });
      chartRef.current = chart;
      candleRef.current = chart.addCandlestickSeries({
        lastValueVisible: true,
        priceLineVisible: true,
        lastPriceAnimation: 1,
      });
      setProbeState({ ok: true, lastEvent: 'init', error: undefined });
      if (import.meta.env.DEV) console.debug('[chart] init complete');

      overlays.current = {};
      if (preset.useSMA) overlays.current.sma = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
      if (preset.useEMA) overlays.current.ema = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
      if (preset.useBB) {
        overlays.current.bbu = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
        overlays.current.bbm = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
        overlays.current.bbl = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
      }
      if (preset.useSTAI) overlays.current.stai = chart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: true });
      if (preset.useVWAP) overlays.current.vwap = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });
      if (preset.useSTPerf) {
        stRawRef.current = chart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: true, color: '#fb923c' });
        stAmaRef.current = preset.stPerfUseAMA
          ? chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true, color: '#22d3ee' })
          : null;
      } else {
        stRawRef.current = null;
        stAmaRef.current = null;
      }

      if (preset.useRSI && rsiRef.current) {
        const rchart = LWC.createChart(rsiRef.current, {
          width,
          height: 140,
          rightPriceScale: { borderVisible: false },
          timeScale: { timeVisible: true },
          layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
        });
        rsiChartRef.current = rchart;
        rsiSeriesRef.current = rchart.addLineSeries({ lineWidth: 1, priceLineVisible: true, lastValueVisible: true });
      }

      if (preset.useMACD && macdRef.current) {
        const sch = LWC.createChart(macdRef.current, {
          width,
          height: 180,
          rightPriceScale: { borderVisible: false },
          timeScale: { timeVisible: true },
          layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
        });
        macdChartRef.current = sch;
        macdLineRef.current = sch.addLineSeries({ lineWidth: 1, priceLineVisible: true, lastValueVisible: true });
        macdSigRef.current = sch.addLineSeries({ lineWidth: 1, priceLineVisible: true, lastValueVisible: true });
        macdHistRef.current = sch.addHistogramSeries({ priceLineVisible: false });
      }

      const onResize = () => {
        const w = Math.max(container.clientWidth || 0, 480);
        chart.applyOptions({ width: w });
        macdChartRef.current?.applyOptions({ width: w });
        rsiChartRef.current?.applyOptions({ width: w });
        logProbeEvent(`resize:${w}`);
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        macdChartRef.current?.remove();
        rsiChartRef.current?.remove();
        chart.remove();
        chartRef.current = null;
        macdChartRef.current = null;
        rsiChartRef.current = null;
        candleRef.current = null;
        overlays.current = {};
        rsiSeriesRef.current = null;
        macdLineRef.current = null;
        macdSigRef.current = null;
        macdHistRef.current = null;
        stRawRef.current = null;
        stAmaRef.current = null;
        setProbeState((prev) => ({ ...prev, ok: false }));
        logProbeEvent('cleanup');
      };
    } catch (err) {
      console.error('[chart] init failed', err);
      setProbeState((prev) => ({
        ...prev,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }));
      logProbeEvent('init-error');
      return () => {};
    }
  }, [
    chartAreaHeight,
    height,
    isChartLoading,
    preset.useBB,
    preset.useEMA,
    preset.useMACD,
    preset.useRSI,
    preset.useSMA,
    preset.useSTAI,
    preset.useSTPerf,
    preset.useVWAP,
    preset.stPerfUseAMA,
    tf,
  ]);

  useEffect(() => {
    if (!history || !candleRef.current) return;

    const pre = preprocessOhlcv(history, { timeframe: tf, maxGapBuckets: 3, capStdDevs: 6 });
    if (pre.msgs.length && import.meta.env.DEV) console.debug('[preprocess]', pre.msgs.join(' | '));

    const cleaned = pre.bars;
    const toChartBar = (b: ApiBar): ChartBar => ({
      time: toSec(b.time),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    });
    const normalized = normalizeHistoricalBars(cleaned.map(toChartBar), tf);
    seedBarsRef.current = normalized;
    candleRef.current.setData(mapBarsForChart(normalized));

    const last = normalized[normalized.length - 1] ?? null;
    lastTimeSecRef.current = last?.time ?? null;
    lastBarRef.current = last;

    if (preset.useSMA && overlays.current.sma)
      overlays.current.sma.setData(mapPointsForChart(sma(normalized, preset.smaPeriod)));
    if (preset.useEMA && overlays.current.ema)
      overlays.current.ema.setData(mapPointsForChart(ema(normalized, preset.emaPeriod)));
    if (preset.useBB && overlays.current.bbu && overlays.current.bbm && overlays.current.bbl) {
      const bb = bollinger(normalized, preset.bbPeriod, preset.bbMult);
      overlays.current.bbu.setData(mapPointsForChart(bb.upper));
      overlays.current.bbm.setData(mapPointsForChart(bb.middle));
      overlays.current.bbl.setData(mapPointsForChart(bb.lower));
    }
    if (preset.useRSI && rsiSeriesRef.current)
      rsiSeriesRef.current.setData(mapPointsForChart(rsi(normalized, preset.rsiPeriod)));

    const candles = normalized.map((b) => toCandle(b));
    if (preset.useSTAI && overlays.current.stai) {
      const st = supertrendAiSeries(candles, buildStAiParams(preset));
      const stLine = st.line.filter((p) => Number.isFinite(p.value));
      overlays.current.stai.setData(mapPointsForChart(stLine));
      const li = candles.length - 1;
      stAiState.current = { lastUpper: st.upper[li] ?? NaN, lastLower: st.lower[li] ?? NaN, trend: st.dir[li] ?? 0 };
    } else stAiState.current = null;

    if (preset.useVWAP && overlays.current.vwap) {
      overlays.current.vwap.setData(mapPointsForChart(vwapSeries(candles)));
      vwapState.current = vwapInit();
      for (const b of candles) vwapStep(vwapState.current, b);
    } else vwapState.current = vwapInit();

    if (preset.useSTPerf && stRawRef.current) {
      const batch = supertrendPerfSeries(candles, buildStPerfParams(preset));
      const raw = batch.raw.filter((p) => Number.isFinite(p.value));
      stRawRef.current.setData(mapPointsForChart(raw));
      if (stAmaRef.current) {
        const ama = (batch.ama ?? []).filter((p) => Number.isFinite(p.value));
        stAmaRef.current.setData(mapPointsForChart(ama));
      }
      stPerfStateRef.current = {
        factor: batch.factor,
        lastUpper: NaN,
        lastLower: NaN,
        trend: 0,
        amaLast: batch.ama?.at(-1)?.value,
      };
    } else {
      stPerfStateRef.current = null;
      stRawRef.current?.setData([]);
      stAmaRef.current?.setData([]);
    }

    if (preset.useMACD && macdLineRef.current && macdSigRef.current && macdHistRef.current) {
      const closes = normalized.map((b) => b.close);
      const times = normalized.map((b) => b.time);
      const cfg = { fast: preset.macdFast ?? 12, slow: preset.macdSlow ?? 26, signal: preset.macdSignal ?? 9 };
      const macd = macdSeries(closes, times, cfg);
      macdLineRef.current.setData(mapPointsForChart(macd.macd));
      macdSigRef.current.setData(mapPointsForChart(macd.signal));
      macdHistRef.current.setData(mapPointsForChart(macd.hist as HistogramData[]));
      macdState.current = macdInit(cfg);
      for (const px of closes) macdStep(macdState.current, px);
    } else {
      macdState.current = macdInit({ fast: preset.macdFast ?? 12, slow: preset.macdSlow ?? 26, signal: preset.macdSignal ?? 9 });
    }

    const lastIdx = normalized.length - 1;
    const from = Math.max(0, lastIdx - focusWindowCount(tf));
    chartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    macdChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    rsiChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
  }, [history, tf, preset]);

  useEffect(() => {
    lastTimeSecRef.current = null;
    lastBarRef.current = null;
    seedBarsRef.current = [];
    stAiState.current = null;
    stPerfStateRef.current = null;
    candleRef.current?.setData([]);
    overlays.current.stai?.setData([]);
    overlays.current.vwap?.setData([]);
    stRawRef.current?.setData([]);
    stAmaRef.current?.setData([]);
  }, [symbol, tf, range]);

  useEffect(() => {
    if (!liveBar || !candleRef.current) return;
    if (!seedBarsRef.current.length) return;

    const tickSec = toSec(liveBar.time);
    assertBucketInvariant(tickSec, tf);
    const alignedSec = alignNYSEBucketStartUtcSec(tickSec, tf);
    const series = candleRef.current;
    const lastT = lastTimeSecRef.current;
    const step = bucketSec(tf);
    const perfParams = buildStPerfParams(preset);
    const aiParams = buildStAiParams(preset);

    const updateStreamingIndicators = (bar: ChartBar) => {
      if (preset.useVWAP && overlays.current.vwap) {
        const v = vwapStep(vwapState.current, toCandle(bar));
        overlays.current.vwap.update(formatPointForChart({ time: bar.time, value: +v.toFixed(6) }));
      }
      if (preset.useSTAI && overlays.current.stai) {
        const candles = seedBarsRef.current.map(toCandle);
        const { nextState, point } = supertrendAiStep(stAiState.current, candles.slice(0, -1), toCandle(bar), aiParams);
        stAiState.current = nextState;
        overlays.current.stai.update(formatPointForChart(point));
      }
      if (preset.useMACD && macdLineRef.current && macdSigRef.current && macdHistRef.current) {
        const { macd, signal, hist } = macdStep(macdState.current, bar.close);
        macdLineRef.current.update(formatPointForChart({ time: bar.time, value: +macd.toFixed(6) }));
        macdSigRef.current.update(formatPointForChart({ time: bar.time, value: +signal.toFixed(6) }));
        macdHistRef.current.update(formatPointForChart({ time: bar.time, value: +hist.toFixed(6) }) as HistogramData);
      }
      updateIndicatorLastPoints(preset, overlays.current, rsiSeriesRef.current, seedBarsRef.current);
    };

    const updateStPerf = (bar: ChartBar, barClosed: boolean) => {
      if (!preset.useSTPerf || !stRawRef.current) return;
      if (!seedBarsRef.current.length) return;
      const hist = seedBarsRef.current.slice(0, -1);
      const { state, raw, ama } = supertrendPerfStep(stPerfStateRef.current, hist, bar, perfParams, barClosed);
      stPerfStateRef.current = state;
      if (Number.isFinite(raw.value)) stRawRef.current.update(formatPointForChart(raw));
      if (stAmaRef.current && ama && Number.isFinite(ama.value)) stAmaRef.current.update(formatPointForChart(ama));
    };

    if (lastT != null && alignedSec < lastT) {
      logProbeEvent(`bucket:stale:${alignedSec}`);
      return;
    }

    const vol = liveBar.volume ?? 0;

    if (lastT != null && alignedSec === lastT && lastBarRef.current) {
      logProbeEvent(`bucket:same:${alignedSec}`);
      const prev = lastBarRef.current;
      const merged: ChartBar = {
        time: prev.time,
        open: prev.open,
        high: Math.max(prev.high, liveBar.high),
        low: Math.min(prev.low, liveBar.low),
        close: liveBar.close,
        volume: (prev.volume ?? 0) + vol,
      };
      series.update(formatBarForChart(merged));
      lastBarRef.current = merged;
      seedBarsRef.current[seedBarsRef.current.length - 1] = merged;
      updateStreamingIndicators(merged);
      updateStPerf(merged, false);
      return;
    }

    if (lastT != null && alignedSec > lastT && lastBarRef.current) logProbeEvent(`bucket:close->open:${lastT}→${alignedSec}`);
    if (lastT === null) logProbeEvent(`bucket:first:${alignedSec}`);

    if (lastT != null && lastBarRef.current) {
      updateStPerf(lastBarRef.current, true);
      let fillT = lastT + step;
      while (fillT < alignedSec) {
        const prevClose = seedBarsRef.current[seedBarsRef.current.length - 1]?.close ?? lastBarRef.current.close;
        const flat: ChartBar = { time: fillT, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 };
        series.update(formatBarForChart(flat));
        seedBarsRef.current.push(flat);
        lastTimeSecRef.current = fillT;
        lastBarRef.current = flat;
        updateStreamingIndicators(flat);
        updateStPerf(flat, true);
        fillT += step;
      }
    }

    const opened: ChartBar = {
      time: alignedSec,
      open: liveBar.open,
      high: liveBar.high,
      low: liveBar.low,
      close: liveBar.close,
      volume: vol,
    };
    series.update(formatBarForChart(opened));
    seedBarsRef.current.push(opened);
    lastTimeSecRef.current = alignedSec;
    lastBarRef.current = opened;
    updateStreamingIndicators(opened);
    updateStPerf(opened, false);
  }, [liveBar, preset, tf]);

  const getSeriesCount = () =>
    (candleRef.current ? 1 : 0) +
    (overlays.current.sma ? 1 : 0) +
    (overlays.current.ema ? 1 : 0) +
    (overlays.current.bbu ? 1 : 0) +
    (overlays.current.bbm ? 1 : 0) +
    (overlays.current.bbl ? 1 : 0) +
    (overlays.current.stai ? 1 : 0) +
    (overlays.current.vwap ? 1 : 0) +
    (stRawRef.current ? 1 : 0) +
    (stAmaRef.current ? 1 : 0) +
    (rsiSeriesRef.current ? 1 : 0) +
    (macdLineRef.current ? 1 : 0) +
    (macdSigRef.current ? 1 : 0) +
    (macdHistRef.current ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <IntervalBar value={tf} onChange={(v) => setDefaultTf(v)} />
          <RangeBar value={range} onChange={(v) => setDefaultRange(v)} />
        </div>
        <div className="flex gap-2">
          <IndicatorMenu timeframe={tf} />
          <Button variant="secondary" onClick={() => chartRef.current?.timeScale().fitContent()}>
            Reset view
          </Button>
        </div>
      </div>

      <div className="relative">
        <div ref={mainRef} className="w-full min-h-[320px]" style={{ minHeight: chartAreaHeight }} />
        {isChartLoading && (
          <div className="absolute inset-0 grid place-items-center text-slate-400 bg-slate-900/40">Loading…</div>
        )}
        {error && !isChartLoading && (
          <div className="absolute inset-0 grid place-items-center text-red-400 bg-slate-900/60">Failed to load data.</div>
        )}
      </div>
      {preset.useRSI && <div ref={rsiRef} className="w-full" style={{ minHeight: 140 }} />}
      {preset.useMACD && <div ref={macdRef} className="w-full" style={{ minHeight: 180 }} />}

      {showProbe && (
        <ChartProbe
          ok={probeState.ok}
          lwcVersion={lwcVersion}
          width={mainRef.current?.clientWidth ?? 0}
          height={mainRef.current?.clientHeight ?? 0}
          series={getSeriesCount()}
          lastEvent={probeState.lastEvent}
          error={probeState.error}
        />
      )}
    </div>
  );
}

function focusWindowCount(tf: TF) {
  const per: Record<TF, number> = { '1Min': 360, '5Min': 72, '10Min': 36, '15Min': 24, '1Hour': 240, '4Hour': 180, '1Day': 250 };
  return per[tf];
}

type IndicatorPreset = {
  useSMA: boolean;
  useEMA: boolean;
  useBB: boolean;
  useRSI: boolean;
  smaPeriod: number;
  emaPeriod: number;
  bbPeriod: number;
  bbMult: number;
  rsiPeriod: number;
};

function updateIndicatorLastPoints(
  preset: IndicatorPreset,
  ov: {
    sma?: ISeriesApi<'Line'>;
    ema?: ISeriesApi<'Line'>;
    bbu?: ISeriesApi<'Line'>;
    bbm?: ISeriesApi<'Line'>;
    bbl?: ISeriesApi<'Line'>;
  },
  rsiSeries: ISeriesApi<'Line'> | null,
  history: ChartBar[],
) {
  const bars = history;

  if (preset.useSMA && ov.sma) {
    const res = sma(bars, preset.smaPeriod);
    const last = res[res.length - 1];
    if (last) ov.sma.update(formatPointForChart(last));
  }

  if (preset.useEMA && ov.ema) {
    const res = ema(bars, preset.emaPeriod);
    const last = res[res.length - 1];
    if (last) ov.ema.update(formatPointForChart(last));
  }

  if (preset.useBB && ov.bbu && ov.bbm && ov.bbl) {
    const bb = bollinger(bars, preset.bbPeriod, preset.bbMult);
    const idx = bb.upper.length - 1;
    if (idx >= 0) {
      ov.bbu.update(formatPointForChart(bb.upper[idx]));
      ov.bbm.update(formatPointForChart(bb.middle[idx]));
      ov.bbl.update(formatPointForChart(bb.lower[idx]));
    }
  }

  if (preset.useRSI && rsiSeries) {
    const res = rsi(bars, preset.rsiPeriod);
    const last = res[res.length - 1];
    if (last) rsiSeries.update(formatPointForChart(last));
  }
}

const toCandle = (bar: ChartBar) => ({ ...bar, volume: bar.volume ?? 0 });
const buildStAiParams = (preset: TfPreset) => ({
  atrLen: preset.stAiAtrLen ?? 14,
  minFactor: preset.stAiMin ?? 1.5,
  midFactor: preset.stAiMid ?? 2.0,
  maxFactor: preset.stAiMax ?? 3.0,
});
const buildStPerfParams = (preset: TfPreset): StPerfParams => ({
  atrSpan: preset.stPerfAtrSpan ?? 14,
  factorMin: preset.stPerfMin ?? 1.2,
  factorMax: preset.stPerfMax ?? 4.0,
  factorStep: preset.stPerfStep ?? 0.2,
  fromCluster: preset.stPerfFrom ?? 'Best',
  perfAlpha: preset.stPerfAlpha ?? 10,
  denomSpan: preset.stPerfDenomSpan ?? 10,
  useAMA: !!preset.stPerfUseAMA,
  applyImmediateOnFlip: !!preset.stPerfApplyImmediateOnFlip,
});
const toChartTime = (timeSec: number) => (USING_TV ? timeSec * 1000 : timeSec);
const formatBarForChart = (bar: ChartBar): ChartBar => (USING_TV ? { ...bar, time: toChartTime(bar.time) } : bar);
const mapBarsForChart = (bars: ChartBar[]): ChartBar[] => (USING_TV ? bars.map((b) => formatBarForChart(b)) : bars);
const formatPointForChart = <T extends { time: number }>(point: T): T =>
  (USING_TV ? ({ ...point, time: toChartTime(point.time) } as T) : point);
const mapPointsForChart = <T extends { time: number }>(pts: T[]): T[] =>
  (USING_TV ? pts.map((p) => formatPointForChart(p)) : pts);
