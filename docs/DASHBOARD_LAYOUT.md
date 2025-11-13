# Dashboard Layout Optimization

## Overview
This document describes the optimized dashboard layout for the Stock Whisperer AI application, designed to provide better visual organization and support for multiple data sources and dynamic timeframes.

## Layout Structure

### 1. **Market Overview (Watchlist)**
Located at the top of the dashboard, featuring a responsive grid of stock cards:
- **Desktop**: 3 columns (lg:grid-cols-3)
- **Tablet**: 2 columns (md:grid-cols-2)
- **Mobile**: 1 column (grid-cols-1)
- Displays featured stocks with real-time price updates
- Click any stock card to view detailed analysis

### 2. **Selected Stock Header**
Shows key information about the currently selected stock:
- Stock symbol and company name
- Current price with color-coded change indicator
- Real-time badges for loading states
- Debug information showing data range and point count

### 3. **Key Metrics Grid**
Responsive grid displaying important stock metrics:
- **Desktop**: 6 columns (lg:grid-cols-6)
- **Tablet**: 3 columns (md:grid-cols-3)
- **Mobile**: 2 columns (grid-cols-2)
- Metrics include: Last Price, Day Range, 52W Range, Volume, Avg Volume, Previous Close
- Each metric card shows trend indicators (up/down/neutral)

### 4. **Main Chart & News Section (Split Layout)**
Optimized two-panel layout for maximum information density:

#### Left Panel: Price Chart (2/3 width)
- **Desktop**: 2 columns (lg:col-span-2)
- **Mobile**: Full width, stacks above news
- Features:
  - Multiple timeframe buttons (1D, 5D, 1M, 3M, 6M, 1Y, 5Y)
  - Candle interval options (10m, 1h, 4h, 1d)
  - SuperTrend AI indicators
  - Interactive Plotly chart with zoom/pan
  - Real-time data source badges
  - Error handling for intraday data limitations

#### Right Panel: News Widget (1/3 width)
- **Desktop**: 1 column (lg:col-span-1)
- **Mobile**: Full width, stacks below chart
- Features:
  - Symbol-specific news feed
  - Scrollable list with 10 articles
  - Article metadata (time, source, related symbols)
  - External link icons
  - Cached data indicators
  - 740px fixed height for consistent viewing

### 5. **Technical Analysis Dashboard**
Full-width section displaying technical indicators:
- Selectable indicators (Moving Averages, Bollinger Bands, RSI, MACD, etc.)
- SuperTrend AI integration
- Separate display and calculation data ranges
- Responsive chart layouts

## Data Source Support

### Multiple Data Sources
The dashboard intelligently handles data from various sources:

1. **Alpaca Market Data API** (Primary)
   - Real-time stock quotes (IEX or SIP feeds)
   - Historical OHLCV data
   - WebSocket streaming for live updates
   - Real-time market news feed

2. **Supabase Edge Functions**
   - Smart caching layer (45-second cache)
   - Secure API key management
   - Low-latency edge computing

3. **Fallback Mechanisms**
   - Automatic fallback to daily data if intraday unavailable
   - Error handling with user-friendly messages
   - Loading states for all data fetches

### Dynamic Timeframe Support

#### Chart Intervals
The chart supports multiple timeframes with intelligent data fetching:
- **Intraday**: 10m, 1h, 4h (requires premium data)
- **Daily**: 1d (always available)
- **Auto-fallback**: Switches to daily if intraday unavailable

#### Date Ranges
Smart data fetching based on display range:
- Display ranges: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y
- Calculation range automatically adjusts for indicator accuracy
- For short display ranges, fetches 1 year of data for proper indicator calculations
- Prevents warm-up issues with long-period indicators (e.g., SMA 200)

#### Data Optimization
```typescript
// Example: Display vs Calculation ranges
Display: 1M → Fetch: 1Y (for indicator calculations)
Display: 3M → Fetch: 1Y
Display: 1Y → Fetch: 2Y (with warmup period)
```

## Configuration

### Environment Variables
The dashboard uses the following configuration from `.env`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL="https://iwwdxshzrxilpzehymeu.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_PROJECT_ID="iwwdxshzrxilpzehymeu"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Feature Flags
VITE_USE_PLOTLY_CHART="true"
```

**Important**: The configuration now points to the correct Supabase project where Alpaca Edge Functions are deployed (`iwwdxshzrxilpzehymeu`).

### Alpaca Credentials
Set these in Supabase Edge Functions secrets:
```bash
APCA_API_KEY_ID=your_key_id
APCA_API_SECRET_KEY=your_secret_key
ALPACA_STOCK_FEED=iex  # or 'sip' for premium
```

## Responsive Design

### Breakpoints
- **Mobile**: < 768px (single column layout)
- **Tablet**: 768px - 1024px (2-3 column layouts)
- **Desktop**: > 1024px (full multi-column layouts)

### Grid System
Uses Tailwind CSS grid utilities for responsive layouts:
- `grid-cols-1`: Mobile default
- `md:grid-cols-2`: Tablet breakpoint
- `lg:grid-cols-3`: Desktop breakpoint

## User Experience Features

### Visual Indicators
- ✅ Real-time price updates with color coding
- ✅ Loading states with skeleton screens
- ✅ Error messages with helpful context
- ✅ Data source badges (IEX, SIP, Cached)
- ✅ Trend indicators (up/down arrows)

### Interactive Elements
- Clickable stock cards for quick symbol switching
- Timeframe buttons with active state highlighting
- Interval toggles with disabled state for unavailable options
- Scrollable news feed with external link indicators

### Performance
- Lazy loading for images in news feed
- Memoized calculations for indicators
- Efficient data filtering for display ranges
- Smart caching via Supabase

## Future Enhancements

Potential improvements for the dashboard:
1. Customizable watchlist (user-defined stocks)
2. Alert system for price movements
3. Real-time WebSocket streaming toggle
4. Multiple chart layouts (side-by-side comparison)
5. News sentiment analysis integration
6. Exportable charts and reports

## Troubleshooting

### News Widget Not Loading
- Check Supabase credentials in `.env`
- Verify Alpaca API keys in Supabase secrets
- Check browser console for API errors

### Intraday Data Unavailable
- Intraday requires premium Alpaca subscription
- Chart will auto-fallback to daily data
- Check `ALPACA_STOCK_FEED` setting (iex vs sip)

### Chart Performance Issues
- Reduce date range for better performance
- Clear browser cache
- Check network tab for slow API responses

## References
- [Alpaca Integration Guide](./ALPACA_INTEGRATION.md)
- [README](../README.md)
- [Supabase Dashboard](https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu)
