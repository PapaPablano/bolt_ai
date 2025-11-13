import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts';

interface ComparisonData {
  symbol: string;
  data: Array<{ time: string; close: number }>;
  color: string;
}

interface ComparisonChartProps {
  datasets: ComparisonData[];
  height?: number;
}

export function ComparisonChart({ datasets, height = 500 }: ComparisonChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

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
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    chartRef.current = chart;

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
      seriesRefs.current.clear();
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current || datasets.length === 0) return;

    seriesRefs.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    seriesRefs.current.clear();

    const normalizedDatasets = normalizeDatasets(datasets);

    normalizedDatasets.forEach((dataset) => {
      const series = chartRef.current!.addLineSeries({
        color: dataset.color,
        lineWidth: 2,
        title: dataset.symbol,
      });

      const lineData: LineData[] = dataset.data.map((point) => ({
        time: new Date(point.time).getTime() / 1000 as Time,
        value: point.close,
      }));

      series.setData(lineData);
      seriesRefs.current.set(dataset.symbol, series);
    });

    chartRef.current.timeScale().fitContent();
  }, [datasets]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} />
      {datasets.length > 0 && (
        <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
          <div className="space-y-1">
            {datasets.map((dataset) => (
              <div key={dataset.symbol} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dataset.color }}
                />
                <span className="text-slate-200 font-medium">{dataset.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeDatasets(datasets: ComparisonData[]): ComparisonData[] {
  return datasets.map((dataset) => {
    if (dataset.data.length === 0) return dataset;

    const firstValue = dataset.data[0].close;
    const normalized = dataset.data.map((point) => ({
      time: point.time,
      close: (point.close / firstValue) * 100,
    }));

    return {
      ...dataset,
      data: normalized,
    };
  });
}
