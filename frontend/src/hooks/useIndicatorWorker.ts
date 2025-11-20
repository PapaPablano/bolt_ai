import { useEffect, useMemo, useRef } from 'react';
import WorkerURL from '@/workers/indicator.worker?worker&url';
import type { Candle, LinePt, StPerfParams } from '@/utils/indicators-supertrend-perf';

type Handlers = {
  onOverlayFull?: (name: string, series: LinePt[], aux?: Record<string, unknown>) => void;
  onOverlayPatch?: (name: string, point: LinePt) => void;
  onOverlayFullMulti?: (name: string, series: Record<string, LinePt[]>) => void;
  onOverlayPatchMulti?: (name: string, point: Record<string, LinePt>) => void;
  onSignals?: (name: string, signals: { time: number; price: number; dir: 1 | -1 }[]) => void;
};

type CompactSeries = [number, number][];
type CompactPoint = [number, number];
type CompactMultiSeries = Record<string, CompactSeries>;
type CompactMultiPoint = Record<string, CompactPoint>;

type WorkerMessage =
  | { type: 'OVERLAY_FULL'; name: string; series: CompactSeries; aux?: Record<string, unknown> }
  | { type: 'OVERLAY_PATCH'; name: string; point: CompactPoint }
  | { type: 'OVERLAY_FULL_MULTI'; name: string; series: CompactMultiSeries }
  | { type: 'OVERLAY_PATCH_MULTI'; name: string; point: CompactMultiPoint }
  | { type: 'SIGNALS'; name: string; signals: { time: number; price: number; dir: 1 | -1 }[] };

const inflateSeries = (series: CompactSeries): LinePt[] => series.map(([time, value]) => ({ time, value }));
const inflatePoint = ([time, value]: CompactPoint): LinePt => ({ time, value });
const inflateMultiSeries = (series: CompactMultiSeries): Record<string, LinePt[]> => {
  const next: Record<string, LinePt[]> = {};
  Object.keys(series).forEach((key) => {
    next[key] = inflateSeries(series[key]);
  });
  return next;
};
const inflateMultiPoint = (points: CompactMultiPoint): Record<string, LinePt> => {
  const out: Record<string, LinePt> = {};
  Object.keys(points).forEach((key) => {
    out[key] = inflatePoint(points[key]);
  });
  return out;
};

export function useIndicatorWorker(symbol: string, tf: string, handlers: Handlers) {
  const workerRef = useRef<Worker | null>(null);
  const handlerRef = useRef(handlers);

  useEffect(() => {
    handlerRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const worker = new Worker(WorkerURL, { type: 'module' });
    workerRef.current = worker;
    worker.postMessage({ type: 'INIT', symbol, tf });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const payload = event.data;
      if (!payload) return;
      switch (payload.type) {
        case 'OVERLAY_FULL':
          handlerRef.current.onOverlayFull?.(payload.name, inflateSeries(payload.series), payload.aux);
          break;
        case 'OVERLAY_PATCH':
          handlerRef.current.onOverlayPatch?.(payload.name, inflatePoint(payload.point));
          break;
        case 'OVERLAY_FULL_MULTI':
          handlerRef.current.onOverlayFullMulti?.(payload.name, inflateMultiSeries(payload.series));
          break;
        case 'OVERLAY_PATCH_MULTI':
          handlerRef.current.onOverlayPatchMulti?.(payload.name, inflateMultiPoint(payload.point));
          break;
        case 'SIGNALS':
          handlerRef.current.onSignals?.(payload.name, payload.signals);
          break;
        default:
          break;
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [symbol, tf]);

  const api = useMemo(() => {
    const setHistory = (bars: Candle[]) => {
      workerRef.current?.postMessage({ type: 'SET_HISTORY', bars });
    };
    const liveBar = (bar: Candle, barClosed: boolean) => {
      workerRef.current?.postMessage({ type: 'LIVE_BAR', bar, barClosed });
    };
    const toggle = (name: 'STAI' | 'EMA' | 'RSI' | 'VWAP' | 'BB' | 'MACD', on: boolean) => {
      workerRef.current?.postMessage({ type: 'TOGGLE', name, on });
    };
    const setStParams = (params: Partial<StPerfParams>) => {
      workerRef.current?.postMessage({ type: 'SET_PARAMS', name: 'STAI', params });
    };
    const setBbParams = (params: Partial<{ period: number; mult: number }>) => {
      workerRef.current?.postMessage({ type: 'SET_PARAMS', name: 'BB', params });
    };
    const setMacdParams = (params: Partial<{ fast: number; slow: number; signal: number }>) => {
      workerRef.current?.postMessage({ type: 'SET_PARAMS', name: 'MACD', params });
    };
    const setVwapParams = (params: Partial<{ mult: number }>) => {
      workerRef.current?.postMessage({ type: 'SET_PARAMS', name: 'VWAP', params });
    };
    return { setHistory, liveBar, toggle, setStParams, setBbParams, setMacdParams, setVwapParams };
  }, []);

  return api;
}
