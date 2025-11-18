import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import { isValidSymbol, normalizeSymbol } from '@/lib/symbols';
import type { Bar } from '@/types/bars';

type LiveOptions = { throttleMs?: number; pollMs?: number };

const DEFAULTS = { throttleMs: 300, pollMs: 1000 } as const;

export function useLiveBars(symbol: string, timeframe: string, opts: LiveOptions = {}) {
  const [bar, setBar] = useState<Bar | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const throttleMs = opts.throttleMs ?? DEFAULTS.throttleMs;
  const pollMs = opts.pollMs ?? DEFAULTS.pollMs;
  const throttledSet = useThrottle<Bar | null>(setBar, throttleMs);

  useEffect(() => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!isValidSymbol(normalizedSymbol)) return;

    let cancelled = false;
    throttledSet(null);
    const { baseTf, aggMinutes } = baseTimeframe(timeframe);

    if (env.alpacaWsUrl) {
      try {
        const ws = new WebSocket(env.alpacaWsUrl);
        wsRef.current = ws;

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ action: 'subscribe', symbols: [normalizedSymbol], type: 'bars', timeframe: baseTf }));
        });

        let cur: Bar | null = null;
        let lastBucket = '';
        ws.addEventListener('message', (ev) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(ev.data);
            if (!msg || msg.time === undefined || msg.open === undefined) return;
            const src: Bar = {
              time: typeof msg.time === 'number' ? new Date(msg.time * 1000).toISOString() : msg.time,
              open: msg.open,
              high: msg.high,
              low: msg.low,
              close: msg.close,
              volume: msg.volume ?? msg.v ?? 0,
            };
            const bucketIso = bucketStartIso(src.time, aggMinutes, baseTf);
            if (aggMinutes === 0) {
              throttledSet({ ...src, time: bucketIso });
              return;
            }

            if (bucketIso !== lastBucket) {
              cur = { time: bucketIso, open: src.open, high: src.high, low: src.low, close: src.close, volume: src.volume ?? 0 };
              lastBucket = bucketIso;
            } else {
              cur = {
                time: bucketIso,
                open: cur!.open,
                high: Math.max(cur!.high, src.high),
                low: Math.min(cur!.low, src.low),
                close: src.close,
                volume: (cur!.volume ?? 0) + (src.volume ?? 0),
              };
            }
            throttledSet(cur!);
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
        // fallback below
      }
    }

    const quoteFunction = env.quoteFunction || 'stock-quote';
    let cur: Bar | null = null;
    let lastBucket = '';

    const id = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(quoteFunction, { body: { symbol: normalizedSymbol } });
        if (error || !data) return;
        const last = parseLastPrice(data as Record<string, unknown>);
        if (!Number.isFinite(last)) return;

        const nowIso = new Date().toISOString();
        const bucketIso = bucketStartIso(nowIso, aggMinutes, baseTf);
        if (aggMinutes === 0) {
          throttledSet({ time: bucketIso, open: last, high: last, low: last, close: last, volume: 0 });
          return;
        }

        if (bucketIso !== lastBucket) {
          cur = { time: bucketIso, open: last, high: last, low: last, close: last, volume: 0 };
          lastBucket = bucketIso;
        } else {
          cur = {
            ...cur!,
            high: Math.max(cur!.high, last),
            low: Math.min(cur!.low, last),
            close: last,
          };
        }
        throttledSet(cur!);
      } catch {
        // ignore transient failures
      }
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe, pollMs, throttleMs, throttledSet]);

  return { bar };
}

function baseTimeframe(tf: string) {
  if (tf === '10Min') return { baseTf: '1Min', aggMinutes: 10 };
  if (tf === '4Hour') return { baseTf: '1Hour', aggMinutes: 240 };
  return { baseTf: tf, aggMinutes: 0 };
}

function bucketStartIso(iso: string, minutes: number, baseTf?: string) {
  if (minutes === 0 && baseTf === '1Day') {
    const d = new Date(iso);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (minutes === 0) return iso;
  const d = new Date(iso);
  const ms = minutes * 60_000;
  return new Date(Math.floor(d.getTime() / ms) * ms).toISOString();
}

function useThrottle<T>(setter: (v: T) => void, ms: number) {
  const timeout = useRef<number | undefined>();

  useEffect(() => {
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current);
    };
  }, []);

  return useCallback(
    (value: T) => {
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setter(value), ms);
    },
    [ms, setter],
  );
}

const parseLastPrice = (data: Record<string, unknown>): number | null => {
  const value = data?.price ?? data?.last ?? data?.close;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};
