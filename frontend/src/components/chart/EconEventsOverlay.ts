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

export function applyEventMarkers(
  series: ISeriesApi<'Candlestick'>,
  events: EconEvent[],
  bars: SeedBar[],
) {
  const markers = events
    .map((event) => {
      const snapped = nearestBarTime(bars, event.ts);
      if (snapped == null) return null;
      const shape = event.impact === 'high' ? 'arrowDown' : event.impact === 'medium' ? 'circle' : 'square';
      return {
        time: snapped as unknown as number,
        position: 'aboveBar' as const,
        shape,
        text: (event.title ?? '').slice(0, 12),
      };
    })
    .filter(Boolean) as Parameters<typeof series.setMarkers>[0];
  series.setMarkers(markers);
}
