import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, type ISeriesApi } from 'lightweight-charts';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import { sma, ema, bollinger, rsi } from '@/utils/indicators';
import type { Bar } from '@/types/bars';

type TF = '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
type Range = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'MAX';

type Props = { symbol: string; initialTf?: TF; initialRange?: Range; height?: number };

const TF_OPTIONS: TF[] = ['1Min', '5Min', '10Min', '15Min', '1Hour', '4Hour', '1Day'];
const RANGE_OPTIONS: Range[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'MAX'];

export default function AdvancedCandleChart({ symbol, initialTf = '1Hour', initialRange = '1Y', height = 520 }: Props) {
  const [tf, setTf] = useState<TF>(() => {
    if (typeof window === 'undefined') return initialTf;
    const stored = window.localStorage.getItem('tf') as TF | null;
    return stored && TF_OPTIONS.includes(stored) ? stored : initialTf;
  });
  const [range, setRange] = useState<Range>(() => {
    if (typeof window === 'undefined') return initialRange;
    const stored = window.localStorage.getItem('range') as Range | null;
    return stored && RANGE_OPTIONS.includes(stored) ? stored : initialRange;
  });
  const [useSMA, setUseSMA] = useState(true);
  const [useEMA, setUseEMA] = useState(false);
  const [useBB, setUseBB] = useState(false);
  const [useRSI, setUseRSI] = useState(false);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbURef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const mainChartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const rsiChartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const { data: history, isLoading, error } = useHistoricalBars(symbol, tf, range);
  const { bar: liveBar } = useLiveBars(symbol, tf);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tf', tf);
  }, [tf]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('range', range);
  }, [range]);

  useEffect(() => {
    if (!mainRef.current) return;
    mainChartRef.current?.remove();
    const chart = createChart(mainRef.current, {
      height: useRSI ? Math.floor(height * 0.72) : height,
      rightPriceScale: { borderVisible: false },
      timeScale: { secondsVisible: tf !== '1Day' },
      layout: {
        textColor: '#cbd5e1',
        background: { color: '#0b1224' },
      },
    });
    const cs = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = cs;

    if (useSMA) smaRef.current = chart.addLineSeries({ lineWidth: 1, color: '#38bdf8' });
    if (useEMA) emaRef.current = chart.addLineSeries({ lineWidth: 1, color: '#a78bfa' });
    if (useBB) {
      bbURef.current = chart.addLineSeries({ lineWidth: 1, color: '#f59e0b' });
      bbMRef.current = chart.addLineSeries({ lineWidth: 1, color: '#e0f2fe' });
      bbLRef.current = chart.addLineSeries({ lineWidth: 1, color: '#f59e0b' });
    }

    mainChartRef.current = chart;

    if (useRSI && rsiRef.current) {
      rsiChartRef.current?.remove();
      const rchart = createChart(rsiRef.current, {
        height: Math.floor(height * 0.28),
        rightPriceScale: { borderVisible: false },
        timeScale: { visible: true, secondsVisible: false, timeVisible: false },
        layout: {
          textColor: '#cbd5e1',
          background: { color: '#0b1224' },
        },
      });
      rsiSeriesRef.current = rchart.addLineSeries({ lineWidth: 1, color: '#38bdf8' });
      rsiChartRef.current = rchart;
    }

    const onResize = () => {
      if (!mainRef.current) return;
      mainChartRef.current?.applyOptions({ width: mainRef.current.clientWidth });
      if (useRSI && rsiRef.current) rsiChartRef.current?.applyOptions({ width: rsiRef.current.clientWidth });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      rsiChartRef.current?.remove();
    };
  }, [tf, height, useSMA, useEMA, useBB, useRSI]);

  useEffect(() => {
    if (!history || !seriesRef.current) return;
    const toCandle = (b: Bar) => ({
      time: toSeconds(b.time),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    });
    seriesRef.current.setData(history.map(toCandle));

    if (useSMA && smaRef.current) smaRef.current.setData(sma(history, 20));
    if (useEMA && emaRef.current) emaRef.current.setData(ema(history, 50));
    if (useBB && bbURef.current && bbMRef.current && bbLRef.current) {
      const bands = bollinger(history, 20, 2);
      bbURef.current.setData(bands.upper);
      bbMRef.current.setData(bands.middle);
      bbLRef.current.setData(bands.lower);
    }
    if (useRSI && rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(rsi(history, 14));
    }

    const focusBars = focusWindowCount(tf);
    const lastIdx = history.length - 1;
    if (lastIdx >= 0 && mainChartRef.current) {
      const from = Math.max(0, lastIdx - focusBars);
      mainChartRef.current.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
      if (useRSI && rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    }
  }, [history, tf, range, useSMA, useEMA, useBB, useRSI]);

  useEffect(() => {
    if (!liveBar || !seriesRef.current) return;
    const point = {
      time: toSeconds(liveBar.time),
      open: liveBar.open,
      high: liveBar.high,
      low: liveBar.low,
      close: liveBar.close,
    };
    seriesRef.current.update(point);

    if (useSMA && smaRef.current && history) smaRef.current.update({ time: point.time, value: rollingSMA(history, point, 20) });
    if (useEMA && emaRef.current && history) emaRef.current.update({ time: point.time, value: rollingEMA(history, point, 50) });
    if (useBB && bbURef.current && bbMRef.current && bbLRef.current && history) {
      const { u, m, l } = rollingBB(history, point, 20, 2);
      if (u !== null && m !== null && l !== null) {
        bbURef.current.update({ time: point.time, value: u });
        bbMRef.current.update({ time: point.time, value: m });
        bbLRef.current.update({ time: point.time, value: l });
      }
    }
    if (useRSI && rsiSeriesRef.current && history) {
      const val = rollingRSI(history, point, 14);
      if (val !== null) rsiSeriesRef.current.update({ time: point.time, value: val });
    }
  }, [liveBar, useSMA, useEMA, useBB, useRSI, history]);

  const controls = useMemo(() => {
    return (
      <div className="flex flex-wrap gap-3 items-center">
        <TimeframeSelect value={tf} onChange={setTf} />
        <RangeSelect value={range} onChange={setRange} />
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={useSMA} onChange={(e) => setUseSMA(e.target.checked)} />
          SMA(20)
        </label>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={useEMA} onChange={(e) => setUseEMA(e.target.checked)} />
          EMA(50)
        </label>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={useBB} onChange={(e) => setUseBB(e.target.checked)} />
          Bollinger(20,2)
        </label>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={useRSI} onChange={(e) => setUseRSI(e.target.checked)} />
          RSI(14)
        </label>
      </div>
    );
  }, [tf, range, useSMA, useEMA, useBB, useRSI]);

  if (isLoading) return <div className="text-slate-400">Loading…</div>;
  if (error) return <div className="text-red-400">Failed to load data.</div>;

  return (
    <div className="grid gap-2">
      {controls}
      <div ref={mainRef} style={{ width: '100%', height: useRSI ? Math.floor(height * 0.72) : height }} />
      {useRSI && <div ref={rsiRef} style={{ width: '100%', height: Math.floor(height * 0.28) }} />}
    </div>
  );
}

function TimeframeSelect({ value, onChange }: { value: TF; onChange: (v: TF) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TF)}
      className="px-3 py-2 rounded bg-slate-900 border border-slate-800"
      aria-label="Timeframe"
    >
      {TF_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

function RangeSelect({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Range)}
      className="px-3 py-2 rounded bg-slate-900 border border-slate-800"
      aria-label="Range"
    >
      {RANGE_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const label = (tf: TF) =>
  ({
    '1Min': '1 m',
    '5Min': '5 m',
    '10Min': '10 m',
    '15Min': '15 m',
    '1Hour': '1 h',
    '4Hour': '4 h',
    '1Day': '1 d',
  })[tf];

const toSeconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function focusWindowCount(tf: TF) {
  const per: Record<TF, number> = { '1Min': 6 * 60, '5Min': 6 * 12, '10Min': 6 * 6, '15Min': 6 * 4, '1Hour': 24 * 10, '4Hour': 6 * 30, '1Day': 250 };
  return per[tf];
}

function rollingSMA(hist: Bar[], p: { time: number; close: number }, period: number) {
  const last = hist.slice(-period + 1).map((b) => b.close);
  const sum = last.reduce((a, b) => a + b, 0) + p.close;
  return +(sum / period).toFixed(5);
}

function rollingEMA(hist: Bar[], p: { time: number; close: number }, period: number) {
  const k = 2 / (period + 1);
  const prev = ema(hist, period).at(-1)?.value ?? p.close;
  return +(((p.close - prev) * k) + prev).toFixed(5);
}

function rollingBB(hist: Bar[], p: { time: number; close: number }, period: number, mult: number) {
  const window = [...hist.slice(-period + 1).map((b) => b.close), p.close];
  if (window.length < period) return { u: null, m: null, l: null };
  const mean = window.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period);
  return { u: +(mean + mult * sd).toFixed(5), m: +mean.toFixed(5), l: +(mean - mult * sd).toFixed(5) };
}

function rollingRSI(hist: Bar[], p: { time: number; close: number }, period: number) {
  const arr = [...hist.map((b) => b.close), p.close];
  if (arr.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = arr.length - period; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}
