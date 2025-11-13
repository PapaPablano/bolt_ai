-- =====================================================
-- RLS-safe migration for public.stock_cache
-- Purpose: Ensure public read access while preventing client writes.
-- Date: 2025-11-09
-- =====================================================

BEGIN;

-- 1) Create table if not exists (matches provided schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.stock_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Ensure indexes match actual columns
CREATE INDEX IF NOT EXISTS idx_stock_cache_cache_key
  ON public.stock_cache (cache_key);

CREATE INDEX IF NOT EXISTS idx_stock_cache_last_updated
  ON public.stock_cache (last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_stock_cache_created_at
  ON public.stock_cache (created_at DESC);

-- 3) Enable Row Level Security
ALTER TABLE public.stock_cache ENABLE ROW LEVEL SECURITY;

-- 4) Public SELECT policy (anon + authenticated)
-- WARNING: This exposes all columns to anyone who can SELECT. Confirm no sensitive data exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_cache' AND policyname = 'stock_cache_public_read'
  ) THEN
    CREATE POLICY stock_cache_public_read
      ON public.stock_cache
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END;
$$;

-- 5) Explicitly do NOT create INSERT/UPDATE/DELETE policies for anon/authenticated.
-- By default, with RLS enabled and no policies for write operations, client tokens (anon/authenticated) cannot write.
-- Backend processes should use the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS for writes.

-- 6) Optional: explicit SELECT grants for clarity (not required for policies to work)
GRANT SELECT ON public.stock_cache TO anon;
GRANT SELECT ON public.stock_cache TO authenticated;

COMMIT;

-- =====================================================
-- Verification queries (run separately as needed)
-- =====================================================
-- Check RLS is enabled for the table:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'stock_cache';

-- List policies on the table:
-- SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'stock_cache';

-- List indexes:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'stock_cache';
