/*
  # Session-anchored OHLCV infrastructure

  - Creates a canonical `ohlcv` hypertable for tick/bar storage.
  - Defines regular-trading-hours helpers for NYSE (Mon–Fri, 09:30–16:00 ET).
  - Builds TimescaleDB continuous aggregates for 5m/15m/1h/4h/1d buckets anchored to ET.
  - Adds refresh/compression/retention policies and "stitched" live-head views.
*/

-- Clean up legacy, non-session-aware aggregates if they still exist
DROP MATERIALIZED VIEW IF EXISTS stock_prices_1m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_prices_5m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_prices_1h CASCADE;

DROP VIEW IF EXISTS v_ohlc_5m_stitched;
DROP VIEW IF EXISTS v_ohlc_15m_stitched;
DROP VIEW IF EXISTS v_ohlc_1h_stitched;
DROP VIEW IF EXISTS v_ohlc_4h_stitched;
DROP VIEW IF EXISTS v_ohlc_1d_stitched;

DROP MATERIALIZED VIEW IF EXISTS ca_5m;
DROP MATERIALIZED VIEW IF EXISTS ca_15m;
DROP MATERIALIZED VIEW IF EXISTS ca_1h;
DROP MATERIALIZED VIEW IF EXISTS ca_4h;
DROP MATERIALIZED VIEW IF EXISTS ca_1d;

-- Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;

-- Canonical OHLCV hypertable --------------------------------------------------
CREATE TABLE IF NOT EXISTS ohlcv (
  symbol TEXT NOT NULL,
  ts      TIMESTAMPTZ NOT NULL,
  open    NUMERIC NOT NULL,
  high    NUMERIC NOT NULL,
  low     NUMERIC NOT NULL,
  close   NUMERIC NOT NULL,
  volume  BIGINT NOT NULL,
  PRIMARY KEY (symbol, ts)
);

SELECT create_hypertable('ohlcv', by_range('ts'), if_not_exists => TRUE);

-- Helpful indexes for raw lookups
CREATE INDEX IF NOT EXISTS ohlcv_ts_desc_idx ON ohlcv (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS ohlcv_ts_idx ON ohlcv (ts);


-- Regular-session helper (Mon–Fri 09:30–16:00 ET)
CREATE OR REPLACE FUNCTION is_regular_session(p_ts timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(ISODOW FROM p_ts AT TIME ZONE 'America/New_York') BETWEEN 1 AND 5
    AND (p_ts AT TIME ZONE 'America/New_York')::time >= TIME '09:30'
    AND (p_ts AT TIME ZONE 'America/New_York')::time < TIME '16:00';
$$;

CREATE OR REPLACE VIEW v_ohlcv_afterhours AS
SELECT *
FROM ohlcv
WHERE NOT is_regular_session(ts);

-- Continuous aggregates anchored to NYSE sessions -----------------------------
-- Helper macro via DO block keeps definitions uniform
DO $$
DECLARE
  tf record;
BEGIN
  FOR tf IN SELECT * FROM (VALUES
    ('ca_5m',  '5 minutes'::interval),
    ('ca_15m', '15 minutes'::interval),
    ('ca_1h',  '1 hour'::interval),
    ('ca_4h',  '4 hours'::interval),
    ('ca_1d',  '1 day'::interval)
  ) AS t(name, bucket_interval)
  LOOP
    EXECUTE format(
      'CREATE MATERIALIZED VIEW IF NOT EXISTS %1$I
       WITH (timescaledb.continuous) AS
       SELECT
         symbol,
         time_bucket(%2$L::interval, ts) AS bucket_local,
         (ARRAY_AGG(open ORDER BY ts ASC))[1] AS open,
         MAX(high) AS high,
         MIN(low) AS low,
         (ARRAY_AGG(close ORDER BY ts DESC))[1] AS close,
         SUM(volume) AS volume
       FROM ohlcv
       WHERE is_regular_session(ts)
       GROUP BY symbol, bucket_local
       WITH NO DATA', tf.name, tf.bucket_interval
    );
  END LOOP;
END $$;

-- Continuous aggregate policies tuned per timeframe
SELECT add_continuous_aggregate_policy('ca_5m',
  start_offset => INTERVAL '35 days',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('ca_15m',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('ca_1h',
  start_offset => INTERVAL '365 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('ca_4h',
  start_offset => INTERVAL '730 days',
  end_offset => INTERVAL '4 hours',
  schedule_interval => INTERVAL '4 hours',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('ca_1d',
  start_offset => INTERVAL '5 years',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

-- Compression & retention policies ------------------------------------------
ALTER TABLE ohlcv SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'ts DESC'
);

SELECT add_compression_policy('ohlcv', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('ohlcv', INTERVAL '18 months', if_not_exists => TRUE);

-- Stitched views (continuous aggregate + live head) --------------------------
DO $$
DECLARE
  tf record;
BEGIN
  FOR tf IN SELECT * FROM (VALUES
    ('ca_5m',  'v_ohlc_5m_stitched',  '5 minutes'::interval),
    ('ca_15m', 'v_ohlc_15m_stitched', '15 minutes'::interval),
    ('ca_1h',  'v_ohlc_1h_stitched',  '1 hour'::interval),
    ('ca_4h',  'v_ohlc_4h_stitched',  '4 hours'::interval),
    ('ca_1d',  'v_ohlc_1d_stitched',  '1 day'::interval)
  ) AS t(ca_name, view_name, bucket_interval)
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE VIEW %1$I AS
       WITH last_ca AS (
         SELECT symbol, MAX(bucket_local) AS last_bucket
         FROM %2$I
         GROUP BY symbol
       ),
       live_head AS (
         SELECT
           o.symbol,
           time_bucket(%3$L::interval, o.ts) AS bucket_local,
           (ARRAY_AGG(o.open ORDER BY o.ts ASC))[1] AS open,
           MAX(o.high) AS high,
           MIN(o.low) AS low,
           (ARRAY_AGG(o.close ORDER BY o.ts DESC))[1] AS close,
           SUM(o.volume) AS volume
         FROM ohlcv o
         LEFT JOIN last_ca lc ON lc.symbol = o.symbol
         WHERE is_regular_session(o.ts)
           AND (
             lc.last_bucket IS NULL
             OR time_bucket(%3$L::interval, o.ts) > lc.last_bucket
           )
         GROUP BY o.symbol, bucket_local
       )
       SELECT
         symbol,
         bucket_local AS bucket,
         open,
         high,
         low,
         close,
         volume
       FROM %2$I
       UNION ALL
       SELECT
         symbol,
         bucket_local AS bucket,
         open,
         high,
         low,
         close,
         volume
       FROM live_head', tf.view_name, tf.ca_name, tf.bucket_interval
    );
  END LOOP;
END $$;

-- Continuous aggregate for 1m stitched history --------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS ca_1m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket_ng(INTERVAL '1 minute', ts, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket,
  toolkit_experimental.first(open, ts) AS open,
  MAX(high) AS high,
  MIN(low) AS low,
  toolkit_experimental.last(close, ts) AS close,
  SUM(volume) AS volume
FROM ohlcv
WHERE is_regular_session(ts)
GROUP BY symbol, bucket
WITH NO DATA;

CREATE INDEX IF NOT EXISTS ca_1m_symbol_bucket_desc_idx
  ON ca_1m (symbol, bucket DESC);

CREATE OR REPLACE VIEW v_ohlc_1m_stitched AS
WITH live_head AS (
  SELECT
    o.symbol,
    time_bucket_ng(INTERVAL '1 minute', o.ts, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket,
    toolkit_experimental.first(o.open, o.ts) AS open,
    MAX(o.high) AS high,
    MIN(o.low) AS low,
    toolkit_experimental.last(o.close, o.ts) AS close,
    SUM(o.volume) AS volume
  FROM ohlcv o
  WHERE is_regular_session(o.ts)
    AND time_bucket_ng(INTERVAL '1 minute', o.ts, '1970-01-01 00:00:00+00', 'America/New_York')
      > COALESCE((SELECT MAX(c.bucket) FROM ca_1m c WHERE c.symbol = o.symbol), '-infinity'::timestamptz)
  GROUP BY o.symbol, bucket
)
SELECT * FROM ca_1m
UNION ALL
SELECT * FROM live_head;

-- Derived 10m stitched view rolled from existing 5m stitched bars --------------
CREATE OR REPLACE VIEW v_ohlc_10m_derived_stitched AS
WITH base AS (
  SELECT * FROM v_ohlc_5m_stitched
),
rolled AS (
  SELECT
    symbol,
    time_bucket_ng(INTERVAL '10 minutes', bucket, '1970-01-01 00:00:00+00', 'America/New_York') AS bucket10,
    (ARRAY_AGG(open ORDER BY bucket ASC))[1] AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    (ARRAY_AGG(close ORDER BY bucket ASC))[array_length(ARRAY_AGG(close), 1)] AS close,
    SUM(volume) AS volume
  FROM base
  GROUP BY symbol, bucket10
)
SELECT symbol, bucket10 AS bucket, open, high, low, close, volume
FROM rolled;
