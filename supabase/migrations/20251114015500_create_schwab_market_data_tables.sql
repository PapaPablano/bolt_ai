/*
  # Create Schwab Market Data Tables

  1. New Tables
    - `market_quotes` - Real-time quotes for equities
    - `futures_data` - Futures market data
    - `options_chains` - Options chain data with Greeks
    - `price_history` - Historical OHLC data
  
  2. Security
    - Enable RLS on all tables
    - Public read access for cached market data
    - Service role can write data
  
  3. Indexes
    - Optimized for time-series queries
    - Symbol-based lookups
*/

-- Market Quotes Table
CREATE TABLE IF NOT EXISTS market_quotes (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  bid_price DECIMAL,
  ask_price DECIMAL,
  last_price DECIMAL,
  volume BIGINT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_symbol_timestamp UNIQUE(symbol, timestamp)
);

-- Futures Data Table
CREATE TABLE IF NOT EXISTS futures_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  bid_price DECIMAL,
  ask_price DECIMAL,
  last_price DECIMAL,
  open_price DECIMAL,
  high_price DECIMAL,
  low_price DECIMAL,
  volume BIGINT,
  open_interest INT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Options Chains Table
CREATE TABLE IF NOT EXISTS options_chains (
  id BIGSERIAL PRIMARY KEY,
  underlying_symbol TEXT NOT NULL,
  option_symbol TEXT NOT NULL,
  strike_price DECIMAL,
  expiration_date DATE,
  contract_type CHAR(1), -- 'C' for Call, 'P' for Put
  bid_price DECIMAL,
  ask_price DECIMAL,
  last_price DECIMAL,
  volume BIGINT,
  open_interest INT,
  implied_volatility DECIMAL,
  delta DECIMAL,
  gamma DECIMAL,
  theta DECIMAL,
  vega DECIMAL,
  rho DECIMAL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_option_symbol_timestamp UNIQUE(option_symbol, timestamp)
);

-- Price History Table
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  open_price DECIMAL,
  high_price DECIMAL,
  low_price DECIMAL,
  close_price DECIMAL,
  volume BIGINT,
  datetime TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_symbol_datetime UNIQUE(symbol, datetime)
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_quotes_symbol_timestamp ON market_quotes(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_futures_symbol_timestamp ON futures_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_options_underlying ON options_chains(underlying_symbol, expiration_date);
CREATE INDEX IF NOT EXISTS idx_options_symbol ON options_chains(option_symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol, datetime DESC);

-- Enable Row Level Security
ALTER TABLE market_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE futures_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE options_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access, service role can write
CREATE POLICY "Public read access for market_quotes"
  ON market_quotes
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert market_quotes"
  ON market_quotes
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read access for futures_data"
  ON futures_data
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert futures_data"
  ON futures_data
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read access for options_chains"
  ON options_chains
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert options_chains"
  ON options_chains
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read access for price_history"
  ON price_history
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert price_history"
  ON price_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create cleanup functions to manage data retention
CREATE OR REPLACE FUNCTION cleanup_old_market_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Keep only last 7 days of intraday quotes
  DELETE FROM market_quotes 
  WHERE timestamp < NOW() - INTERVAL '7 days';
  
  -- Keep only last 30 days of futures data
  DELETE FROM futures_data 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Keep only last 90 days of options data
  DELETE FROM options_chains 
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$;

-- Comments for documentation
COMMENT ON TABLE market_quotes IS 'Real-time equity quotes from Schwab API';
COMMENT ON TABLE futures_data IS 'Futures market data including open interest';
COMMENT ON TABLE options_chains IS 'Options chain data with Greeks and pricing';
COMMENT ON TABLE price_history IS 'Historical OHLC price data for charting';
