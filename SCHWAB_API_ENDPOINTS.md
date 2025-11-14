# Schwab API Edge Functions Reference

Complete reference for all Schwab API Edge Functions deployed in this application.

## Authentication Functions

### schwab-auth-init
Generates OAuth authorization URL for initial setup.

**Endpoint:** `POST /schwab-auth-init`

**Response:**
```json
{
  "authUrl": "https://api.schwabapi.com/v1/oauth/authorize?...",
  "redirectUri": "https://localhost:3000/callback",
  "instructions": [
    "1. Visit the authUrl in your browser",
    "2. Log in to your Schwab account",
    "3. Authorize the application",
    "4. Copy the code from callback URL",
    "5. Call schwab-auth-exchange with the code"
  ]
}
```

### schwab-auth-exchange
Exchanges authorization code for access/refresh tokens.

**Endpoint:** `POST /schwab-auth-exchange`

**Request:**
```json
{
  "code": "AUTHORIZATION_CODE_FROM_CALLBACK"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schwab OAuth tokens stored successfully!",
  "expiresIn": 1800,
  "expiresInMinutes": 30
}
```

## Market Data Functions

### schwab-quote
Get real-time quotes for one or more symbols.

**Endpoint:** `POST /schwab-quote`

**Request:**
```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"]
}
```

**Response:**
```json
{
  "quotes": [
    {
      "symbol": "AAPL",
      "bidPrice": 178.50,
      "askPrice": 178.52,
      "lastPrice": 178.51,
      "volume": 52300000,
      "timestamp": 1699900800000
    }
  ]
}
```

### schwab-historical
Get historical OHLC candle data.

**Endpoint:** `POST /schwab-historical`

**Request:**
```json
{
  "symbol": "AAPL",
  "periodType": "day",
  "period": 10,
  "frequencyType": "minute",
  "frequency": 5,
  "needExtendedHoursData": false
}
```

**Parameters:**
- `periodType`: 'day' | 'month' | 'year' | 'ytd'
- `period`: Number of periods
- `frequencyType`: 'minute' | 'daily' | 'weekly' | 'monthly'
- `frequency`: Frequency within period type
- `startDate`: Unix timestamp (optional)
- `endDate`: Unix timestamp (optional)

**Response:**
```json
{
  "candles": [
    {
      "datetime": 1699900800000,
      "open": 178.00,
      "high": 179.00,
      "low": 177.50,
      "close": 178.50,
      "volume": 1250000,
      "symbol": "AAPL"
    }
  ]
}
```

### schwab-option-chains (NEW)
Get option chain data for a symbol.

**Endpoint:** `POST /schwab-option-chains`

**Request:**
```json
{
  "symbol": "AAPL",
  "strikeCount": 10,
  "includeQuotes": true,
  "contractType": "ALL",
  "strategy": "SINGLE"
}
```

**Parameters:**
- `symbol`: Stock symbol (required)
- `strikeCount`: Number of strikes to return
- `includeQuotes`: Include quote data (default: true)
- `contractType`: 'CALL' | 'PUT' | 'ALL'
- `strategy`: 'SINGLE' | 'ANALYTICAL' | 'COVERED' | 'VERTICAL' | etc.
- `interval`: Strike price interval
- `strike`: Specific strike price
- `expMonth`: Expiration month filter
- `optionType`: 'STANDARD' | 'NON_STANDARD' | 'ALL'

**Response:**
```json
{
  "symbol": "AAPL",
  "callExpDateMap": {
    "2024-01-19:30": {
      "180.0": [
        {
          "symbol": "AAPL_011924C180",
          "bid": 2.50,
          "ask": 2.55,
          "last": 2.52,
          "delta": 0.52,
          "gamma": 0.03,
          "theta": -0.05,
          "vega": 0.12,
          "volatility": 0.25
        }
      ]
    }
  },
  "putExpDateMap": { ... }
}
```

**Database Storage:**
Option chain data is automatically saved to `options_chains` table when `includeQuotes` is true.

### schwab-movers (NEW)
Get market movers for major indices.

**Endpoint:** `POST /schwab-movers`

**Request:**
```json
{
  "index": "$SPX",
  "sort": "PERCENT_CHANGE_UP",
  "frequency": 0
}
```

**Parameters:**
- `index`: '$DJI' | '$COMPX' | '$SPX' | 'NYSE' | 'NASDAQ'
- `sort`: 'VOLUME' | 'TRADES' | 'PERCENT_CHANGE_UP' | 'PERCENT_CHANGE_DOWN'
- `frequency`: 0 | 1 | 5 | 10 | 30 | 60 (minutes)

**Response:**
```json
{
  "movers": [
    {
      "symbol": "NVDA",
      "description": "NVIDIA Corporation",
      "last": 495.50,
      "netChange": 45.20,
      "percentChange": 10.04,
      "totalVolume": 85000000,
      "direction": "up"
    }
  ]
}
```

### schwab-market-hours (NEW)
Get market hours for various markets.

**Endpoint:** `POST /schwab-market-hours`

**Request (all markets):**
```json
{
  "markets": ["equity", "option", "future"],
  "date": "2024-01-15"
}
```

**Request (specific market):**
```json
{
  "marketId": "equity",
  "date": "2024-01-15"
}
```

**Parameters:**
- `markets`: Array of market types (optional)
- `marketId`: Specific market ID (optional)
- `date`: Date in YYYY-MM-DD format (optional, defaults to today)

**Response:**
```json
{
  "equity": {
    "EQ": {
      "date": "2024-01-15",
      "marketType": "EQUITY",
      "isOpen": true,
      "sessionHours": {
        "preMarket": [
          {
            "start": "2024-01-15T07:00:00-05:00",
            "end": "2024-01-15T09:30:00-05:00"
          }
        ],
        "regularMarket": [
          {
            "start": "2024-01-15T09:30:00-05:00",
            "end": "2024-01-15T16:00:00-05:00"
          }
        ],
        "postMarket": [
          {
            "start": "2024-01-15T16:00:00-05:00",
            "end": "2024-01-15T20:00:00-05:00"
          }
        ]
      }
    }
  }
}
```

### schwab-instruments (NEW)
Search for instruments or get by CUSIP.

**Endpoint:** `POST /schwab-instruments`

**Request (search):**
```json
{
  "symbol": "AAPL",
  "projection": "symbol-search"
}
```

**Request (by CUSIP):**
```json
{
  "cusipId": "037833100"
}
```

**Parameters:**
- `symbol`: Symbol to search (required for search)
- `projection`: 'symbol-search' | 'symbol-regex' | 'desc-search' | 'desc-regex' | 'fundamental'
- `cusipId`: CUSIP identifier (required for CUSIP lookup)

**Response (search):**
```json
{
  "instruments": [
    {
      "symbol": "AAPL",
      "description": "Apple Inc. - Common Stock",
      "exchange": "NASDAQ",
      "assetType": "EQUITY",
      "cusip": "037833100"
    }
  ]
}
```

## Streaming Functions

### schwab-stream (NEW)
Real-time streaming market data via Server-Sent Events (SSE).

**Endpoint:** `POST /schwab-stream`

**Request:**
```json
{
  "service": "LEVELONE_EQUITIES",
  "command": "SUBS",
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "fields": [0, 1, 2, 3, 4, 5, 8, 10, 12, 18, 19]
}
```

**Parameters:**
- `service`: 'LEVELONE_EQUITIES' | 'LEVELONE_OPTIONS' | 'LEVELONE_FUTURES' | 'LEVELONE_FOREX' | 'CHART_EQUITY' | 'CHART_FUTURES'
- `command`: 'SUBS' | 'ADD' | 'UNSUBS'
- `symbols`: Array of symbols to stream
- `fields`: Array of field IDs to include (optional)

**Response:** Server-Sent Events stream

**Example Usage (JavaScript):**
```javascript
const eventSource = new EventSource(
  'https://your-project.supabase.co/functions/v1/schwab-stream',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
      service: 'LEVELONE_EQUITIES',
      command: 'SUBS',
      symbols: ['AAPL', 'MSFT']
    })
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Market data:', data);
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

**Stream Events:**
```json
// Connection established
{"type": "connected"}

// Market data update
{
  "data": [{
    "service": "LEVELONE_EQUITIES",
    "timestamp": 1699900800000,
    "key": "AAPL",
    "1": 178.50,  // Bid Price
    "2": 178.52,  // Ask Price
    "3": 178.51,  // Last Price
    "8": 52300000 // Volume
  }]
}

// Connection closed
{"type": "closed"}
```

**Field IDs for LEVELONE_EQUITIES:**
- 0: Symbol
- 1: Bid Price
- 2: Ask Price
- 3: Last Price
- 4: Bid Size
- 5: Ask Size
- 8: Total Volume
- 10: Last Size
- 12: High Price
- 18: Open Price
- 19: Close Price

## Database Tables

All market data functions can optionally store data in these tables:

### market_quotes
Real-time equity quotes.

**Schema:**
```sql
CREATE TABLE market_quotes (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  bid_price DECIMAL,
  ask_price DECIMAL,
  last_price DECIMAL,
  volume BIGINT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### futures_data
Futures market data.

**Schema:**
```sql
CREATE TABLE futures_data (
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
```

### options_chains
Options chain data with Greeks.

**Schema:**
```sql
CREATE TABLE options_chains (
  id BIGSERIAL PRIMARY KEY,
  underlying_symbol TEXT NOT NULL,
  option_symbol TEXT NOT NULL,
  strike_price DECIMAL,
  expiration_date DATE,
  contract_type CHAR(1), -- 'C' or 'P'
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
```

### price_history
Historical OHLC data.

**Schema:**
```sql
CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  open_price DECIMAL,
  high_price DECIMAL,
  low_price DECIMAL,
  close_price DECIMAL,
  volume BIGINT,
  datetime TIMESTAMPTZ NOT NULL
);
```

## Deployment

Deploy all functions with:

```bash
# Core functions
supabase functions deploy schwab-auth-init --project-ref your-ref
supabase functions deploy schwab-auth-exchange --project-ref your-ref
supabase functions deploy schwab-quote --project-ref your-ref
supabase functions deploy schwab-historical --project-ref your-ref

# New functions
supabase functions deploy schwab-option-chains --project-ref your-ref
supabase functions deploy schwab-movers --project-ref your-ref
supabase functions deploy schwab-market-hours --project-ref your-ref
supabase functions deploy schwab-instruments --project-ref your-ref
supabase functions deploy schwab-stream --project-ref your-ref
```

## Environment Variables

Required in Supabase secrets:
```bash
SCHWAB_KEY_ID=your_client_id
SCHWAB_SECRET_KEY=your_client_secret
SCHWAB_REDIRECT_URI=https://localhost:3000/callback
```

## Rate Limits

Schwab API has the following rate limits:
- 120 requests per minute per user
- Streaming connections are persistent and don't count against rate limits
- Option chains are data-intensive; use caching where possible

## Error Handling

All functions return standardized error responses:

```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

Common errors:
- `401`: Token expired or invalid (will auto-refresh if possible)
- `404`: Symbol or resource not found
- `429`: Rate limit exceeded
- `500`: Server error or Schwab API unavailable

## Support

For issues or questions:
- Check [SCHWAB_API_TROUBLESHOOTING.md](./SCHWAB_API_TROUBLESHOOTING.md) for common issues
- Review Schwab API documentation at https://developer.schwab.com/
- Check function logs: `supabase functions logs <function-name>`
