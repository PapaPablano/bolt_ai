import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('SCHWAB_KEY_ID');
    const redirectUri = Deno.env.get('SCHWAB_REDIRECT_URI') || 'https://localhost:3000/callback';
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: 'SCHWAB_KEY_ID not configured in Supabase secrets',
          instructions: [
            'Set your Schwab credentials in Supabase:',
            '1. Go to Project Settings > Edge Functions > Manage Secrets',
            '2. Add SCHWAB_KEY_ID (your Schwab application client ID)',
            '3. Add SCHWAB_SECRET_KEY (your Schwab application client secret)',
            '4. Optionally set SCHWAB_REDIRECT_URI (default: https://localhost:3000/callback)'
          ]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        redirectUri: redirectUri,
        instructions: [
          '🔐 Schwab OAuth Setup Instructions:',
          '',
          '1. Copy the authUrl below and visit it in your browser',
          '2. Log in to your Schwab Developer account',
          '3. Authorize the application',
          '4. You will be redirected to: ' + redirectUri + '?code=XXXXX',
          '5. Copy the "code" parameter from the URL',
          '6. Call the schwab-auth-exchange function with this code',
          '',
          'Example:',
          'POST /schwab-auth-exchange',
          '{ "code": "YOUR_AUTHORIZATION_CODE" }',
        ],
        clientId: clientId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
