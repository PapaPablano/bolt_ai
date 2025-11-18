import { useEffect, useLayoutEffect, useRef } from 'react';
import * as LWC from 'lightweight-charts';
import type { ISeriesApi, LineData } from 'lightweight-charts';

type SeriesDef = {
  id: string;
  name: string;
  data: { time: number | string | Date; value: number }[];
  color?: string;
};

type Props = {
  height?: number;
  series: SeriesDef[];
  dark?: boolean;
};

export default function ComparisonChart({ height = 320, series, dark = true }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof LWC.createChart> | null>(null);
  const seriesRefs = useRef<Record<string, ISeriesApi<'Line'>>>({});

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || chartRef.current) return;

    const width = Math.max(el.clientWidth || 0, 640);
    const layout = dark
      ? { background: { color: '#0b1224' }, textColor: '#cbd5e1' }
      : { background: { color: '#ffffff' }, textColor: '#111827' };

    const chart = LWC.createChart(el, {
      width,
      height,
      layout,
      rightPriceScale: { borderVisible: false },
      timeScale: { secondsVisible: false, timeVisible: true },
    });

    chartRef.current = chart;

    const onResize = () => {
      const w = Math.max(el.clientWidth || 0, 480);
      chart.applyOptions({ width: w });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [height, dark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const refs = seriesRefs.current;
    const present = new Set<string>();

    for (const s of series) {
      present.add(s.id);
      if (!refs[s.id]) {
        refs[s.id] = chart.addLineSeries({
          lineWidth: 2,
          priceLineVisible: false,
          color: s.color,
          title: s.name,
        });
      }
      const data: LineData[] = s.data.map((d) => ({
        time: typeof d.time === 'number' ? d.time : Math.floor(new Date(d.time).getTime() / 1000),
        value: d.value,
      }));
      refs[s.id].setData(data);
    }

    // Remove stale series
    for (const id of Object.keys(refs)) {
      if (!present.has(id)) {
        // @ts-expect-error remove not typed on series; exists at runtime
        refs[id].remove?.();
        delete refs[id];
      }
    }

    chart.timeScale().fitContent();
  }, [series]);

  return <div ref={hostRef} style={{ width: '100%', height }} />;
}
