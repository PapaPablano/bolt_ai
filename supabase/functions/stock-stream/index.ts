import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Define the shape of the incoming trade data from the WebSocket
interface AlpacaTrade {
  T: string // Message Type
  S: string // Symbol
  i: number // Trade ID
  x: string // Exchange
  p: number // Price
  s: number // Size
  t: string // Timestamp
  c: string[] // Conditions
  z: string // Tape
}

const ALPACA_KEY_ID = Deno.env.get('ALPACA_KEY_ID')!
const ALPACA_SECRET_KEY = Deno.env.get('ALPACA_SECRET_KEY')!
const WEBSOCKET_URL = 'wss://stream.data.alpaca.markets/v2/iex' // Using IEX for free data

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

/**
 * WebSocket proxy for real-time Alpaca market data streaming
 * 
 * This Edge function establishes a WebSocket connection to Alpaca's real-time data feed
 * and proxies the data to the frontend via Server-Sent Events (SSE).
 * 
 * Query Parameters:
 * - symbols: Comma-separated list of stock symbols (e.g., "AAPL,GOOGL,MSFT")
 * - trades: Whether to subscribe to trades (default: true)
 * - quotes: Whether to subscribe to quotes (default: false)
 * - bars: Whether to subscribe to bars (default: false)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const symbolsParam = url.searchParams.get('symbols')
    const subscribeTrades = url.searchParams.get('trades') !== 'false'
    const subscribeQuotes = url.searchParams.get('quotes') === 'true'
    const subscribeBars = url.searchParams.get('bars') === 'true'

    if (!symbolsParam) {
      return new Response(
        JSON.stringify({ error: 'symbols parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase())

    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Helper to send SSE message
        const sendEvent = (event: string, data: unknown) => {
          const message = `event: ${event}
data: ${JSON.stringify(data)}

`
          controller.enqueue(encoder.encode(message))
        }

        try {
          const socket = new WebSocket(WEBSOCKET_URL)

          socket.onopen = () => {
            console.log('WebSocket connection opened. Authenticating...')
            // Authenticate
            socket.send(JSON.stringify({
              action: 'auth',
              key: ALPACA_KEY_ID,
              secret: ALPACA_SECRET_KEY,
            }))
          }

          socket.onmessage = (event) => {
            const messages = JSON.parse(event.data)
            for (const msg of messages) {
              if (msg.T === 'success' && msg.msg === 'authenticated') {
                console.log('Authentication successful. Subscribing to trades...')
                // Subscribe to trades for the given symbols
                socket.send(JSON.stringify({
                  action: 'subscribe',
                  trades: symbols,
                }))
              } else if (msg.T === 't') {
                // This is a trade message
                const trade: AlpacaTrade = msg
                const message = `data: ${JSON.stringify(trade)}\n\n`
                controller.enqueue(new TextEncoder().encode(message))
              } else {
                console.log('Received other message:', msg)
              }
            }
          }

          socket.onclose = () => {
            console.log('WebSocket connection closed.')
            try {
              controller.close()
            } catch (e) {
              // Ignore if controller is already closed
            }
          }

          socket.onerror = (err) => {
            console.error('WebSocket error:', err)
            controller.error(err)
          }

          // Clean up on client disconnect
          req.signal.onabort = () => {
            console.log('Client disconnected, closing WebSocket connection.')
            if (socket.readyState === WebSocket.OPEN) {
              socket.close()
            }
            try {
              controller.close()
            } catch (e) {
              // Ignore if controller is already closed
            }
          }
        } catch (error) {
          console.error('Error setting up stream:', error)
          sendEvent('error', { 
            message: 'Failed to connect to stream',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in stock-stream endpoint:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
