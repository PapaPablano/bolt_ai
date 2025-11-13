# Technical Indicators Data Requirements Analysis

## Problem Statement
Technical indicators need varying amounts of historical data to calculate properly. Currently, we're only fetching data for the selected timeframe (e.g., 23 days for 1 month), but indicators like SMA 200 need at least 200 days of historical data.

## Data Requirements by Indicator

### Trend Indicators
| Indicator | Period | Minimum Data Points | Notes |
|-----------|--------|---------------------|-------|
| SMA 20    | 20     | 20                 | Need 20 days before first calculation |
| SMA 50    | 50     | 50                 | Need 50 days before first calculation |
| SMA 200   | 200    | 200                | **CRITICAL: Need 200 days!** |
| EMA 12    | 12     | 12                 | Need 12 days before first calculation |
| EMA 26    | 26     | 26                 | Need 26 days before first calculation |
| EMA 50    | 50     | 50                 | Need 50 days before first calculation |
| Bollinger Bands | 20 | 20             | Uses SMA 20 as basis |
| Keltner Channel | 20 | 20-34          | Uses EMA 20 + ATR (14) |

### Momentum Indicators
| Indicator | Period | Minimum Data Points | Notes |
|-----------|--------|---------------------|-------|
| RSI       | 14     | 15                 | Need period + 1 for changes |
| MACD      | 26     | 34                 | Uses EMA 26 (slowest) + signal (9) |
| Stochastic| 14     | 14-17              | 14-period + 3-period smoothing |
| KDJ       | 9      | 12                 | 9-period + 3-period smoothing |
| ADX       | 14     | 28                 | Need 2x period for smoothing |

### Volume Indicators
| Indicator | Period | Minimum Data Points | Notes |
|-----------|--------|---------------------|-------|
| OBV       | N/A    | 1                  | Cumulative, needs all history |
| VROC      | 14     | 15                 | Volume rate of change |
| MFI       | 14     | 15                 | Money Flow Index |

### Volatility Indicators
| Indicator | Period | Minimum Data Points | Notes |
|-----------|--------|---------------------|-------|
| ATR       | 14     | 15                 | Average True Range |

## Current Fetch Strategy (PROBLEMATIC)

### API Calls by Selected Range
```typescript
switch(dateRange) {
  case '1d':   fetch 1 day      → Only 1 data point
  case '5d':   fetch 5 days     → Only 5 data points
  case '1mo':  fetch 30 days    → Only 23 data points (trading days)
  case '3mo':  fetch 90 days    → Only ~66 data points
  case '6mo':  fetch 180 days   → Only ~128 data points
  case '1y':   fetch 365 days   → Only ~252 data points
  case '5y':   fetch 1825 days  → ~1300 data points
}
```

### Problem Examples

**Scenario 1: User selects "1 month"**
- API fetches: 23 days
- SMA 20: ✅ Can calculate (needs 20)
- SMA 50: ❌ Can't calculate (needs 50, only have 23)
- SMA 200: ❌ Can't calculate (needs 200, only have 23)
- Result: Most moving averages show NO DATA

**Scenario 2: User selects "3 months"**
- API fetches: ~66 days
- SMA 50: ✅ Can calculate
- SMA 200: ❌ Can't calculate (needs 200, only have 66)
- Result: SMA 200 shows NO DATA

**Scenario 3: User selects "6 months"**
- API fetches: ~128 days
- SMA 200: ❌ Can't calculate (needs 200, only have 128)
- Result: SMA 200 STILL shows NO DATA

## Proposed Solution: Two-Tier Data Fetching

### Strategy 1: Always Fetch Sufficient Data (RECOMMENDED)

```typescript
// Always fetch enough data for the longest indicator (SMA 200)
// Then filter for display based on selected range

const MINIMUM_DATA_NEEDED = 250; // 200 + 50 buffer

// Fetch sufficient data for calculations
const calculationRange = determineCalculationRange(dateRange);
const { data: allData } = useStockHistorical(symbol, calculationRange);

// Filter data for display based on selected range
const displayData = filterDataByRange(allData, dateRange);
```

### Calculation Range Mapping
```typescript
const getCalculationRange = (displayRange: string): string => {
  // For short ranges, fetch extra data for indicators
  switch(displayRange) {
    case '1d':
    case '5d':
    case '1mo':
      return '1y';  // Fetch 1 year to calculate all indicators
    case '3mo':
      return '1y';  // Fetch 1 year
    case '6mo':
      return '1y';  // Fetch 1 year
    case '1y':
      return '2y';  // Fetch 2 years (for warmup period)
    case '5y':
      return '5y';  // Already enough data
    default:
      return '1y';
  }
};
```

### Display Filtering
```typescript
const filterDataByDisplayRange = (
  allData: PriceData[], 
  displayRange: string
): PriceData[] => {
  if (!allData || allData.length === 0) return [];
  
  const today = new Date();
  let cutoffDate = new Date();
  
  switch(displayRange) {
    case '1d':
      cutoffDate.setDate(today.getDate() - 1);
      break;
    case '5d':
      cutoffDate.setDate(today.getDate() - 5);
      break;
    case '1mo':
      cutoffDate.setMonth(today.getMonth() - 1);
      break;
    case '3mo':
      cutoffDate.setMonth(today.getMonth() - 3);
      break;
    case '6mo':
      cutoffDate.setMonth(today.getMonth() - 6);
      break;
    case '1y':
      cutoffDate.setFullYear(today.getFullYear() - 1);
      break;
    case '5y':
      cutoffDate.setFullYear(today.getFullYear() - 5);
      break;
  }
  
  return allData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= cutoffDate;
  });
};
```

## Implementation Plan

### Phase 1: Data Fetching (High Priority)
1. ✅ Modify `Index.tsx` to fetch calculation data
2. ✅ Add display filtering logic
3. ✅ Update cache keys to prevent confusion
4. ✅ Add console logging for debugging

### Phase 2: Indicator Calculations (High Priority)
1. ✅ Pass FULL dataset to indicator calculations
2. ✅ Filter indicator results for display range
3. ✅ Handle warmup period properly

### Phase 3: Chart Display (Medium Priority)
1. ✅ Ensure charts only show display range on X-axis
2. ✅ Update tick intervals for filtered data
3. ✅ Add loading states during calculation

### Phase 4: Optimization (Low Priority)
1. ⚠️ Cache calculation data separately from display data
2. ⚠️ Implement incremental updates (append new data)
3. ⚠️ Add database storage for historical data

## Database Storage Strategy (Future Enhancement)

### PostgreSQL Schema
```sql
-- Store historical OHLCV data
CREATE TABLE stock_historical_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(15, 4) NOT NULL,
  high DECIMAL(15, 4) NOT NULL,
  low DECIMAL(15, 4) NOT NULL,
  close DECIMAL(15, 4) NOT NULL,
  volume BIGINT NOT NULL,
  source TEXT, -- 'marketstack', 'yahoo', 'polygon'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

CREATE INDEX idx_stock_hist_symbol_date ON stock_historical_data(symbol, date DESC);

-- Pre-calculated indicators (optional optimization)
CREATE TABLE stock_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  indicator_type TEXT NOT NULL, -- 'sma_20', 'rsi_14', etc.
  value DECIMAL(15, 6),
  metadata JSONB, -- For multi-value indicators like MACD
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date, indicator_type)
);
```

### Benefits of Database Storage
1. **Reduced API Calls**: Fetch once, store forever
2. **Faster Calculations**: Pre-calculated indicators
3. **Historical Consistency**: Same data across time
4. **Cost Savings**: Fewer external API requests
5. **Offline Support**: Works without external APIs

### Implementation Steps
1. Create migration for tables
2. Create Edge Function to populate historical data
3. Modify `useStockHistorical` to check DB first
4. Add background job to update daily
5. Add indicators calculation cron job

## Testing Checklist

### Test Each Range with All Indicators
```
[ ] 1D Range:
    [ ] SMA 20, 50, 200 visible?
    [ ] RSI shows values?
    [ ] MACD shows all lines?
    [ ] X-axis shows ~1 day

[ ] 5D Range:
    [ ] All SMAs visible?
    [ ] All indicators calculate?
    [ ] X-axis shows ~5 days

[ ] 1M Range:
    [ ] SMA 200 shows values? (Critical test!)
    [ ] All momentum indicators work?
    [ ] X-axis shows ~1 month

[ ] 3M Range:
    [ ] All indicators visible?
    [ ] No gaps in indicator lines?
    [ ] X-axis shows ~3 months

[ ] 6M Range:
    [ ] SMA 200 complete?
    [ ] All indicators calculating?
    [ ] X-axis shows ~6 months

[ ] 1Y Range:
    [ ] All long-term indicators work?
    [ ] Indicators have full history?
    [ ] X-axis shows ~1 year

[ ] 5Y Range:
    [ ] All indicators over full range?
    [ ] Performance acceptable?
    [ ] X-axis shows ~5 years
```

### Indicator-Specific Tests
```
[ ] SMA 20: Shows from day 20 onwards
[ ] SMA 50: Shows from day 50 onwards
[ ] SMA 200: Shows from day 200 onwards (KEY TEST)
[ ] RSI: Shows from day 15 onwards
[ ] MACD: Shows from day 34 onwards
[ ] Bollinger Bands: Shows from day 20 onwards
[ ] Stochastic: Shows from day 17 onwards
[ ] KDJ: Shows from day 12 onwards
[ ] OBV: Shows from day 1 (cumulative)
[ ] ATR: Shows from day 15 onwards
[ ] ADX: Shows from day 28 onwards
```

## Expected Console Output (After Fix)

```javascript
// User selects "1M" range
[useStockHistorical] Fetching AAPL with range: 1y  // Fetch 1 year
[useStockHistorical] Received 252 data points from yahoo
Using calculation data: 252 data points
Date range in calculation data: 2024-11-09 to 2025-11-07
Filtering display data for range: 1mo
Display data after filter: 23 data points
Date range in display data: 2025-10-08 to 2025-11-07
[TechnicalAnalysisDashboard] Received 252 data points for calculation
[TechnicalAnalysisDashboard] Displaying 23 data points
[TechnicalAnalysisDashboard] SMA 200: ✓ Calculated (200 warmup satisfied)
[TechnicalAnalysisDashboard] RSI: ✓ Calculated
[TechnicalAnalysisDashboard] MACD: ✓ Calculated
```

## Performance Considerations

### API Response Sizes
- 1 day: ~0.5 KB
- 1 month: ~5 KB
- 3 months: ~15 KB
- 6 months: ~30 KB
- 1 year: ~60 KB (⚠️ New default for short ranges)
- 5 years: ~300 KB

### Cache Strategy
```typescript
// Separate cache for calculation vs display
queryKey: ['stock-historical-calc', symbol, calculationRange]
queryKey: ['stock-historical-display', symbol, displayRange]

// Or use single key with metadata
queryKey: ['stock-historical', symbol, { calc: '1y', display: '1mo' }]
```

### Optimization Opportunities
1. **Client-side filtering**: Fetch once, filter many times
2. **IndexedDB storage**: Store 5Y data locally
3. **Service Worker**: Cache historical data
4. **Incremental updates**: Only fetch new data daily
5. **Pre-calculated indicators**: Store in database

## Rollout Plan

### Phase 1: Quick Fix (1 hour)
- Implement two-tier fetching in `Index.tsx`
- Add display filtering logic
- Test with 1M range + SMA 200

### Phase 2: Full Implementation (2-3 hours)
- Update all indicator calculations
- Add proper error handling
- Implement loading states
- Full testing across all ranges

### Phase 3: Database Integration (Future)
- Create database schema
- Implement background sync
- Add pre-calculation jobs
- Performance optimization

## Success Metrics

✅ **SMA 200 shows data on 1 month view**
✅ **All indicators calculate correctly across all ranges**
✅ **No "null" or empty indicator lines**
✅ **X-axis correctly shows selected range only**
✅ **Page load time remains under 3 seconds**
✅ **API calls reduced (with caching)**
✅ **User can switch ranges smoothly**

## Current Status
- ❌ Insufficient data for long-period indicators
- ❌ SMA 200 not working on short ranges
- ❌ Indicators showing gaps or no data
- ❌ Display range equals fetch range (incorrect)

## Target Status (After Fix)
- ✅ Always fetch sufficient data (1 year minimum)
- ✅ Calculate indicators on full dataset
- ✅ Display filtered view based on selected range
- ✅ All indicators working across all timeframes
