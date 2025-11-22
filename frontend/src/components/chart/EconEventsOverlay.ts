import type { ISeriesApi } from 'lightweight-charts';
import type { EconEvent } from '@/api/calendar';

export type SeedBar = { time: number };

function nearestBarTime(bars: SeedBar[], ts: number): number | null {
  if (!bars.length) return null;
  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid].time < ts) lo = mid + 1;
    else hi = mid;
  }
  const a = bars[lo]?.time ?? ts;
  const b = bars[lo - 1]?.time ?? a;
  const snapped = Math.abs(a - ts) <= Math.abs(b - ts) ? a : b;
  return Math.abs(snapped - ts) <= 6 * 3600 ? snapped : null;
}

/** Applies markers and returns the number actually rendered. */
export function applyEventMarkers(
  series: ISeriesApi<'Candlestick'>,
  events: EconEvent[],
  bars: SeedBar[],
  limit = 50,
): number {
  const markers = events
    .map((e) => {
      const t = nearestBarTime(bars, e.ts);
      if (t == null) return null;
      const shape =
        e.impact === 'high' ? 'arrowDown' :
        e.impact === 'medium' ? 'circle' : 'square';
      return {
        time: t as unknown as number,
        position: 'aboveBar' as const,
        shape,
        text: (e.title ?? '').slice(0, 12),
      };
    })
    .filter(Boolean) as Parameters<ISeriesApi<'Candlestick'>['setMarkers']>[0];

  const limited = markers.sort((a, b) => (a.time as number) - (b.time as number)).slice(Math.max(0, markers.length - limit));
  series.setMarkers(limited);
  return limited.length;
}
