import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';

async function upsertToken(
  supabase: ReturnType<typeof createClient>,
  provider: string,
  tokenType: string,
  value: string,
  expiresAt: string | null,
) {
  const { error } = await supabase.rpc('upsert_api_token', {
    p_provider: provider,
    p_token_type: tokenType,
    p_token_value: value,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error('upsert_api_token RPC error (schwab-auth-exchange)', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ 
          error: 'Authorization code is required',
          usage: 'POST /schwab-auth-exchange with body: { "code": "YOUR_AUTHORIZATION_CODE" }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('SCHWAB_KEY_ID');
    const clientSecret = Deno.env.get('SCHWAB_SECRET_KEY');
    const redirectUri = Deno.env.get('SCHWAB_REDIRECT_URI') || 'https://localhost:3000/callback';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'SCHWAB_KEY_ID or SCHWAB_SECRET_KEY not configured in Supabase secrets',
          instructions: [
            'Set your Schwab credentials in Supabase:',
            '1. Go to Project Settings > Edge Functions > Manage Secrets',
            '2. Add SCHWAB_KEY_ID (your Schwab application client ID)',
            '3. Add SCHWAB_SECRET_KEY (your Schwab application client secret)'
          ]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Exchanging authorization code for tokens...');

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
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ 
          error: `Token exchange failed: ${response.status}`,
          details: errorText,
          hint: 'Make sure the authorization code is valid and not expired. Codes are single-use and expire quickly.'
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await response.json();
    console.log('Token exchange successful, storing in database...');

    const now = Date.now();
    const expiresInSec = tokenData.expires_in || 1800;
    const expiresAtIso = new Date(now + expiresInSec * 1000).toISOString();

    // Store tokens in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Upsert tokens into generic api_tokens store used by schwab-proxy
    await upsertToken(supabase, 'schwab', 'access', tokenData.access_token, expiresAtIso);

    if (tokenData.refresh_token) {
      await upsertToken(supabase, 'schwab', 'refresh', tokenData.refresh_token, null);
    }

    // Clear any existing tokens first (legacy schwab_tokens table)
    await supabase.from('schwab_tokens').delete().neq('id', 0);

    // Insert new tokens into schwab_tokens for backward compatibility
    const { error: dbError } = await supabase
      .from('schwab_tokens')
      .insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(now / 1000) + expiresInSec,
        scope: tokenData.scope || 'MarketData',
        token_type: tokenData.token_type || 'Bearer',
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to store tokens: ${dbError.message}`,
          details: dbError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tokens stored successfully!');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '✅ Schwab OAuth tokens stored successfully!',
        expiresIn: tokenData.expires_in || 1800,
        expiresInMinutes: Math.floor((tokenData.expires_in || 1800) / 60),
        scope: tokenData.scope || 'MarketData',
        nextSteps: [
          'Your Schwab API is now connected!',
          'The tokens will be automatically refreshed when they expire.',
          'You can now use schwab-quote and schwab-historical functions.',
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in schwab-auth-exchange:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
