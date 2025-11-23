# Database Schema Overview

This document summarizes the core database schema used by Stock Whisperer,
with a focus on **TimescaleDB time-series structures** and
**Supabase-authored domain tables**.

## 1. Time-Series Core (TimescaleDB)

### 1.1 `ohlcv` hypertable

Canonical OHLCV storage for intraday/daily bars.

```sql
CREATE TABLE ohlcv (
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

CREATE INDEX IF NOT EXISTS ohlcv_ts_desc_idx ON ohlcv (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS ohlcv_ts_idx ON ohlcv (ts);
```

- **Hypertable**: partitioned by `ts`.
- **Access patterns**:
  - Latest bars per `symbol` (`symbol, ts DESC` index).
  - Range queries over time (`ts` index).

### 1.2 Trading-session helpers

```sql
CREATE OR REPLACE FUNCTION is_regular_session(p_ts timestamptz) RETURNS boolean AS $$
  SELECT
    EXTRACT(ISODOW FROM p_ts AT TIME ZONE 'America/New_York') BETWEEN 1 AND 5
    AND (p_ts AT TIME ZONE 'America/New_York')::time >= TIME '09:30'
    AND (p_ts AT TIME ZONE 'America/New_York')::time < TIME '16:00';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW v_ohlcv_afterhours AS
SELECT * FROM ohlcv WHERE NOT is_regular_session(ts);
```

- Defines **NYSE RTH** window (Mon–Fri, 09:30–16:00 ET).
- Used to restrict continuous aggregates to regular sessions.

### 1.3 Continuous aggregates

Materialized views over `ohlcv`:

- `ca_5m`
- `ca_15m`
- `ca_1h`
- `ca_4h`
- `ca_1d`
- `ca_1m` (1-minute CA defined separately)

All are **Timescale continuous aggregates** created via a generic macro:

```sql
CREATE MATERIALIZED VIEW ca_5m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('5 minutes', ts) AS bucket_local,
  (ARRAY_AGG(open ORDER BY ts ASC))[1] AS open,
  MAX(high) AS high,
  MIN(low) AS low,
  (ARRAY_AGG(close ORDER BY ts DESC))[1] AS close,
  SUM(volume) AS volume
FROM ohlcv
WHERE is_regular_session(ts)
GROUP BY symbol, bucket_local
WITH NO DATA;
```

#### Policies

`20251118_session_anchored_aggregates.sql` sets CA policies:

- `ca_5m`:
  - `start_offset = 35 days`
  - `end_offset = 5 minutes`
  - `schedule_interval = 5 minutes`
- `ca_15m`:
  - `start_offset = 90 days`
  - `end_offset = 15 minutes`
  - `schedule_interval = 15 minutes`
- `ca_1h`:
  - `start_offset = 365 days`
  - `end_offset = 1 hour`
  - `schedule_interval = 1 hour`
- `ca_4h`:
  - `start_offset = 730 days`
  - `end_offset = 4 hours`
  - `schedule_interval = 4 hours`
- `ca_1d`:
  - `start_offset = 5 years`
  - `end_offset = 1 day`
  - `schedule_interval = 1 day`

These tune how far back each CA is refreshed and how often.

#### 1-minute and derived 10-minute views

- `ca_1m`: 1-minute continuous aggregate (RTH-only) with index
  `ca_1m_symbol_bucket_desc_idx` on `(symbol, bucket DESC)`.
- `v_ohlc_10m_derived_stitched`: 10-minute stitched view derived from
  `v_ohlc_5m_stitched` via `time_bucket_ng(...)` rollup.

### 1.4 Compression & retention policies

On `ohlcv` hypertable:

```sql
ALTER TABLE ohlcv SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'ts DESC'
);

SELECT add_compression_policy('ohlcv', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('ohlcv', INTERVAL '18 months', if_not_exists => TRUE);
```

- **Compression**:
  - Chunks older than **7 days** are compressed.
  - Segmented by `symbol`, ordered by `ts DESC`.
- **Retention**:
  - Chunks older than **18 months** are dropped, keeping long-term
    storage bounded.

### 1.5 Stitched views (CA + live head)

For each CA timeframe, a stitched view combines the materialized
historical buckets with a "live head" computed from raw `ohlcv`:

- `v_ohlc_1m_stitched`
- `v_ohlc_5m_stitched`
- `v_ohlc_15m_stitched`
- `v_ohlc_1h_stitched`
- `v_ohlc_4h_stitched`
- `v_ohlc_1d_stitched`

These views:
- Use `last_ca` CTE to find the latest CA bucket per symbol.
- Build `live_head` only for buckets **after** the last CA bucket.
- `UNION ALL` CA data with `live_head` to provide near-real-time bars.

Helper scripts under `scripts/sql/`:
- `refresh_all_cas.sql`: full-range CA refreshes (dev/CI only).
- `validate_ca.sql`: sanity checks on CA row counts, session bounds,
  and stitched overlap.


## 2. Supabase Application Schema

Defined primarily in
`supabase/migrations/20250109_create_schema.sql` and follow-up
migrations.

### 2.1 `stock_cache`

Public cache of market data used by Edge Functions (e.g. `stock-quote`,
`stock-historical-v3`).

```sql
CREATE TABLE stock_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_cache_key    ON stock_cache(cache_key);
CREATE INDEX idx_stock_cache_updated ON stock_cache(last_updated);
```

- **Access pattern**: keyed lookups by `cache_key` and date-based
  cleanup by `last_updated`.
- **RLS**: intentionally **no RLS**; used as a global shared cache.

### 2.2 Watchlists

```sql
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
```

```sql
CREATE TABLE watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (watchlist_id, symbol)
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_symbol   ON watchlist_items(symbol);
```

- Relationship: `watchlists (1) → (N) watchlist_items`.
- RLS policies ensure users see only their own watchlists and items.

### 2.3 Portfolios & Holdings

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_value DECIMAL(15, 2) DEFAULT 0,
  cash_balance DECIMAL(15, 2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user ON portfolios(user_id);
```

```sql
CREATE TABLE portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL CHECK (quantity >= 0),
  buy_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2),
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX idx_holdings_symbol    ON portfolio_holdings(symbol);
```

- Relationship: `portfolios (1) → (N) portfolio_holdings`.
- A trigger keeps `portfolios.total_value` in sync when holdings change.

### 2.4 Price alerts

```sql
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  price_target DECIMAL(15, 2) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user   ON price_alerts(user_id);
CREATE INDEX idx_alerts_symbol ON price_alerts(symbol);
CREATE INDEX idx_alerts_active ON price_alerts(is_active) WHERE is_active = true;
```

- Supports efficient lookups of **active** alerts per user and symbol.

### 2.5 User preferences

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  default_watchlist_id UUID REFERENCES watchlists(id) ON DELETE SET NULL,
  default_portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  email_alerts BOOLEAN DEFAULT true,
  preferred_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- One row per user; linked to watchlists/portfolios for defaults.

### 2.6 Additional tables

Supabase migrations also define:

- `stock_transactions`: portfolio transaction history with RLS tying
  rows back to a user via `portfolios`.
- ML-related tables (e.g. `ml_training_data`) used by
  `stock-historical-v3` to persist technical indicator features.
- Schwab integration tables (tokens, market data), defined in
  `20251113232825_create_schwab_tokens_table.sql` and
  `20251114015500_create_schwab_market_data_tables.sql`.
- `chart_prefs` and related UX/state tables (20251117 migration).

Refer to the individual migration files in `supabase/migrations/` for
complete column lists and RLS policies.


## 3. Operational Notes & Recommendations

- **Timescale retention/compression**: Already configured on `ohlcv`
  (7-day compression, 18-month retention), aligning with a hot+warm data
  model suitable for interactive UIs and analytics.
- **Indexes**: Core access paths (by `symbol`, `user_id`, `portfolio_id`)
  are indexed. When adding new query patterns, ensure supporting indexes
  are added in new migrations.
- **Validation**: Use `scripts/sql/validate_ca.sql` after large
  backfills to confirm session anchoring and stitched views are sane.
- **Seeding**: See `SETUP.md` → *Seeding Timescale OHLCV* for how to
  populate `ohlcv` in local/CI environments, then refresh/validate CAs.
