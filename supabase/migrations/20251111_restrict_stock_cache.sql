-- Migration: Restrict public.stock_cache reads to authenticated users only
-- Filename suggestion: 20251111_restrict_stock_cache.sql
-- Up and Down sections included in one file for convenience.
-- Note: If your migration runner expects separate up/down files, let me know.

-- =====================
-- Up (apply migration)
-- =====================
BEGIN;

-- 1) Ensure RLS is enabled on the table (safe to run if already enabled)
ALTER TABLE public.stock_cache ENABLE ROW LEVEL SECURITY;

-- 2) Create or replace a SELECT policy that restricts reads to authenticated users only.
-- If a policy with this name exists, this ALTER will fail on some Postgres versions;
-- in that case you can DROP the policy first or I can provide conditional logic.
DO $$
BEGIN
  -- If the policy exists, drop it so we can recreate it consistently
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_cache' AND policyname = 'stock_cache_public_read'
  ) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stock_cache;', 'stock_cache_public_read');
  END IF;
END;
$$;

CREATE POLICY stock_cache_public_read
  ON public.stock_cache
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- 3) Revoke broad SELECT privileges from anon role to prevent bypassing RLS
REVOKE SELECT ON public.stock_cache FROM anon;

COMMIT;

-- =========================
-- Down (revert migration)
-- =========================
BEGIN;

-- 1) Restore previous policy behavior by allowing anon again (recreate policy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_cache' AND policyname = 'stock_cache_public_read'
  ) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stock_cache;', 'stock_cache_public_read');
  END IF;
END;
$$;

CREATE POLICY stock_cache_public_read
  ON public.stock_cache
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 2) Grant SELECT back to anon
GRANT SELECT ON public.stock_cache TO anon;

COMMIT;