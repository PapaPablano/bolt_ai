# Technical Indicators Documentation

## Overview
The Stock Whisperer AI platform includes a comprehensive technical analysis system with 16 indicators across 4 categories.

## Available Indicators

### Trend Indicators (Overlays on Price Chart)
1. **SMA 20** - Simple Moving Average (20-period)
   - Default: **Enabled**
   - Color: Blue (#3b82f6)
   - Use: Identifies short-term trend direction

2. **SMA 50** - Simple Moving Average (50-period)
   - Color: Orange (#f59e0b)
   - Use: Medium-term trend confirmation

3. **SMA 200** - Simple Moving Average (200-period)
   - Color: Red (#ef4444)
   - Use: Long-term trend identification, bull/bear market definition

4. **EMA 12** - Exponential Moving Average (12-period)
   - Color: Purple (#8b5cf6)
   - Use: Fast-responding trend following

5. **EMA 26** - Exponential Moving Average (26-period)
   - Color: Pink (#ec4899)
   - Use: Used in MACD calculation

6. **EMA 50** - Exponential Moving Average (50-period)
   - Color: Indigo (#6366f1)
   - Use: Medium-term exponential trend

### Momentum Indicators (Separate Chart Panels)
7. **RSI (14)** - Relative Strength Index
   - Default: **Enabled**
   - Range: 0-100
   - Overbought: > 70 (red zone)
   - Oversold: < 30 (green zone)
   - Use: Identifies overbought/oversold conditions

8. **MACD (12, 26, 9)** - Moving Average Convergence Divergence
   - Default: **Enabled**
   - Components:
     - MACD Line (blue): EMA(12) - EMA(26)
     - Signal Line (orange): EMA(9) of MACD
     - Histogram (bars): MACD - Signal
   - Use: Trend changes, momentum shifts, buy/sell signals

9. **Stochastic (14, 3)** - Stochastic Oscillator
   - Range: 0-100
   - Overbought: > 80 (red zone)
   - Oversold: < 20 (green zone)
   - Components:
     - %K (blue): Fast stochastic
     - %D (orange): Slow stochastic (3-period SMA of %K)
   - Use: Momentum and potential reversal points

### Volatility Indicators
10. **Bollinger Bands (20, 2)** - Bollinger Bands
    - Overlay on price chart
    - Components:
      - Middle Band (green): SMA(20)
      - Upper Band (green dashed): SMA(20) + 2σ
      - Lower Band (green dashed): SMA(20) - 2σ
    - Use: Volatility, price extremes, squeeze/expansion

11. **ATR (14)** - Average True Range
    - Separate chart panel
    - Color: Red (#ef4444)
    - Use: Volatility measurement, stop-loss placement

12. **Keltner Channel (20, 10, 2)** - Keltner Channel
    - Overlay on price chart
    - Components:
      - Middle Line (cyan): EMA(20)
      - Upper Channel (cyan dashed): EMA(20) + 2×ATR(10)
      - Lower Channel (cyan dashed): EMA(20) - 2×ATR(10)
    - Use: Trend identification, breakout signals

13. **ADX (14)** - Average Directional Index
    - Separate chart panel
    - Color: Blue (#3b82f6)
    - Range: 0-100
    - Strong Trend: > 25
    - Use: Trend strength measurement

### Volume Indicators (Separate Chart Panels)
14. **OBV** - On-Balance Volume
    - Color: Green (#10b981)
    - Use: Volume flow, confirms price trends

15. **VROC (14)** - Volume Rate of Change
    - Color: Orange (#f59e0b)
    - Use: Volume momentum, identifies unusual volume

16. **MFI (14)** - Money Flow Index
    - Color: Purple (#8b5cf6)
    - Range: 0-100
    - Overbought: > 80
    - Oversold: < 20
    - Use: Volume-weighted RSI, buying/selling pressure

## Usage

### Component Integration
```tsx
import { TechnicalAnalysisDashboard } from '@/components/TechnicalAnalysisDashboard';

<TechnicalAnalysisDashboard
  symbol="AAPL"
  data={priceData} // Array of PriceData objects
/>
```

### Default Configuration
By default, the following indicators are enabled:
- SMA 20 (trend overlay)
- RSI (momentum)
- MACD (momentum)

### Custom Configuration
```tsx
const [indicators, setIndicators] = useState<IndicatorConfig>({
  // Trend
  sma20: true,
  sma50: true,
  sma200: false,
  ema12: false,
  ema26: false,
  ema50: false,
  
  // Momentum
  rsi: true,
  macd: true,
  stochastic: true,
  
  // Volatility
  bollingerBands: true,
  atr: false,
  keltnerChannel: false,
  adx: false,
  
  // Volume
  obv: false,
  vroc: false,
  mfi: false,
});

<IndicatorSelector
  selectedIndicators={indicators}
  onChange={setIndicators}
/>
```

## Calculation Details

### RSI Formula
```
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```

### MACD Formula
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line - Signal Line
```

### Bollinger Bands Formula
```
Middle Band = SMA(20)
Upper Band = SMA(20) + (2 × σ)
Lower Band = SMA(20) - (2 × σ)
```

### Stochastic Formula
```
%K = ((Current Close - Lowest Low(14)) / (Highest High(14) - Lowest Low(14))) × 100
%D = SMA(3) of %K
```

### Money Flow Index Formula
```
Typical Price = (High + Low + Close) / 3
Money Flow = Typical Price × Volume
MFI = 100 - (100 / (1 + (Positive MF / Negative MF)))
```

## Performance Notes

- All indicators use `useMemo` for calculation caching
- Calculations are optimized for real-time updates
- Large datasets (>1000 points) may cause slight delays
- Consider using time-based data filtering for better performance

## Trading Strategies

### Trend Following
- Enable: SMA 20, SMA 50, SMA 200
- Buy: Price crosses above SMA 50
- Sell: Price crosses below SMA 50

### Momentum Trading
- Enable: RSI, MACD, Stochastic
- Buy: RSI < 30, MACD crossover up, Stochastic < 20
- Sell: RSI > 70, MACD crossover down, Stochastic > 80

### Volatility Breakout
- Enable: Bollinger Bands, ATR, Keltner Channel
- Buy: Price breaks above upper band with high ATR
- Sell: Price returns inside bands

### Volume Confirmation
- Enable: OBV, MFI, VROC
- Confirm trends with rising OBV
- Divergences signal potential reversals
- High VROC indicates strong conviction

## Future Enhancements
- [ ] Indicator presets (Momentum Trader, Trend Follower, etc.)
- [ ] Alert conditions based on indicator values
- [ ] Custom parameter configuration
- [ ] Additional indicators (Ichimoku, Fibonacci, Williams %R)
- [ ] Multi-timeframe analysis
- [ ] Indicator backtesting results
