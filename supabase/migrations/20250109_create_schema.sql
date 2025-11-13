-- Stock Whisperer AI Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stock Cache Table
-- Stores cached API responses with timestamps
CREATE TABLE IF NOT EXISTS stock_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_cache_key ON stock_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_stock_cache_updated ON stock_cache(last_updated);

-- Watchlists Table
-- User-created watchlists for tracking stocks
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- Watchlist Items Table
-- Individual stocks within watchlists
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);

-- Portfolios Table
-- User investment portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_value DECIMAL(15, 2) DEFAULT 0,
  cash_balance DECIMAL(15, 2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);

-- Portfolio Holdings Table
-- Individual stock positions within portfolios
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL CHECK (quantity >= 0),
  buy_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2),
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON portfolio_holdings(symbol);

-- Price Alerts Table
-- User-defined price alerts for stocks
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  price_target DECIMAL(15, 2) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON price_alerts(is_active) WHERE is_active = true;

-- User Preferences Table
-- Store user-specific settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  default_watchlist_id UUID REFERENCES watchlists(id) ON DELETE SET NULL,
  default_portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  email_alerts BOOLEAN DEFAULT true,
  preferred_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Transactions Table
-- Track buy/sell transactions for portfolio history
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity DECIMAL(15, 4) NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  fees DECIMAL(15, 2) DEFAULT 0,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio ON stock_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON stock_transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(transaction_date);

-- Enable Row Level Security (RLS)
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Watchlists
DROP POLICY IF EXISTS "Users can view their own watchlists" ON watchlists;
CREATE POLICY "Users can view their own watchlists"
  ON watchlists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own watchlists" ON watchlists;
CREATE POLICY "Users can create their own watchlists"
  ON watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own watchlists" ON watchlists;
CREATE POLICY "Users can update their own watchlists"
  ON watchlists FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own watchlists" ON watchlists;
CREATE POLICY "Users can delete their own watchlists"
  ON watchlists FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Watchlist Items
DROP POLICY IF EXISTS "Users can view their watchlist items" ON watchlist_items;
CREATE POLICY "Users can view their watchlist items"
  ON watchlist_items FOR SELECT
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create watchlist items" ON watchlist_items;
CREATE POLICY "Users can create watchlist items"
  ON watchlist_items FOR INSERT
  WITH CHECK (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their watchlist items" ON watchlist_items;
CREATE POLICY "Users can update their watchlist items"
  ON watchlist_items FOR UPDATE
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete their watchlist items" ON watchlist_items;
CREATE POLICY "Users can delete their watchlist items"
  ON watchlist_items FOR DELETE
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));

-- RLS Policies for Portfolios
DROP POLICY IF EXISTS "Users can view their own portfolios" ON portfolios;
CREATE POLICY "Users can view their own portfolios"
  ON portfolios FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own portfolios" ON portfolios;
CREATE POLICY "Users can create their own portfolios"
  ON portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own portfolios" ON portfolios;
CREATE POLICY "Users can update their own portfolios"
  ON portfolios FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own portfolios" ON portfolios;
CREATE POLICY "Users can delete their own portfolios"
  ON portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Portfolio Holdings
DROP POLICY IF EXISTS "Users can view their portfolio holdings" ON portfolio_holdings;
CREATE POLICY "Users can view their portfolio holdings"
  ON portfolio_holdings FOR SELECT
  USING (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create portfolio holdings" ON portfolio_holdings;
CREATE POLICY "Users can create portfolio holdings"
  ON portfolio_holdings FOR INSERT
  WITH CHECK (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their portfolio holdings" ON portfolio_holdings;
CREATE POLICY "Users can update their portfolio holdings"
  ON portfolio_holdings FOR UPDATE
  USING (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete their portfolio holdings" ON portfolio_holdings;
CREATE POLICY "Users can delete their portfolio holdings"
  ON portfolio_holdings FOR DELETE
  USING (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

-- RLS Policies for Price Alerts
DROP POLICY IF EXISTS "Users can view their own price alerts" ON price_alerts;
CREATE POLICY "Users can view their own price alerts"
  ON price_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own price alerts" ON price_alerts;
CREATE POLICY "Users can create their own price alerts"
  ON price_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own price alerts" ON price_alerts;
CREATE POLICY "Users can update their own price alerts"
  ON price_alerts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own price alerts" ON price_alerts;
CREATE POLICY "Users can delete their own price alerts"
  ON price_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for User Preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for Stock Transactions
DROP POLICY IF EXISTS "Users can view their portfolio transactions" ON stock_transactions;
CREATE POLICY "Users can view their portfolio transactions"
  ON stock_transactions FOR SELECT
  USING (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create portfolio transactions" ON stock_transactions;
CREATE POLICY "Users can create portfolio transactions"
  ON stock_transactions FOR INSERT
  WITH CHECK (portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  ));

-- Functions and Triggers

-- Function to update portfolio total value
CREATE OR REPLACE FUNCTION update_portfolio_value()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE portfolios
  SET total_value = (
    SELECT COALESCE(SUM(quantity * COALESCE(current_price, buy_price)), 0)
    FROM portfolio_holdings
    WHERE portfolio_id = COALESCE(NEW.portfolio_id, OLD.portfolio_id)
  ) + COALESCE(cash_balance, 0),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.portfolio_id, OLD.portfolio_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update portfolio value when holdings change
DROP TRIGGER IF EXISTS trigger_update_portfolio_value ON portfolio_holdings;
CREATE TRIGGER trigger_update_portfolio_value
AFTER INSERT OR UPDATE OR DELETE ON portfolio_holdings
FOR EACH ROW
EXECUTE FUNCTION update_portfolio_value();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_watchlists_updated_at ON watchlists;
CREATE TRIGGER update_watchlists_updated_at
BEFORE UPDATE ON watchlists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_portfolios_updated_at ON portfolios;
CREATE TRIGGER update_portfolios_updated_at
BEFORE UPDATE ON portfolios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_portfolio_holdings_updated_at ON portfolio_holdings;
CREATE TRIGGER update_portfolio_holdings_updated_at
BEFORE UPDATE ON portfolio_holdings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Stock cache is public (no RLS needed)
-- This allows the application to cache data for all users
COMMENT ON TABLE stock_cache IS 'Public cache for stock market data - no RLS required';
