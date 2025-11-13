/*
  # Create Schwab OAuth Tokens Table

  1. New Tables
    - `schwab_tokens`
      - `id` (integer, primary key, auto-increment)
      - `access_token` (text, stores Schwab OAuth access token)
      - `refresh_token` (text, stores Schwab OAuth refresh token)
      - `expires_at` (bigint, unix timestamp when token expires)
      - `scope` (text, OAuth scope)
      - `token_type` (text, OAuth token type, usually "Bearer")
      - `created_at` (timestamptz, when token was first created)
      - `updated_at` (timestamptz, when token was last updated)

  2. Security
    - Enable RLS on `schwab_tokens` table
    - No public access - only service role can read/write tokens
    - Tokens are sensitive credentials that must be protected

  3. Notes
    - This table stores OAuth tokens for the Schwab API integration
    - Tokens are automatically refreshed by the Edge Functions
    - Only one token record should exist at a time
*/

CREATE TABLE IF NOT EXISTS schwab_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE schwab_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access"
  ON schwab_tokens
  FOR ALL
  USING (false);
