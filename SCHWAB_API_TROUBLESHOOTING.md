# Schwab API Connection Troubleshooting

## Issue Summary

The Schwab API is not connecting in this repository even though it was working in `stock-whisperer-ai-04`. This document explains the root causes and provides solutions.

## Root Causes Identified

### 1. **Missing Environment Variables**

The Schwab Edge Functions expect these environment variables in Supabase:
- `SCHWAB_KEY_ID` - Your Schwab application client ID
- `SCHWAB_SECRET_KEY` - Your Schwab application client secret

**Check if these are set:**
```bash
# Via Supabase CLI
supabase secrets list --project-ref your-project-ref

# Should show:
# SCHWAB_KEY_ID
# SCHWAB_SECRET_KEY
```

### 2. **Missing OAuth Token in Database**

The Schwab functions require an OAuth token stored in the `schwab_tokens` table. Unlike Alpaca which uses API keys, Schwab uses OAuth 2.0 with access/refresh tokens.

**Current State:**
- ✅ The `schwab_tokens` table exists (migration file present)
- ❌ The table is likely **empty** (no initial OAuth token)

**Why this causes connection failures:**
```typescript
// From schwab-quote/index.ts line 119-121
if (!token) {
  throw new Error('No Schwab token available. Please authenticate first.');
}
```

### 3. **Missing OAuth Flow Implementation**

The Edge Functions expect a valid OAuth token to already exist, but there's no automated way to:
1. Generate the initial authorization URL
2. Handle the OAuth callback
3. Exchange the authorization code for tokens
4. Store the tokens in the database

## Solutions

### Quick Fix: Add Schwab OAuth Initialization Function

Create a new Edge Function to handle the OAuth flow:

**File: `supabase/functions/schwab-auth-init/index.ts`**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('SCHWAB_KEY_ID');
    const redirectUri = Deno.env.get('SCHWAB_REDIRECT_URI') || 'https://127.0.0.1:8080/callback';
    
    if (!clientId) {
      throw new Error('SCHWAB_KEY_ID not configured');
    }

    // Generate authorization URL
    const authUrl = new URL(`${SCHWAB_OAUTH_BASE_URL}/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'MarketData');

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        instructions: [
          '1. Visit the authUrl in your browser',
          '2. Log in to your Schwab account',
          '3. Authorize the application',
          '4. Copy the authorization code from the callback URL',
          '5. Call schwab-auth-exchange with the code'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**File: `supabase/functions/schwab-auth-exchange/index.ts`**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const clientId = Deno.env.get('SCHWAB_KEY_ID');
    const clientSecret = Deno.env.get('SCHWAB_SECRET_KEY');
    const redirectUri = Deno.env.get('SCHWAB_REDIRECT_URI') || 'https://127.0.0.1:8080/callback';

    if (!clientId || !clientSecret) {
      throw new Error('SCHWAB_KEY_ID or SCHWAB_SECRET_KEY not configured');
    }

    // Exchange code for tokens
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch(`${SCHWAB_OAUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();

    // Store tokens in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabase
      .from('schwab_tokens')
      .upsert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        scope: tokenData.scope || '',
        token_type: tokenData.token_type || 'Bearer',
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      throw new Error(`Failed to store tokens: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Schwab tokens stored successfully',
        expiresIn: tokenData.expires_in,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step-by-Step Setup Process

#### 1. Set Environment Variables in Supabase

```bash
# Via Dashboard: Project Settings > Edge Functions > Manage Secrets
# Or via CLI:
supabase secrets set SCHWAB_KEY_ID="your-schwab-app-key"
supabase secrets set SCHWAB_SECRET_KEY="your-schwab-app-secret"
supabase secrets set SCHWAB_REDIRECT_URI="https://127.0.0.1:8080/callback"
```

#### 2. Deploy the New OAuth Functions

```bash
cd supabase/functions

# Deploy authentication helper functions
supabase functions deploy schwab-auth-init --project-ref your-project-ref
supabase functions deploy schwab-auth-exchange --project-ref your-project-ref
```

#### 3. Run the Database Migration

If you haven't already:

```sql
-- Run in Supabase SQL Editor
-- Contents of: supabase/migrations/20251113232825_create_schwab_tokens_table.sql
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
```

#### 4. Initialize OAuth Flow

```bash
# Call the init function to get the authorization URL
curl -X POST https://your-project.supabase.co/functions/v1/schwab-auth-init \
  -H "Authorization: Bearer your-anon-key"

# Response will include:
# {
#   "authUrl": "https://api.schwabapi.com/v1/oauth/authorize?...",
#   "instructions": [...]
# }
```

#### 5. Complete OAuth Flow

1. Visit the `authUrl` from the response
2. Log in to your Schwab Developer account
3. Authorize the application
4. You'll be redirected to: `https://127.0.0.1:8080/callback?code=XXXXXX`
5. Copy the `code` parameter value

#### 6. Exchange Code for Tokens

```bash
curl -X POST https://your-project.supabase.co/functions/v1/schwab-auth-exchange \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_AUTHORIZATION_CODE"}'
```

If successful, the tokens are now stored in the database and will auto-refresh!

### Verification

Test the Schwab API connection:

```bash
# Test quote endpoint
curl -X POST https://your-project.supabase.co/functions/v1/schwab-quote \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "MSFT"]}'

# Test historical endpoint
curl -X POST https://your-project.supabase.co/functions/v1/schwab-historical \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "periodType": "day", "period": 10, "frequencyType": "minute", "frequency": 1}'
```

## Key Differences from stock-whisperer-ai-04

### What Worked in the Old Repo

In `stock-whisperer-ai-04`, the Schwab integration likely:
1. Had OAuth tokens already stored in the database
2. Had the OAuth flow set up and completed during initial setup
3. Had environment variables properly configured

### What's Missing in This Repo

1. **No OAuth initialization flow** - Functions expect tokens to exist
2. **No helper functions** to generate auth URLs and exchange codes
3. **No documentation** on the OAuth setup process
4. **Possible missing env vars** - `SCHWAB_KEY_ID` and `SCHWAB_SECRET_KEY`

## Alternative Solution: Use Alpaca Instead

If Schwab setup is too complex, the app already has **full Alpaca integration** which is simpler:

1. Alpaca uses API keys (no OAuth flow needed)
2. Already configured and working
3. Provides the same data (quotes, historical, etc.)

The frontend already uses Alpaca by default via `stock-quote` and `stock-historical-v3` functions.

**To use Alpaca exclusively:**
1. Set `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` in Supabase
2. Remove Schwab function calls from frontend code
3. All data will come from Alpaca (which is already working)

## Recommended Approach

### For Production Use:
- **Use Alpaca** - It's already integrated and working
- Schwab can be added later if needed for specific features

### For Development/Testing:
- Follow the OAuth setup steps above
- Add the two new Edge Functions (`schwab-auth-init`, `schwab-auth-exchange`)
- Complete the OAuth flow once
- Tokens will auto-refresh thereafter

## Environment Variables Summary

```bash
# Required for Schwab API
SCHWAB_KEY_ID=your_schwab_client_id
SCHWAB_SECRET_KEY=your_schwab_client_secret
SCHWAB_REDIRECT_URI=https://127.0.0.1:8080/callback  # Or your callback URL

# Already working (Alpaca)
ALPACA_KEY_ID=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret
ALPACA_STOCK_FEED=iex  # or 'sip' for paid plans

# Auto-provided by Supabase (don't set manually)
SUPABASE_URL=auto_provided
SUPABASE_SERVICE_ROLE_KEY=auto_provided
```

## Conclusion

The Schwab API connection fails because:
1. ❌ OAuth tokens are not initialized in the database
2. ❌ No OAuth flow implementation exists to get initial tokens
3. ❌ Environment variables may not be set

**Solutions:**
- **Quick**: Use Alpaca (already working)
- **Complete**: Add OAuth helper functions and complete the flow
- **Best**: Provide both options and let users choose

The code itself is correct - it just needs the OAuth setup completed once!
