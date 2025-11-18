export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  barsFunction: (import.meta.env.VITE_BARS_FUNCTION as string) || 'get-bars',
  quoteFunction: (import.meta.env.VITE_QUOTE_FUNCTION as string) || 'stock-quote',
  defaultSymbol: (import.meta.env.VITE_DEFAULT_SYMBOL as string) || 'AAPL',
  defaultTimeframe: (import.meta.env.VITE_DEFAULT_TIMEFRAME as string) || '1Min',
  // Optional WS proxy that handles provider auth server-side.
  alpacaWsUrl: (import.meta.env.VITE_ALPACA_WS_URL as string) || '',
};
