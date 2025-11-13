# ML Integration Roadmap

## Overview

This document outlines the planned integration of machine learning capabilities using an **Attention-Based Multi-Timeframe Transformer** model for advanced market prediction and analysis.

**Reference Implementation**: https://github.com/PapaPablano/Attention-Based-Multi-Timeframe-Transformer

## Current Data Pipeline (ML-Ready)

The existing Alpaca integration provides ML-ready data:

### ✅ Multi-Timeframe Data
Already implemented via `useStockIntraday` hook:
- **1-minute bars** - High-frequency patterns
- **5-minute bars** - Short-term trends
- **10-minute bars** - Intraday movements
- **15-minute bars** - Session patterns
- **30-minute bars** - Half-hour cycles
- **1-hour bars** - Hourly trends
- **4-hour bars** - Daily session patterns
- **Daily bars** - Long-term trends

### ✅ OHLCV Data Structure
All timeframes include:
- Open, High, Low, Close prices
- Volume data
- Trade count (from Alpaca)
- VWAP (Volume-Weighted Average Price)
- Timestamp with timezone

### ✅ Real-Time Data Stream
WebSocket streaming provides:
- Live trade updates
- Quote updates (bid/ask)
- Real-time bar formation
- Low-latency data for model inference

## Planned ML Architecture

### Phase 1: Data Preparation Layer (Q1)
**Status**: Foundation in place

- [ ] **Feature Engineering Service**
  - Technical indicators (RSI, MACD, Bollinger Bands already computed)
  - Volume profile analysis
  - Price momentum calculations
  - Market microstructure features

- [ ] **Multi-Timeframe Data Aggregator**
  - Align data across different timeframes
  - Create attention-ready tensors
  - Handle missing data and market gaps
  - Normalize price and volume data

- [ ] **Data Storage for Training**
  - Supabase table: `ml_training_data`
  - Store preprocessed features
  - Version control for model training
  - Historical data backfill from Alpaca

### Phase 2: Model Integration (Q2)
**Status**: Planned

- [ ] **Attention-Based Transformer Model**
  - Multi-head attention across timeframes
  - Positional encoding for temporal data
  - Transformer encoder for feature extraction
  - Output: Price predictions, trend classification

- [ ] **Model Serving Infrastructure**
  - Supabase Edge Function: `ml-predict`
  - Model inference endpoint
  - Batch prediction support
  - Real-time prediction on streaming data

- [ ] **Model Training Pipeline**
  - Automated retraining on new data
  - Hyperparameter optimization
  - Model versioning and rollback
  - Performance monitoring

### Phase 3: Dashboard Integration (Q3)
**Status**: Planned

- [ ] **Prediction Visualization**
  - Price prediction overlays on charts
  - Confidence intervals
  - Multi-timeframe prediction comparison
  - Attention weight visualization

- [ ] **Trading Signals**
  - Buy/sell signal generation
  - Risk assessment scores
  - Position sizing recommendations
  - Alert triggers based on predictions

- [ ] **Model Performance Metrics**
  - Prediction accuracy tracking
  - Backtesting results
  - Real-time performance monitoring
  - Model explanation (SHAP values)

### Phase 4: Advanced Features (Q4)
**Status**: Future

- [ ] **Portfolio Optimization**
  - ML-driven asset allocation
  - Risk-adjusted return optimization
  - Correlation analysis across assets
  - Dynamic rebalancing recommendations

- [ ] **Sentiment Analysis**
  - News sentiment integration (Alpaca news feed)
  - Social media sentiment
  - Market sentiment indicators
  - Combine with price predictions

- [ ] **Anomaly Detection**
  - Market regime detection
  - Unusual price movements
  - Flash crash prediction
  - Circuit breaker alerts

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Alpaca Market Data API                    │
│  (Real-time Trades, Quotes, Bars, News)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions Layer                   │
│  • stock-quote      • stock-intraday    • stock-news        │
│  • stock-historical • stock-stream      • ml-predict (new)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL                          │
│  • stock_cache (45s TTL)                                    │
│  • ml_training_data (historical features)                   │
│  • ml_predictions (model outputs)                           │
│  • ml_model_versions (model metadata)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│  React   │  │   ML     │  │  Training    │
│   Hooks  │  │ Feature  │  │  Pipeline    │
│          │  │ Engineer │  │              │
└──────────┘  └──────────┘  └──────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Transformer Model   │
          │  (Multi-Timeframe)   │
          │  • Attention Layers  │
          │  • Prediction Head   │
          └──────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │    Dashboard UI      │
          │  • Predictions       │
          │  • Signals           │
          │  • Visualization     │
          └──────────────────────┘
```

## Technical Requirements

### Data Requirements
- **Minimum History**: 1 year of daily data per symbol
- **Intraday Data**: 3 months of 1-minute bars for training
- **Multiple Timeframes**: Simultaneous access to 1m, 5m, 15m, 1h, 1d
- **Real-Time Updates**: Sub-second latency for inference

### Model Requirements
- **Input Shape**: `[batch_size, sequence_length, num_timeframes, num_features]`
- **Timeframes**: 5-8 different timeframes
- **Features per Timeframe**: 15-20 (OHLCV + indicators)
- **Sequence Length**: 100-200 time steps
- **Output**: Price prediction + confidence + signal

### Infrastructure Requirements
- **Model Size**: ~10-50 MB (compressed)
- **Inference Time**: <100ms per prediction
- **Batch Processing**: Support for 10-100 symbols
- **GPU Support**: Optional but recommended
- **Model Format**: ONNX or TensorFlow.js for browser inference

## Integration with Existing Components

### Hooks (Current → ML-Enhanced)
```typescript
// Current
const { data: quote } = useStockQuote('AAPL');
const { data: intraday } = useStockIntraday('AAPL', '1m', '1d');

// Future ML-Enhanced
const { prediction, confidence, signal } = useMLPrediction('AAPL', {
  timeframes: ['1m', '5m', '15m', '1h', '1d'],
  horizon: '1h',  // Predict 1 hour ahead
});

// Combine with real-time streaming
const { lastTrade } = useStockStream({ symbols: ['AAPL'] });
const { prediction } = useMLPrediction('AAPL', {
  realTimeData: lastTrade,  // Use live data for inference
});
```

### Components (Current → ML-Enhanced)
```typescript
// Current
<PlotlyPriceChart symbol="AAPL" interval="1h" />

// Future ML-Enhanced
<PlotlyPriceChart 
  symbol="AAPL" 
  interval="1h"
  showMLPrediction={true}
  predictionHorizon="4h"
  showConfidenceBands={true}
  showAttentionWeights={true}
/>
```

### Dashboard (Current → ML-Enhanced)
```typescript
// Future ML Dashboard
<EnhancedDashboard symbol="AAPL">
  <MLPredictionPanel />
  <AttentionVisualization />
  <TradingSignals />
  <ModelPerformanceMetrics />
</EnhancedDashboard>
```

## Database Schema (Planned)

### ml_training_data
```sql
CREATE TABLE ml_training_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  features JSONB NOT NULL,  -- Preprocessed features
  target DECIMAL,           -- Future price
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX idx_ml_training_symbol_time 
  ON ml_training_data(symbol, timeframe, timestamp DESC);
```

### ml_predictions
```sql
CREATE TABLE ml_predictions (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prediction_time TIMESTAMPTZ NOT NULL,
  horizon_minutes INTEGER NOT NULL,
  predicted_price DECIMAL NOT NULL,
  confidence DECIMAL NOT NULL,
  signal TEXT,  -- 'buy', 'sell', 'hold'
  attention_weights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_predictions_symbol_time 
  ON ml_predictions(symbol, prediction_time DESC);
```

### ml_model_versions
```sql
CREATE TABLE ml_model_versions (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  model_path TEXT NOT NULL,
  training_start TIMESTAMPTZ NOT NULL,
  training_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL,  -- accuracy, MSE, etc.
  config JSONB NOT NULL,   -- model hyperparameters
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Performance Considerations

### Real-Time Inference
- **Target Latency**: <100ms from data arrival to prediction
- **Batch Predictions**: Process multiple symbols simultaneously
- **Caching Strategy**: Cache predictions for 1-5 minutes
- **Fallback**: Use last valid prediction if model unavailable

### Training Pipeline
- **Automated Retraining**: Weekly or on significant market events
- **Data Preprocessing**: Run nightly for next day's data
- **Model Validation**: 20% holdout set, walk-forward validation
- **Version Control**: Keep last 5 model versions

### Scaling Strategy
- **Edge Functions**: Auto-scale with Supabase
- **Model Serving**: Consider external GPU inference service for heavy models
- **Data Storage**: Partition tables by month for performance
- **Caching**: Use Supabase's built-in Redis for prediction cache

## Development Phases

### Phase 1 (Current): Data Foundation ✅
- Alpaca integration complete
- Multi-timeframe data available
- Real-time streaming ready
- Technical indicators computed

### Phase 2 (Next): Feature Engineering
- Create feature extraction service
- Build training data pipeline
- Set up database tables
- Implement data versioning

### Phase 3 (Q2): Model Development
- Port transformer model to production
- Create inference endpoint
- Build training pipeline
- Set up monitoring

### Phase 4 (Q3): Dashboard Integration
- Add prediction visualization
- Create signal generation
- Build performance dashboard
- User preferences for ML features

## Resources and References

### Model Architecture
- **Repository**: https://github.com/PapaPablano/Attention-Based-Multi-Timeframe-Transformer
- **Paper**: Attention mechanisms for time series
- **Framework**: TensorFlow/PyTorch → Convert to ONNX/TF.js

### Data Sources
- **Alpaca Docs**: https://alpaca.markets/docs/api-references/market-data-api/
- **Supabase Docs**: https://supabase.com/docs/guides/database/overview
- **Technical Indicators**: Already implemented in `/src/lib/technicalIndicators.ts`

### Related Documentation
- [ALPACA_INTEGRATION.md](./ALPACA_INTEGRATION.md) - Current data pipeline
- [TECHNICAL_INDICATORS.md](./TECHNICAL_INDICATORS.md) - Available features
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Database configuration

## Next Steps

1. **Review transformer model architecture** from reference repo
2. **Design feature engineering pipeline** for multi-timeframe data
3. **Create database schema** for ML tables
4. **Prototype inference endpoint** in Supabase Edge Function
5. **Build prediction visualization** component
6. **Set up training pipeline** with historical Alpaca data

---

**Status**: Planning Phase  
**Target**: Q2 2024 for initial model integration  
**Owner**: ML Team  
**Dependencies**: Alpaca integration (✅ Complete), Feature engineering (In Progress)
