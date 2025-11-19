import { alignNYSEBucketStartUtcSec, bucketSec } from '@/utils/nyseTime';
import type { TF } from '@/types/prefs';

let bucketWarned = false;

/** Log once when we detect bucket/unit mismatches (e.g., passing ms instead of sec). */
export function assertBucketInvariant(tsSec: number, tf: TF) {
  if (bucketWarned) return;
  if (!Number.isFinite(tsSec)) return;
  const step = bucketSec(tf);
  const aligned = alignNYSEBucketStartUtcSec(tsSec, tf);
  const off = Math.abs(tsSec - aligned);
  const looksLikeMs = tsSec > 1e11 || aligned > 1e11;

  if (looksLikeMs || off >= step) {
    bucketWarned = true;
    console.warn('[bucket] invariant failed', { tsSec, tf, aligned, step });
  }
}
