import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as LWC from 'lightweight-charts';
import type { BusinessDay, CandlestickData, HistogramData, ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts';
import { DEFAULT_CALENDAR_PREFS, type TF, type Range, type TfPreset } from '@/types/prefs';
import type { Bar as ApiBar } from '@/types/bars';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import type { IndicatorStylePrefs } from '@/types/indicator-styles';
import { cloneIndicatorStylePrefs } from '@/types/indicator-styles';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import { useProbeToggle } from '@/hooks/useProbeToggle';
import { useIndicatorWorker, type LinePt as WorkerLinePt } from '@/hooks/useIndicatorWorker';
import { sma } from '@/utils/indicators';
import { normalizeHistoricalBars, type Bar as ChartBar } from '@/utils/bars';
import { alignNYSEBucketStartUtcSec, bucketSec, toSec } from '@/utils/nyseTime';
import { resolveSessionOpenMs, OPEN_OFFSET_MS, CLOSE_OFFSET_MS, etMidnightUtc } from '@/utils/session';
import { preprocessOhlcv } from '@/utils/preprocessOhlcv';
import type { LinePt, StPerfParams } from '@/utils/indicators-supertrend-perf';
import { assertBucketInvariant } from '@/utils/devInvariants';
import { downsampleOhlcVisible } from '@/utils/ohlc-decimator';
import { IndicatorPanel, type KdjPanelParams } from '@/components/IndicatorPanel';
import { fetchCalendar, type EconEvent } from '@/api/calendar';
import { applyEventMarkers } from '@/components/chart/EconEventsOverlay';
import { isWorkerIndicator, type PanelIndicatorName } from '@/types/indicators';
import { ChartProbe } from './ChartProbe';
import { IndicatorMenu } from './IndicatorMenu';
import { IntervalBar } from './IntervalBar';
import { RangeBar } from './RangeBar';
import { Button } from '@/components/ui/button';
import PaneKDJ from './PaneKDJ';
import { genMockBars } from '@/utils/mock';

type Props = { symbol: string; initialTf?: TF; initialRange?: Range; height?: number };
type ProbeState = { ok: boolean; error?: string; lastEvent?: string };
type ChartTimeRange = { from: Time | null; to: Time | null };

export const mergePanePatch = (prev: WorkerLinePt[], patch?: WorkerLinePt[]): WorkerLinePt[] => {
  if (!patch?.length) return prev;
  const next = patch[patch.length - 1];
  if (!next) return prev;
  if (prev.length && prev[prev.length - 1].time === next.time) {
    return [...prev.slice(0, -1), next];
  }
  return [...prev, next];
};

const envVars = import.meta.env as Record<string, string | undefined>;
const tvFlag = (envVars.VITE_CHART_VENDOR ?? envVars.VITE_USE_TRADINGVIEW ?? '').toLowerCase();
const USING_TV = tvFlag === 'tradingview' || tvFlag === 'true';

const SESSION_MS = CLOSE_OFFSET_MS - OPEN_OFFSET_MS;
const CALENDAR_DEBOUNCE_MS = 200;
// MACD spacing is idempotent: targets stay stable regardless of zoom history.
const MACD_SPACING_TARGETS: Record<'thin' | 'normal' | 'wide', number> = { thin: 5, normal: 7, wide: 9 };
const MINUTES_PER_TRADING_DAY = 390;
const rangeToMinutes = (value: Range | string): number => {
  switch (value?.toUpperCase?.()) {
    case '1D':
      return MINUTES_PER_TRADING_DAY;
    case '5D':
      return 5 * MINUTES_PER_TRADING_DAY;
    case '1M':
      return 30 * MINUTES_PER_TRADING_DAY;
    case '3M':
      return 90 * MINUTES_PER_TRADING_DAY;
    case '6M':
      return 180 * MINUTES_PER_TRADING_DAY;
    case '1Y':
      return 252 * MINUTES_PER_TRADING_DAY;
    case '2Y':
      return 2 * 252 * MINUTES_PER_TRADING_DAY;
    case '5Y':
      return 5 * 252 * MINUTES_PER_TRADING_DAY;
    case '10Y':
    case 'MAX':
      return 10 * 252 * MINUTES_PER_TRADING_DAY;
    default:
      return 900;
  }
};
export default function AdvancedCandleChart({ symbol, initialTf = '1Hour', initialRange = '1Y', height = 520 }: Props) {
  const qaProbeEnabled =
    import.meta.env.DEV ||
    import.meta.env.VITE_QA_PROBE === '1' ||
    (typeof window !== 'undefined' && ((window as any).__QA_PROBE__ === '1' || new URLSearchParams(window.location.search).get('probe') === '1'));
  const [{ mockMode, mockSeed, mockEnd }] = useState(() => {
    if (typeof window === 'undefined') return { mockMode: false, mockSeed: 1337, mockEnd: Date.now() };
    try {
      const params = new URL(window.location.href).searchParams;
      const isMock = params.get('mock') === '1';
      const parsedSeed = Number.parseInt(params.get('seed') ?? '1337', 10);
      const seed = Number.isFinite(parsedSeed) ? parsedSeed : 1337;
      const parsedEnd = Number.parseInt(params.get('mockEnd') ?? `${Date.now()}`, 10);
      const end = Number.isFinite(parsedEnd) ? parsedEnd : Date.now();
      return { mockMode: isMock, mockSeed: seed, mockEnd: end };
    } catch {
      return { mockMode: false, mockSeed: 1337, mockEnd: Date.now() };
    }
  });
  const { enabled: probeEnabled } = useProbeToggle();
  const { loading: prefsLoading, prefs, getTfPreset, setDefaultTf, setDefaultRange, updateTfPreset, setIndicatorStyles } = useChartPrefs();
  const tf: TF = prefs.default_timeframe ?? initialTf;
  const range: Range = prefs.default_range ?? initialRange;
  const preset = getTfPreset(tf);
  const calendarPrefs = prefs.calendar ?? DEFAULT_CALENDAR_PREFS;
  const calendarCountries = calendarPrefs.countries?.length ? calendarPrefs.countries : DEFAULT_CALENDAR_PREFS.countries;
  const calendarCountriesKey = calendarCountries.join(',');
  const calendarMinImpact = calendarPrefs.minImpact ?? DEFAULT_CALENDAR_PREFS.minImpact;

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

  const lastTimeSecRef = useRef<number | null>(null);
  const lastBarRef = useRef<ChartBar | null>(null);
  const seedBarsRef = useRef<ChartBar[]>([]);
  const econEventsRef = useRef<EconEvent[] | null>(null);
  const econMarkerCountRef = useRef(0);
  const calendarAbortRef = useRef<AbortController | null>(null);
  const calendarTimerRef = useRef<number | null>(null);
  const calendarSigRef = useRef<string | null>(null);

  const [probeState, setProbeState] = useState<ProbeState>({ ok: false, lastEvent: 'idle' });
  const [econEventsLen, setEconEventsLen] = useState(0);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [seedBarsVersion, setSeedBarsVersion] = useState(0);
  const logProbeEvent = (msg: string) => {
    if (import.meta.env.DEV) console.debug('[chart]', msg);
    setProbeState((prev) => ({ ...prev, lastEvent: msg }));
  };
  const lwcInfo = LWC as unknown as { version?: string; Version?: string };
  const lwcVersion = lwcInfo.version ?? lwcInfo.Version;
  const showProbe = import.meta.env.DEV && probeEnabled;

  if (qaProbeEnabled) {
    try {
      // eslint-disable-next-line no-console
      console.info('[qa-probe] render', {
        DEV: import.meta.env.DEV,
        QA: import.meta.env.VITE_QA_PROBE === '1',
        symbol,
        mockMode,
        seed: mockSeed,
        mockEnd,
      });
    } catch {
      /* noop */
    }
  }

  const hist = useHistoricalBars(symbol, tf, range);
  const live = useLiveBars(symbol, tf, { enabled: !mockMode });
  const bars = useMemo<ApiBar[]>(() => {
    if (mockMode) {
      const synthetic = genMockBars({ minutes: rangeToMinutes(range), end: mockEnd, seed: mockSeed });
      return synthetic.map((bar) => ({
        time: new Date(fromChartTimeValue(bar.time) * 1000).toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: 0,
      }));
    }
    return hist.data ?? [];
  }, [hist.data, mockMode, mockEnd, mockSeed, range]);
  const liveBar = mockMode ? null : live.bar;

  const isChartLoading = prefsLoading || (!mockMode && hist.isLoading);
  const auxPanelHeight = (preset.useMACD ? 180 : 0) + (preset.useRSI ? 140 : 0);
  const chartAreaHeight = Math.max(height - auxPanelHeight, 320);
  const lastVisibleRangeRef = useRef<{ from: number; to: number } | null>(null);
  const rangeThrottleRef = useRef<number | null>(null);
  const chartError = mockMode ? null : hist.error;

  const normalizeWorkerSeries = (series: LinePt[]) =>
    series.filter((pt) => Number.isFinite(pt.value)).map((pt) => ({ time: pt.time, value: pt.value }));

  const handleWorkerOverlayFull = useCallback((name: string, series: LinePt[], aux?: Record<string, unknown>) => {
    if (!series?.length) return;
    if (name === 'STAI' && aux?.factor && import.meta.env.DEV) console.debug('[indicator][stai] factor', aux.factor);
    if (name === 'STAI') overlays.current.stai?.setData(mapLinePoints(normalizeWorkerSeries(series)));
    if (name === 'EMA') overlays.current.ema?.setData(mapLinePoints(normalizeWorkerSeries(series)));
    if (name === 'RSI') rsiSeriesRef.current?.setData(mapLinePoints(normalizeWorkerSeries(series)));
    if (name === 'VWAP') overlays.current.vwap?.setData(mapLinePoints(normalizeWorkerSeries(series)));
  }, []);

  const handleWorkerOverlayPatch = useCallback((name: string, point: LinePt) => {
    if (!Number.isFinite(point.value)) return;
    const formatted = formatLinePoint(point);
    if (name === 'STAI') overlays.current.stai?.update(formatted);
    if (name === 'EMA') overlays.current.ema?.update(formatted);
    if (name === 'RSI') rsiSeriesRef.current?.update(formatted);
    if (name === 'VWAP') overlays.current.vwap?.update(formatted);
  }, []);

  const handleWorkerOverlayFullMulti = useCallback((name: string, series: Record<string, LinePt[]>) => {
    if (name === 'BB' && overlays.current.bbm && overlays.current.bbu && overlays.current.bbl) {
      overlays.current.bbm.setData(mapLinePoints(normalizeWorkerSeries(series.mid ?? [])));
      overlays.current.bbu.setData(mapLinePoints(normalizeWorkerSeries(series.up ?? [])));
      overlays.current.bbl.setData(mapLinePoints(normalizeWorkerSeries(series.lo ?? [])));
    }
    if (name === 'MACD' && macdLineRef.current && macdSigRef.current && macdHistRef.current) {
      macdLineRef.current.setData(mapLinePoints(normalizeWorkerSeries(series.macd ?? [])));
      macdSigRef.current.setData(mapLinePoints(normalizeWorkerSeries(series.signal ?? [])));
      const hist = normalizeWorkerSeries(series.hist ?? []);
      macdHistRef.current.setData(mapHistogramPoints(hist));
    }
  }, []);

  const handleWorkerOverlayPatchMulti = useCallback((name: string, point: Record<string, LinePt>) => {
    if (name === 'BB' && overlays.current.bbm && overlays.current.bbu && overlays.current.bbl) {
      if (point.mid) overlays.current.bbm.update(formatLinePoint(point.mid));
      if (point.up) overlays.current.bbu.update(formatLinePoint(point.up));
      if (point.lo) overlays.current.bbl.update(formatLinePoint(point.lo));
    }
    if (name === 'MACD' && macdLineRef.current && macdSigRef.current && macdHistRef.current) {
      if (point.macd) macdLineRef.current.update(formatLinePoint(point.macd));
      if (point.signal) macdSigRef.current.update(formatLinePoint(point.signal));
      if (point.hist) macdHistRef.current.update(formatHistogramPoint(point.hist));
    }
  }, []);

  const [kdjK, setKdjK] = useState<WorkerLinePt[]>([]);
  const [kdjD, setKdjD] = useState<WorkerLinePt[]>([]);
  const [kdjJ, setKdjJ] = useState<WorkerLinePt[]>([]);

  const indicatorToggles = useMemo<Record<PanelIndicatorName, boolean>>(
    () => ({
      STAI: !!preset.useSTPerf,
      EMA: !!preset.useEMA,
      RSI: !!preset.useRSI,
      VWAP: !!preset.useVWAP,
      BB: !!preset.useBB,
      MACD: !!preset.useMACD,
      KDJ: !!preset.useKDJ,
      Calendar: !!preset.useCalendar,
    }),
    [
      preset.useSTPerf,
      preset.useEMA,
      preset.useRSI,
      preset.useVWAP,
      preset.useBB,
      preset.useMACD,
      preset.useKDJ,
      preset.useCalendar,
    ],
  );
  const calendarEnabled = indicatorToggles.Calendar || !!preset.useCalendar;

  const indicatorWorker = useIndicatorWorker(symbol, tf, {
    onOverlayFull: handleWorkerOverlayFull,
    onOverlayPatch: handleWorkerOverlayPatch,
    onOverlayFullMulti: handleWorkerOverlayFullMulti,
    onOverlayPatchMulti: handleWorkerOverlayPatchMulti,
    onSignals: (indicator: string, signals: { time: number; price: number; dir: 1 | -1 }[]) => {
      if (import.meta.env.DEV && signals.length) console.debug('[indicator][signals]', indicator, signals.at(-1));
    },
    kdj: {
      onKdjFull: (k, d, j) => {
        setKdjK(k);
        setKdjD(d);
        setKdjJ(j);
      },
      onKdjPatch: (k, d, j) => {
        if (k) setKdjK((prev) => mergePanePatch(prev, k));
        if (d) setKdjD((prev) => mergePanePatch(prev, d));
        if (j) setKdjJ((prev) => mergePanePatch(prev, j));
      },
    },
  });

  const applyVisibleDecimation = useCallback(
    (range: { from: number; to: number } | null) => {
      const bars = seedBarsRef.current;
      const series = candleRef.current;
      const width = Math.max(480, mainRef.current?.clientWidth ?? 1200);
      if (!bars.length || !series) return;
      const fallback = { from: bars[0].time, to: bars[bars.length - 1]?.time ?? bars[0].time };
      const targetRange = range ?? fallback;
      const sampleTime = bars[0]?.time ?? targetRange.from;
      const usesMs = Math.abs(sampleTime) > 1e12;
      const toMs = (value: number) => (usesMs ? value : value * 1000);
      const fromMs = (value: number) => (usesMs ? value : Math.floor(value / 1000));
      const originMs = getAnchoredOriginMs(tf, toMs(sampleTime));
      const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio || 1 : 1;
      const sessionBoundary =
        tf === '1Day'
          ? undefined
          : (start: number, end: number) => {
              const startMs = toMs(start);
              const endMs = toMs(end);
              const open = resolveSessionOpenMs(startMs);
              const close = open + SESSION_MS;
              return endMs > close ? fromMs(close) : null;
            };
      const ds = downsampleOhlcVisible(bars, targetRange.from, targetRange.to, width, 1.6, {
        origin: fromMs(originMs),
        devicePixelRatio: dpr,
        sessionBoundary,
      });
      const payload = ds.length ? ds : bars;
      series.setData(mapBarsForChart(payload));
      lastVisibleRangeRef.current = targetRange;
    },
    [tf],
  );

    const stPanelDefaults = useMemo(() => buildStPerfParams(preset), [preset]);
  const bbPanelDefaults = useMemo(() => ({ period: preset.bbPeriod, mult: preset.bbMult }), [preset.bbPeriod, preset.bbMult]);
  const macdPanelDefaults = useMemo(
    () => ({ fast: preset.macdFast ?? 12, slow: preset.macdSlow ?? 26, signal: preset.macdSignal ?? 9 }),
    [preset.macdFast, preset.macdSlow, preset.macdSignal],
  );
  const vwapPanelDefaults = useMemo(() => ({ mult: preset.vwapMult ?? 1 }), [preset.vwapMult]);
  const kdjPanelDefaults = useMemo<KdjPanelParams>(
    () => ({
      period: preset.kdjPeriod ?? 9,
      kSmooth: preset.kdjKSmooth ?? 3,
      dSmooth: preset.kdjDSmooth ?? 3,
      sessionAnchored: preset.kdjSessionAnchored ?? true,
    }),
    [preset.kdjPeriod, preset.kdjKSmooth, preset.kdjDSmooth, preset.kdjSessionAnchored],
  );
  const indicatorPanelInitials = useMemo(
    () => ({ st: stPanelDefaults, bb: bbPanelDefaults, macd: macdPanelDefaults, vwap: vwapPanelDefaults, kdj: kdjPanelDefaults }),
    [bbPanelDefaults, macdPanelDefaults, stPanelDefaults, vwapPanelDefaults, kdjPanelDefaults],
  );
  const showKdjPane = indicatorToggles.KDJ;

  const [stylePrefs, setStylePrefs] = useState<IndicatorStylePrefs>(() => cloneIndicatorStylePrefs(prefs.styles));

  useEffect(() => {
    setStylePrefs(cloneIndicatorStylePrefs(prefs.styles));
  }, [prefs.styles]);

  const kdjLineWidths = useMemo(
    () => ({
      k: clampLineWidth(stylePrefs.perIndicator?.kdjK?.lineWidth ?? stylePrefs.global.lineWidth ?? 2),
      d: clampLineWidth(stylePrefs.perIndicator?.kdjD?.lineWidth ?? stylePrefs.global.lineWidth ?? 2),
      j: clampLineWidth(stylePrefs.perIndicator?.kdjJ?.lineWidth ?? stylePrefs.global.lineWidth ?? 2),
    }),
    [stylePrefs],
  );

  // --- styles → series application --------------------------------------------
  const applyIndicatorStyles = useCallback(
    (styles: IndicatorStylePrefs) => {
      const effWidth = (override?: number) => clampLineWidth(override ?? styles.global.lineWidth ?? 2);

      overlays.current.stai?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.stAi?.lineWidth) });
      overlays.current.ema?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.ema?.lineWidth) });
      overlays.current.vwap?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.vwap?.lineWidth) });

      const bbWidth = effWidth(styles.perIndicator?.bb?.lineWidth);
      overlays.current.bbu?.applyOptions({ lineWidth: bbWidth });
      overlays.current.bbm?.applyOptions({ lineWidth: bbWidth });
      overlays.current.bbl?.applyOptions({ lineWidth: bbWidth });

      rsiSeriesRef.current?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.rsi?.lineWidth) });
      macdLineRef.current?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.macdLine?.lineWidth) });
      macdSigRef.current?.applyOptions({ lineWidth: effWidth(styles.perIndicator?.macdSignal?.lineWidth) });

      const histThickness = styles.perIndicator?.macdHist?.histThickness ?? styles.global.histThickness ?? 'normal';
      if (macdChartRef.current) {
        macdChartRef.current.timeScale().applyOptions({ barSpacing: MACD_SPACING_TARGETS[histThickness] });
      }
    },
    [],
  );

  const handleStylePrefsChange = useCallback(
    (next: IndicatorStylePrefs) => {
      setStylePrefs(next);
      setIndicatorStyles(next);
      applyIndicatorStyles(next);
    },
    [setIndicatorStyles, applyIndicatorStyles],
  );

  useEffect(() => {
    if (candleRef.current) {
      applyIndicatorStyles(stylePrefs);
    }
  }, [applyIndicatorStyles, stylePrefs]);

  const persistStParams = useCallback(
    (params: Partial<StPerfParams>) => {
      const patch: Partial<TfPreset> = {};
      if (params.atrSpan !== undefined) patch.stPerfAtrSpan = params.atrSpan;
      if (params.factorMin !== undefined) patch.stPerfMin = params.factorMin;
      if (params.factorMax !== undefined) patch.stPerfMax = params.factorMax;
      if (params.factorStep !== undefined) patch.stPerfStep = params.factorStep;
      if (params.fromCluster !== undefined) patch.stPerfFrom = params.fromCluster;
      if (params.useAMA !== undefined) patch.stPerfUseAMA = params.useAMA;
      if (params.applyImmediateOnFlip !== undefined) patch.stPerfApplyImmediateOnFlip = params.applyImmediateOnFlip;
      if (params.k !== undefined) patch.stPerfK = params.k;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [tf, updateTfPreset],
  );

  const persistBbParams = useCallback(
    (params: Partial<{ period: number; mult: number }>) => {
      const patch: Partial<TfPreset> = {};
      if (params.period !== undefined) patch.bbPeriod = params.period;
      if (params.mult !== undefined) patch.bbMult = params.mult;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [tf, updateTfPreset],
  );

  const persistMacdParams = useCallback(
    (params: Partial<{ fast: number; slow: number; signal: number }>) => {
      const patch: Partial<TfPreset> = {};
      if (params.fast !== undefined) patch.macdFast = params.fast;
      if (params.slow !== undefined) patch.macdSlow = params.slow;
      if (params.signal !== undefined) patch.macdSignal = params.signal;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [tf, updateTfPreset],
  );

  const persistVwapParams = useCallback(
    (params: Partial<{ mult: number }>) => {
      const patch: Partial<TfPreset> = {};
      if (params.mult !== undefined) patch.vwapMult = params.mult;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [tf, updateTfPreset],
  );

  const persistKdjParams = useCallback(
    (params: Partial<KdjPanelParams>) => {
      const patch: Partial<TfPreset> = {};
      if (params.period !== undefined) patch.kdjPeriod = params.period;
      if (params.kSmooth !== undefined) patch.kdjKSmooth = params.kSmooth;
      if (params.dSmooth !== undefined) patch.kdjDSmooth = params.dSmooth;
      if (params.sessionAnchored !== undefined) patch.kdjSessionAnchored = params.sessionAnchored;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [tf, updateTfPreset],
  );

  const clearIndicatorSeries = useCallback((name: PanelIndicatorName) => {
    if (name === 'STAI') overlays.current.stai?.setData([]);
    if (name === 'EMA') overlays.current.ema?.setData([]);
    if (name === 'RSI') rsiSeriesRef.current?.setData([]);
    if (name === 'VWAP') overlays.current.vwap?.setData([]);
    if (name === 'BB') {
      overlays.current.bbm?.setData([]);
      overlays.current.bbu?.setData([]);
      overlays.current.bbl?.setData([]);
    }
    if (name === 'MACD') {
      macdLineRef.current?.setData([]);
      macdSigRef.current?.setData([]);
      macdHistRef.current?.setData([]);
    }
    if (name === 'KDJ') {
      setKdjK([]);
      setKdjD([]);
      setKdjJ([]);
    }
  }, []);

  const clearCalendarMarkers = useCallback(() => {
    try {
      candleRef.current?.setMarkers?.([] as any);
    } catch {
      /* noop */
    }
    econMarkerCountRef.current = 0;
    calendarSigRef.current = null;
  }, []);

  const handleIndicatorToggle = useCallback(
    (name: PanelIndicatorName, on: boolean) => {
      if (name === 'Calendar') {
        updateTfPreset(tf, { useCalendar: on });
        return;
      }
      if (name === 'KDJ') {
        indicatorWorker.toggleKdj(on);
        if (!on) clearIndicatorSeries('KDJ');
        updateTfPreset(tf, { useKDJ: on });
        return;
      }
      if (!isWorkerIndicator(name)) return;
      indicatorWorker.toggle(name, on);
      if (!on) clearIndicatorSeries(name);
      const patch: Partial<TfPreset> = {};
      if (name === 'STAI') patch.useSTPerf = on;
      if (name === 'EMA') patch.useEMA = on;
      if (name === 'RSI') patch.useRSI = on;
      if (name === 'VWAP') patch.useVWAP = on;
      if (name === 'BB') patch.useBB = on;
      if (name === 'MACD') patch.useMACD = on;
      if (Object.keys(patch).length) updateTfPreset(tf, patch);
    },
    [indicatorWorker, tf, updateTfPreset, clearIndicatorSeries],
  );

  const handleStParamChange = useCallback(
    (params: Partial<StPerfParams>) => {
      indicatorWorker.setStParams(params);
      persistStParams(params);
    },
    [indicatorWorker, persistStParams],
  );

  const handleBbParamChange = useCallback(
    (params: Partial<{ period: number; mult: number }>) => {
      indicatorWorker.setBbParams(params);
      persistBbParams(params);
    },
    [indicatorWorker, persistBbParams],
  );

  const handleMacdParamChange = useCallback(
    (params: Partial<{ fast: number; slow: number; signal: number }>) => {
      indicatorWorker.setMacdParams(params);
      persistMacdParams(params);
    },
    [indicatorWorker, persistMacdParams],
  );

  const handleVwapParamChange = useCallback(
    (params: Partial<{ mult: number }>) => {
      indicatorWorker.setVwapParams(params);
      persistVwapParams(params);
    },
    [indicatorWorker, persistVwapParams],
  );

  const handleKdjParamChange = useCallback(
    (params: Partial<KdjPanelParams>) => {
      indicatorWorker.setKdjParams(params);
      persistKdjParams(params);
    },
    [indicatorWorker, persistKdjParams],
  );

  useEffect(() => {
    indicatorWorker.setStParams(stPanelDefaults);
  }, [indicatorWorker, stPanelDefaults]);

  useEffect(() => {
    indicatorWorker.setBbParams(bbPanelDefaults);
  }, [indicatorWorker, bbPanelDefaults]);

  useEffect(() => {
    indicatorWorker.setMacdParams(macdPanelDefaults);
  }, [indicatorWorker, macdPanelDefaults]);

  useEffect(() => {
    indicatorWorker.setVwapParams(vwapPanelDefaults);
  }, [indicatorWorker, vwapPanelDefaults]);

  useEffect(() => {
    indicatorWorker.setKdjParams(kdjPanelDefaults);
  }, [indicatorWorker, kdjPanelDefaults]);

  useEffect(() => {
    if (overlays.current.vwap) {
      const width = clampLineWidth(vwapPanelDefaults.mult);
      overlays.current.vwap.applyOptions({ lineWidth: width });
    }
  }, [vwapPanelDefaults]);

  useEffect(() => {
    (Object.keys(indicatorToggles) as PanelIndicatorName[]).forEach((name) => {
      if (!isWorkerIndicator(name)) return;
      const on = indicatorToggles[name];
      indicatorWorker.toggle(name, on);
      if (!on) clearIndicatorSeries(name);
    });
    indicatorWorker.toggleKdj(indicatorToggles.KDJ);
    if (!indicatorToggles.KDJ) clearIndicatorSeries('KDJ');
  }, [indicatorWorker, indicatorToggles, clearIndicatorSeries]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const scale = chart.timeScale();
    const handler = (range: ChartTimeRange | null) => {
      const next = toSecondsVisibleRange(range);
      if (rangeThrottleRef.current != null) return;
      rangeThrottleRef.current = requestAnimationFrame(() => {
        rangeThrottleRef.current = null;
        applyVisibleDecimation(next);
      });
    };
    scale.subscribeVisibleTimeRangeChange(handler);
    return () => {
      if (rangeThrottleRef.current != null) {
        cancelAnimationFrame(rangeThrottleRef.current);
        rangeThrottleRef.current = null;
      }
      scale.unsubscribeVisibleTimeRangeChange(handler);
    };
  }, [applyVisibleDecimation, range, symbol, tf]);

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

    let zeroWidthObserver: ResizeObserver | null = null;

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
      if (preset.useSTAI || preset.useSTPerf)
        overlays.current.stai = chart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: true });
      if (preset.useVWAP) overlays.current.vwap = chart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: true });

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

      if (container.clientWidth === 0 && typeof ResizeObserver !== 'undefined') {
        zeroWidthObserver = new ResizeObserver((entries) => {
          const w = entries[0]?.contentRect?.width ?? 0;
          if (w > 0) {
            chart.applyOptions({ width: w });
            macdChartRef.current?.applyOptions({ width: w });
            rsiChartRef.current?.applyOptions({ width: w });
            applyVisibleDecimation(lastVisibleRangeRef.current);
            zeroWidthObserver?.disconnect();
            zeroWidthObserver = null;
          }
        });
        zeroWidthObserver.observe(container);
      }

      const onResize = () => {
        const w = Math.max(container.clientWidth || 0, 480);
        chart.applyOptions({ width: w });
        macdChartRef.current?.applyOptions({ width: w });
        rsiChartRef.current?.applyOptions({ width: w });
        applyVisibleDecimation(lastVisibleRangeRef.current);
        logProbeEvent(`resize:${w}`);
      };
      window.addEventListener('resize', onResize);
      return () => {
        zeroWidthObserver?.disconnect();
        zeroWidthObserver = null;
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
    applyVisibleDecimation,
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
    if (!bars.length || !candleRef.current) return;

    if (import.meta.env.DEV) {
      const maybeNumericTime = bars[0]?.time as unknown;
      if (typeof maybeNumericTime === 'number' && Math.abs(maybeNumericTime) < 1e12) {
        console.warn('[chart] Expected ms timestamps; got seconds');
      }
    }

    const pre = preprocessOhlcv(bars, { timeframe: tf, maxGapBuckets: 3, capStdDevs: 6 });
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
    setSeedBarsVersion((prev) => prev + 1);

    const entireRange =
      normalized.length > 0 ? { from: normalized[0].time, to: normalized[normalized.length - 1].time } : null;
    applyVisibleDecimation(entireRange);

    const last = normalized[normalized.length - 1] ?? null;
    lastTimeSecRef.current = last?.time ?? null;
    lastBarRef.current = last;

    const candles = normalized.map((b) => toCandle(b));
    if (candles.length) indicatorWorker.setHistory(candles);

    if (preset.useSMA && overlays.current.sma) {
      const series = sma(normalized, preset.smaPeriod);
      overlays.current.sma.setData(mapPointsForChart(series));
    }
    const lastIdx = normalized.length - 1;
    const from = Math.max(0, lastIdx - focusWindowCount(tf));
    chartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    macdChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    rsiChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
  }, [applyVisibleDecimation, bars, indicatorWorker, preset, tf]);

  useEffect(() => {
    lastTimeSecRef.current = null;
    lastBarRef.current = null;
    seedBarsRef.current = [];
    lastVisibleRangeRef.current = null;
    candleRef.current?.setData([]);
    overlays.current.stai?.setData([]);
    overlays.current.ema?.setData([]);
    overlays.current.vwap?.setData([]);
    overlays.current.bbu?.setData([]);
    overlays.current.bbm?.setData([]);
    overlays.current.bbl?.setData([]);
    rsiSeriesRef.current?.setData([]);
    macdLineRef.current?.setData([]);
    macdSigRef.current?.setData([]);
    macdHistRef.current?.setData([]);
    indicatorWorker.setHistory([]);
    econEventsRef.current = null;
    setEconEventsLen(0);
    clearCalendarMarkers();
    setSeedBarsVersion((prev) => prev + 1);
  }, [indicatorWorker, range, symbol, tf, clearCalendarMarkers]);

  useEffect(() => {
    const series = candleRef.current;
    const bars = seedBarsRef.current;

    if (calendarTimerRef.current) {
      window.clearTimeout(calendarTimerRef.current);
      calendarTimerRef.current = null;
    }
    calendarAbortRef.current?.abort();
    calendarAbortRef.current = null;

    if (!series || !bars.length || !calendarEnabled) {
      econEventsRef.current = null;
      setEconEventsLen(0);
      econMarkerCountRef.current = 0;
      calendarSigRef.current = null;
      setCalendarError(null);
      clearCalendarMarkers();
      return;
    }

    const controller = new AbortController();
    calendarAbortRef.current = controller;

    calendarTimerRef.current = window.setTimeout(async () => {
      try {
        const start = bars[0].time;
        const end = bars[bars.length - 1].time;
        setCalendarError(null);
        const events = await fetchCalendar({
          start,
          end,
          countries: calendarCountries,
          minImpact: calendarMinImpact,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const sig = events.length ? events.map((e) => `${e.id}:${e.ts}`).join('|') : 'empty';
        if (sig !== calendarSigRef.current) {
          calendarSigRef.current = sig;
          econEventsRef.current = events;
          const applied = applyEventMarkers(series, events, bars);
          econMarkerCountRef.current = applied;
        }
        setEconEventsLen(events.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        setCalendarError(err instanceof Error ? err.message : 'Calendar fetch failed');
        econEventsRef.current = null;
        setEconEventsLen(0);
        econMarkerCountRef.current = 0;
        calendarSigRef.current = null;
        clearCalendarMarkers();
        if (import.meta.env.DEV) console.warn('[calendar] fetch failed', err);
      }
    }, CALENDAR_DEBOUNCE_MS) as unknown as number;

    return () => {
      if (calendarTimerRef.current) {
        window.clearTimeout(calendarTimerRef.current);
        calendarTimerRef.current = null;
      }
      calendarAbortRef.current?.abort();
      calendarAbortRef.current = null;
    };
  }, [
    calendarCountriesKey,
    calendarEnabled,
    calendarMinImpact,
    seedBarsVersion,
    symbol,
    tf,
  ]);

  useEffect(() => {
    const series = candleRef.current;
    const bars = seedBarsRef.current;
    const events = econEventsRef.current;
    if (!series || !bars.length || !events?.length) return;
    const applied = applyEventMarkers(series, events, bars);
    econMarkerCountRef.current = applied;
  }, [econEventsLen, seedBarsVersion]);

  useEffect(() => {
    if (mockMode) return;
    if (!liveBar || !candleRef.current) return;
    if (!seedBarsRef.current.length) return;

    const tickSec = toSec(liveBar.time);
    assertBucketInvariant(tickSec, tf);
    const alignedSec = alignNYSEBucketStartUtcSec(tickSec, tf);
    const series = candleRef.current;
    const lastT = lastTimeSecRef.current;
    const step = bucketSec(tf);
    let shouldRedecimate = false;

    const updateStreamingIndicators = () => {
      updateIndicatorLastPoints(preset, overlays.current, seedBarsRef.current);
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
      updateStreamingIndicators();
      indicatorWorker.liveBar(toCandle(merged), false);
      return;
    }

    if (lastT != null && alignedSec > lastT && lastBarRef.current) logProbeEvent(`bucket:close->open:${lastT}→${alignedSec}`);
    if (lastT === null) logProbeEvent(`bucket:first:${alignedSec}`);

    if (lastT != null && lastBarRef.current) {
      indicatorWorker.liveBar(toCandle(lastBarRef.current), true);
      shouldRedecimate = true;
      let fillT = lastT + step;
      while (fillT < alignedSec) {
        const prevClose = seedBarsRef.current[seedBarsRef.current.length - 1]?.close ?? lastBarRef.current.close;
        const flat: ChartBar = { time: fillT, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 };
        series.update(formatBarForChart(flat));
        seedBarsRef.current.push(flat);
        lastTimeSecRef.current = fillT;
        lastBarRef.current = flat;
        updateStreamingIndicators();
        indicatorWorker.liveBar(toCandle(flat), true);
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
    updateStreamingIndicators();
    indicatorWorker.liveBar(toCandle(opened), false);
    shouldRedecimate = true;

    if (shouldRedecimate) applyVisibleDecimation(lastVisibleRangeRef.current);
  }, [applyVisibleDecimation, indicatorWorker, liveBar, mockMode, preset, tf]);

  const getSeriesCount = useCallback(
    () =>
      (candleRef.current ? 1 : 0) +
      (overlays.current.sma ? 1 : 0) +
      (overlays.current.ema ? 1 : 0) +
      (overlays.current.bbu ? 1 : 0) +
      (overlays.current.bbm ? 1 : 0) +
      (overlays.current.bbl ? 1 : 0) +
      (overlays.current.stai ? 1 : 0) +
      (overlays.current.vwap ? 1 : 0) +
      (rsiSeriesRef.current ? 1 : 0) +
      (macdLineRef.current ? 1 : 0) +
      (macdSigRef.current ? 1 : 0) +
      (macdHistRef.current ? 1 : 0),
    [],
  );

  // QA probe (namespaced by symbol) available in dev and flagged preview builds
  useEffect(() => {
    if (!qaProbeEnabled) return;
    const w = window as any;
    const root = (w.__probe ??= {});
    const entry = (root[symbol] ??= {});

    Object.defineProperties(entry, {
      macdBarSpacing: {
        configurable: true,
        enumerable: true,
        get: () => macdChartRef.current?.timeScale().options().barSpacing ?? null,
      },
      seriesCount: {
        configurable: true,
        enumerable: true,
        get: () => getSeriesCount(),
      },
      visibleLogicalRange: {
        configurable: true,
        enumerable: true,
        get: () => {
          const range = chartRef.current?.timeScale().getVisibleLogicalRange();
          return range ? { from: range.from, to: range.to } : null;
        },
      },
      dataLogicalRange: {
        configurable: true,
        enumerable: true,
        get: () => {
          const bars = seedBarsRef.current;
          return bars?.length ? { from: 0, to: bars.length - 1 } : null;
        },
      },
      setMacdThickness: {
        configurable: true,
        enumerable: true,
        value: (thickness: 'thin' | 'normal' | 'wide') => {
          setStylePrefs((prev) => {
            const next = cloneIndicatorStylePrefs(prev);
            next.perIndicator = next.perIndicator ?? {};
            next.perIndicator.macdHist = { ...(next.perIndicator.macdHist ?? {}), histThickness: thickness };
            return next;
          });
        },
      },
      econEventCount: {
        configurable: true,
        enumerable: true,
        get: () => econEventsRef.current?.length ?? 0,
      },
      econMarkerCount: {
        configurable: true,
        enumerable: true,
        get: () => econMarkerCountRef.current,
      },
    });

    if (import.meta.env.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[qa-probe] mounted', { symbol, namespaces: Object.keys(root) });
      } catch {
        /* noop */
      }
    }

    return () => {
      const r = (window as any).__probe;
      if (!r) return;
      if (r[symbol]) delete r[symbol];
      if (!Object.keys(r).length) delete (window as any).__probe;
      if (import.meta.env.DEV) {
        try {
          // eslint-disable-next-line no-console
          console.debug('[qa-probe] unmounted', { symbol });
        } catch {
          /* noop */
        }
      }
    };
  }, [getSeriesCount, qaProbeEnabled, setStylePrefs, symbol]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <IntervalBar value={tf} onChange={(v) => setDefaultTf(v)} />
          <RangeBar value={range} onChange={(v) => setDefaultRange(v)} />
        </div>
        <div className="flex gap-2">
          <IndicatorMenu timeframe={tf} />
          <Button data-testid="btn-reset-view" variant="secondary" onClick={() => chartRef.current?.timeScale().fitContent()}>
            Reset view
          </Button>
        </div>
      </div>

      {chartError && (
        <div data-testid="chart-error" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {String(chartError)}
        </div>
      )}

      {calendarError && (
        <div
          data-testid="calendar-error"
          className="mt-2 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          Economic calendar unavailable: {calendarError}
        </div>
      )}

      <IndicatorPanel
        initial={indicatorPanelInitials}
        toggles={indicatorToggles}
        onToggle={handleIndicatorToggle}
        onSetStParams={handleStParamChange}
        onSetBbParams={handleBbParamChange}
        onSetMacdParams={handleMacdParamChange}
        onSetVwapParams={handleVwapParamChange}
        onSetKdjParams={handleKdjParamChange}
        stylePrefs={stylePrefs}
        onChangeStyles={handleStylePrefsChange}
      />

      <div className="relative">
        <div data-testid="chart-root" ref={mainRef} className="w-full min-h-[320px]" style={{ minHeight: chartAreaHeight }} />
        {isChartLoading && (
          <div className="absolute inset-0 grid place-items-center text-slate-400 bg-slate-900/40">Loading…</div>
        )}
      </div>
      {preset.useRSI && <div data-testid="pane-rsi" ref={rsiRef} className="w-full" style={{ minHeight: 140 }} />}
      {preset.useMACD && <div data-testid="pane-macd" ref={macdRef} className="w-full" style={{ minHeight: 180 }} />}
      {showKdjPane && <PaneKDJ data-testid="pane-kdj" k={kdjK} d={kdjD} j={kdjJ} lineWidths={kdjLineWidths} />}

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
  history: ChartBar[],
) {
  const bars = history;

  if (preset.useSMA && ov.sma) {
    const res = sma(bars, preset.smaPeriod);
    const last = res[res.length - 1];
    if (last) ov.sma.update(formatPointForChart(last));
  }
}

const toCandle = (bar: ChartBar) => ({ ...bar, volume: bar.volume ?? 0 });
const fromChartTimeValue = (value: Time) => {
  if (typeof value === 'number') {
    return USING_TV ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string') {
    const [y, m, d] = value.split('-').map(Number);
    const ts = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
    return Math.floor(ts / 1000);
  }
  const bd = value as BusinessDay;
  const ts = Date.UTC(bd.year, (bd.month ?? 1) - 1, bd.day ?? 1);
  return Math.floor(ts / 1000);
};

const toSecondsVisibleRange = (range: ChartTimeRange | null): { from: number; to: number } | null => {
  if (!range || range.from == null || range.to == null) return null;
  return { from: fromChartTimeValue(range.from), to: fromChartTimeValue(range.to) };
};

const buildStPerfParams = (preset: TfPreset): StPerfParams => ({
  atrSpan: preset.stPerfAtrSpan ?? 14,
  factorMin: preset.stPerfMin ?? 1.2,
  factorMax: preset.stPerfMax ?? 4.0,
  factorStep: preset.stPerfStep ?? 0.2,
  k: preset.stPerfK ?? 3,
  fromCluster: preset.stPerfFrom ?? 'Best',
  perfAlpha: preset.stPerfAlpha ?? 10,
  denomSpan: preset.stPerfDenomSpan ?? 10,
  useAMA: !!preset.stPerfUseAMA,
  applyImmediateOnFlip: !!preset.stPerfApplyImmediateOnFlip,
});
const toChartTime = (timeSec: number): Time => {
  if (USING_TV) {
    return (timeSec * 1000) as Time;
  }
  return (timeSec as UTCTimestamp) as Time;
};
const formatBarForChart = (bar: ChartBar): CandlestickData<Time> => ({
  time: toChartTime(bar.time),
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});
const mapBarsForChart = (bars: ChartBar[]): CandlestickData<Time>[] => bars.map((b) => formatBarForChart(b));
const formatPointForChart = <T extends { time: number }>(point: T): T & { time: Time } =>
  ({ ...point, time: toChartTime(point.time) } as T & { time: Time });
const mapPointsForChart = <T extends { time: number }>(pts: T[]): (T & { time: Time })[] =>
  pts.map((p) => formatPointForChart(p));

// Clamp to supported Lightweight Charts width range (1..4)
const clampLineWidth = (w: number | undefined): 1 | 2 | 3 | 4 => {
  const n = Math.round(Number(w ?? 2));
  return Math.max(1, Math.min(4, n)) as 1 | 2 | 3 | 4;
};

// Line helpers
const formatLinePoint = <T extends { time: number; value: number }>(pt: T) => ({
  ...pt,
  time: toChartTime(pt.time),
});

const mapLinePoints = <T extends { time: number; value: number }>(pts: T[]) => pts.map((p) => formatLinePoint(p));

// Histogram helpers
const formatHistogramPoint = <T extends { time: number; value: number }>(pt: T): HistogramData<Time> => ({
  time: toChartTime(pt.time),
  value: pt.value,
});

const mapHistogramPoints = <T extends { time: number; value: number }>(pts: T[]): HistogramData<Time>[] =>
  pts.map((p) => formatHistogramPoint(p));

function getAnchoredOriginMs(tf: TF, referenceMs: number) {
  return tf === '1Day' ? etMidnightUtc(referenceMs) : resolveSessionOpenMs(referenceMs);
}

/* @__TEST_ONLY__ */
export const __test = { fromChartTimeValue, mergePanePatch };
