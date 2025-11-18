import { useEffect, useMemo, useRef } from 'react';
import { createChart, type ISeriesApi } from 'lightweight-charts';
import type { TF, Range } from '@/types/prefs';
import type { Bar } from '@/types/bars';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { useHistoricalBars } from '@/hooks/useHistoricalBars';
import { useLiveBars } from '@/hooks/useLiveBars';
import { sma, ema, bollinger, rsi, toSec } from '@/utils/indicators';
import { IndicatorMenu } from './IndicatorMenu';
import { IntervalBar } from './IntervalBar';
import { RangeBar } from './RangeBar';
import { Button } from '@/components/ui/button';

type Props = { symbol: string; initialTf?: TF; initialRange?: Range; height?: number };

export default function AdvancedCandleChart({ symbol, initialTf = '1Hour', initialRange = '1Y', height = 520 }: Props) {
  const { loading: prefsLoading, prefs, getTfPreset, setDefaultTf, setDefaultRange } = useChartPrefs();
  const tf: TF = prefs.default_timeframe ?? initialTf;
  const range: Range = prefs.default_range ?? initialRange;
  const preset = useMemo(() => getTfPreset(tf), [getTfPreset, tf]);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlays = useRef<{ sma?: ISeriesApi<'Line'>; ema?: ISeriesApi<'Line'>; bbu?: ISeriesApi<'Line'>; bbm?: ISeriesApi<'Line'>; bbl?: ISeriesApi<'Line'> }>({});
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const mainChartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const rsiChartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const { data: history, isLoading, error } = useHistoricalBars(symbol, tf, range);
  const { bar: liveBar } = useLiveBars(symbol, tf);

  useEffect(() => {
    if (!mainRef.current) return;
    mainChartRef.current?.remove();
    const chart = createChart(mainRef.current, {
      height: preset.useRSI ? Math.floor(height * 0.72) : height,
      rightPriceScale: { borderVisible: false },
      timeScale: { secondsVisible: tf !== '1Day' },
      layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
    });
    const cs = chart.addCandlestickSeries();
    seriesRef.current = cs;

    overlays.current = {};
    if (preset.useSMA) overlays.current.sma = chart.addLineSeries({ lineWidth: 1 });
    if (preset.useEMA) overlays.current.ema = chart.addLineSeries({ lineWidth: 1 });
    if (preset.useBB) {
      overlays.current.bbu = chart.addLineSeries({ lineWidth: 1 });
      overlays.current.bbm = chart.addLineSeries({ lineWidth: 1 });
      overlays.current.bbl = chart.addLineSeries({ lineWidth: 1 });
    }
    mainChartRef.current = chart;

    if (preset.useRSI && rsiRef.current) {
      rsiChartRef.current?.remove();
      const rchart = createChart(rsiRef.current, {
        height: Math.floor(height * 0.28),
        rightPriceScale: { borderVisible: false },
        layout: { background: { color: '#0b1224' }, textColor: '#cbd5e1' },
      });
      rsiSeriesRef.current = rchart.addLineSeries({ lineWidth: 1 });
      rsiChartRef.current = rchart;
    }
    const onResize = () => {
      if (!mainRef.current) return;
      mainChartRef.current?.applyOptions({ width: mainRef.current.clientWidth });
      if (preset.useRSI && rsiRef.current) rsiChartRef.current?.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      rsiChartRef.current?.remove();
    };
  }, [tf, height, preset.useSMA, preset.useEMA, preset.useBB, preset.useRSI]);

  useEffect(() => {
    if (!history || !seriesRef.current) return;
    const toCandle = (b: Bar) => ({ time: toSec(b.time), open: b.open, high: b.high, low: b.low, close: b.close });
    seriesRef.current.setData(history.map(toCandle));

    if (preset.useSMA && overlays.current.sma) overlays.current.sma.setData(sma(history, preset.smaPeriod));
    if (preset.useEMA && overlays.current.ema) overlays.current.ema.setData(ema(history, preset.emaPeriod));
    if (preset.useBB && overlays.current.bbu && overlays.current.bbm && overlays.current.bbl) {
      const bb = bollinger(history, preset.bbPeriod, preset.bbMult);
      overlays.current.bbu.setData(bb.upper);
      overlays.current.bbm.setData(bb.middle);
      overlays.current.bbl.setData(bb.lower);
    }
    if (preset.useRSI && rsiSeriesRef.current) rsiSeriesRef.current.setData(rsi(history, preset.rsiPeriod));

    const focusBars = focusWindowCount(tf);
    const lastIdx = history.length - 1;
    const from = Math.max(0, lastIdx - focusBars);
    mainChartRef.current?.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
    if (preset.useRSI && rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to: lastIdx });
  }, [history, tf, preset]);

  useEffect(() => {
    if (!liveBar || !seriesRef.current) return;
    const p = { time: toSec(liveBar.time), open: liveBar.open, high: liveBar.high, low: liveBar.low, close: liveBar.close };
    seriesRef.current.update(p);
  }, [liveBar]);

  if (isLoading || prefsLoading) return <div className="text-slate-400">Loading…</div>;
  if (error) return <div className="text-red-400">Failed to load data.</div>;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <IntervalBar value={tf} onChange={(v) => setDefaultTf(v)} />
          <RangeBar value={range} onChange={(v) => setDefaultRange(v)} />
        </div>
        <div className="flex gap-2">
          <IndicatorMenu timeframe={tf} />
          <Button variant="secondary" onClick={() => mainChartRef.current?.timeScale().fitContent()}>
            Reset view
          </Button>
        </div>
      </div>
      <div ref={mainRef} className="w-full" style={{ height: preset.useRSI ? Math.floor(height * 0.72) : height }} />
      {preset.useRSI && <div ref={rsiRef} className="w-full" style={{ height: Math.floor(height * 0.28) }} />}
    </div>
  );
}

function focusWindowCount(tf: TF) {
  const per: Record<TF, number> = { '1Min': 360, '5Min': 72, '10Min': 36, '15Min': 24, '1Hour': 240, '4Hour': 180, '1Day': 250 };
  return per[tf];
}
