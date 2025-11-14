import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokenStorage {
  read: () => Promise<OAuthToken | null>;
  write: (token: OAuthToken) => Promise<void>;
}

interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

interface StreamerCredentials {
  schwabClientCustomerId: string;
  schwabClientCorrelId: string;
  schwabClientChannel: string;
  schwabClientFunctionId: string;
  streamerUrl: string;
}

interface StreamRequest {
  service: 'LEVELONE_EQUITIES' | 'LEVELONE_OPTIONS' | 'LEVELONE_FUTURES' | 'LEVELONE_FOREX' | 'CHART_EQUITY' | 'CHART_FUTURES';
  command: 'SUBS' | 'ADD' | 'UNSUBS';
  symbols: string[];
  fields?: number[];
}

const SCHWAB_API_BASE_URL = 'https://api.schwabapi.com/marketdata/v1';
const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth';
const SCHWAB_TRADER_API_BASE_URL = 'https://api.schwabapi.com/trader/v1';

function isTokenExpired(expiresAt: number, skewSeconds = 60): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= expiresAt - skewSeconds;
}

class SupabaseTokenStorage implements TokenStorage {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async read(): Promise<OAuthToken | null> {
    const { data, error } = await this.supabase
      .from('schwab_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async write(token: OAuthToken): Promise<void> {
    await this.supabase
      .from('schwab_tokens')
      .upsert({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        scope: token.scope,
        token_type: token.tokenType,
        updated_at: new Date().toISOString(),
      });
  }
}

async function refreshToken(
  refreshToken: string,
  storage: TokenStorage
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: Deno.env.get('SCHWAB_KEY_ID') || '',
    client_secret: Deno.env.get('SCHWAB_SECRET_KEY') || '',
  });

  const response = await fetch(`${SCHWAB_OAUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Schwab OAuth refresh failed: ${response.status}`);
  }

  const payload = await response.json();
  const token: OAuthToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
    scope: payload.scope,
    tokenType: payload.token_type,
  };

  await storage.write(token);
  return token;
}

async function getValidToken(storage: TokenStorage): Promise<OAuthToken> {
  let token = await storage.read();

  if (!token) {
    throw new Error('No Schwab token available. Please authenticate first.');
  }

  if (isTokenExpired(token.expiresAt)) {
    token = await refreshToken(token.refreshToken, storage);
  }

  return token;
}

async function getStreamerCredentials(token: OAuthToken): Promise<StreamerCredentials> {
  const response = await fetch(`${SCHWAB_TRADER_API_BASE_URL}/userPreference`, {
    headers: {
      'Authorization': `${token.tokenType} ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get streamer credentials: ${response.status}`);
  }

  const data = await response.json();
  const streamerInfo = data.streamerInfo || {};

  return {
    schwabClientCustomerId: String(data.schwabClientCustomerId || ''),
    schwabClientCorrelId: String(data.schwabClientCorrelId || ''),
    schwabClientChannel: String(streamerInfo.schwabClientChannel || ''),
    schwabClientFunctionId: String(streamerInfo.schwabClientFunctionId || ''),
    streamerUrl: String(streamerInfo.streamerSocketUrl || streamerInfo.streamerUrl || ''),
  };
}

function createLoginRequest(
  credentials: StreamerCredentials,
  accessToken: string
): object {
  return {
    requests: [{
      requestid: "1",
      service: "ADMIN",
      command: "LOGIN",
      SchwabClientCustomerId: credentials.schwabClientCustomerId,
      SchwabClientCorrelId: credentials.schwabClientCorrelId,
      parameters: {
        Authorization: accessToken,
        SchwabClientChannel: credentials.schwabClientChannel,
        SchwabClientFunctionId: credentials.schwabClientFunctionId,
      }
    }]
  };
}

function createSubscribeRequest(
  credentials: StreamerCredentials,
  request: StreamRequest,
  requestId: number
): object {
  return {
    requests: [{
      requestid: String(requestId),
      service: request.service,
      command: request.command,
      SchwabClientCustomerId: credentials.schwabClientCustomerId,
      SchwabClientCorrelId: credentials.schwabClientCorrelId,
      parameters: {
        keys: request.symbols.join(','),
        fields: request.fields ? request.fields.join(',') : '0,1,2,3,4,5,8,10,12,18,19',
      }
    }]
  };
}

// This function handles WebSocket streaming via Server-Sent Events (SSE)
// since Edge Functions don't support persistent WebSocket connections directly
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const streamRequest = await req.json() as StreamRequest;

    if (!streamRequest.service || !streamRequest.symbols || streamRequest.symbols.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'service and symbols are required',
          example: {
            service: 'LEVELONE_EQUITIES',
            command: 'SUBS',
            symbols: ['AAPL', 'MSFT'],
            fields: [0, 1, 2, 3, 4, 5]
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const storage = new SupabaseTokenStorage(supabase);
    const token = await getValidToken(storage);
    const credentials = await getStreamerCredentials(token);

    if (!credentials.streamerUrl) {
      throw new Error('Streamer URL not available in user preferences');
    }

    // Create WebSocket connection to Schwab
    const ws = new WebSocket(credentials.streamerUrl);
    
    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let isConnected = false;
        let requestCounter = 2; // Start at 2 since login is 1

        ws.onopen = () => {
          console.log('WebSocket connected to Schwab');
          // Send login request
          const loginRequest = createLoginRequest(credentials, token.accessToken);
          ws.send(JSON.stringify(loginRequest));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if login was successful
            if (data.response && !isConnected) {
              const response = data.response[0];
              if (response.content && response.content.code === 0) {
                console.log('Login successful, subscribing to data');
                isConnected = true;
                
                // Send subscription request
                const subRequest = createSubscribeRequest(
                  credentials,
                  streamRequest,
                  requestCounter++
                );
                ws.send(JSON.stringify(subRequest));
                
                // Send initial success message to client
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
                );
              }
            } else if (data.data || data.snapshot || data.notify) {
              // Forward market data to client
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
              );
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: 'WebSocket error' })}\n\n`)
          );
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'closed' })}\n\n`)
          );
          controller.close();
        };

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            controller.enqueue(
              new TextEncoder().encode(': heartbeat\n\n')
            );
          } else {
            clearInterval(heartbeat);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on stream cancellation
        return () => {
          clearInterval(heartbeat);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        note: 'This function provides real-time streaming via Server-Sent Events (SSE)',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
