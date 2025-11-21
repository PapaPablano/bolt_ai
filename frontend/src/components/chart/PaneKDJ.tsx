import { useEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { createChart, type ISeriesApi, type Time } from 'lightweight-charts';
import type { LinePt } from '@/hooks/useIndicatorWorker';

const normalizeTime = (value: number): Time => {
  if (Number.isNaN(value)) return value as Time;
  const seconds = value > 1e12 ? Math.floor(value / 1000) : value;
  return seconds as Time;
};

const toSeries = (points: LinePt[]) => points.map((pt) => ({ time: normalizeTime(pt.time), value: pt.value }));

const LINE_STYLES = {
  k: { color: '#f97316' },
  d: { color: '#22d3ee' },
  j: { color: '#a855f7' },
} as const;

type LineWidths = { k?: 1 | 2 | 3 | 4; d?: 1 | 2 | 3 | 4; j?: 1 | 2 | 3 | 4 };

// Line widths are controlled via props and clamped to 1–4 for chart compatibility.
const clampWidth = (value?: number): 1 | 2 | 3 | 4 => {
  const n = Math.round(Number(value ?? 2));
  return Math.max(1, Math.min(4, n)) as 1 | 2 | 3 | 4;
};

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  height?: number;
  k: LinePt[];
  d: LinePt[];
  j: LinePt[];
  lineWidths?: LineWidths;
};

export default function PaneKDJ({
  height = 120,
  k,
  d,
  j,
  lineWidths,
  className,
  style,
  ...rest
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const kRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dRef = useRef<ISeriesApi<'Line'> | null>(null);
  const jRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
      timeScale: { secondsVisible: false, borderVisible: false },
    });

    kRef.current = chart.addLineSeries({
      lineWidth: clampWidth(lineWidths?.k),
      priceLineVisible: false,
      color: LINE_STYLES.k.color,
    });
    dRef.current = chart.addLineSeries({
      lineWidth: clampWidth(lineWidths?.d),
      priceLineVisible: false,
      color: LINE_STYLES.d.color,
    });
    jRef.current = chart.addLineSeries({
      lineWidth: clampWidth(lineWidths?.j),
      priceLineVisible: false,
      color: LINE_STYLES.j.color,
    });
    chartRef.current = chart;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth || 480 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      kRef.current = null;
      dRef.current = null;
      jRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    kRef.current?.applyOptions({ lineWidth: clampWidth(lineWidths?.k) });
    dRef.current?.applyOptions({ lineWidth: clampWidth(lineWidths?.d) });
    jRef.current?.applyOptions({ lineWidth: clampWidth(lineWidths?.j) });
  }, [lineWidths?.k, lineWidths?.d, lineWidths?.j]);

  useEffect(() => {
    if (!kRef.current) return;
    kRef.current.setData(toSeries(k));
  }, [k]);

  useEffect(() => {
    if (!dRef.current) return;
    dRef.current.setData(toSeries(d));
  }, [d]);

  useEffect(() => {
    if (!jRef.current) return;
    jRef.current.setData(toSeries(j));
  }, [j]);

  const mergedClass = ['w-full', className].filter(Boolean).join(' ');
  return <div ref={containerRef} className={mergedClass} style={{ minHeight: height, ...style }} {...rest} />;
}

/* @__TEST_ONLY__ */
export const __test = {
  clamp(w?: number): 1 | 2 | 3 | 4 {
    const n = Math.round(Number(w ?? 2));
    return Math.max(1, Math.min(4, n)) as 1 | 2 | 3 | 4;
  },
};
