# Stock API & Database Implementation

## Overview

This implementation provides a complete stock data fetching system with intelligent caching and a comprehensive database schema for user portfolios and watchlists.

## Stock API Utility Functions (`/src/lib/stockApi.ts`)

### Available Functions

#### 1. `fetchStockQuote(symbol: string)`
Fetches real-time stock quotes with automatic caching (1-minute expiration).

```typescript
const quote = await fetchStockQuote('AAPL');
// Returns: { symbol, name, price, change, changePercent, volume, high, low, open, previousClose, source }
```

#### 2. `fetchHistoricalData(symbol: string, dateRange: string)`
Fetches OHLC historical data with permanent caching (historical data never changes).

```typescript
const data = await fetchHistoricalData('AAPL', '1mo');
// Date ranges: '1d', '5d', '1mo', '3mo', '6mo', '1y', '5y'
```

#### 3. `fetchIntradayData(symbol: string, interval: string, range: string)`
Fetches minute-level intraday data through Alpaca Market Data aggregates (up to two years depending on plan).

```typescript
const intraday = await fetchIntradayData('AAPL', '5m', '1d');
// Intervals: '1m', '5m', '10m', '15m', '30m', '1h', '4h'
// Ranges: '1d', '5d', '1w', '1mo', '3mo', '6mo', '1y', '2y'
```

#### 4. `fetchStockNews(symbol: string, limit: number)`
Fetches latest news articles for sentiment analysis (cached for 5 minutes).

```typescript
const news = await fetchStockNews('AAPL', 10);
```

#### 5. `fetchFundamentalMetrics(symbol: string)`
Fetches fundamental metrics like P/E ratio, market cap, etc. (cached for 1 hour).

```typescript
const metrics = await fetchFundamentalMetrics('AAPL');
```

#### 6. `fetchMultipleQuotes(symbols: string[])`
Batch fetch quotes for multiple symbols in parallel.

```typescript
const quotes = await fetchMultipleQuotes(['AAPL', 'MSFT', 'GOOGL']);
```

### Utility Functions

- `isMarketOpen()` - Check if US market is currently open
- `clearCache(symbol?)` - Clear cache for specific symbol or all data

### Caching Strategy

- **Real-time quotes**: 1-minute expiration
- **Historical data**: Infinite cache (immutable data)
- **Intraday data**: 1-minute expiration  
- **News**: 5-minute expiration
- **Fundamentals**: 1-hour expiration

All caching is handled automatically through the `stock_cache` table in Supabase.

## Database Schema

### Tables Created

1. **`stock_cache`** - Caches API responses with timestamps
2. **`watchlists`** - User-created watchlists
3. **`watchlist_items`** - Stocks within watchlists
4. **`portfolios`** - User investment portfolios
5. **`portfolio_holdings`** - Stock positions in portfolios
6. **`price_alerts`** - User price alert notifications
7. **`user_preferences`** - User settings and preferences
8. **`stock_transactions`** - Buy/sell transaction history

### Key Features

- **Row Level Security (RLS)** enabled on all user tables
- **Automatic portfolio value calculation** via triggers
- **Auto-updating timestamps** on data changes
- **Foreign key constraints** for data integrity
- **Indexed columns** for query performance

## Setup Instructions

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Copy and paste the content from:
/supabase/migrations/20250109_create_schema.sql
```

### 2. Verify Tables

Check that all 8 tables were created successfully:
- stock_cache
- watchlists
- watchlist_items
- portfolios
- portfolio_holdings
- price_alerts
- user_preferences
- stock_transactions

### 3. Test the API

```typescript
import { fetchStockQuote, fetchHistoricalData } from '@/lib/stockApi';

// Fetch real-time quote
const quote = await fetchStockQuote('AAPL');
console.log(`AAPL: $${quote.price} (${quote.source})`);

// Fetch historical data
const history = await fetchHistoricalData('AAPL', '1mo');
console.log(`Fetched ${history.length} data points`);
```

## Data Flow

```
User Request
    ↓
Check Cache (stock_cache table)
    ↓
Cache Hit? → Return cached data
    ↓
Cache Miss? → Call Supabase Edge Function
    ↓
Alpaca Market Data API (quotes, intraday, historical)
    ↓ (fallback)
Yahoo Finance API (symbol search only)
    ↓
Store in Cache
    ↓
Return to User
```

## Data Provider Strategy

1. **Alpaca Market Data** (Primary source for quotes, intraday, historical)
2. **Yahoo Finance** (Secondary fallback for ticker search metadata)
3. **Internal cache** (Primary for previously fetched data)

## Performance Optimization

- **Parallel fetching** for multiple symbols
- **Smart caching** based on data volatility
- **Market hours detection** for refresh timing
- **Database indexing** on frequently queried columns

## Security

- **Row Level Security** ensures users only access their own data
- **Authentication required** for all user-specific operations
- **Public cache** for market data (shared across all users)
- **SQL injection protection** via Supabase client

## Next Steps

1. ✅ Run the SQL migration in Supabase
2. ✅ Test the API functions
3. Create UI components for watchlists
4. Create UI components for portfolios
5. Implement price alert notifications
6. Add news sentiment analysis
7. Build ML prediction models

## API Limits & Caching Guidance

### Alpaca Market Data (reference)
- IEX feed included on free tier; SIP feed available on paid plans
- Aggregates support up to 2 years of minute data
- REST quotas vary by plan; streaming quotes reduce REST load when connected

### Recommended Caching
With proper caching, you can support:
- 100+ active users
- Real-time quote updates every minute
- Historical data with infinite cache
- Minimal REST consumption thanks to cache + streaming

## Troubleshooting

### Cache not working?
Check that `stock_cache` table exists and has proper structure.

### RLS errors?
Ensure user is authenticated before accessing user-specific tables.

### API errors?
Verify `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` are set in Supabase Edge Functions secrets. Optionally configure `ALPACA_STOCK_FEED` (`iex` or `sip`).

**Note:** Edge Functions use `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` (not `APCA_API_KEY_ID`). See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete naming reference.

## Support

For issues or questions:
1. Check Supabase logs in Dashboard
2. Verify Edge Functions are deployed
3. Test API keys directly with curl
4. Review this documentation

---

**Status**: ✅ Implementation Complete
**Last Updated**: November 9, 2025
