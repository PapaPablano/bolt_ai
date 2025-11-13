# Technical Indicators as Machine Learning Features

## Overview

This document maps the existing technical indicators in the dashboard to their role as features in the upcoming Attention-Based Multi-Timeframe Transformer model. **All current indicators will be preserved and enhanced for ML integration.**

## Current Technical Indicators (Preserved)

### Trend Indicators

#### 1. Simple Moving Average (SMA)
**Location**: `src/lib/technicalIndicators.ts::calculateSMA()`  
**Current Use**: Trend identification, support/resistance  
**ML Feature Use**: 
- Multiple periods (20, 50, 100, 200) across all timeframes
- Price relative to SMA (price - SMA) / SMA
- SMA crossovers as categorical features
- Slope of SMA (trend strength)

**Multi-Timeframe Application**:
```typescript
// For transformer model, compute across all timeframes
const features = {
  '1m_sma_20': calculateSMA(data_1m.close, 20),
  '5m_sma_20': calculateSMA(data_5m.close, 20),
  '15m_sma_20': calculateSMA(data_15m.close, 20),
  '1h_sma_20': calculateSMA(data_1h.close, 20),
  '1d_sma_20': calculateSMA(data_1d.close, 20),
  // ... more periods and timeframes
};
```

#### 2. Exponential Moving Average (EMA)
**Location**: `src/lib/technicalIndicators.ts::calculateEMA()`  
**Current Use**: Faster trend detection, MACD component  
**ML Feature Use**:
- Multiple periods (9, 12, 26, 50) for attention weighting
- EMA crossovers (golden/death cross)
- Distance from price (momentum indicator)
- Multi-timeframe EMA consensus

**Why Important for ML**: EMAs give more weight to recent prices, helping the model understand recent momentum changes.

### Momentum Indicators

#### 3. Relative Strength Index (RSI)
**Location**: `src/lib/technicalIndicators.ts::calculateRSI()`  
**Current Use**: Overbought/oversold conditions  
**ML Feature Use**:
- Raw RSI value (0-100)
- RSI divergence from price (important signal)
- RSI moving average
- Multi-timeframe RSI alignment
- RSI rate of change

**Transformer Attention**: RSI helps model learn market extremes and potential reversals.

#### 4. MACD (Moving Average Convergence Divergence)
**Location**: `src/lib/technicalIndicators.ts::calculateMACD()`  
**Current Use**: Trend strength and direction changes  
**ML Feature Use**:
- MACD line value
- Signal line value
- MACD histogram (MACD - Signal)
- Histogram slope (momentum acceleration)
- Zero-line crosses (trend changes)

**Transformer Benefit**: MACD provides both trend and momentum in one indicator, ideal for attention mechanisms.

#### 5. Stochastic Oscillator
**Location**: `src/lib/technicalIndicators.ts::calculateStochastic()`  
**Current Use**: Overbought/oversold, momentum  
**ML Feature Use**:
- %K value (fast stochastic)
- %D value (slow stochastic)
- %K and %D crossovers
- Divergence from price
- Multi-timeframe alignment

#### 6. KDJ Indicator
**Location**: `src/lib/technicalIndicators.ts::calculateKDJ()`  
**Current Use**: Enhanced stochastic with J line  
**ML Feature Use**:
- K, D, J values independently
- KDJ crossover patterns
- J line extremes (>100, <0) as strong signals
- Multi-timeframe KDJ consensus

**Special ML Value**: KDJ's J line can lead price movements, valuable for predictive models.

### Volatility Indicators

#### 7. Bollinger Bands
**Location**: `src/lib/technicalIndicators.ts::calculateBollingerBands()`  
**Current Use**: Volatility and price extremes  
**ML Feature Use**:
- Upper band, middle band (SMA), lower band
- %B: (Price - Lower) / (Upper - Lower)
- Bandwidth: (Upper - Lower) / Middle
- Price position relative to bands
- Band squeeze (low volatility) detection

**Transformer Attention**: Bollinger Bands help model understand volatility regimes, crucial for risk assessment.

#### 8. Average True Range (ATR)
**Location**: `src/lib/technicalIndicators.ts::calculateATR()`  
**Current Use**: Volatility measurement  
**ML Feature Use**:
- Raw ATR value
- ATR as % of price (normalized volatility)
- ATR percentile (current vs historical)
- ATR rate of change (volatility trend)
- Multi-timeframe ATR comparison

**Why Critical for ML**: ATR helps model adjust predictions based on market volatility conditions.

#### 9. Keltner Channel
**Location**: `src/lib/technicalIndicators.ts::calculateKeltnerChannel()`  
**Current Use**: Trend and breakout identification  
**ML Feature Use**:
- Upper/lower channel values
- Price position in channel
- Channel width (volatility)
- Breakouts above/below channel
- Keltner vs Bollinger comparison

### Volume Indicators

#### 10. On-Balance Volume (OBV)
**Location**: `src/lib/technicalIndicators.ts::calculateOBV()`  
**Current Use**: Volume flow, confirmation  
**ML Feature Use**:
- Raw OBV value
- OBV trend (rising/falling)
- OBV divergence from price (critical signal)
- OBV moving average
- Multi-timeframe OBV alignment

**ML Importance**: OBV provides volume confirmation, helping model avoid false breakouts.

#### 11. Volume Rate of Change (VROC)
**Location**: `src/lib/technicalIndicators.ts::calculateVROC()`  
**Current Use**: Volume momentum  
**ML Feature Use**:
- VROC value
- VROC extremes (unusual volume)
- VROC trend
- Volume spike detection
- Multi-timeframe volume analysis

#### 12. Money Flow Index (MFI)
**Location**: `src/lib/technicalIndicators.ts::calculateMFI()`  
**Current Use**: Volume-weighted RSI  
**ML Feature Use**:
- Raw MFI value (0-100)
- MFI divergence from price
- MFI overbought/oversold
- MFI vs RSI comparison (volume confirmation)
- Multi-timeframe MFI

**Special ML Value**: MFI combines price and volume, providing more reliable signals than RSI alone.

### Trend Strength Indicators

#### 13. Average Directional Index (ADX)
**Location**: `src/lib/technicalIndicators.ts::calculateADX()`  
**Current Use**: Trend strength measurement  
**ML Feature Use**:
- ADX value (trend strength)
- +DI (positive directional indicator)
- -DI (negative directional indicator)
- DI crossovers
- ADX slope (trend acceleration)

**Transformer Benefit**: ADX helps model weight trend-following vs mean-reversion strategies.

#### 14. SuperTrend AI
**Location**: `src/lib/superTrendAI.ts`  
**Current Use**: Advanced trend following with AI optimization  
**ML Feature Use**:
- SuperTrend signal (long/short)
- SuperTrend value (stop-loss level)
- Signal changes (trend reversals)
- Performance index
- Target factor (adaptive parameter)

**Critical for ML**: SuperTrend AI is already ML-enhanced, making it a high-value feature for the transformer.

## Feature Engineering Pipeline

### Phase 1: Raw Indicators (Current State ✅)
```typescript
// All indicators already computed in dashboard
const indicators = {
  sma: calculateSMA(prices, 20),
  ema: calculateEMA(prices, 12),
  rsi: calculateRSI(prices, 14),
  macd: calculateMACD(prices),
  bollinger: calculateBollingerBands(prices),
  atr: calculateATR(prices),
  obv: calculateOBV(prices),
  adx: calculateADX(prices),
  kdj: calculateKDJ(prices),
  // ... all others
};
```

### Phase 2: Multi-Timeframe Features (Next)
```typescript
// Compute same indicators across multiple timeframes
const multiTimeframeFeatures = {
  // 1-minute timeframe
  '1m': {
    sma_20: calculateSMA(data_1m.close, 20),
    rsi_14: calculateRSI(data_1m.close, 14),
    macd: calculateMACD(data_1m.close),
    // ... all indicators
  },
  // 5-minute timeframe
  '5m': {
    sma_20: calculateSMA(data_5m.close, 20),
    rsi_14: calculateRSI(data_5m.close, 14),
    macd: calculateMACD(data_5m.close),
    // ... all indicators
  },
  // ... 15m, 30m, 1h, 4h, 1d timeframes
};
```

### Phase 3: Derived Features (ML Enhancement)
```typescript
// Create additional features from existing indicators
const derivedFeatures = {
  // Price relative to indicators
  price_vs_sma_20: (price - sma_20) / sma_20,
  price_vs_bollinger_upper: (price - bb_upper) / bb_upper,
  
  // Indicator relationships
  rsi_vs_mfi: rsi - mfi,  // Divergence check
  stoch_k_vs_d: stoch_k - stoch_d,  // Stochastic crossover
  
  // Trend confirmation
  sma_cross_ema: sma_20 > ema_12 ? 1 : 0,
  adx_strong_trend: adx > 25 ? 1 : 0,
  
  // Momentum confirmation
  macd_above_signal: macd > macd_signal ? 1 : 0,
  rsi_oversold: rsi < 30 ? 1 : 0,
  rsi_overbought: rsi > 70 ? 1 : 0,
  
  // Volume confirmation
  obv_trend_up: obv > obv_sma ? 1 : 0,
  volume_spike: vroc > 2 ? 1 : 0,
  
  // Multi-timeframe alignment
  trend_alignment: sum([
    trend_1m === trend_5m ? 1 : 0,
    trend_5m === trend_15m ? 1 : 0,
    trend_15m === trend_1h ? 1 : 0,
  ]) / 3,
};
```

### Phase 4: Attention-Ready Tensor
```typescript
// Prepare data for transformer model
const attentionTensor = {
  timeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
  sequence_length: 100,  // Last 100 time steps
  features_per_timeframe: 30,  // All indicators + derived
  
  // Shape: [batch, sequence, timeframes, features]
  data: tensor([
    // For each time step in sequence
    [
      // For each timeframe
      [
        // All features for this timeframe at this time step
        price, sma_20, ema_12, rsi, macd, macd_signal, macd_hist,
        stoch_k, stoch_d, kdj_k, kdj_d, kdj_j,
        bb_upper, bb_middle, bb_lower, bb_percent_b, bb_width,
        atr, atr_percent, keltner_upper, keltner_lower,
        obv, obv_sma, vroc, mfi,
        adx, plus_di, minus_di,
        supertrend_signal, supertrend_value,
        // Derived features
        price_vs_sma, rsi_vs_mfi, trend_strength, volume_confirmation
      ],
      // ... repeat for each timeframe
    ],
    // ... repeat for each time step
  ])
};
```

## Integration with Transformer Model

### Multi-Head Attention Across Timeframes
```
Input: [1m, 5m, 15m, 30m, 1h, 4h, 1d] indicators

Attention Layer 1: Learn relationships between timeframes
  - How does 1m RSI relate to 1h RSI?
  - Does 5m MACD divergence predict 1h trend change?
  - Are Bollinger Bands squeezing across all timeframes?

Attention Layer 2: Learn relationships between indicators
  - RSI + MFI (momentum + volume)
  - MACD + ADX (trend + strength)
  - Bollinger + ATR (volatility confirmation)

Attention Layer 3: Learn temporal patterns
  - SuperTrend signal changes
  - Moving average crossovers
  - RSI divergence patterns

Output: Price prediction + confidence + trading signal
```

### Example: RSI Across Timeframes
```
Time: 10:00 AM
Symbol: AAPL

Timeframe  RSI  Trend  Weight (by attention)
---------- ---- ------ --------------------
1m         65   Up     0.05  (noisy, low weight)
5m         68   Up     0.10
15m        62   Up     0.15
30m        58   Up     0.18  (stable, high weight)
1h         55   Up     0.22  (stable, high weight)
4h         52   Up     0.20  (stable, high weight)
1d         50   Neut   0.10

Attention learns: Longer timeframes get higher weight
Prediction: Continuation of uptrend with 85% confidence
Signal: Hold / Weak Buy
```

## Database Schema for ML Features

```sql
-- Store computed features for training
CREATE TABLE ml_features (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- OHLCV (base data)
  open DECIMAL NOT NULL,
  high DECIMAL NOT NULL,
  low DECIMAL NOT NULL,
  close DECIMAL NOT NULL,
  volume BIGINT NOT NULL,
  
  -- Trend indicators
  sma_20 DECIMAL,
  sma_50 DECIMAL,
  sma_100 DECIMAL,
  sma_200 DECIMAL,
  ema_9 DECIMAL,
  ema_12 DECIMAL,
  ema_26 DECIMAL,
  ema_50 DECIMAL,
  
  -- Momentum indicators
  rsi_14 DECIMAL,
  macd DECIMAL,
  macd_signal DECIMAL,
  macd_hist DECIMAL,
  stoch_k DECIMAL,
  stoch_d DECIMAL,
  kdj_k DECIMAL,
  kdj_d DECIMAL,
  kdj_j DECIMAL,
  
  -- Volatility indicators
  bb_upper DECIMAL,
  bb_middle DECIMAL,
  bb_lower DECIMAL,
  bb_percent_b DECIMAL,
  bb_width DECIMAL,
  atr DECIMAL,
  atr_percent DECIMAL,
  keltner_upper DECIMAL,
  keltner_lower DECIMAL,
  
  -- Volume indicators
  obv BIGINT,
  obv_sma DECIMAL,
  vroc DECIMAL,
  mfi DECIMAL,
  
  -- Trend strength
  adx DECIMAL,
  plus_di DECIMAL,
  minus_di DECIMAL,
  
  -- SuperTrend AI
  supertrend_signal TEXT,
  supertrend_value DECIMAL,
  supertrend_perf_index DECIMAL,
  
  -- Derived features (computed from above)
  derived_features JSONB,
  
  -- Target (for supervised learning)
  future_return_1h DECIMAL,  -- Return 1 hour ahead
  future_return_4h DECIMAL,  -- Return 4 hours ahead
  future_return_1d DECIMAL,  -- Return 1 day ahead
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX idx_ml_features_symbol_time 
  ON ml_features(symbol, timeframe, timestamp DESC);

CREATE INDEX idx_ml_features_training 
  ON ml_features(symbol, timestamp DESC) 
  WHERE future_return_1h IS NOT NULL;
```

## Feature Importance (Expected)

Based on similar financial ML models, expected importance:

1. **SuperTrend AI** (10-15%) - Already ML-optimized
2. **Multi-timeframe RSI** (8-12%) - Momentum consensus
3. **MACD across timeframes** (8-12%) - Trend confirmation
4. **ADX + Directional Indicators** (7-10%) - Trend strength
5. **Bollinger + ATR** (6-9%) - Volatility regime
6. **Volume indicators (OBV, MFI)** (6-8%) - Flow confirmation
7. **KDJ Indicator** (5-7%) - Leading momentum
8. **Moving averages** (5-7%) - Trend foundation
9. **Stochastic** (3-5%) - Overbought/oversold
10. **Keltner Channels** (3-5%) - Breakout confirmation

**Multi-timeframe attention**: +20-30% boost to all features

## Preservation Strategy

### ✅ Keep All Existing Functionality
- Dashboard displays remain unchanged
- All current indicator calculations preserved
- User preferences for indicators maintained
- Technical analysis charts continue working

### ✅ Extend for ML Without Breaking
```typescript
// Current usage (preserved)
const indicators = calculateAllIndicators(data);
<TechnicalAnalysisDashboard data={data} indicators={indicators} />

// ML usage (new, non-breaking)
const mlFeatures = prepareMLFeatures(indicators, multiTimeframeData);
const prediction = await mlModel.predict(mlFeatures);
<MLPredictionOverlay prediction={prediction} />
```

### ✅ Backward Compatible Enhancement
```typescript
// Enhance existing functions without breaking them
export function calculateRSI(
  data: number[], 
  period: number = 14,
  options?: { returnMetadata?: boolean }
): (number | null)[] | { values: (number | null)[], metadata: any } {
  const values = calculateRSICore(data, period);
  
  if (options?.returnMetadata) {
    return {
      values,
      metadata: {
        overbought: values.filter(v => v > 70).length,
        oversold: values.filter(v => v < 30).length,
        averageValue: mean(values.filter(v => v !== null)),
      }
    };
  }
  
  return values;  // Backward compatible
}
```

## Next Steps

1. **Create Feature Engineering Service** (Supabase Edge Function)
   - Compute all indicators for all timeframes
   - Store in `ml_features` table
   - Run nightly for historical data

2. **Multi-Timeframe Data Aggregator**
   - Use existing Alpaca integration
   - Fetch 1m, 5m, 15m, 30m, 1h, 4h, 1d simultaneously
   - Align timestamps across timeframes

3. **Prepare Training Dataset**
   - Last 1 year of daily data (365 days)
   - Last 3 months of intraday data (90 days)
   - All indicators computed
   - Target returns labeled

4. **Model Input Pipeline**
   - Transform indicators to tensors
   - Normalize features per indicator type
   - Handle missing values
   - Create attention masks

5. **Integrate with Dashboard**
   - Add ML prediction overlay on charts
   - Show feature importance
   - Display attention weights
   - Keep all existing indicators visible

## Conclusion

**All existing technical indicators are preserved and will be core features of the ML model.** The transformer architecture will learn to:
- Weight indicators differently based on market conditions
- Combine indicators across multiple timeframes
- Discover non-linear relationships between indicators
- Adapt attention based on prediction horizon

The indicators you've already implemented are perfectly positioned to become high-value ML features! 🎯
