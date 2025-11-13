import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import { type BarData } from '../lib/api';

interface TradingChartProps {
  data: BarData[];
  symbol: string;
  height?: number;
}

export function TradingChart({ data, symbol, height = 600 }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const candlestickData: CandlestickData[] = data.map(bar => ({
      time: new Date(bar.time).getTime() / 1000 as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candlestickSeriesRef.current.setData(candlestickData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100">{symbol}</h3>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}
