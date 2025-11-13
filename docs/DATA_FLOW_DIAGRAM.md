# Date Range Selection - Data Flow Diagram

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Index.tsx (Main Page)                    │
│                                                                   │
│  State Management:                                               │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ const [dateRange, setDateRange] = useState("1mo")   │        │
│  │ const [selectedSymbol, setSelectedSymbol] = useState │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                   │
│  Data Fetching (React Query):                                    │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ useStockHistorical(selectedSymbol, dateRange)       │        │
│  │   ↓                                                  │        │
│  │ Returns: historicalData[]                           │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                   │
│  Data Transformation:                                            │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ priceData = useMemo(() => {                         │        │
│  │   return historicalData.map(...)                    │        │
│  │ }, [historicalData])                                │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                   │
└───────────────────────┬─────────────────────┬───────────────────┘
                        │                     │
                        ▼                     ▼
        ┌───────────────────────┐   ┌──────────────────────────┐
        │    PriceChart         │   │ TechnicalAnalysisDashboard│
        │                       │   │                           │
        │  Props:               │   │  Props:                   │
        │  - symbol             │   │  - symbol                 │
        │  - data               │   │  - data (priceData)       │
        │  - selectedRange      │   │                           │
        │  - onRangeChange()    │   │  Calculations:            │
        │                       │   │  - RSI, MACD, Stochastic  │
        │  Renders:             │   │  - KDJ, Bollinger, etc.   │
        │  - Area chart         │   │  - All 17 indicators      │
        │  - Date range buttons │   │                           │
        └───────────────────────┘   └──────────────────────────┘
                │
                │ User clicks button
                ▼
```

## User Interaction Flow

```
User Action: Click "6M" button in PriceChart
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 1. PriceChart: onRangeChange("6mo") callback fires     │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 2. Index.tsx: handleDateRangeChange("6mo") updates     │
│    state via setDateRange("6mo")                       │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 3. React Query: Detects query key change               │
│    ['stock-historical', 'AAPL', '6mo']                 │
│    (was ['stock-historical', 'AAPL', '1mo'])           │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 4. Supabase Edge Function: API call made               │
│    POST /functions/v1/stock-historical                 │
│    Body: { symbol: "AAPL", range: "6mo" }              │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 5. Edge Function: Fetches from API sources             │
│    Marketstack → Yahoo Finance → Polygon.io            │
│    Returns ~180 days of OHLCV data                     │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 6. React Query: Updates cached data                    │
│    historicalData = [...180 daily records]             │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 7. Index.tsx: priceData useMemo recalculates           │
│    - Normalizes date format (YYYY-MM-DD)               │
│    - Generates mock data if API fails                  │
└────────────────────────────────────────────────────────┘
                    │
                    ├──────────────┬─────────────────────┐
                    ▼              ▼                     ▼
        ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
        │ 8a. PriceChart  │  │ 8b. Dashboard│  │ 8c. All      │
        │  Re-renders     │  │  Re-renders  │  │  Indicators  │
        │  with new data  │  │  with new    │  │  Recalculate │
        │                 │  │  priceData   │  │              │
        │ - Updates X-axis│  │              │  │ - RSI (14)   │
        │ - Redraws area  │  │              │  │ - MACD       │
        │ - Highlights    │  │              │  │ - Stochastic │
        │   "6M" button   │  │              │  │ - KDJ        │
        │                 │  │              │  │ - ATR        │
        │                 │  │              │  │ - OBV        │
        │                 │  │              │  │ - MFI        │
        │                 │  │              │  │ - etc...     │
        └─────────────────┘  └──────────────┘  └──────────────┘
```

## API Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno Runtime)          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ stock-historical Edge Function                        │   │
│  │                                                       │   │
│  │  Input: { symbol: "AAPL", range: "6mo" }             │   │
│  │                                                       │   │
│  │  Date Calculation:                                    │   │
│  │  - endDate = new Date()                              │   │
│  │  - startDate = endDate - 6 months                    │   │
│  │                                                       │   │
│  │  API Fallback Chain:                                  │   │
│  │  1. Marketstack (if MARKETSTACK_API_KEY exists)      │   │
│  │     └─> Success? Return data                         │   │
│  │     └─> Fail? Try next...                            │   │
│  │                                                       │   │
│  │  2. Yahoo Finance (no API key needed)                │   │
│  │     └─> Success? Return data                         │   │
│  │     └─> Fail? Try next...                            │   │
│  │                                                       │   │
│  │  3. Polygon.io (if POLYGON_API_KEY exists)           │   │
│  │     └─> Success? Return data                         │   │
│  │     └─> Fail? Throw error                            │   │
│  │                                                       │   │
│  │  Output: { data: [...], source: "marketstack" }      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  External API Providers                       │
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Marketstack │    │Yahoo Finance│    │ Polygon.io  │     │
│  │             │    │             │    │             │     │
│  │ - Paid API  │    │ - Free      │    │ - Paid API  │     │
│  │ - Most      │    │ - Reliable  │    │ - Backup    │     │
│  │   reliable  │    │ - No key    │    │ - Good      │     │
│  │ - EOD data  │    │   needed    │    │   coverage  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## React Query Caching Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    React Query Cache                          │
│                                                               │
│  Query Key Format: ['stock-historical', symbol, range]       │
│                                                               │
│  Cache Entries:                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ['stock-historical', 'AAPL', '1mo'] → [...data]      │   │
│  │   Age: 2 minutes (fresh)                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ['stock-historical', 'AAPL', '6mo'] → [...data]      │   │
│  │   Age: 6 minutes (stale, will refetch on next use)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ['stock-historical', 'TSLA', '1mo'] → [...data]      │   │
│  │   Age: 1 minute (fresh)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Settings:                                                    │
│  - staleTime: 5 minutes                                      │
│  - cacheTime: 10 minutes (default)                           │
│  - Refetch on window focus: true                             │
│  - Retry: 3 attempts                                         │
└──────────────────────────────────────────────────────────────┘
```

## Performance Optimization Points

```
┌────────────────────────────────────────────────────────────┐
│                  Optimization Layer 1:                      │
│                  React Query Cache                          │
│                                                             │
│  - Prevents duplicate API calls                            │
│  - 5-minute staleTime means rapid clicks don't refetch     │
│  - Different symbols cached separately                     │
│  - Different ranges cached separately                      │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                  Optimization Layer 2:                      │
│                  useMemo Dependencies                       │
│                                                             │
│  priceData = useMemo(() => {...}, [historicalData])        │
│  - Only recalculates when API data changes                 │
│  - Not affected by other state changes                     │
│                                                             │
│  indicatorData = useMemo(() => {...}, [data, indicators])  │
│  - Only recalculates when data or selections change        │
│  - Heavy calculations (RSI, MACD, etc.) not repeated       │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                  Optimization Layer 3:                      │
│                  Conditional Calculations                   │
│                                                             │
│  const rsi = selectedIndicators.rsi                        │
│    ? calculateRSI(closes, 14)                              │
│    : [];                                                   │
│                                                             │
│  - Disabled indicators don't calculate                     │
│  - Saves CPU for complex indicators (MACD, ADX)            │
│  - User only pays for what they use                        │
└────────────────────────────────────────────────────────────┘
```

## Date Range Button Mapping

```
┌───────────────────────────────────────────────────────────┐
│              User Interface Button Labels                  │
│              (What user sees)                             │
│                                                           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ 1D │ │ 5D │ │ 1M │ │ 3M │ │ 6M │ │ 1Y │ │ 5Y │      │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘      │
└───────────────────────────────────────────────────────────┘
     │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌───────────────────────────────────────────────────────────┐
│                    rangeMap Object                         │
│                    (in PriceChart.tsx)                     │
│                                                           │
│  {                                                        │
│    "1D": "1d",    // 1 day                               │
│    "5D": "5d",    // 5 days                              │
│    "1M": "1mo",   // 1 month                             │
│    "3M": "3mo",   // 3 months                            │
│    "6M": "6mo",   // 6 months                            │
│    "1Y": "1y",    // 1 year                              │
│    "5Y": "5y"     // 5 years                             │
│  }                                                        │
└───────────────────────────────────────────────────────────┘
     │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌───────────────────────────────────────────────────────────┐
│              API Range Parameter Values                    │
│              (Sent to Supabase Edge Function)             │
│                                                           │
│    "1d"   "5d"   "1mo"  "3mo"  "6mo"  "1y"   "5y"        │
│                                                           │
│  These match the Edge Function's switch statement         │
└───────────────────────────────────────────────────────────┘
```

## Database Schema Overview

```
┌──────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                     │
│                    (Supabase Managed)                     │
│                                                           │
│  User Data (RLS Protected):                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ watchlists          - User stock watchlists      │   │
│  │ watchlist_items     - Stocks in watchlists       │   │
│  │ portfolios          - User portfolios            │   │
│  │ portfolio_holdings  - Stock positions            │   │
│  │ price_alerts        - Price notifications        │   │
│  │ user_preferences    - User settings              │   │
│  │ stock_transactions  - Trade history              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  Public Data (No RLS):                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ stock_cache         - API response cache         │   │
│  │   - cache_key: unique identifier                │   │
│  │   - data: JSONB stored data                     │   │
│  │   - last_updated: timestamp                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  Database Functions:                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ update_portfolio_value()                         │   │
│  │   - Triggers on portfolio_holdings changes       │   │
│  │   - Auto-calculates total portfolio value        │   │
│  │                                                   │   │
│  │ update_updated_at_column()                       │   │
│  │   - Triggers before UPDATE                       │   │
│  │   - Maintains updated_at timestamps              │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Complete System Flow

```
┌─────────────┐
│    User     │
│   (Browser) │
└─────┬───────┘
      │
      │ 1. Clicks "6M" button
      ▼
┌─────────────────────┐
│    PriceChart       │
│  Component (React)  │
└─────┬───────────────┘
      │
      │ 2. onRangeChange("6mo")
      ▼
┌─────────────────────┐
│    Index.tsx        │
│  State Management   │
│  setDateRange("6mo")│
└─────┬───────────────┘
      │
      │ 3. State update triggers re-render
      ▼
┌─────────────────────┐
│  useStockHistorical │
│  React Query Hook   │
└─────┬───────────────┘
      │
      │ 4. Checks cache for ['stock-historical', 'AAPL', '6mo']
      │    Cache miss or stale → Fetch
      ▼
┌─────────────────────┐
│  Supabase Client    │
│  (supabase.js)      │
└─────┬───────────────┘
      │
      │ 5. POST https://[project].supabase.co/functions/v1/stock-historical
      │    Body: { symbol: "AAPL", range: "6mo" }
      ▼
┌─────────────────────┐
│  Edge Function      │
│  (Deno Runtime)     │
└─────┬───────────────┘
      │
      │ 6. Try Marketstack API
      ▼
┌─────────────────────┐
│  Marketstack API    │
│  or Yahoo Finance   │
│  or Polygon.io      │
└─────┬───────────────┘
      │
      │ 7. Return OHLCV data
      ▼
┌─────────────────────┐
│  Edge Function      │
│  Format & Return    │
└─────┬───────────────┘
      │
      │ 8. Response: { data: [...], source: "yahoo" }
      ▼
┌─────────────────────┐
│  React Query Cache  │
│  Store for 5 min    │
└─────┬───────────────┘
      │
      │ 9. Update component state
      ▼
┌─────────────────────┐
│    Index.tsx        │
│  priceData useMemo  │
│  recalculates       │
└─────┬───────────────┘
      │
      ├────────────────────┬────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│  PriceChart  │  │   Dashboard     │  │  Indicators  │
│  Re-renders  │  │   Re-renders    │  │  Recalculate │
│              │  │                 │  │              │
│ - New data   │  │ - New priceData │  │ - RSI        │
│ - "6M" active│  │ - Indicators    │  │ - MACD       │
│ - Updated    │  │   calculate     │  │ - Stochastic │
│   X-axis     │  │                 │  │ - KDJ        │
└──────────────┘  └─────────────────┘  └──────────────┘
```

## Summary

This diagram shows:
1. **Component Hierarchy** - How Index.tsx orchestrates PriceChart and Dashboard
2. **User Interaction Flow** - Complete path from button click to chart update
3. **API Integration** - How Edge Functions handle data fetching with fallbacks
4. **Caching Strategy** - React Query's multi-level cache optimization
5. **Performance** - Three layers of optimization (cache, useMemo, conditional)
6. **Button Mapping** - Display labels → API values translation
7. **Database Schema** - PostgreSQL tables and functions
8. **Complete System Flow** - End-to-end data journey

All components work together to provide:
- Fast, cached responses
- Automatic updates across all charts
- Fallback API sources for reliability
- Optimized calculations for performance
