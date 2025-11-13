# Technical Indicators - Component Reference

## 📦 Component Hierarchy

```
TechnicalAnalysisDashboard (Main Container)
├── IndicatorSelector (Left Sidebar)
│   ├── Accordion (Radix UI)
│   │   ├── Trend Section (6 indicators)
│   │   ├── Momentum Section (3 indicators)
│   │   ├── Volatility Section (4 indicators)
│   │   └── Volume Section (3 indicators)
│   └── Badge (Selected count)
│
└── Charts Area (Right Content)
    ├── EnhancedPriceChart (Main Chart)
    │   ├── Price Line
    │   ├── SMA Overlays (20/50/200)
    │   ├── EMA Overlays (12/26/50)
    │   ├── Bollinger Bands
    │   └── Keltner Channel
    │
    ├── RSIChart (Conditional)
    │   ├── RSI Line
    │   ├── Overbought Zone (70)
    │   └── Oversold Zone (30)
    │
    ├── MACDChart (Conditional)
    │   ├── MACD Line
    │   ├── Signal Line
    │   └── Histogram
    │
    ├── StochasticChart (Conditional)
    │   ├── %K Line
    │   ├── %D Line
    │   ├── Overbought Zone (80)
    │   └── Oversold Zone (20)
    │
    ├── VolumeIndicatorChart (OBV)
    ├── VolumeIndicatorChart (VROC)
    ├── VolumeIndicatorChart (MFI)
    ├── VolumeIndicatorChart (ATR)
    └── VolumeIndicatorChart (ADX)
```

## 📄 File Structure

```
src/
├── lib/
│   └── technicalIndicators.ts ............... Core calculation functions
│       ├── calculateRSI()
│       ├── calculateMACD()
│       ├── calculateSMA()
│       ├── calculateEMA()
│       ├── calculateBollingerBands()
│       ├── calculateATR()
│       ├── calculateStochastic()
│       ├── calculateADX()
│       ├── calculateOBV()
│       ├── calculateVROC()
│       ├── calculateMFI()
│       └── calculateKeltnerChannel()
│
├── components/
│   ├── TechnicalAnalysisDashboard.tsx ...... Main container component
│   │   └── Props: { symbol, data }
│   │
│   ├── IndicatorSelector.tsx ............... Checkbox UI for selection
│   │   └── Props: { selectedIndicators, onChange }
│   │
│   ├── EnhancedPriceChart.tsx .............. Price chart with overlays
│   │   └── Props: { symbol, data, indicators }
│   │
│   ├── IndicatorCharts.tsx ................. Individual indicator charts
│   │   ├── RSIChart({ data })
│   │   ├── MACDChart({ data })
│   │   ├── StochasticChart({ data })
│   │   └── VolumeIndicatorChart({ data, title, color })
│   │
│   └── examples/
│       └── TechnicalIndicatorExamples.tsx .. Usage examples
│           ├── BasicTechnicalAnalysis
│           ├── CustomIndicatorConfig
│           ├── IndicatorPresets
│           ├── ManualIndicatorSelection
│           ├── MultiSymbolAnalysis
│           └── TradingSignals
│
└── pages/
    └── Index.tsx ........................... Main application page
        └── Integrated TechnicalAnalysisDashboard
```

## 🔧 Component API Reference

### TechnicalAnalysisDashboard

**Purpose**: Main container that orchestrates all technical indicators

**Props**:
```typescript
interface TechnicalAnalysisDashboardProps {
  symbol: string;        // Stock symbol (e.g., "AAPL")
  data: PriceData[];     // Historical OHLCV data
}
```

**Usage**:
```tsx
<TechnicalAnalysisDashboard
  symbol="AAPL"
  data={historicalData}
/>
```

**Features**:
- Manages indicator selection state
- Calculates all indicators using useMemo
- Conditionally renders chart components
- Responsive grid layout

---

### IndicatorSelector

**Purpose**: UI for toggling indicators on/off

**Props**:
```typescript
interface IndicatorSelectorProps {
  selectedIndicators: IndicatorConfig;
  onChange: (config: IndicatorConfig) => void;
}

interface IndicatorConfig {
  // Trend
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema12: boolean;
  ema26: boolean;
  ema50: boolean;
  
  // Momentum
  rsi: boolean;
  macd: boolean;
  stochastic: boolean;
  
  // Volatility
  bollingerBands: boolean;
  atr: boolean;
  keltnerChannel: boolean;
  adx: boolean;
  
  // Volume
  obv: boolean;
  vroc: boolean;
  mfi: boolean;
}
```

**Usage**:
```tsx
const [indicators, setIndicators] = useState<IndicatorConfig>({...});

<IndicatorSelector
  selectedIndicators={indicators}
  onChange={setIndicators}
/>
```

**Features**:
- Accordion organization by category
- Badge shows count of selected indicators
- Checkbox controls for each indicator
- Persistent state across renders

---

### EnhancedPriceChart

**Purpose**: Price chart with indicator overlays

**Props**:
```typescript
interface EnhancedPriceChartProps {
  symbol: string;
  data: PriceData[];
  indicators: IndicatorConfig;
}
```

**Usage**:
```tsx
<EnhancedPriceChart
  symbol="AAPL"
  data={historicalData}
  indicators={selectedIndicators}
/>
```

**Features**:
- Line chart for price
- Overlay lines for moving averages
- Overlay bands for Bollinger/Keltner
- Custom tooltip with all indicator values
- Responsive height (400px)

**Supported Overlays**:
- SMA 20, 50, 200
- EMA 12, 26, 50
- Bollinger Bands (3 lines)
- Keltner Channel (3 lines)

---

### RSIChart

**Purpose**: Relative Strength Index visualization

**Props**:
```typescript
interface RSIChartProps {
  data: Array<{ date: string; rsi: number | null }>;
}
```

**Usage**:
```tsx
<RSIChart data={rsiData} />
```

**Features**:
- Line chart showing RSI values
- Red zone above 70 (overbought)
- Green zone below 30 (oversold)
- Reference lines at 70, 50, 30
- Y-axis range: 0-100

---

### MACDChart

**Purpose**: Moving Average Convergence Divergence visualization

**Props**:
```typescript
interface MACDChartProps {
  data: Array<{
    date: string;
    macd: number;
    signal: number;
    histogram: number;
  }>;
}
```

**Usage**:
```tsx
<MACDChart data={macdData} />
```

**Features**:
- Line chart for MACD and Signal
- Bar chart for histogram
- Gradient fill on histogram (red/green)
- Zero reference line

---

### StochasticChart

**Purpose**: Stochastic Oscillator visualization

**Props**:
```typescript
interface StochasticChartProps {
  data: Array<{
    date: string;
    k: number;
    d: number;
  }>;
}
```

**Usage**:
```tsx
<StochasticChart data={stochasticData} />
```

**Features**:
- %K line (fast)
- %D line (slow)
- Red zone above 80 (overbought)
- Green zone below 20 (oversold)
- Y-axis range: 0-100

---

### VolumeIndicatorChart

**Purpose**: Generic chart for volume-based indicators

**Props**:
```typescript
interface VolumeIndicatorChartProps {
  data: Array<{ date: string; value: number | null }>;
  title: string;
  color: string;
}
```

**Usage**:
```tsx
<VolumeIndicatorChart
  data={obvData}
  title="OBV - On-Balance Volume"
  color="#10b981"
/>
```

**Features**:
- Line chart with customizable color
- Dynamic Y-axis based on data range
- Clean, minimal design
- Reusable for OBV, VROC, MFI, ATR, ADX

---

## 🎨 Styling

All components use:
- **Tailwind CSS** for utility classes
- **Radix UI** for accessible primitives
- **Custom theme** from shadcn/ui
- **Recharts** for chart rendering

### Color Variables
```css
--primary: Blue (#3b82f6)
--secondary: Orange (#f59e0b)
--accent: Purple (#8b5cf6)
--success: Green (#10b981)
--danger: Red (#ef4444)
```

### Chart Dimensions
```css
Price Chart: 400px height
Indicator Charts: 300px height
Grid Gap: 24px (gap-6)
```

---

## 📊 Data Types

### PriceData
```typescript
interface PriceData {
  date: string;      // ISO date string
  open: number;      // Opening price
  high: number;      // High price
  low: number;       // Low price
  close: number;     // Closing price
  volume: number;    // Trading volume
}
```

### Indicator Results
```typescript
// RSI
number[]

// MACD
{
  macd: number[];
  signal: number[];
  histogram: number[];
}

// Stochastic
{
  k: number[];
  d: number[];
}

// Bollinger Bands
{
  upper: number[];
  middle: number[];
  lower: number[];
}

// Simple Arrays
number[]  // For SMA, EMA, ATR, OBV, etc.
```

---

## 🔄 State Management

```tsx
// Parent component manages selection state
const [selectedIndicators, setSelectedIndicators] = useState<IndicatorConfig>({
  sma20: true,
  rsi: true,
  macd: true,
  // ... other indicators default to false
});

// Calculations are memoized for performance
const calculatedData = useMemo(() => {
  // Calculate indicators only when data or config changes
  return computeIndicators(data, selectedIndicators);
}, [data, selectedIndicators]);

// Child components receive calculated data as props
<RSIChart data={calculatedData.rsi} />
<MACDChart data={calculatedData.macd} />
```

---

## 🚀 Performance Considerations

1. **Memoization**: All calculations use `useMemo`
2. **Conditional Rendering**: Charts only render when selected
3. **Efficient Algorithms**: Optimized calculation loops
4. **Lazy Loading**: Components loaded on demand
5. **Chart Optimization**: Recharts configured for performance

---

## 🧪 Testing

```tsx
// Example test structure
describe('TechnicalAnalysisDashboard', () => {
  it('renders with default indicators', () => {
    render(<TechnicalAnalysisDashboard symbol="AAPL" data={mockData} />);
    expect(screen.getByText('SMA 20')).toBeInTheDocument();
  });
  
  it('calculates RSI correctly', () => {
    const rsi = calculateRSI([100, 105, 110, 108, 112], 14);
    expect(rsi[rsi.length - 1]).toBeGreaterThan(50);
  });
});
```

---

## 📚 Related Documentation

- `TECHNICAL_INDICATORS.md` - Full indicator reference
- `TECHNICAL_INDICATORS_QUICKSTART.md` - Getting started guide
- `PHASE_4_3_COMPLETE.md` - Implementation summary
- `VISUAL_SUMMARY.md` - Architecture overview

---

**Last Updated**: January 2025
**Version**: 1.0.0
