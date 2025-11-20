-- Validation queries for session-anchored CAs and stitched views

-- 1) Row counts after seed
SELECT symbol, count(*) FROM ohlcv GROUP BY 1 ORDER BY 1;

-- 2) No cross-session buckets in 5m CA (ET)
SELECT count(*) FROM ca_5m
WHERE (bucket AT TIME ZONE 'America/New_York')::time < TIME '09:30'
   OR (bucket AT TIME ZONE 'America/New_York')::time >= TIME '16:00';

-- 3) No duplicate buckets in 5m CA
SELECT symbol, bucket, count(*) FROM ca_5m
GROUP BY 1, 2 HAVING count(*) > 1;

-- 4) Stitched overlap sanity (no CA overlap)
WITH last_ca AS (
  SELECT symbol, max(bucket) AS last FROM ca_5m GROUP BY 1
)
SELECT l.symbol, count(*) FROM last_ca l
JOIN v_ohlc_5m_stitched v
  ON v.symbol = l.symbol
 AND v.bucket <= l.last
GROUP BY 1;
