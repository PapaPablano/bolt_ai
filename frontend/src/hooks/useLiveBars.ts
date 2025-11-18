import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { env } from '@/lib/env';
import type { Bar } from '@/types/bars';
import { alignNYSEBucketStartSec } from '@/utils/nyseTime';

type LiveOptions = { throttleMs?: number; pollMs?: number };
const DEFAULTS: LiveOptions = { throttleMs: 250, pollMs: 1000 };

const toIso = (sec: number) => new Date(sec * 1000).toISOString();

export function useLiveBars(symbol: string, timeframe: string, opts: LiveOptions = DEFAULTS) {
  const [bar, setBar] = useState<Bar | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const throttleRef = useRef<number | null>(null);

  const emit = (b: Bar) => {
    if (throttleRef.current) window.clearTimeout(throttleRef.current);
    throttleRef.current = window.setTimeout(() => setBar(b), opts.throttleMs ?? DEFAULTS.throttleMs!) as unknown as number;
  };

  useEffect(() => {
    let cancelled = false;
    setBar(null);

    // --- Prefer WS via your secure proxy -----------------------------------
    if (env.alpacaWsUrl) {
      try {
        const ws = new WebSocket(env.alpacaWsUrl);
        wsRef.current = ws;
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ action: 'subscribe', symbols: [symbol], type: 'bars', timeframe }));
        });
        ws.addEventListener('message', (ev) => {
          if (cancelled) return;
          try {
            const payload = JSON.parse(ev.data);
            const tMs = Date.parse(payload?.time);
            if (!Number.isFinite(tMs)) return;
            const aligned = alignNYSEBucketStartSec(Math.floor(tMs / 1000), timeframe);
            emit({
              time: toIso(aligned),
              open: Number(payload.open),
              high: Number(payload.high),
              low: Number(payload.low),
              close: Number(payload.close),
              volume: Number(payload.volume ?? 0),
            });
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
        // fall back to polling
      }
    }

    // --- Polling fallback: aggregate quote into current bucket --------------
    let current: Bar | null = null;
    let lastBucketSec = -1;
    const quoteFn = env.quoteFunction || 'stock-quote';

    const id = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(quoteFn, { body: { symbol } });
        if (error || !data) return;
        const px = Number((data as Record<string, unknown>)?.price ?? (data as Record<string, unknown>)?.last ?? (data as Record<string, unknown>)?.close ?? NaN);
        if (!Number.isFinite(px)) return;

        const nowSec = Math.floor(Date.now() / 1000);
        const aligned = alignNYSEBucketStartSec(nowSec, timeframe);

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
    }, opts.pollMs ?? DEFAULTS.pollMs!);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe, opts.pollMs, opts.throttleMs]);

  useEffect(() => {
    return () => {
      if (throttleRef.current) window.clearTimeout(throttleRef.current);
    };
  }, []);

  return { bar };
}
