import { useEffect, useRef } from 'react';
import type { ISeriesApi, Time } from 'lightweight-charts';

interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bar_closed?: boolean;
}

const WS_URL = 'wss://api.bolt.com/ws';

/**
 * Subscribe to the Bolt realtime feed and stream OHLCV updates directly into the provided candlestick series.
 * The feed indicates when a bar closes via `bar_closed`; we flush the current bar and start a new one when that flag arrives.
 */
export function useRealtimeOHLCV(candleSeries: ISeriesApi<'Candlestick'> | null, symbol: string, timeframe: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const currentBarRef = useRef<OHLCVBar | null>(null);

  useEffect(() => {
    if (!candleSeries) return;

    currentBarRef.current = null;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          symbol,
          timeframe,
        }),
      );
    };

    ws.onmessage = (event) => {
      let payload: OHLCVBar | null = null;
      try {
        payload = JSON.parse(event.data) as OHLCVBar;
      } catch {
        return;
      }

      if (!payload || !payload.time) return;
      const update: OHLCVBar = { ...payload, volume: Number(payload.volume ?? 0) };

      if (update.bar_closed === true) {
        if (currentBarRef.current) {
          candleSeries.update(formatBar(currentBarRef.current));
        }

        currentBarRef.current = update;
        candleSeries.update(formatBar(update));
        return;
      }

      if (!currentBarRef.current || currentBarRef.current.time !== update.time) {
        currentBarRef.current = update;
      } else {
        currentBarRef.current.high = Math.max(currentBarRef.current.high, update.high);
        currentBarRef.current.low = Math.min(currentBarRef.current.low, update.low);
        currentBarRef.current.close = update.close;
        currentBarRef.current.volume += update.volume;
      }

      candleSeries.update(formatBar(currentBarRef.current));
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      currentBarRef.current = null;
    };
  }, [candleSeries, symbol, timeframe]);
}

const formatBar = (bar: OHLCVBar) => ({
  time: parseTime(bar.time),
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});

const parseTime = (isoString: string): Time => ((new Date(isoString).getTime() / 1000) as Time);

