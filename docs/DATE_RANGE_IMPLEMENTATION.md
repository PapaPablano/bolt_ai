# Date Range Selection Implementation

## Overview
This document explains how the date range selection system works across the Stock Whisperer AI application, ensuring both the main price chart and all 17 technical indicators update based on the selected time period.

## Architecture

### Data Flow
```
User clicks date button → Index.tsx state updates → useStockHistorical refetches → 
Both PriceChart and TechnicalAnalysisDashboard receive new data
```

### Components Involved

#### 1. Index.tsx (Main Page)
**State Management:**
```typescript
const [dateRange, setDateRange] = useState("1mo"); // Default: 1 month
const { data: historicalData } = useStockHistorical(selectedSymbol, dateRange);
```

**Key Functions:**
- `handleDateRangeChange(range: string)`: Updates dateRange state when user clicks a time period button
- Passes `dateRange` and `handleDateRangeChange` to `PriceChart` component
- Passes transformed `priceData` to `TechnicalAnalysisDashboard` (automatically updates when dateRange changes)

#### 2. PriceChart.tsx
**Props:**
```typescript
interface PriceChartProps {
  symbol: string;
  data: Array<{ date: string; price: number; volume: number }>;
  selectedRange: string;        // Current selected range (e.g., "1mo", "3mo")
  onRangeChange: (range: string) => void; // Callback to update parent state
}
```

**Date Range Buttons:**
- Display labels: `["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"]`
- API values: `["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"]`
- Mapping: `{ "1D": "1d", "5D": "5d", "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "5Y": "5y" }`

**Button Behavior:**
```typescript
<Button
  variant={selectedRange === rangeMap[range] ? "default" : "ghost"}
  onClick={() => onRangeChange(rangeMap[range])}
>
  {range}
</Button>
```

#### 3. TechnicalAnalysisDashboard.tsx
**Props:**
```typescript
interface TechnicalAnalysisDashboardProps {
  symbol: string;
  data: PriceData[]; // Automatically updated when dateRange changes in Index.tsx
}
```

**Automatic Updates:**
- Receives `priceData` from Index.tsx via props
- When `dateRange` changes → `useStockHistorical` refetches → `priceData` recalculated → Dashboard re-renders
- All 17 technical indicators automatically recalculate with new data:
  - Trend: SMA (20, 50, 200), EMA (12, 26, 50), Bollinger Bands, Keltner Channel
  - Momentum: RSI, MACD, Stochastic, KDJ, ADX
  - Volume: OBV, VROC, MFI
  - Volatility: ATR

## Supabase Integration

### Edge Functions

#### 1. stock-historical
**Endpoint:** `https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-historical`

**Request:**
```json
{
  "symbol": "AAPL",
  "range": "3mo"  // Supports: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y
}
```

**Response:**
```json
{
  "data": [
    {
      "date": "2024-08-09",
      "open": 170.25,
      "high": 172.50,
      "low": 169.80,
      "close": 171.90,
      "volume": 45678900
    },
    // ... more data points
  ],
  "source": "marketstack" // or "yahoo" or "polygon"
}
```

**Data Sources (Fallback Order):**
1. **Marketstack** (Primary) - Requires `MARKETSTACK_API_KEY` env var
2. **Yahoo Finance** (Secondary) - No API key needed
3. **Polygon.io** (Fallback) - Requires `POLYGON_API_KEY` env var

**Date Range Calculation:**
```typescript
switch(range) {
  case '1d':   startDate.setDate(endDate.getDate() - 1); break;
  case '5d':   startDate.setDate(endDate.getDate() - 5); break;
  case '1mo':  startDate.setMonth(endDate.getMonth() - 1); break;
  case '3mo':  startDate.setMonth(endDate.getMonth() - 3); break;
  case '6mo':  startDate.setMonth(endDate.getMonth() - 6); break;
  case '1y':   startDate.setFullYear(endDate.getFullYear() - 1); break;
  case '5y':   startDate.setFullYear(endDate.getFullYear() - 5); break;
}
```

#### 2. stock-quote
**Endpoint:** `https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-quote`

**Request:**
```json
{
  "symbol": "AAPL"
}
```

**Response:**
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 171.90,
  "change": 2.15,
  "changePercent": 1.27,
  "volume": 45678900,
  "high": 172.50,
  "low": 169.80,
  "open": 170.25,
  "previousClose": 169.75,
  "source": "marketstack"
}
```

#### 3. stock-intraday
**Endpoint:** `https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-intraday`

**Note:** Requires Marketstack paid plan. Returns HTTP 402 if unavailable.

**Request:**
```json
{
  "symbol": "AAPL",
  "interval": "1min",  // Supports: 1min, 5min, 15min, 30min, 1hour
  "range": "1d"        // Supports: 1d, 5d, 1w
}
```

#### 4. stock-search
**Endpoint:** `https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-search`

**Request:**
```json
{
  "query": "apple"
}
```

### Deployment Status
All Edge Functions are **ACTIVE** and deployed:
```
NAME              | STATUS | VERSION | UPDATED_AT
stock-quote       | ACTIVE | 6       | 2025-11-09 20:09:22
stock-historical  | ACTIVE | 5       | 2025-11-09 20:00:28
stock-intraday    | ACTIVE | 4       | 2025-11-09 20:00:54
stock-search      | ACTIVE | 1       | 2025-11-09 20:44:15
```

### Database Schema

#### Tables Created
1. **stock_cache** - Caches API responses (no RLS, public)
2. **watchlists** - User watchlists (RLS enabled)
3. **watchlist_items** - Stocks in watchlists (RLS enabled)
4. **portfolios** - User portfolios (RLS enabled)
5. **portfolio_holdings** - Stock positions (RLS enabled)
6. **price_alerts** - Price notifications (RLS enabled)
7. **user_preferences** - User settings (RLS enabled)
8. **stock_transactions** - Buy/sell history (RLS enabled)

#### Database Functions
1. **update_portfolio_value()** - Auto-calculates portfolio total value
2. **update_updated_at_column()** - Maintains updated_at timestamps

#### Row Level Security (RLS)
All user-specific tables have policies ensuring:
- Users can only view/modify their own data
- Policies check `auth.uid() = user_id`
- CASCADE deletes when user is deleted

### React Query Hook

#### useStockHistorical.ts
```typescript
export const useStockHistorical = (symbol: string, range: string = '1mo') => {
  return useQuery({
    queryKey: ['stock-historical', symbol, range],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stock-historical', {
        body: { symbol, range },
      });
      if (error) throw error;
      return data.data as HistoricalData[];
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};
```

**Key Features:**
- Query key includes both `symbol` and `range` → Refetches when either changes
- 5-minute cache prevents unnecessary API calls
- Only enabled when symbol is provided
- Automatic error handling and retry logic from React Query

## Technical Indicators Data Flow

### Calculation Pipeline
```
Historical Data (API) 
  ↓
Index.tsx (priceData useMemo)
  ↓
TechnicalAnalysisDashboard (props)
  ↓
indicatorData useMemo (calculates all selected indicators)
  ↓
Individual Chart Components (RSIChart, MACDChart, etc.)
```

### Indicator Categories

#### 1. Trend Indicators
- **SMA (Simple Moving Average)**: 20, 50, 200 periods
- **EMA (Exponential Moving Average)**: 12, 26, 50 periods
- **Bollinger Bands**: 20-period SMA ± 2 standard deviations
- **Keltner Channel**: 20-period EMA ± 2 ATR

#### 2. Momentum Indicators
- **RSI (Relative Strength Index)**: 14-period, overbought/oversold zones
- **MACD (Moving Average Convergence Divergence)**: 12/26/9 settings
- **Stochastic Oscillator**: 14-period K, 3-period D
- **KDJ**: 9-period, K/D/J lines (J = 3K - 2D)
- **ADX (Average Directional Index)**: 14-period trend strength

#### 3. Volume Indicators
- **OBV (On-Balance Volume)**: Cumulative volume based on price direction
- **VROC (Volume Rate of Change)**: 14-period volume momentum
- **MFI (Money Flow Index)**: 14-period volume-weighted RSI

#### 4. Volatility Indicators
- **ATR (Average True Range)**: 14-period volatility measure

### Data Format Requirements
All indicators receive data in this format:
```typescript
interface PriceData {
  date: string;      // YYYY-MM-DD format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Date Formatting
- **Internal Storage**: `YYYY-MM-DD` (e.g., "2024-11-09")
- **Chart Display**: `MMM DD, YY` (e.g., "Nov 09, 24")

```typescript
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: '2-digit' 
  });
};
```

## Usage Example

### Changing Date Range Programmatically
```typescript
// In Index.tsx or parent component
const [dateRange, setDateRange] = useState("1mo");

// Change to 6 months
setDateRange("6mo");

// This automatically:
// 1. Triggers useStockHistorical refetch
// 2. Updates priceData useMemo
// 3. Re-renders PriceChart with new data
// 4. Passes new data to TechnicalAnalysisDashboard
// 5. Recalculates all active technical indicators
```

### User Interaction Flow
1. User clicks "6M" button in PriceChart
2. `onRangeChange("6mo")` callback fires
3. Index.tsx updates `dateRange` state to "6mo"
4. `useStockHistorical` hook detects query key change
5. Edge Function called with `{ symbol: "AAPL", range: "6mo" }`
6. API returns 6 months of daily OHLCV data
7. `priceData` useMemo recalculates with new data
8. PriceChart receives updated `simplePriceData`
9. TechnicalAnalysisDashboard receives updated `priceData`
10. All selected indicators recalculate in `indicatorData` useMemo
11. All chart components re-render with new calculations

## Performance Optimizations

### 1. React Query Caching
- Queries cached by `[symbol, range]` key
- 5-minute staleTime prevents redundant API calls
- Background refetching keeps data fresh

### 2. useMemo Dependencies
```typescript
// Index.tsx - Only recalculates when historicalData changes
const priceData = useMemo(() => {
  // Transform and format data
}, [historicalData]);

// TechnicalAnalysisDashboard - Only recalculates when data or selections change
const indicatorData = useMemo(() => {
  // Calculate indicators
}, [data, selectedIndicators]);
```

### 3. Conditional Calculation
Only selected indicators are calculated:
```typescript
const rsi = selectedIndicators.rsi ? calculateRSI(closes, 14) : [];
const macd = selectedIndicators.macd ? calculateMACD(closes, 12, 26, 9) : null;
```

### 4. API Fallback Strategy
Three-tier fallback ensures data availability:
1. Marketstack (paid, most reliable)
2. Yahoo Finance (free, no API key)
3. Polygon.io (paid, backup)

## Environment Variables Required

### Supabase
```bash
VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### API Keys (Optional, for Edge Functions)
```bash
MARKETSTACK_API_KEY=your_marketstack_key  # Primary source
POLYGON_API_KEY=your_polygon_key          # Fallback
```

**Note:** Yahoo Finance requires no API key and serves as a free fallback.

## Testing Checklist

### Date Range Functionality
- [ ] Click each time range button (1D, 5D, 1M, 3M, 6M, 1Y, 5Y)
- [ ] Verify main price chart updates with correct data range
- [ ] Verify all selected technical indicators update
- [ ] Check that button highlighting shows correct selected range
- [ ] Test rapid button clicking (should debounce correctly)

### Technical Indicators
- [ ] Enable/disable each indicator in selector
- [ ] Verify calculations appear correct for different date ranges
- [ ] Test with 1D data (should show intraday if available)
- [ ] Test with 5Y data (should show long-term trends)
- [ ] Check that date formatting is consistent across all charts

### API Integration
- [ ] Verify Edge Functions return data for various symbols
- [ ] Test error handling for invalid symbols
- [ ] Check fallback behavior if primary API fails
- [ ] Verify cache behavior (repeated requests should be fast)

### Performance
- [ ] Monitor network tab for duplicate requests
- [ ] Verify React Query cache is working
- [ ] Check that only selected indicators calculate
- [ ] Test with multiple rapid symbol/range changes

## Troubleshooting

### Issue: Date Range Buttons Not Working
**Symptoms:** Clicking buttons doesn't update charts
**Check:**
1. PriceChart receives `selectedRange` and `onRangeChange` props
2. Index.tsx has `dateRange` state and `handleDateRangeChange` function
3. useStockHistorical hook receives `dateRange` as second parameter
4. React Query devtools show query key updates

### Issue: Technical Indicators Not Updating
**Symptoms:** Indicators show old data after range change
**Check:**
1. TechnicalAnalysisDashboard receives `data` prop from Index.tsx
2. `priceData` useMemo in Index.tsx depends on `historicalData`
3. `indicatorData` useMemo in Dashboard depends on `data` prop
4. Console logs show new data arriving from API

### Issue: API Errors
**Symptoms:** "No data available" or network errors
**Check:**
1. Supabase Edge Functions are deployed (run `supabase functions list`)
2. Environment variables are set correctly
3. API keys are valid (if using Marketstack/Polygon)
4. Symbol is valid (test with known symbols like AAPL, TSLA, MSFT)
5. Network tab shows successful requests to Supabase functions

### Issue: Wrong Date Range Returned
**Symptoms:** Data doesn't match selected range
**Check:**
1. Range mapping in PriceChart: `rangeMap[range]` converts display to API format
2. Edge Function receives correct range parameter
3. API source supports requested range (some free tiers limit history)
4. Weekend/holiday data gaps are expected

## Future Enhancements

### Potential Improvements
1. **Intraday Data Support**: Implement proper 1D range with minute-level data
2. **Custom Date Ranges**: Add date picker for specific start/end dates
3. **Indicator Presets**: Save/load common indicator combinations
4. **Export Functionality**: Download chart data as CSV
5. **Comparison Mode**: Overlay multiple symbols on same chart
6. **Real-time Updates**: WebSocket for live price updates
7. **Advanced Caching**: Store historical data in Supabase database for faster loads
8. **Mobile Optimization**: Touch-friendly date range selector

### Upcoming Features (From Roadmap)
- AI-powered pattern recognition
- Automated trading signals
- Portfolio backtesting with historical data
- Alerts based on technical indicator crossovers
- Multi-timeframe analysis (MTF indicators)

## Related Documentation
- [API Integration](./API_INTEGRATION.md)
- [Stock API Implementation](./STOCK_API_IMPLEMENTATION.md)
- [Supabase Setup](./SUPABASE_SETUP.md)
- [KDJ Implementation](./KDJ_IMPLEMENTATION.md)
- [Indicator Comparison](./INDICATOR_COMPARISON.md)

## Version History
- **v1.0** (2025-11-09): Initial implementation with date range selection
  - Added state management in Index.tsx
  - Connected PriceChart buttons to API
  - Verified all 17 indicators update correctly
  - Confirmed Edge Functions deployed and working
