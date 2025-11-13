# Stock Data API Integration

This document describes the stock data API integration for the Stock Whisperer AI application.

## Overview

The application uses a robust three-tier fallback system to ensure maximum data availability and reliability:

1. **Marketstack API** (Primary) - Professional stock market data
2. **Yahoo Finance API** (Secondary) - Free fallback option
3. **Polygon.io API** (Tertiary) - Final fallback for enterprise data

## API Endpoints

### 1. Stock Quote (`/stock-quote`)

**Purpose**: Get real-time stock quotes and current market data

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
  "source": "marketstack"
}
```

**Data Sources**:
- **Marketstack**: `/eod/latest` endpoint (free tier)
- **Yahoo Finance**: Chart API (fallback)
- **Polygon.io**: Previous day aggregates (final fallback)

### 2. Historical Data (`/stock-historical`)

**Purpose**: Get historical OHLCV data for charting and analysis

**Request**:
```json
{
  "symbol": "AAPL",
  "range": "1mo"
}
```

**Supported Ranges**: `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `5y`

**Response**:
```json
{
  "data": [
    {
      "date": "2023-10-01",
      "open": 177.89,
      "high": 180.12,
      "low": 176.22,
      "close": 178.45,
      "volume": 52300000
    }
  ],
  "source": "marketstack"
}
```

**Data Sources**:
- **Marketstack**: `/eod` endpoint with date range
- **Yahoo Finance**: Chart API with range parameter (fallback)
- **Polygon.io**: Aggregates with date range (final fallback)

### 3. Intraday Data (`/stock-intraday`) ⭐ NEW

**Purpose**: Get real-time intraday data for minute-by-minute analysis

**Request**:
```json
{
  "symbol": "AAPL",
  "interval": "1min",
  "range": "1d"
}
```

**Supported Intervals**: `1min`, `5min`, `15min`, `30min`, `1hour`
**Supported Ranges**: `1d`, `5d`, `1w`

**Response**:
```json
{
  "data": [
    {
      "datetime": "2023-10-01T09:30:00+00:00",
      "date": "2023-10-01",
      "time": "09:30:00",
      "open": 177.89,
      "high": 178.12,
      "low": 177.65,
      "close": 178.01,
      "volume": 1250000
    }
  ],
  "source": "marketstack",
  "interval": "1min",
  "symbol": "AAPL"
}
```

**Data Sources**:
- **Marketstack**: `/intraday` endpoint (requires paid plan)
- **Fallback**: Returns 402 error with suggestion to use daily data

### 4. Stock Search (`/stock-search`)

**Purpose**: Search for stock symbols and company names

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
      "type": "Common Stock",
      "exchange": "NASDAQ"
    }
  ],
  "source": "yahoo"
}
```

## Environment Variables

### Required for Supabase Edge Functions

Add these environment variables to your Supabase project settings:

```bash
# Primary data source (recommended)
MARKETSTACK_API_KEY=your_marketstack_api_key_here

# Fallback data source (recommended for reliability)
POLYGON_API_KEY=your_polygon_api_key_here
```

### API Key Setup Instructions

1. **Marketstack API**:
   - Sign up at [marketstack.com](https://marketstack.com)
   - Free tier: 1,000 requests/month, end-of-day data only
   - Paid tiers: Real-time intraday data, higher limits

2. **Polygon.io API**:
   - Sign up at [polygon.io](https://polygon.io)
   - Free tier: 5 requests/minute, delayed data
   - Paid tiers: Real-time data, higher rate limits

## Fallback Logic

The system implements intelligent fallback logic:

```
Request → Marketstack API (if key available)
    ↓ (on failure)
Yahoo Finance API (free, no key needed)
    ↓ (on failure)
Polygon.io API (if key available)
    ↓ (on failure)
Error response
```

This ensures maximum uptime and data availability even if one or more services are unavailable.

## Error Handling

### Common Error Responses

**Missing Symbol**:
```json
{
  "error": "Symbol is required"
}
```

**API Key Issues**:
```json
{
  "error": "MARKETSTACK_API_KEY not configured"
}
```

**Intraday Access Restriction**:
```json
{
  "error": "Intraday data requires Marketstack paid plan. Falling back to end-of-day data.",
  "suggestion": "Use stock-historical endpoint for daily data instead."
}
```

**No Data Available**:
```json
{
  "error": "No data available for this symbol"
}
```

## Rate Limits

### Marketstack API
- Free: 1,000 requests/month
- Basic: 10,000 requests/month
- Professional: 100,000 requests/month

### Polygon.io API
- Free: 5 requests/minute
- Starter: 100 requests/minute
- Developer: 1,000 requests/minute

### Yahoo Finance API
- No official rate limits
- Recommended: Max 2,000 requests/hour per IP

## Best Practices

1. **Cache Data**: Implement client-side caching to reduce API calls
2. **Handle Errors Gracefully**: Always check for error responses
3. **Use Appropriate Intervals**: Don't request intraday data more frequently than needed
4. **Monitor Usage**: Track API usage to avoid hitting rate limits
5. **Implement Retry Logic**: Add exponential backoff for failed requests

## Frontend Usage

### React Hooks

```typescript
// Stock quotes
const { data: quote } = useStockQuote('AAPL');

// Historical data  
const { data: history } = useStockHistorical('AAPL', '1mo');

// Intraday data (new)
const { data: intraday } = useStockIntraday('AAPL', '1min', '1d');

// Stock search
const { data: results } = useStockSearch('Apple');
```

### Error Handling in Frontend

```typescript
const { data, error, isLoading } = useStockQuote('AAPL');

if (error) {
  // Handle different error types
  if (error.status === 402) {
    // Payment required for premium features
    console.log('Premium feature required');
  } else {
    // General error handling
    console.error('API Error:', error.message);
  }
}
```