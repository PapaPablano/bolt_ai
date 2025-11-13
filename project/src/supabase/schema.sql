-- Market Data Tables
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

CREATE TABLE IF NOT EXISTS options_chains (
  id BIGSERIAL PRIMARY KEY,
  underlying_symbol TEXT NOT NULL,
  option_symbol TEXT NOT NULL,
  strike_price DECIMAL,
  expiration_date DATE,
  contract_type CHAR(1),
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
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  token_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_symbol_timestamp ON market_quotes(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_futures_symbol_timestamp ON futures_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_options_underlying ON options_chains(underlying_symbol, expiration_date);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol, datetime DESC);
