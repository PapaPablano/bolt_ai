import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import type { CandlestickData, ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import type { Bar } from '@/types/bars';

type Props = {
  symbol: string;
  timeframe?: '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
  range?: string;
  height?: number;
};

const toPoint = (bar: Bar): CandlestickData<Time> => ({
  time: Math.floor(new Date(bar.time).getTime() / 1000) as UTCTimestamp,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});

export function LiveCandleChart({
  symbol,
  timeframe = '1Min',
  range = '6M',
  height = 480,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { data: history, isLoading, error } = useHistoricalBars(symbol, timeframe, range);
  const { bar: liveBar } = useLiveBars(symbol, timeframe);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      rightPriceScale: { borderVisible: false },
      timeScale: { secondsVisible: timeframe !== '1Day' },
      layout: {
        background: { color: '#0b1224' },
        textColor: '#cbd5e1',
      },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = series;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, [height, timeframe]);

  useEffect(() => {
    if (!seriesRef.current || !Array.isArray(history)) return;
    seriesRef.current.setData(history.map(toPoint));
  }, [history]);

  useEffect(() => {
    if (!seriesRef.current || !liveBar) return;
    seriesRef.current.update(toPoint(liveBar));
  }, [liveBar]);

  if (isLoading) return <div className="text-slate-400">Loading chart…</div>;
  if (error) return <div className="text-red-400">Failed to load history.</div>;

  return <div ref={containerRef} className="w-full h-[420px]" />;
}

export default LiveCandleChart;
