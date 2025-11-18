import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import type { Bar } from '@/types/bars';

type LiveOptions = { throttleMs?: number; pollMs?: number };

const DEFAULTS: Required<LiveOptions> = { throttleMs: 300, pollMs: 1000 };

const aggregateTickIntoBar = (prev: Bar | null, last: number, bucketIso: string): Bar => {
  if (!prev) {
    return { time: bucketIso, open: last, high: last, low: last, close: last, volume: 0 };
  }

  return {
    time: bucketIso,
    open: prev.open,
    high: Math.max(prev.high, last),
    low: Math.min(prev.low, last),
    close: last,
    volume: prev.volume ?? 0,
  };
};

const bucketStart = (date: Date, timeframe: string): Date => {
  const d = new Date(date);
  if (timeframe === '1Day') {
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const minutesMap: Record<string, number> = { '1Min': 1, '5Min': 5, '15Min': 15, '1Hour': 60 };
  const minutes = minutesMap[timeframe] ?? 1;
  const ms = 60_000 * minutes;
  return new Date(Math.floor(d.getTime() / ms) * ms);
};

const useThrottle = <T,>(val: T, ms: number) => {
  const [state, setState] = useState(val);
  const timeout = useRef<number | null>(null);

  useEffect(() => {
    if (timeout.current) {
      window.clearTimeout(timeout.current);
    }
    timeout.current = window.setTimeout(() => setState(val), ms);

    return () => {
      if (timeout.current) {
        window.clearTimeout(timeout.current);
      }
    };
  }, [val, ms]);

  return state;
};

const parseLastPrice = (data: Record<string, unknown>): number | null => {
  const value = data?.price ?? data?.last ?? data?.close;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

export function useLiveBars(symbol: string, timeframe: string, opts: LiveOptions = {}) {
  const [bar, setBar] = useState<Bar | null>(null);
  const throttled = useThrottle(bar, opts.throttleMs ?? DEFAULTS.throttleMs);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setBar(null);

    const pollMs = opts.pollMs ?? DEFAULTS.pollMs;

    // Prefer websocket stream if available (proxy should handle auth).
    if (env.alpacaWsUrl) {
      try {
        const ws = new WebSocket(env.alpacaWsUrl);
        wsRef.current = ws;

        ws.addEventListener('open', () => {
          const msg = { action: 'subscribe', symbols: [symbol], type: 'bars', timeframe };
          ws.send(JSON.stringify(msg));
        });

        ws.addEventListener('message', (ev) => {
          if (cancelled) return;
          try {
            const payload = JSON.parse(ev.data);
            if (payload && payload.time && typeof payload.close === 'number') {
              setBar(payload as Bar);
            }
          } catch {
            // ignore malformed messages
          }
        });

        ws.addEventListener('close', () => {
          wsRef.current = null;
        });

        return () => {
          cancelled = true;
          try {
            ws.close();
          } catch {
            // ignore
          }
        };
      } catch {
        // Fall back to polling if WS setup fails.
      }
    }

    const quoteFunction = env.quoteFunction || 'stock-quote';
    let lastBucket = '';
    let current: Bar | null = null;

    const id = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(quoteFunction, { body: { symbol } });
        if (error || !data) return;
        const last = parseLastPrice(data as Record<string, unknown>);
        if (!Number.isFinite(last)) return;

        const now = new Date();
        const bucket = bucketStart(now, timeframe);
        const bucketIso = bucket.toISOString();

        if (bucketIso !== lastBucket) {
          current = { time: bucketIso, open: last!, high: last!, low: last!, close: last!, volume: 0 };
          lastBucket = bucketIso;
        } else {
          current = aggregateTickIntoBar(current, last!, bucketIso);
        }
        setBar(current);
      } catch {
        // ignore transient errors
      }
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe, opts.pollMs, opts.throttleMs]);

  return { bar: throttled };
}
