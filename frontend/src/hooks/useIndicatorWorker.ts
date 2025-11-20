import { useEffect, useMemo, useRef } from 'react';
import WorkerURL from '@/workers/indicator.worker?worker&url';
import type { Candle, LinePt as BaseLinePt, StPerfParams } from '@/utils/indicators-supertrend-perf';

export type LinePt = BaseLinePt;

type Handlers = {
  onOverlayFull?: (name: string, series: LinePt[], aux?: Record<string, unknown>) => void;
  onOverlayPatch?: (name: string, point: LinePt) => void;
  onOverlayFullMulti?: (name: string, series: Record<string, LinePt[]>) => void;
  onOverlayPatchMulti?: (name: string, point: Record<string, LinePt>) => void;
  onSignals?: (name: string, signals: { time: number; price: number; dir: 1 | -1 }[]) => void;
};

export type KdjHandlers = {
  onKdjFull?: (k: LinePt[], d: LinePt[], j: LinePt[]) => void;
  onKdjPatch?: (k?: LinePt[], d?: LinePt[], j?: LinePt[]) => void;
};

export type UseIndicatorWorkerOpts = Handlers & {
  kdj?: KdjHandlers;
};

type CompactSeries = [number, number][];
type CompactPoint = [number, number];
type CompactMultiSeries = Record<string, CompactSeries>;
type CompactMultiPoint = Record<string, CompactPoint>;
type CompactPaneSeries = [number, number][];

type WorkerMessage =
  | { type: 'OVERLAY_FULL'; name: string; series: CompactSeries; aux?: Record<string, unknown> }
  | { type: 'OVERLAY_PATCH'; name: string; point: CompactPoint }
  | { type: 'OVERLAY_FULL_MULTI'; name: string; series: CompactMultiSeries }
  | { type: 'OVERLAY_PATCH_MULTI'; name: string; point: CompactMultiPoint }
  | { type: 'SIGNALS'; name: string; signals: { time: number; price: number; dir: 1 | -1 }[] }
  | { type: 'PANE_FULL'; key: 'kdj'; k: CompactPaneSeries; d: CompactPaneSeries; j: CompactPaneSeries }
  | { type: 'PANE_PATCH'; key: 'kdj'; k?: CompactPaneSeries; d?: CompactPaneSeries; j?: CompactPaneSeries };

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

const inflatePaneSeries = (series: CompactPaneSeries): LinePt[] => series.map(([time, value]) => ({ time, value }));

export const applyPatch = (prev: LinePt[], patch?: CompactPaneSeries): LinePt[] => {
  if (!patch?.length) return prev;
  const [time, value] = patch[0];
  if (prev.length && prev[prev.length - 1]?.time === time) {
    return [...prev.slice(0, -1), { time, value }];
  }
  return [...prev, { time, value }];
};

export function useIndicatorWorker(symbol: string, tf: string, opts: UseIndicatorWorkerOpts) {
  const workerRef = useRef<Worker | null>(null);
  const handlerRef = useRef(opts);

  useEffect(() => {
    handlerRef.current = opts;
  }, [opts]);

  const post = (payload: unknown) => workerRef.current?.postMessage(payload);

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
        case 'PANE_FULL':
          if (payload.key === 'kdj') {
            handlerRef.current.kdj?.onKdjFull?.(
              inflatePaneSeries(payload.k),
              inflatePaneSeries(payload.d),
              inflatePaneSeries(payload.j),
            );
          }
          break;
        case 'PANE_PATCH':
          if (payload.key === 'kdj') {
            handlerRef.current.kdj?.onKdjPatch?.(
              payload.k ? inflatePaneSeries(payload.k) : undefined,
              payload.d ? inflatePaneSeries(payload.d) : undefined,
              payload.j ? inflatePaneSeries(payload.j) : undefined,
            );
          }
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
      post({ type: 'SET_HISTORY', bars });
    };
    const liveBar = (bar: Candle, barClosed: boolean) => {
      post({ type: 'LIVE_BAR', bar, barClosed });
    };
    const toggle = (name: 'STAI' | 'EMA' | 'RSI' | 'VWAP' | 'BB' | 'MACD', on: boolean) => {
      post({ type: 'TOGGLE', name, on });
    };
    const setStParams = (params: Partial<StPerfParams>) => {
      post({ type: 'SET_PARAMS', name: 'STAI', params });
    };
    const setBbParams = (params: Partial<{ period: number; mult: number }>) => {
      post({ type: 'SET_PARAMS', name: 'BB', params });
    };
    const setMacdParams = (params: Partial<{ fast: number; slow: number; signal: number }>) => {
      post({ type: 'SET_PARAMS', name: 'MACD', params });
    };
    const setVwapParams = (params: Partial<{ mult: number }>) => {
      post({ type: 'SET_PARAMS', name: 'VWAP', params });
    };
    const toggleKdj = (enabled: boolean) => {
      post({ type: 'TOGGLE', name: 'KDJ', on: enabled });
    };
    const setKdjParams = (params: Partial<{ enabled: boolean; period: number; kSmooth: number; dSmooth: number; sessionAnchored: boolean }>) => {
      post({ type: 'SET_PARAMS', name: 'KDJ', params });
    };
    return { setHistory, liveBar, toggle, setStParams, setBbParams, setMacdParams, setVwapParams, toggleKdj, setKdjParams };
  }, []);

  return api;
}
