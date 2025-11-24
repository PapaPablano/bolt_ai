import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import type { Bar } from '@/types/bars';
import type { TF } from '@/types/prefs';
import { alignNYSEBucketStartUtcSec } from '@/utils/nyseTime';
import { assertBucketInvariant } from '@/utils/devInvariants';
import { WsStream } from '@/lib/ws/stream';
import type { TF as LiveTf, WsBarPayload } from '../../shared/ws-schema';

type LiveOptions = { throttleMs?: number; pollMs?: number; enabled?: boolean };
const DEFAULTS: Required<Omit<LiveOptions, 'enabled'>> = { throttleMs: 250, pollMs: 1000 };

const toIso = (sec: number) => new Date(sec * 1000).toISOString();

const WS_URL = env.ohlcWsUrl || '';
const wsClient = WS_URL ? new WsStream(WS_URL) : null;

const TF_MAP: Partial<Record<TF, LiveTf>> = {
  '1Min': '1m',
  '5Min': '5m',
  '15Min': '15m',
  '1Hour': '1h',
  '4Hour': '4h',
  '1Day': '1d',
};

const mapTf = (tf: TF): LiveTf | null => TF_MAP[tf] ?? null;

const toBar = (payload: WsBarPayload): Bar => ({
  time: new Date(payload.tsStart).toISOString(),
  open: payload.o,
  high: payload.h,
  low: payload.l,
  close: payload.c,
  volume: payload.v,
});

export function useLiveBars(symbol: string, timeframe: TF, opts: LiveOptions = {}) {
  const [bar, setBar] = useState<Bar | null>(null);
  const throttleRef = useRef<number | null>(null);

  useEffect(() => {
    setBar(null);
    if (opts.enabled === false) return;

    const emit = (b: Bar) => {
      if (throttleRef.current) window.clearTimeout(throttleRef.current);
      const throttle = opts.throttleMs ?? DEFAULTS.throttleMs;
      throttleRef.current = window.setTimeout(() => setBar(b), throttle) as unknown as number;
    };

    const startPolling = () => {
      let current: Bar | null = null;
      let lastBucketSec = -1;
      const quoteFn = env.quoteFunction || 'stock-quote';

      const pollMs = opts.pollMs ?? DEFAULTS.pollMs;
      const id = window.setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke(quoteFn, { body: { symbol } });
          if (error || !data) return;
          const px = Number((data as Record<string, unknown>)?.price ?? (data as Record<string, unknown>)?.last ?? (data as Record<string, unknown>)?.close ?? NaN);
          if (!Number.isFinite(px)) return;

          const nowSec = Math.floor(Date.now() / 1000);
          assertBucketInvariant(nowSec, timeframe);
          const aligned = alignNYSEBucketStartUtcSec(nowSec, timeframe);

          if (aligned !== lastBucketSec) {
            current = { time: toIso(aligned), open: px, high: px, low: px, close: px, volume: 0 };
            lastBucketSec = aligned;
          } else if (current) {
            current = {
              ...current,
              high: Math.max(current.high, px),
              low: Math.min(current.low, px),
              close: px,
            };
          }

          if (current) emit(current);
        } catch {
          // ignore poll errors
        }
      }, pollMs);

      return () => {
        window.clearInterval(id);
      };
    };

    const liveTf = mapTf(timeframe);
    if (wsClient && liveTf) {
      let unsub: (() => void) | undefined;
      let pollCleanup: (() => void) | undefined;
      let cancelled = false;

      wsClient
        .subscribe(symbol, liveTf, (payload) => {
          if (cancelled) return;
          const tickSec = Math.floor(payload.tsStart / 1000);
          assertBucketInvariant(tickSec, timeframe);
          emit(toBar(payload));
        })
        .then((fn) => {
          if (cancelled) {
            fn();
            return;
          }
          unsub = fn;
        })
        .catch(() => {
          if (!cancelled) pollCleanup = startPolling();
        });

      return () => {
        cancelled = true;
        unsub?.();
        pollCleanup?.();
      };
    }

    return startPolling();
  }, [symbol, timeframe, opts.enabled, opts.pollMs, opts.throttleMs]);

  useEffect(() => {
    return () => {
      if (throttleRef.current) window.clearTimeout(throttleRef.current);
    };
  }, []);

  return { bar };
}
