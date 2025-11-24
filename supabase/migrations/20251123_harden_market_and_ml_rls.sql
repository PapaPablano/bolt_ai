-- Migration: Harden RLS for Schwab market data, ML tables, and Timescale OHLCV
-- Date: 2025-11-23
--
-- Changes:
--   1) Restrict market data tables to authenticated Supabase app users only (no anon).
--   2) Add RLS and service-role-only access for ml_training_data, and authenticated read-only access for ml_predictions.
--   3) Protect Timescale ohlcv table from Supabase Data API (service-role-only access).
--   4) Harden numeric types for ML and market data tables and add CHECK (> 0)
--      constraints on core monetary columns.

BEGIN;

-- =====================================================================
-- 1) Schwab market data tables: market_quotes, futures_data, options_chains, price_history
--    Goal: read access via authenticated Supabase app users only (no anon).
-- =====================================================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.market_quotes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.futures_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.options_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_history  ENABLE ROW LEVEL SECURITY;

-- Helper to drop an existing policy by name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'market_quotes'
      AND policyname = 'Public read access for market_quotes'
  ) THEN
    EXECUTE 'DROP POLICY "Public read access for market_quotes" ON public.market_quotes;';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'futures_data'
      AND policyname = 'Public read access for futures_data'
  ) THEN
    EXECUTE 'DROP POLICY "Public read access for futures_data" ON public.futures_data;';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'options_chains'
      AND policyname = 'Public read access for options_chains'
  ) THEN
    EXECUTE 'DROP POLICY "Public read access for options_chains" ON public.options_chains;';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'price_history'
      AND policyname = 'Public read access for price_history'
  ) THEN
    EXECUTE 'DROP POLICY "Public read access for price_history" ON public.price_history;';
  END IF;
END;
$$;

-- Re-create read policies scoped explicitly to Supabase app roles
CREATE POLICY "Public read access for market_quotes"
  ON public.market_quotes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public read access for futures_data"
  ON public.futures_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public read access for options_chains"
  ON public.options_chains
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public read access for price_history"
  ON public.price_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Make sure no broader PUBLIC grants leak SELECT beyond Supabase roles.
-- This does NOT revoke explicit grants to roles like service_role.
REVOKE ALL ON public.market_quotes   FROM PUBLIC;
REVOKE ALL ON public.futures_data    FROM PUBLIC;
REVOKE ALL ON public.options_chains FROM PUBLIC;
REVOKE ALL ON public.price_history  FROM PUBLIC;

-- Explicit clarity: app roles can SELECT; writes remain governed by existing policies.
GRANT SELECT ON public.market_quotes   TO authenticated;
GRANT SELECT ON public.futures_data    TO authenticated;
GRANT SELECT ON public.options_chains TO authenticated;
GRANT SELECT ON public.price_history  TO authenticated;


-- =====================================================================
-- 2) ML tables: ml_training_data, ml_predictions
--    Goal: service-role-only access for ml_training_data, authenticated read-only for ml_predictions.
-- =====================================================================

-- Enable RLS (safe if already enabled or table missing in some environments)
ALTER TABLE IF EXISTS public.ml_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ml_predictions  ENABLE ROW LEVEL SECURITY;

-- Drop any permissive policies if they were added previously
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ml_training_data'
  ) THEN
    PERFORM 1; -- placeholder; we DROP with a generic statement below
  END IF;
END;
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ml_training_data'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ml_training_data;', pol.policyname);
  END LOOP;
END;
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ml_predictions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ml_predictions;', pol.policyname);
  END LOOP;
END;
$$;

-- Service-role-only pattern: no row access via anon/authenticated.
-- Supabase service role bypasses RLS, so Edge Functions and backend jobs using the
-- service key can still read/write these tables.
CREATE POLICY "Service role only access ml_training_data"
  ON public.ml_training_data
  FOR ALL
  USING (false);

CREATE POLICY "Read ml_predictions for authenticated users"
  ON public.ml_predictions
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure anon/authenticated cannot accidentally gain privileges via grants
REVOKE ALL ON public.ml_training_data FROM anon, authenticated;
REVOKE ALL ON public.ml_predictions  FROM anon, authenticated;

-- Allow SELECT on ml_predictions for authenticated users (writes remain blocked by RLS)
GRANT SELECT ON public.ml_predictions TO authenticated;


-- =====================================================================
-- 3) Timescale OHLCV table: ohlcv
--    Goal: ensure this raw market data is not readable via Supabase Data API.
--    Access remains available to backend ingestion/analytics via direct DB roles
--    (e.g., postgres or other superuser/owner) and to Supabase service role.
-- =====================================================================

ALTER TABLE IF EXISTS public.ohlcv ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ohlcv'
      AND policyname = 'Service role only access ohlcv'
  ) THEN
    EXECUTE 'DROP POLICY "Service role only access ohlcv" ON public.ohlcv;';
  END IF;
END;
$$;

CREATE POLICY "Service role only access ohlcv"
  ON public.ohlcv
  FOR ALL
  USING (false);

REVOKE ALL ON public.ohlcv FROM anon, authenticated;

-- =====================================================================
-- 4) Numeric hardening for ML & market data tables
--    - Convert ML price fields to NUMERIC(18,8).
--    - Tighten DECIMAL/NUMERIC definitions on Schwab market data tables.
--    - Add CHECK (> 0) constraints where domain-correct.
--      NOTE: Constraints are added as NOT VALID to avoid scanning existing
--      rows; they still apply to new/updated rows.
-- =====================================================================

-- 4.1 ML tables: change price-like fields from REAL to NUMERIC(18,8)
ALTER TABLE IF EXISTS public.ml_training_data
  ALTER COLUMN open  TYPE NUMERIC(18,8) USING open::NUMERIC(18,8),
  ALTER COLUMN high  TYPE NUMERIC(18,8) USING high::NUMERIC(18,8),
  ALTER COLUMN low   TYPE NUMERIC(18,8) USING low::NUMERIC(18,8),
  ALTER COLUMN close TYPE NUMERIC(18,8) USING close::NUMERIC(18,8);

ALTER TABLE IF EXISTS public.ml_predictions
  ALTER COLUMN predicted_close TYPE NUMERIC(18,8)
  USING predicted_close::NUMERIC(18,8);

-- 4.2 ML tables: monetary CHECK constraints (NOT VALID)
ALTER TABLE IF EXISTS public.ml_training_data
  ADD CONSTRAINT ml_training_data_price_positive
    CHECK (open > 0 AND high > 0 AND low > 0 AND close > 0) NOT VALID;

ALTER TABLE IF EXISTS public.ml_predictions
  ADD CONSTRAINT ml_predictions_price_positive
    CHECK (predicted_close IS NULL OR predicted_close > 0) NOT VALID;

-- 4.3 Schwab market data tables: explicit NUMERIC(18,8) for prices
ALTER TABLE IF EXISTS public.market_quotes
  ALTER COLUMN bid_price  TYPE NUMERIC(18,8) USING bid_price::NUMERIC(18,8),
  ALTER COLUMN ask_price  TYPE NUMERIC(18,8) USING ask_price::NUMERIC(18,8),
  ALTER COLUMN last_price TYPE NUMERIC(18,8) USING last_price::NUMERIC(18,8);

ALTER TABLE IF EXISTS public.futures_data
  ALTER COLUMN bid_price   TYPE NUMERIC(18,8) USING bid_price::NUMERIC(18,8),
  ALTER COLUMN ask_price   TYPE NUMERIC(18,8) USING ask_price::NUMERIC(18,8),
  ALTER COLUMN last_price  TYPE NUMERIC(18,8) USING last_price::NUMERIC(18,8),
  ALTER COLUMN open_price  TYPE NUMERIC(18,8) USING open_price::NUMERIC(18,8),
  ALTER COLUMN high_price  TYPE NUMERIC(18,8) USING high_price::NUMERIC(18,8),
  ALTER COLUMN low_price   TYPE NUMERIC(18,8) USING low_price::NUMERIC(18,8);

ALTER TABLE IF EXISTS public.options_chains
  ALTER COLUMN strike_price       TYPE NUMERIC(18,8) USING strike_price::NUMERIC(18,8),
  ALTER COLUMN bid_price          TYPE NUMERIC(18,8) USING bid_price::NUMERIC(18,8),
  ALTER COLUMN ask_price          TYPE NUMERIC(18,8) USING ask_price::NUMERIC(18,8),
  ALTER COLUMN last_price         TYPE NUMERIC(18,8) USING last_price::NUMERIC(18,8),
  ALTER COLUMN implied_volatility TYPE NUMERIC(18,8) USING implied_volatility::NUMERIC(18,8),
  ALTER COLUMN delta              TYPE NUMERIC(18,8) USING delta::NUMERIC(18,8),
  ALTER COLUMN gamma              TYPE NUMERIC(18,8) USING gamma::NUMERIC(18,8),
  ALTER COLUMN theta              TYPE NUMERIC(18,8) USING theta::NUMERIC(18,8),
  ALTER COLUMN vega               TYPE NUMERIC(18,8) USING vega::NUMERIC(18,8),
  ALTER COLUMN rho                TYPE NUMERIC(18,8) USING rho::NUMERIC(18,8);

ALTER TABLE IF EXISTS public.price_history
  ALTER COLUMN open_price  TYPE NUMERIC(18,8) USING open_price::NUMERIC(18,8),
  ALTER COLUMN high_price  TYPE NUMERIC(18,8) USING high_price::NUMERIC(18,8),
  ALTER COLUMN low_price   TYPE NUMERIC(18,8) USING low_price::NUMERIC(18,8),
  ALTER COLUMN close_price TYPE NUMERIC(18,8) USING close_price::NUMERIC(18,8);

-- 4.4 Market data & OHLCV: CHECK constraints for positive prices
ALTER TABLE IF EXISTS public.market_quotes
  ADD CONSTRAINT market_quotes_price_positive
    CHECK (
      (bid_price IS NULL OR bid_price > 0) AND
      (ask_price IS NULL OR ask_price > 0) AND
      (last_price IS NULL OR last_price > 0)
    ) NOT VALID;

ALTER TABLE IF EXISTS public.futures_data
  ADD CONSTRAINT futures_data_price_positive
    CHECK (
      (bid_price IS NULL OR bid_price > 0) AND
      (ask_price IS NULL OR ask_price > 0) AND
      (last_price IS NULL OR last_price > 0) AND
      (open_price IS NULL OR open_price > 0) AND
      (high_price IS NULL OR high_price > 0) AND
      (low_price IS NULL OR low_price > 0)
    ) NOT VALID;

ALTER TABLE IF EXISTS public.options_chains
  ADD CONSTRAINT options_chains_price_positive
    CHECK (
      strike_price > 0 AND
      (bid_price IS NULL OR bid_price > 0) AND
      (ask_price IS NULL OR ask_price > 0) AND
      (last_price IS NULL OR last_price > 0)
    ) NOT VALID;

ALTER TABLE IF EXISTS public.price_history
  ADD CONSTRAINT price_history_price_positive
    CHECK (
      open_price > 0 AND
      high_price > 0 AND
      low_price > 0 AND
      close_price > 0
    ) NOT VALID;

ALTER TABLE IF EXISTS public.ohlcv
  ADD CONSTRAINT ohlcv_price_positive
    CHECK (
      open > 0 AND
      high > 0 AND
      low > 0 AND
      close > 0 AND
      volume >= 0
    ) NOT VALID;

-- 4.5 Portfolio & transaction tables: CHECK constraints on monetary fields
ALTER TABLE IF EXISTS public.portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_price_positive
    CHECK (
      buy_price > 0 AND
      (current_price IS NULL OR current_price > 0)
    ) NOT VALID;

ALTER TABLE IF EXISTS public.price_alerts
  ADD CONSTRAINT price_alerts_target_positive
    CHECK (price_target > 0) NOT VALID;

ALTER TABLE IF EXISTS public.stock_transactions
  ADD CONSTRAINT stock_transactions_price_positive
    CHECK (price > 0) NOT VALID,
  ADD CONSTRAINT stock_transactions_amount_nonnegative
    CHECK (total_amount >= 0 AND fees >= 0) NOT VALID;

COMMIT;
