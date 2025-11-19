/*
  # Session-Anchored Continuous Aggregates

  - Rebuilds intraday aggregates so they anchor to US equity sessions.
  - Fixes "missing bars" by constraining calculations to regular trading hours.
  - Adds 1m (RTH), 5m (derived), and 1d session-aware materialized views with refresh policies.
*/

-- Drop legacy aggregates that were not session-aware
DROP MATERIALIZED VIEW IF EXISTS stock_prices_1m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_prices_5m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_prices_1h CASCADE;

-- Session-aware 1-minute aggregate (regular trading hours only)
CREATE MATERIALIZED VIEW stock_prices_1m_rth
WITH (timescaledb.continuous) AS
SELECT
    time_bucket_ng(
        '1 minute',
        time,
        origin => '2020-01-02 09:30:00-05'::timestamptz,
        timezone => 'America/New_York'
    ) AS bucket,
    symbol,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume,
    COUNT(*) AS tick_count
FROM stock_prices
WHERE EXTRACT(HOUR FROM time AT TIME ZONE 'America/New_York') >= 9
  AND EXTRACT(HOUR FROM time AT TIME ZONE 'America/New_York') < 16
  AND (
    EXTRACT(HOUR FROM time AT TIME ZONE 'America/New_York') > 9
    OR EXTRACT(MINUTE FROM time AT TIME ZONE 'America/New_York') >= 30
  )
GROUP BY bucket, symbol;

SELECT add_continuous_aggregate_policy('stock_prices_1m_rth',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '30 seconds',
    schedule_interval => INTERVAL '30 seconds'
);

CREATE INDEX idx_stock_prices_1m_rth_symbol_bucket
ON stock_prices_1m_rth (symbol, bucket DESC);

-- 5-minute aggregate built from the session-aware 1m buckets
CREATE MATERIALIZED VIEW stock_prices_5m_rth
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', bucket) AS bucket,
    symbol,
    FIRST(open, bucket) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, bucket) AS close,
    SUM(volume) AS volume
FROM stock_prices_1m_rth
GROUP BY 1, 2;

SELECT add_continuous_aggregate_policy('stock_prices_5m_rth',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- Daily bars anchored to the 16:00 ET close
CREATE MATERIALIZED VIEW stock_prices_1d_rth
WITH (timescaledb.continuous) AS
SELECT
    time_bucket_ng(
        '1 day',
        bucket,
        origin => '2020-01-02 16:00:00-05'::timestamptz,
        timezone => 'America/New_York'
    ) AS bucket,
    symbol,
    FIRST(open, bucket) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, bucket) AS close,
    SUM(volume) AS volume
FROM stock_prices_1m_rth
GROUP BY 1, 2;

SELECT add_continuous_aggregate_policy('stock_prices_1d_rth',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 hour'
);
