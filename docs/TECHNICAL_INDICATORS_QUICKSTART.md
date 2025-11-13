# Technical Indicators Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Import the Dashboard Component
```tsx
import { TechnicalAnalysisDashboard } from '@/components/TechnicalAnalysisDashboard';
```

### Step 2: Fetch Historical Data
```tsx
import { useStockHistorical } from '@/hooks/useStockHistorical';

const { data } = useStockHistorical('AAPL', '3mo');
```

### Step 3: Render the Dashboard
```tsx
<TechnicalAnalysisDashboard
  symbol="AAPL"
  data={data || []}
/>
```

That's it! You now have a fully functional technical analysis dashboard with 16 indicators.

## 📊 What You Get Out of the Box

### Default Configuration
When you render the dashboard, these indicators are **automatically enabled**:
- ✅ **SMA 20** - Blue line on price chart
- ✅ **RSI** - Momentum oscillator below chart
- ✅ **MACD** - Trend indicator with histogram

### All Available Indicators

#### 🔵 Trend (Overlays on Price Chart)
- SMA 20, 50, 200
- EMA 12, 26, 50

#### 🟢 Momentum (Separate Charts)
- RSI (14) - Overbought/Oversold
- MACD (12, 26, 9) - Trend changes
- Stochastic (14, 3) - Momentum reversals

#### 🟡 Volatility
- Bollinger Bands (20, 2) - Price extremes
- ATR (14) - Volatility measurement
- Keltner Channel (20, 10, 2) - Trend identification
- ADX (14) - Trend strength

#### 🟣 Volume
- OBV - Volume flow
- VROC (14) - Volume momentum
- MFI (14) - Money flow pressure

## 🎮 Interactive Controls

### Toggle Indicators
1. Look for the **indicator selector** on the left side
2. Click on any category (Trend, Momentum, Volatility, Volume)
3. Check/uncheck indicators to show/hide them
4. Charts update automatically

### View Details
- **Hover** over any chart to see exact values
- **Date, price, and indicator values** appear in tooltip
- Color-coded for easy identification

## 💡 Common Use Cases

### For Day Traders
```tsx
// Enable fast-moving indicators
Enable: EMA 12, EMA 26, RSI, Stochastic, VROC
```

### For Swing Traders
```tsx
// Enable medium-term indicators
Enable: SMA 20, SMA 50, RSI, MACD, Bollinger Bands
```

### For Long-Term Investors
```tsx
// Enable long-term trend indicators
Enable: SMA 50, SMA 200, ADX, OBV
```

## 🎯 Reading the Indicators

### RSI (Relative Strength Index)
- **< 30** = Oversold (potential buy)
- **> 70** = Overbought (potential sell)
- **30-70** = Neutral zone

### MACD
- **Histogram > 0** = Bullish momentum
- **Histogram < 0** = Bearish momentum
- **Crossover** = Signal change

### Bollinger Bands
- **Price touches upper band** = Overbought
- **Price touches lower band** = Oversold
- **Bands narrow** = Low volatility (squeeze)
- **Bands widen** = High volatility (expansion)

### Moving Averages
- **Price above MA** = Uptrend
- **Price below MA** = Downtrend
- **Golden Cross** = SMA 50 crosses above SMA 200 (bullish)
- **Death Cross** = SMA 50 crosses below SMA 200 (bearish)

## 🔧 Customization Example

```tsx
import { useState } from 'react';
import { TechnicalAnalysisDashboard } from '@/components/TechnicalAnalysisDashboard';
import { type IndicatorConfig } from '@/components/IndicatorSelector';

function MyCustomDashboard() {
  const [config, setConfig] = useState<IndicatorConfig>({
    sma20: true,
    sma50: true,
    sma200: false,
    ema12: false,
    ema26: false,
    ema50: false,
    rsi: true,
    macd: true,
    stochastic: false,
    bollingerBands: true,
    atr: false,
    keltnerChannel: false,
    adx: false,
    obv: true,
    vroc: false,
    mfi: false,
  });

  return (
    <TechnicalAnalysisDashboard
      symbol="AAPL"
      data={historicalData}
    />
  );
}
```

## 📱 Responsive Design

The dashboard automatically adapts to screen size:

- **Mobile** (< 768px): Single column, full-width charts
- **Tablet** (768px - 1024px): 2 columns, selector in sidebar
- **Desktop** (> 1024px): 4 columns, optimal layout

## ⚡ Performance Tips

1. **Limit Active Indicators**: Each indicator requires calculation
2. **Use Shorter Timeframes**: Less data = faster rendering
3. **Close Unused Panels**: Collapse indicator categories not in use

## 🐛 Troubleshooting

### No Data Showing
```tsx
// Check if data is loaded
{data ? (
  <TechnicalAnalysisDashboard symbol="AAPL" data={data} />
) : (
  <div>Loading...</div>
)}
```

### Indicators Not Calculating
```tsx
// Ensure data has required fields
type PriceData = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Charts Overlapping
```tsx
// Add spacing between sections
<div className="space-y-6">
  <TechnicalAnalysisDashboard ... />
</div>
```

## 📚 Learn More

- **Full Documentation**: `docs/TECHNICAL_INDICATORS.md`
- **Implementation Details**: `docs/PHASE_4_3_COMPLETE.md`
- **Code Examples**: `src/components/examples/TechnicalIndicatorExamples.tsx`

## 🎓 Trading Strategy Examples

### Strategy 1: RSI + MACD Confluence
1. Enable RSI and MACD
2. Wait for RSI < 30 (oversold)
3. Wait for MACD bullish crossover
4. **BUY** when both conditions met

### Strategy 2: Bollinger Band Bounce
1. Enable Bollinger Bands
2. Wait for price to touch lower band
3. Wait for RSI < 30 confirmation
4. **BUY** on reversal signal

### Strategy 3: Moving Average Crossover
1. Enable SMA 20 and SMA 50
2. **BUY** when SMA 20 crosses above SMA 50
3. **SELL** when SMA 20 crosses below SMA 50

## 💬 Need Help?

- Check examples in `/src/components/examples/TechnicalIndicatorExamples.tsx`
- Review indicator calculations in `/src/lib/technicalIndicators.ts`
- Read full documentation in `/docs/TECHNICAL_INDICATORS.md`

---

**Happy Trading! 📈**
