# Alpaca Market Data Integration Guide

## Overview

This application uses **Alpaca Market Data API** as the primary data source for real-time and historical stock market data. Alpaca provides professional-grade market data with multiple feed options and comprehensive coverage.

## Features

### Current Capabilities

✅ **Real-time Stock Quotes** - Latest bid/ask spreads and trade data  
✅ **Historical OHLCV Data** - Up to 10+ years of daily bars and up to 2 years of intraday bars (1min to 1day intervals)  
✅ **Intraday Data** - Real-time minute, hourly, and daily aggregates  
✅ **Stock Search** - Search and discover ticker symbols  
✅ **WebSocket Streaming** - Real-time trade, quote, and bar updates  
✅ **News Feed** - Real-time market news and analysis  
✅ **Crypto Data** - Cryptocurrency market data  
✅ **Options Data** - Options chain data and streaming

### Architecture

```
Frontend (React)
    ↓
React Hooks (useStockQuote, useStockIntraday, etc.)
    ↓
Supabase Edge Functions (stock-quote, stock-intraday, etc.)
    ↓
Alpaca REST Client (/supabase/functions/_shared/alpaca/client.ts)
    ↓
Alpaca Market Data API (https://data.alpaca.markets)
```

## Environment Variables

### Required Variables

Add these to your **Supabase project settings** under "Edge Functions" → "Manage secrets":

```bash
# Alpaca API Credentials (Required)
APCA_API_KEY_ID=your_alpaca_key_id
APCA_API_SECRET_KEY=your_alpaca_secret_key

# Data Feed Selection (Optional)
# Options: 'iex' (default, free) or 'sip' (paid, requires subscription)
ALPACA_STOCK_FEED=iex
```

### Getting Alpaca Credentials

1. **Sign up at [Alpaca](https://alpaca.markets)**
   - Free tier available with IEX data feed
   - No credit card required for basic access

2. **Generate API Keys**
   - Navigate to: Dashboard → Your API Keys
   - Click "Generate New Keys"
   - Choose "Paper Trading" for testing (recommended)
   - Copy both API Key ID and Secret Key

3. **Data Feed Options**
   - **IEX Feed** (free): Real-time quotes from IEX exchange
   - **SIP Feed** (paid): Consolidated real-time data from all exchanges
   - Requires Unlimited or higher plan for SIP access

## API Endpoints

### 1. Stock Quote (`/stock-quote`)

**Purpose**: Get real-time stock quotes with bid/ask spreads

**Request**:
```json
{
  "symbol": "AAPL"
}
```

**Response**:
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 178.45,
  "change": 2.34,
  "changePercent": 1.33,
  "volume": 52300000,
  "high": 180.12,
  "low": 176.22,
  "open": 177.89,
  "previousClose": 176.11,
  "source": "alpaca"
}
```

**Frontend Usage**:
```typescript
import { useStockQuote } from '@/hooks/useStockQuote';

function StockPrice({ symbol }: { symbol: string }) {
  const { data: quote, isLoading, error } = useStockQuote(symbol);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h2>{quote.symbol}: ${quote.price.toFixed(2)}</h2>
      <p>{quote.changePercent > 0 ? '↑' : '↓'} {quote.changePercent.toFixed(2)}%</p>
    </div>
  );
}
```

### 2. Intraday Data (`/stock-intraday`)

**Purpose**: Get minute-by-minute or hourly OHLCV bars

**Request**:
```json
{
  "symbol": "AAPL",
  "interval": "1m",
  "range": "1d"
}
```

**Supported Intervals**: `1m`, `5m`, `10m`, `15m`, `30m`, `1h`, `4h`, `1d`  
**Supported Ranges**: `1d`, `5d`, `1w`, `1mo`, `3mo`, `6mo`, `1y`, `2y`

**Response**:
```json
{
  "data": [
    {
      "datetime": "2024-01-15T09:30:00.000Z",
      "date": "2024-01-15",
      "time": "09:30:00.000",
      "open": 177.89,
      "high": 178.12,
      "low": 177.65,
      "close": 178.01,
      "volume": 1250000
    }
  ],
  "source": "alpaca:1m",
  "interval": "1m",
  "symbol": "AAPL"
}
```

**Frontend Usage**:
```typescript
import { useStockIntraday } from '@/hooks/useStockIntraday';

function IntradayChart({ symbol }: { symbol: string }) {
  const { data, isLoading } = useStockIntraday(symbol, '5m', '1d');
  
  if (isLoading || !data) return <div>Loading chart...</div>;
  
  return (
    <Chart data={data.data} />
  );
}
```

### 3. Historical Data (`/stock-historical`)

**Purpose**: Get daily OHLCV bars for longer time periods

**Request**:
```json
{
  "symbol": "AAPL",
  "range": "1y"
}
```

**Response**: Array of daily price data points

**Frontend Usage**:
```typescript
import { useStockHistorical } from '@/hooks/useStockHistorical';

function HistoricalChart({ symbol }: { symbol: string }) {
  const { data, isLoading } = useStockHistorical(symbol, '1y');
  
  return <PriceChart data={data} />;
}
```

### 4. Stock Search (`/stock-search`)

**Purpose**: Search for stock symbols by name or ticker

**Request**:
```json
{
  "query": "Apple"
}
```

**Response**:
```json
{
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "asset_class": "us_equity",
      "status": "active"
    }
  ]
}
```

**Frontend Usage**:
```typescript
import { useStockSearch } from '@/hooks/useStockSearch';

function StockSearchBox() {
  const [query, setQuery] = useState('');
  const { data: results } = useStockSearch(query);
  
  return (
    <div>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)}
        placeholder="Search stocks..."
      />
      {results?.map(stock => (
        <div key={stock.symbol}>{stock.symbol} - {stock.name}</div>
      ))}
    </div>
  );
}
```

## WebSocket Streaming (Advanced)

### Real-Time Data Streams

Alpaca provides WebSocket feeds for real-time market data:

#### Available Streams:
- **Equities**: Real-time trades, quotes, and bars for stocks
- **Crypto**: Cryptocurrency market data
- **News**: Market news and analysis
- **Options**: Options chain data and trades

#### Implementation Example

The WebSocket client is available in `/supabase/functions/_shared/alpaca/stream.ts`:

```typescript
import { connectEquitiesStream } from '../_shared/alpaca/stream.ts';
import { resolveAlpacaCredentials } from '../_shared/alpaca/client.ts';

// Connect to real-time equity stream
const socket = await connectEquitiesStream({
  credentials: resolveAlpacaCredentials(),
  symbols: {
    trades: ['AAPL', 'GOOGL', 'MSFT'],
    quotes: ['AAPL'],
    bars: ['SPY']
  },
  onMessage: (data) => {
    console.log('Real-time update:', data);
  },
  onOpen: () => console.log('Connected to Alpaca stream'),
  onError: (err) => console.error('Stream error:', err),
  onClose: () => console.log('Stream closed')
});
```

#### News Stream

```typescript
import { connectNewsStream } from '../_shared/alpaca/stream.ts';

const newsSocket = await connectNewsStream({
  credentials: resolveAlpacaCredentials(),
  topics: ['AAPL', 'TSLA'],  // or ['*'] for all news
  onMessage: (newsItem) => {
    console.log('News:', newsItem);
  }
});
```

#### Crypto Stream

```typescript
import { connectCryptoStream } from '../_shared/alpaca/stream.ts';

const cryptoSocket = await connectCryptoStream({
  credentials: resolveAlpacaCredentials(),
  symbols: {
    trades: ['BTCUSD', 'ETHUSD'],
    quotes: ['BTCUSD']
  },
  onMessage: (data) => {
    console.log('Crypto update:', data);
  }
});
```

## Rate Limits

### Alpaca API Rate Limits

- **Free Tier (IEX)**:
  - 200 requests per minute per API key
  - 10 concurrent connections per WebSocket

- **Unlimited Plan (SIP)**:
  - Unlimited REST API requests
  - 30 concurrent WebSocket connections
  - Full market data from all exchanges

### Best Practices

1. **Use Caching**: All Edge functions implement 45-second cache
2. **Batch Requests**: Request multiple symbols when possible
3. **WebSocket for Real-Time**: Use WebSocket streams instead of polling
4. **Respect Rate Limits**: Implement exponential backoff on errors

## Data Feed Comparison

| Feature | IEX Feed (Free) | SIP Feed (Paid) |
|---------|----------------|-----------------|
| Real-time Quotes | ✅ IEX Exchange | ✅ All Exchanges |
| Historical Data | ✅ Up to 2 years | ✅ Full History |
| Intraday Bars | ✅ Limited | ✅ Comprehensive |
| WebSocket Streaming | ✅ | ✅ |
| Market Depth | ❌ | ✅ |
| Pre/Post Market | Limited | ✅ Full |
| Cost | Free | Paid Subscription |

## Error Handling

### Common Errors

**Missing Credentials**:
```json
{
  "error": "Missing Alpaca credentials. Ensure APCA_API_KEY_ID and APCA_API_SECRET_KEY are configured."
}
```

**Invalid Symbol**:
```json
{
  "error": "Alpaca request failed: 404 Symbol not found"
}
```

**Rate Limit Exceeded**:
```json
{
  "error": "Alpaca request failed: 429 Too Many Requests"
}
```

### Frontend Error Handling

```typescript
const { data, error, isLoading } = useStockQuote('AAPL');

if (error) {
  if (error.message.includes('429')) {
    // Rate limit - show retry message
    return <div>Too many requests. Please wait...</div>;
  }
  if (error.message.includes('404')) {
    // Invalid symbol
    return <div>Symbol not found</div>;
  }
  // Generic error
  return <div>Error loading data: {error.message}</div>;
}
```

## Caching Strategy

All Alpaca data is cached in Supabase `stock_cache` table:

- **Quote Cache**: 45 seconds
- **Intraday Cache**: 45 seconds
- **Historical Cache**: Longer (varies by range)

Cache keys follow the pattern:
```
intraday:{SYMBOL}:{INTERVAL}:{RANGE}
quote:{SYMBOL}
historical:{SYMBOL}:{RANGE}
```

## Troubleshooting

A local test script is available to invoke any Edge Function directly from your terminal. This is the fastest way to check if credentials are working and to inspect the raw data returned from the API.

**Prerequisites**:
- Ensure `npx` and `tsx` are available in your environment.
- Your `.env` file must contain the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Usage**:
```bash
npx tsx scripts/testInvoke.ts <function-name> '[json-payload]'
```

**Example: Test `stock-quote` for AAPL**
```bash
npx tsx scripts/testInvoke.ts stock-quote '{"symbol": "AAPL"}'
```

**Example: Test `stock-historical` for GOOG**
```bash
npx tsx scripts/testInvoke.ts stock-historical '{"symbol": "GOOG", "range": "5y"}'
```

### Issue: "Missing Alpaca credentials"

**Solution**: Ensure environment variables are set in Supabase:
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Click "Manage secrets"
3. Add `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`
4. Redeploy Edge Functions

### Issue: No data returned for symbol

**Solution**: Verify the symbol is valid and actively traded:
```typescript
// Use stock search to verify symbol
const { data } = await supabase.functions.invoke('stock-search', {
  body: { query: 'AAPL' }
});
```

### Issue: Intraday data shows gaps

**Cause**: Market closed or symbol has low trading volume  
**Solution**: This is normal - gaps represent times when no trades occurred

### Issue: WebSocket connection fails

**Solution**: Check that:
1. Credentials are valid
2. Using correct feed URL (IEX vs SIP)
3. Not exceeding concurrent connection limit
4. Network allows WebSocket connections

## Migration from Other APIs

If migrating from Polygon, Marketstack, or Yahoo Finance:

### From Polygon
- Alpaca provides similar intraday bars with better rate limits
- WebSocket API is more stable
- Replace Polygon API key with Alpaca credentials

### From Marketstack
- Alpaca offers real-time data (not just end-of-day)
- Better free tier with IEX data
- More comprehensive API coverage

### From Yahoo Finance
- Alpaca is more reliable (official API, not web scraping)
- Better data quality and consistency
- Professional support available

## Additional Resources

- [Alpaca Market Data API Docs](https://alpaca.markets/docs/api-references/market-data-api/)
- [Alpaca WebSocket Streaming](https://alpaca.markets/docs/api-references/market-data-api/stock-pricing-data/realtime/)
- [IEX vs SIP Data Comparison](https://alpaca.markets/docs/market-data/#iex-vs-sip)
- [Alpaca Dashboard](https://app.alpaca.markets/)

## Support

For issues specific to this integration:
- Check Edge Function logs in Supabase Dashboard
- Review `/docs/API_INTEGRATION.md` for general API guidance
- Test credentials using Alpaca Dashboard

For Alpaca API issues:
- [Alpaca Support](https://alpaca.markets/support)
- [Alpaca Community Slack](https://alpaca.markets/slack)
