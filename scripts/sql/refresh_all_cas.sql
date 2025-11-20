-- Refresh all continuous aggregates over their full ranges.
-- For local dev and CI you can safely use wide ranges; production
-- should use narrower windows.

CALL refresh_continuous_aggregate('ca_1m'::regclass,  '-infinity', 'infinity');
CALL refresh_continuous_aggregate('ca_5m'::regclass,  '-infinity', 'infinity');
CALL refresh_continuous_aggregate('ca_15m'::regclass, '-infinity', 'infinity');
CALL refresh_continuous_aggregate('ca_1h'::regclass,  '-infinity', 'infinity');
CALL refresh_continuous_aggregate('ca_4h'::regclass,  '-infinity', 'infinity');
CALL refresh_continuous_aggregate('ca_1d'::regclass,  '-infinity', 'infinity');
