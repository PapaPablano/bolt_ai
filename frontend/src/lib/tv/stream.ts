import type { Bar } from '@/utils/bars-tv';
import type { ResolutionMapper } from '@/lib/tv/datafeed';
import { alignNYSEBucketStartUtcSec, bucketSec, toSec, type TF } from '@/utils/nyseTime';
import { validateSeriesMs } from '@/utils/validateSeries';

export type Tick = { time: number | string; open: number; high: number; low: number; close: number; volume?: number };
export type RealtimeCallback = (bar: Bar) => void;

const HISTORY_LIMIT = 2048;

export interface StreamAggregatorOptions {
  label?: string;
  validateEvery?: number;
}

export function createTvStreamAggregator(tf: TF, onRealtimeCallback: RealtimeCallback, opts: StreamAggregatorOptions = {}) {
  const step = bucketSec(tf);
  const label = opts.label ?? 'tv-stream';
  const validateEvery = Math.max(0, opts.validateEvery ?? 32);
  const history: Bar[] = [];

  let lastStart: number | null = null;
  let lastBar: Bar | null = null;
  let updates = 0;

  const pushHistory = (bar: Bar, replace: boolean) => {
    if (replace && history.length) {
      history[history.length - 1] = { ...bar };
    } else {
      history.push({ ...bar });
      if (history.length > HISTORY_LIMIT) history.shift();
    }
  };

  const emit = (bar: Bar, replaceHistory = false) => {
    lastBar = bar;
    onRealtimeCallback(bar);
    pushHistory(bar, replaceHistory);
    updates++;
    if (validateEvery > 0 && history.length > 1 && updates % validateEvery === 0) {
      validateSeriesMs(history, tf, label);
    }
  };

  const fillGaps = (targetStart: number) => {
    if (lastStart === null || !lastBar) return;
    let fill = lastStart + step;
    while (fill < targetStart) {
      const px = lastBar.close;
      const flat: Bar = { time: fill * 1000, open: px, high: px, low: px, close: px, volume: 0 };
      emit(flat);
      lastStart = fill;
      fill += step;
    }
  };

  const mergeTick = (tick: Tick): Bar => {
    if (!lastBar) {
      return {
        time: alignNYSEBucketStartUtcSec(toSec(tick.time), tf) * 1000,
        open: tick.open,
        high: tick.high,
        low: tick.low,
        close: tick.close,
        volume: tick.volume ?? 0,
      };
    }
    lastBar.high = Math.max(lastBar.high, tick.high);
    lastBar.low = Math.min(lastBar.low, tick.low);
    lastBar.close = tick.close;
    lastBar.volume = (lastBar.volume ?? 0) + (tick.volume ?? 0);
    return lastBar;
  };

  const handleTick = (tick: Tick) => {
    const tSec = toSec(tick.time);
    const tStart = alignNYSEBucketStartUtcSec(tSec, tf);

    if (lastStart !== null && tStart < lastStart) return;

    if (lastStart === null || tStart > lastStart) {
      fillGaps(tStart);
      const nextBar: Bar = { time: tStart * 1000, open: tick.open, high: tick.high, low: tick.low, close: tick.close, volume: tick.volume ?? 0 };
      emit(nextBar);
      lastStart = tStart;
      return;
    }

    const updated = mergeTick(tick);
    emit(updated, true);
  };

  return { handleTick };
}

export type SubscribeFn = (symbolInfo: unknown, tf: TF, onTick: (tick: Tick) => void, subscribeUID: string) => (() => void) | void;

export interface TvStreamControllerDeps {
  resToTf: ResolutionMapper;
  subscribe: SubscribeFn;
  label?: string;
  validateEvery?: number;
}

export function createTvStreamController({
  resToTf,
  subscribe,
  label = 'tv-stream',
  validateEvery,
}: TvStreamControllerDeps) {
  const registry = new Map<string, { dispose?: (() => void) | void }>();

  return {
    subscribeBars(symbolInfo: unknown, resolution: string, onRealtimeCallback: RealtimeCallback, subscribeUID: string) {
      const tf = resToTf(resolution);
      const agg = createTvStreamAggregator(tf, onRealtimeCallback, { label: `${label}:${subscribeUID}`, validateEvery });
      const dispose = subscribe(symbolInfo, tf, agg.handleTick, subscribeUID);
      registry.set(subscribeUID, { dispose });
    },
    unsubscribeBars(subscribeUID: string) {
      const entry = registry.get(subscribeUID);
      if (!entry) return;
      try {
        entry.dispose?.();
      } finally {
        registry.delete(subscribeUID);
      }
    },
  };
}
