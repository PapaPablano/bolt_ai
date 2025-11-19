import { createHash } from 'crypto';

export type FeatureCacheKeyInput = {
  symbol: string;
  timeframe: string;
  start?: string;
  end?: string;
  featureSet: string;
  dataVersion?: string;
};

export const featureCacheKey = (input: FeatureCacheKeyInput) => {
  const payload = JSON.stringify({
    s: input.symbol.toUpperCase(),
    tf: input.timeframe,
    st: input.start ?? '',
    en: input.end ?? '',
    f: input.featureSet,
    v: input.dataVersion ?? 'v1',
  });
  return createHash('sha256').update(payload).digest('hex');
};

export type FeatureCacheRow = {
  key: string;
  payload_json: unknown;
  ttl: number;
  updated_at?: string;
};

/**
 * Placeholder helpers. The actual Supabase table should be created as:
 * create table feature_cache (key text primary key, payload_json jsonb, ttl integer, updated_at timestamptz default now());
 * create index on feature_cache(updated_at);
 */
export function buildCacheRow(keyInput: FeatureCacheKeyInput, payload: unknown, ttlSec: number): FeatureCacheRow {
  return { key: featureCacheKey(keyInput), payload_json: payload, ttl: ttlSec };
}
