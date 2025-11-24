-- API tokens & logs for external provider integrations
-- This migration is additive and does not touch existing schwab_tokens.

-- api_tokens: generic token store (Schwab, Alpaca, JBlanked, etc.)
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,              -- e.g. 'schwab', 'alpaca', 'jblanked'
  token_type TEXT NOT NULL,            -- e.g. 'access', 'refresh'
  token_value TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT api_tokens_provider_type_unique UNIQUE (provider, token_type)
);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Only service_role may read/write tokens
DROP POLICY IF EXISTS "service role only on api_tokens" ON public.api_tokens;
CREATE POLICY "service role only on api_tokens"
  ON public.api_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- api_logs: basic observability for external provider calls
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,              -- 'schwab', 'alpaca', 'jblanked', etc.
  action TEXT NOT NULL,                -- 'get_quote', 'get_bars', etc.
  user_id UUID,                        -- optional: end-user id, when available
  request_params JSONB,                -- optional: sanitized params
  response_status INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only on api_logs" ON public.api_logs;
CREATE POLICY "service role only on api_logs"
  ON public.api_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_api_logs_provider ON public.api_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON public.api_logs(user_id);


-- Helper function: upsert an API token
CREATE OR REPLACE FUNCTION public.upsert_api_token(
  p_provider   TEXT,
  p_token_type TEXT,
  p_token_value TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: upsert_api_token is restricted to service_role';
  END IF;

  INSERT INTO public.api_tokens (provider, token_type, token_value, expires_at)
  VALUES (p_provider, p_token_type, p_token_value, p_expires_at)
  ON CONFLICT (provider, token_type)
  DO UPDATE SET
    token_value = EXCLUDED.token_value,
    expires_at  = EXCLUDED.expires_at,
    updated_at  = NOW();
END;
$$;


-- Helper function: read an API token + expiry info
CREATE OR REPLACE FUNCTION public.get_api_token(
  p_provider   TEXT,
  p_token_type TEXT
)
RETURNS TABLE (
  token_value TEXT,
  expires_at  TIMESTAMPTZ,
  is_expired  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: get_api_token is restricted to service_role';
  END IF;

  RETURN QUERY
  SELECT
    t.token_value,
    t.expires_at,
    (t.expires_at IS NOT NULL AND t.expires_at < NOW()) AS is_expired
  FROM public.api_tokens AS t
  WHERE t.provider = p_provider
    AND t.token_type = p_token_type
  LIMIT 1;
END;
$$;
