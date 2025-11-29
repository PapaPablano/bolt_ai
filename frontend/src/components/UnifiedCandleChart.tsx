import { useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import type {
  CandlestickData,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  Time,
  TimeScaleOptions,
  UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '@/types/bars';

export type UnifiedCandleChartProps = {
  candles: Bar[];
  height?: number;
  onReady?: (chart: IChartApi) => void;
  liveBar?: Bar | null;
};

const toTimestamp = (time: Bar['time']): UTCTimestamp => {
  const ms = typeof time === 'number' ? time : new Date(time).getTime();
  return Math.floor(ms / 1000) as UTCTimestamp;
};

const makeCandles = (candles: Bar[]): CandlestickData<Time>[] =>
  candles.map((candle) => ({
    time: toTimestamp(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));

const BASE_OPTIONS: DeepPartial<TimeScaleOptions> = {
  rightOffset: 8,
  barSpacing: 12,
  timeVisible: true,
  secondsVisible: false,
};

export function UnifiedCandleChart({ candles, height = 420, onReady, liveBar }: UnifiedCandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: '#080c16' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1e293b' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: BASE_OPTIONS,
      crosshair: { horzLine: { labelBackgroundColor: '#0ea5e9' }, vertLine: { labelBackgroundColor: '#0ea5e9' } },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      wickUpColor: '#10b981',
      downColor: '#ef4444',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    onReady?.(chart);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      chartRef.current.applyOptions({ width: entry.contentRect.width });
      chartRef.current.timeScale().fitContent();
    });
    observer.observe(container);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, onReady]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const data = makeCandles(candles);
    seriesRef.current.setData(data);
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  const normalizedLiveBar = useMemo(() => (liveBar ? makeCandles([liveBar])[0] : null), [liveBar]);

  useEffect(() => {
    if (!normalizedLiveBar || !seriesRef.current) return;
    seriesRef.current.update(normalizedLiveBar);
  }, [normalizedLiveBar]);

  return (
    <div ref={containerRef} className="relative w-full h-[420px]">
      <div className="absolute inset-0" />
    </div>
  );
}

export default UnifiedCandleChart;
