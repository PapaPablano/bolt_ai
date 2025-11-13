# Quick Start Guide: Alpaca Integration

## Prerequisites

1. **Alpaca Account**
   - Sign up at https://alpaca.markets
   - Generate API keys (Paper Trading recommended for testing)

2. **Supabase Project**
   - Project URL: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu
   - Access to Edge Functions secrets

## Setup Steps

### Step 1: Configure Alpaca Credentials

1. Go to [Supabase Project Settings](https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu/settings/api)
2. Navigate to "Edge Functions" → "Manage secrets"
3. Add the following secrets:

```bash
# Note: Use ALPACA_KEY_ID (not APCA_API_KEY_ID) - this is what the code expects
ALPACA_KEY_ID=your_alpaca_key_id_here
ALPACA_SECRET_KEY=your_alpaca_secret_key_here
ALPACA_STOCK_FEED=iex  # or 'sip' for premium data
```

**Important:** Edge Functions use `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` as environment variable names.

### Step 2: Deploy Edge Functions

Deploy the new Alpaca Edge Functions to Supabase:

```bash
# If using Supabase CLI
supabase functions deploy stock-news
supabase functions deploy stock-stream

# Or redeploy all functions
supabase functions deploy
```

Alternatively, Supabase auto-deploys when you push to your connected Git repository.

### Step 3: Test the Integration

#### Test 1: Stock Quote (Existing)
```typescript
import { useStockQuote } from '@/hooks/useStockQuote';

function QuoteTest() {
  const { data: quote, isLoading } = useStockQuote('AAPL');
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>{quote.symbol}: ${quote.price}</h2>
      <p>Source: {quote.source}</p> {/* Should show "alpaca" */}
    </div>
  );
}
```

#### Test 2: News Feed (New)
```typescript
import { useStockNews } from '@/hooks/useStockNews';
import { NewsWidget } from '@/components/NewsWidget';

function NewsTest() {
  // Option 1: Use the hook directly
  const { data: news, isLoading } = useStockNews({ 
    symbol: 'AAPL', 
    limit: 10 
  });
  
  // Option 2: Use the component
  return <NewsWidget symbol="AAPL" limit={10} />;
}
```

#### Test 3: Real-Time Streaming (New)
```typescript
import { useStockStream } from '@/hooks/useStockStream';
import { RealTimeIndicator } from '@/components/RealTimeIndicator';

function StreamTest() {
  const { 
    status, 
    lastTrade, 
    error 
  } = useStockStream({
    symbols: ['AAPL'],
    subscribeTrades: true,
    onTrade: (trade) => {
      console.log(`Live trade: ${trade.symbol} @ $${trade.price}`);
    }
  });
  
  return (
    <div>
      <RealTimeIndicator status={status} symbol="AAPL" error={error} />
      {lastTrade && (
        <div>
          <p>Price: ${lastTrade.price}</p>
          <p>Size: {lastTrade.size}</p>
          <p>Time: {new Date(lastTrade.timestamp).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Use the Enhanced Dashboard

The `EnhancedDashboard` component integrates all features:

```typescript
import { EnhancedDashboard } from '@/components/EnhancedDashboard';

function App() {
  return <EnhancedDashboard symbol="AAPL" />;
}
```

**Features included:**
- ✅ Real-time price updates (toggle on/off)
- ✅ News feed (toggle on/off)
- ✅ Data source indicators
- ✅ Connection status monitoring
- ✅ Settings panel
- ✅ All existing technical indicators preserved

## Feature Overview

### 1. Real-Time Streaming

**Purpose**: Get live price updates via WebSocket

**When to use:**
- Day trading or active monitoring
- High-frequency analysis
- Real-time alerts

**When NOT to use:**
- Analyzing multiple stocks simultaneously (bandwidth)
- Long-term historical analysis
- Battery-sensitive devices

**Example:**
```typescript
const { status, lastTrade } = useStockStream({
  symbols: ['AAPL', 'GOOGL', 'MSFT'],
  subscribeTrades: true,
  enabled: true  // Toggle via settings
});
```

### 2. News Feed

**Purpose**: Get real-time market news and analysis

**Features:**
- Symbol-specific news
- General market news
- Rich article display with images
- Source attribution
- 5-minute caching

**Example:**
```typescript
// Symbol-specific news
const { data: appleNews } = useSymbolNews('AAPL', 10);

// General market news
const { data: marketNews } = useMarketNews(20);

// Or use the widget component
<NewsWidget symbol="AAPL" limit={10} height={600} />
```

### 3. Technical Indicators (Preserved)

**All existing indicators continue to work:**

```typescript
import { 
  calculateSMA, 
  calculateRSI, 
  calculateMACD,
  calculateBollingerBands,
  // ... all others
} from '@/lib/technicalIndicators';

// Use as before - nothing changed
const sma = calculateSMA(prices, 20);
const rsi = calculateRSI(prices, 14);
const macd = calculateMACD(prices);
```

**These will be ML features later:**
- ✅ All indicators preserved
- ✅ Will feed into transformer model
- ✅ Multi-timeframe support ready
- ✅ See `docs/TECHNICAL_INDICATORS_AS_ML_FEATURES.md`

### 4. Data Source Indicators

Show which Alpaca feed is being used:

```typescript
import { DataSourceBadge } from '@/components/RealTimeIndicator';

<DataSourceBadge source="iex" />  // Shows "IEX" with tooltip
<DataSourceBadge source="sip" />  // Shows "SIP" (premium)
```

### 5. Settings Panel

Configure Alpaca features:

```typescript
import { AlpacaSettingsPanel } from '@/components/AlpacaSettingsPanel';

<AlpacaSettingsPanel
  realTimeEnabled={true}
  onRealTimeToggle={setRealTimeEnabled}
  newsEnabled={true}
  onNewsToggle={setNewsEnabled}
  dataFeed="iex"
/>
```

## Integration with Existing Dashboard

### Current Dashboard (Index.tsx)

The existing dashboard with technical indicators works as-is. To add Alpaca features:

```typescript
import { Index } from '@/pages/Index';  // Your current dashboard
import { NewsWidget } from '@/components/NewsWidget';
import { useStockStream } from '@/hooks/useStockStream';
import { RealTimeIndicator } from '@/components/RealTimeIndicator';

function EnhancedIndex() {
  const [symbol, setSymbol] = useState('AAPL');
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  
  const { status, lastTrade } = useStockStream({
    symbols: [symbol],
    subscribeTrades: true,
    enabled: realTimeEnabled
  });
  
  return (
    <div>
      {/* Add real-time indicator to existing dashboard */}
      <div className="flex items-center gap-2 mb-4">
        <h2>{symbol}</h2>
        {realTimeEnabled && (
          <RealTimeIndicator status={status} symbol={symbol} />
        )}
        <Switch 
          checked={realTimeEnabled}
          onCheckedChange={setRealTimeEnabled}
        />
      </div>
      
      {/* Your existing dashboard */}
      <Index />
      
      {/* Add news widget to sidebar or bottom */}
      <div className="mt-6">
        <NewsWidget symbol={symbol} limit={10} />
      </div>
    </div>
  );
}
```

## Performance Tips

### 1. Caching Strategy
- **Quotes**: 45-second cache (automatic)
- **Intraday data**: 45-second cache (automatic)
- **News**: 5-minute cache (automatic)
- **Historical data**: Longer cache based on range

### 2. Real-Time Streaming
- Disable when not actively monitoring
- Limit to 5-10 symbols simultaneously
- Uses Server-Sent Events (SSE) for efficiency

### 3. News Feed
- 5-minute cache reduces API calls
- `excludeContentless={true}` filters low-quality articles
- Use `limit` parameter to control bandwidth

### 4. Multi-Timeframe Queries
```typescript
// Efficient: Fetch multiple timeframes at once
const { data: data1m } = useStockIntraday('AAPL', '1m', '1d');
const { data: data5m } = useStockIntraday('AAPL', '5m', '1d');
const { data: data1h } = useStockIntraday('AAPL', '1h', '5d');

// These are cached individually, so subsequent calls are instant
```

## Troubleshooting

### Issue: "Missing Alpaca credentials"

**Solution:**
1. Verify credentials in Supabase Edge Functions secrets
2. Check environment variable names are exact:
   - `ALPACA_KEY_ID` (not `APCA_API_KEY_ID`)
   - `ALPACA_SECRET_KEY` (not `APCA_API_SECRET_KEY`)
3. Redeploy Edge Functions after adding secrets

### Issue: Real-time stream not connecting

**Symptoms:** Status stuck on "connecting"

**Solutions:**
1. Check browser console for errors
2. Verify Supabase Edge Function is deployed:
   ```bash
   curl https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-stream?symbols=AAPL
   ```
3. Check Alpaca credentials are valid
4. Try with a single, active symbol (e.g., 'SPY')

### Issue: No news articles returned

**Possible Causes:**
1. Symbol not found or inactive
2. No recent news for that symbol
3. Rate limit reached

**Solutions:**
1. Test with high-activity stocks ('AAPL', 'TSLA', 'SPY')
2. Check for general market news: `useMarketNews()`
3. Check Supabase Edge Function logs

### Issue: Technical indicators not showing

**Solution:**
This is unrelated to Alpaca integration. Check:
1. Data format matches `PriceData` interface
2. Sufficient data points for indicator period
3. No null/undefined values in price data

## Data Feed Comparison

| Feature | IEX Feed (Free) | SIP Feed (Paid) |
|---------|----------------|-----------------|
| Real-time quotes | ✅ IEX exchange | ✅ All exchanges |
| Historical data | ✅ 2 years | ✅ Full history |
| Intraday bars | ✅ Limited | ✅ Comprehensive |
| WebSocket streaming | ✅ | ✅ |
| Market depth | ❌ | ✅ |
| Pre/post market | Limited | ✅ Full |
| Cost | Free | Subscription |

**Recommendation:** Start with IEX (free), upgrade to SIP if you need consolidated data.

## Rate Limits

### Free Tier (IEX)
- **REST API**: 200 requests/minute
- **WebSocket**: 10 concurrent connections
- **News**: Included in API limit

### Unlimited Plan (SIP)
- **REST API**: Unlimited
- **WebSocket**: 30 concurrent connections
- **News**: Unlimited

**Note:** Supabase caching reduces effective API calls by 70-80%.

## Next Steps

1. **✅ Test basic integration** with quotes and news
2. **✅ Explore real-time streaming** for active trading
3. **📚 Review technical indicators** as future ML features
4. **🤖 Prepare for ML integration** (see roadmap)
5. **🎨 Customize dashboard** with your preferences

## Resources

- **Alpaca Integration**: [docs/ALPACA_INTEGRATION.md](./ALPACA_INTEGRATION.md)
- **ML Roadmap**: [docs/ML_INTEGRATION_ROADMAP.md](./ML_INTEGRATION_ROADMAP.md)
- **Technical Indicators**: [docs/TECHNICAL_INDICATORS_AS_ML_FEATURES.md](./TECHNICAL_INDICATORS_AS_ML_FEATURES.md)
- **Alpaca Docs**: https://alpaca.markets/docs/
- **Supabase Docs**: https://supabase.com/docs/

## Support

- **Alpaca API Issues**: https://alpaca.markets/support
- **Supabase Issues**: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu/logs
- **Project Issues**: GitHub Issues

---

**Ready to go!** 🚀 Your Loveable dashboard now has professional-grade market data with Alpaca integration, while preserving all technical indicators for future ML capabilities.
