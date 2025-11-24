import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, BarData } from 'lightweight-charts';

// Ensure data is strictly ascending by time before passing to lightweight-charts.
// Instead of throwing on duplicates/out-of-order timestamps, we defensively
// sanitize the series so the chart continues to render.
function sanitizeAscendingTimes<T extends { time: number; high?: number; low?: number; close?: number; volume?: number }>(
  data: T[],
): T[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  // Sort by time in case callers provide unsorted arrays.
  const sorted = [...data].sort((a, b) => a.time - b.time);
  const out: T[] = [];
  let lastTime = Number.NEGATIVE_INFINITY;

  for (const bar of sorted) {
    if (bar.time <= lastTime) {
      // Duplicate/backwards time: merge into previous bar if OHLC present,
      // otherwise skip this bar.
      const prev = out[out.length - 1];
      if (prev && typeof prev.high === 'number' && typeof prev.low === 'number' && typeof prev.close === 'number') {
        if (typeof bar.high === 'number') prev.high = Math.max(prev.high, bar.high);
        if (typeof bar.low === 'number') prev.low = Math.min(prev.low, bar.low);
        if (typeof bar.close === 'number') prev.close = bar.close;
        if (typeof bar.volume === 'number') {
          prev.volume = (prev.volume ?? 0) + bar.volume;
        }
      }
      continue;
    }
    out.push(bar);
    lastTime = bar.time;
  }

  return out;
}

type AdvancedCandleChartProps = {
  bars: BarData[];
};

export function AdvancedCandleChart({ bars }: AdvancedCandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    seriesRef.current = chartRef.current.addCandlestickSeries();

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;

    const safeBars = sanitizeAscendingTimes(bars);
    seriesRef.current.setData(safeBars);
  }, [bars]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}
