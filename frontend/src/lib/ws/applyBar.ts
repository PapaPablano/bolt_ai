import type { WsBarPayload } from "../../../shared/ws-schema";

// Minimal helper to keep track of stitched candles and honor barClose boundaries.
export function applyBarLwc(
  series: { update: (bar: { time: number; open: number; high: number; low: number; close: number }) => void },
  lastRef: { last?: WsBarPayload },
  bar: WsBarPayload,
) {
  const payload = { time: bar.tsStart / 1000, open: bar.o, high: bar.h, low: bar.l, close: bar.c };
  const isNewBucket = !lastRef.last || bar.tsStart > lastRef.last.tsStart;

  if (isNewBucket) {
    series.update(payload);
  } else {
    // Same bucket → overwrite the partial bar with the merged values.
    series.update(payload);
  }

  lastRef.last = bar.barClose ? undefined : bar;
}
