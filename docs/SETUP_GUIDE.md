# Setup Guide for Dashboard Optimization

## What Was Changed

### 1. Environment Configuration Fixed ✅
**Problem**: The `.env` file was pointing to the wrong Supabase project.
- **Before**: `https://kmiqdnpjjajnewkuyqfi.supabase.co` (old project)
- **After**: `https://iwwdxshzrxilpzehymeu.supabase.co` (correct project with Alpaca functions)

**Impact**: The application now connects to the Supabase project where your Alpaca Edge Functions are deployed.

### 2. Dashboard Layout Optimized ✅
**New Layout Structure**:
```
┌─────────────────────────────────────────────┐
│  Watchlist (3 featured stocks in grid)     │
├─────────────────────────────────────────────┤
│  Selected Stock Header + Key Metrics       │
├──────────────────────┬─────────────────────┤
│  Main Chart (2/3)    │  News Feed (1/3)    │
│  - Multiple timeframe│  - Real-time news   │
│  - Candle intervals  │  - Scrollable       │
│  - Interactive Plotly│  - Symbol-specific  │
└──────────────────────┴─────────────────────┘
│  Technical Indicators Dashboard            │
└─────────────────────────────────────────────┘
```

**Benefits**:
- ✅ News is always visible alongside the chart
- ✅ Better use of screen space
- ✅ Responsive on all devices (mobile, tablet, desktop)
- ✅ More professional trading dashboard feel

### 3. Multiple Data Source Support ✅
The chart now properly handles:
- **Alpaca Market Data API** (primary source)
- **Supabase Edge Functions** (caching + security)
- **Automatic Fallback** (if intraday data unavailable)

### 4. Dynamic Timeframe Support ✅
- Chart supports: 10m, 1h, 4h, 1d intervals
- Date ranges: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y
- Smart data fetching for indicator calculations
- Auto-fallback to daily data if premium features unavailable

## Next Steps to Complete Setup

### Step 1: Verify Alpaca Credentials
The Edge Functions need valid Alpaca API credentials. Check if they're set:

```bash
# Using Supabase CLI
supabase secrets list --project-ref iwwdxshzrxilpzehymeu
```

Expected output should show:
- `APCA_API_KEY_ID`
- `APCA_API_SECRET_KEY`
- `ALPACA_STOCK_FEED`

### Step 2: Set/Update Alpaca Credentials (if needed)
If credentials are missing or invalid:

```bash
# Set new credentials
supabase secrets set --project-ref iwwdxshzrxilpzehymeu \
  APCA_API_KEY_ID=your_new_key_id \
  APCA_API_SECRET_KEY=your_new_secret_key \
  ALPACA_STOCK_FEED=iex
```

**Where to get credentials**:
1. Sign up at [Alpaca Markets](https://alpaca.markets)
2. Go to your dashboard
3. Generate new API keys
4. Use "Paper Trading" keys for testing (free)
5. Use "Live Trading" keys for production (requires account funding)

### Step 3: Redeploy Edge Functions
After updating credentials, redeploy the functions:

```bash
supabase functions deploy stock-quote stock-news stock-stream \
  --project-ref iwwdxshzrxilpzehymeu
```

### Step 4: Test the Application

#### Run Locally
```bash
npm install
npm run dev
```

Visit `http://localhost:5173` and verify:
- ✅ Stock quotes load
- ✅ Chart displays with data
- ✅ News feed shows articles
- ✅ Timeframe buttons work
- ✅ No console errors

#### Test API Endpoints Directly
```bash
# Test stock quote
curl -s \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"symbol":"AAPL"}' \
  https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-quote

# Test news feed
curl -s \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"symbol":"AAPL","limit":5}' \
  https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-news
```

Replace `YOUR_ANON_KEY` with the value from `.env` (`VITE_SUPABASE_ANON_KEY`).

### Step 5: Deploy to Production
Once everything works locally:

```bash
# Build for production
npm run build

# Deploy using your preferred method:
# - Lovable.dev (automatic via git push)
# - Vercel, Netlify, or other hosting
# - Or follow your existing deployment process
```

## Troubleshooting

### Issue: News Widget Shows "Failed to load news"
**Cause**: Invalid Alpaca credentials or missing secrets

**Solution**:
1. Check Supabase secrets (Step 1 above)
2. Verify credentials at Alpaca dashboard
3. Regenerate keys if needed
4. Redeploy Edge Functions (Step 3 above)

### Issue: Chart Shows "Intraday data unavailable"
**Cause**: Alpaca free tier only supports daily data

**Solution**:
- This is expected behavior with free IEX feed
- Upgrade to SIP feed for intraday data
- Or use daily (1d) interval which works on all plans

**To upgrade**:
```bash
supabase secrets set --project-ref iwwdxshzrxilpzehymeu \
  ALPACA_STOCK_FEED=sip
```

### Issue: Console Shows 401/403 Errors
**Cause**: Credentials not properly set or expired

**Solution**:
1. Check if `.env` has correct Supabase URL and keys
2. Verify Alpaca keys are active (not expired)
3. Check browser's Network tab for actual error message
4. Clear browser cache and reload

### Issue: Layout Looks Broken
**Cause**: CSS not loading or browser cache issue

**Solution**:
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check console for CSS loading errors
4. Verify build completed successfully (`npm run build`)

## Understanding the Data Flow

```
User Browser
    ↓
React App (.env config)
    ↓
Supabase Client (authentication)
    ↓
Supabase Edge Functions (iwwdxshzrxilpzehymeu)
    ├─ stock-quote (45-second cache)
    ├─ stock-news (real-time)
    └─ stock-stream (WebSocket)
    ↓
Alpaca Market Data API
    └─ Returns: Quotes, Historical, News
```

**Caching Strategy**:
- Quotes: 45 seconds (via Supabase `stock_cache` table)
- News: Fresh on every request
- Historical: Cached per symbol/interval

## File Structure Reference

```
stock-whisperer-ai-04/
├── .env                          # ✅ Updated config
├── src/
│   ├── pages/
│   │   └── Index.tsx            # ✅ Updated layout
│   ├── components/
│   │   ├── NewsWidget.tsx       # Used in sidebar
│   │   ├── PlotlyPriceChart.tsx # Main chart
│   │   └── ...
│   ├── hooks/
│   │   ├── useStockQuote.ts     # Quote data
│   │   ├── useStockNews.ts      # News feed
│   │   └── ...
│   └── integrations/
│       └── supabase/
│           └── client.ts         # Reads .env config
├── supabase/
│   └── functions/
│       ├── stock-quote/
│       ├── stock-news/
│       └── stock-stream/
└── docs/
    ├── DASHBOARD_LAYOUT.md      # ✅ New documentation
    ├── LAYOUT_VISUAL.md         # ✅ Visual diagrams
    ├── SETUP_GUIDE.md           # ✅ This file
    └── ALPACA_INTEGRATION.md    # Existing guide
```

## Resources

- **Supabase Dashboard**: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu
- **Alpaca Dashboard**: https://app.alpaca.markets
- **Lovable Project**: https://lovable.dev/projects/b8d442c0-ec4f-413a-b76b-8817e3790e8a
- **GitHub Repo**: https://github.com/PapaPablano/stock-whisperer-ai-04

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Check Supabase logs: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu/logs/edge-functions
4. Review documentation files in `docs/` folder

## Summary

✅ **What's Working Now**:
- Correct Supabase project configuration
- Optimized dashboard layout
- News widget integration
- Multiple data source support
- Dynamic timeframe support

⏳ **What Needs Valid Credentials**:
- Real-time stock quotes
- News feed data
- Intraday chart data
- WebSocket streaming

Once you configure valid Alpaca credentials, all features will work end-to-end!
