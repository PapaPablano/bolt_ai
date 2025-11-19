import { bucketSec, type TF } from '@/utils/nyseTime';

export function validateSeriesMs(bars: { time: number }[], tf: TF, label: string) {
  if (!bars.length) return;
  const stepMs = bucketSec(tf) * 1000;
  const perDay: Record<string, number> = {};
  const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  let badOrder = 0;
  let dups = 0;

  const firstKey = dayKey(bars[0].time);
  perDay[firstKey] = (perDay[firstKey] ?? 0) + 1;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].time <= bars[i - 1].time) badOrder++;
    if (bars[i].time === bars[i - 1].time) dups++;
    const key = dayKey(bars[i].time);
    perDay[key] = (perDay[key] ?? 0) + 1;
  }

  const sample = Object.entries(perDay).slice(-5);
  console.log(`[validate ${label}] tf=${tf} step=${stepMs}ms len=${bars.length} badOrder=${badOrder} dups=${dups} sample/day:`, sample);
}
