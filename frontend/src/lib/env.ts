export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  quoteFunction: (import.meta.env.VITE_QUOTE_FUNCTION as string) || 'stock-quote',
  defaultSymbol: (import.meta.env.VITE_DEFAULT_SYMBOL as string) || 'AAPL',
  defaultTimeframe: (import.meta.env.VITE_DEFAULT_TIMEFRAME as string) || '1Hour',
  defaultRange: (import.meta.env.VITE_DEFAULT_RANGE as string) || '6M',
  // Optional WS proxy that handles provider auth server-side.
  ohlcWsUrl: (import.meta.env.VITE_STREAM_WS_URL as string) || (import.meta.env.VITE_ALPACA_WS_URL as string) || '',
};
