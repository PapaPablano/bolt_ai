-- 1-minute continuous aggregate (RTH-only, NYSE anchored)
CREATE MATERIALIZED VIEW IF NOT EXISTS ca_1m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket_ng(INTERVAL '1 minute', ts, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket,
  toolkit_experimental.first(open, ts)  AS open,
  MAX(high)                              AS high,
  MIN(low)                               AS low,
  toolkit_experimental.last(close, ts)  AS close,
  SUM(volume)                            AS volume
FROM ohlcv
WHERE is_regular_session(ts)
GROUP BY symbol, bucket
WITH NO DATA;

CREATE INDEX IF NOT EXISTS ca_1m_symbol_bucket_desc_idx ON ca_1m(symbol, bucket DESC);

-- Stitched 1m view (CA + live head)
CREATE OR REPLACE VIEW v_ohlc_1m_stitched AS
WITH live_head AS (
  SELECT
    o.symbol,
    time_bucket_ng(INTERVAL '1 minute', o.ts, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket,
    toolkit_experimental.first(o.open, o.ts) AS open,
    MAX(o.high)                              AS high,
    MIN(o.low)                               AS low,
    toolkit_experimental.last(o.close, o.ts) AS close,
    SUM(o.volume)                            AS volume
  FROM ohlcv o
  WHERE is_regular_session(o.ts)
    AND time_bucket_ng(INTERVAL '1 minute', o.ts, '1970-01-01 00:00:00+00', 'America/New_York')
        > COALESCE((SELECT MAX(c.bucket) FROM ca_1m c WHERE c.symbol = o.symbol), '-infinity'::timestamptz)
  GROUP BY o.symbol, bucket
)
SELECT * FROM ca_1m
UNION ALL
SELECT * FROM live_head;

-- 2) 10-minute derived stitched view from ca_5m (group pairs of 5m)
-- Note: This is a plain VIEW, not a CA; fast because it rolls up CA_5m.
CREATE OR REPLACE VIEW v_ohlc_10m_derived_stitched AS
WITH base AS (
  SELECT * FROM v_ohlc_5m_stitched
),
rolled AS (
  SELECT
    symbol,
    time_bucket_ng(INTERVAL '10 minutes', bucket, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket10,
    (ARRAY_AGG(open ORDER BY bucket ASC))[1]  AS open,
    MAX(high)                                  AS high,
    MIN(low)                                   AS low,
    (ARRAY_AGG(close ORDER BY bucket ASC))[array_length(ARRAY_AGG(close),1)] AS close,
    SUM(volume)                                AS volume
  FROM base
  GROUP BY symbol, bucket10
)
SELECT symbol, bucket10 AS bucket, open, high, low, close, volume
FROM rolled;
