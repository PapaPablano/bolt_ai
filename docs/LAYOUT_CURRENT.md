# Current Dashboard Layout (Updated)

## Overview
This document describes the **current** dashboard layout after the latest reorganization.

## Layout Order

1. **Header** - Navigation and stock search
2. **Market Overview (Watchlist)** - Featured stocks grid
3. **Selected Stock Header** - Current stock information
4. **Main Chart** - Full width price chart
5. **Technical Indicators** - Full width technical analysis
6. **Split Layout** - News Widget (left) + Key Metrics (right)

---

## Desktop Layout (> 1024px)

```
┌──────────────────────────────────────────────────────────────────┐
│                        1. HEADER                                  │
│  [Logo] [Search Bar]                        [Theme] [Settings]   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              2. MARKET OVERVIEW (WATCHLIST)                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │   AAPL     │  │   GOOGL    │  │   MSFT     │                 │
│  │  $182.45   │  │  $142.67   │  │  $415.23   │                 │
│  │  +2.34%    │  │  -0.89%    │  │  +1.12%    │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│           3. SELECTED STOCK HEADER                                │
│  AAPL [Apple Inc.] [$182.45] [+2.34%] [Loading...]              │
│  Range: 1M | Display: 250 pts | Calc: 365 pts                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              4. MAIN CHART (FULL WIDTH)                           │
│                                                                   │
│  [1D][5D][1M][3M][6M][1Y][5Y]    [10m][1h][4h][1d]             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │              Interactive Plotly Chart                     │   │
│  │           Candlesticks + Volume + Indicators              │   │
│  │                                                           │   │
│  │                    Height: 560px                          │   │
│  │                                                           │   │
│  │  [Zoom/Pan Controls]  [Crosshair]  [Data Tooltip]       │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  SuperTrend AI: Factor 3.2 | Performance: 0.9234                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│         5. TECHNICAL ANALYSIS DASHBOARD (FULL WIDTH)              │
│                                                                   │
│  Technical Indicators                                             │
│  [Indicator Selector: MA, BB, RSI, MACD, SuperTrend AI]         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Moving Averages Chart                                    │   │
│  │  [SMA 20, 50, 200] [EMA 12, 26]                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  RSI Indicator                                            │   │
│  │  [Overbought/Oversold zones]                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MACD Indicator                                           │   │
│  │  [Signal line crossovers]                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│       6. SPLIT LAYOUT: NEWS & KEY METRICS (50/50)                 │
│                                                                   │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐ │
│  │  NEWS WIDGET (50% width)     │  │  KEY METRICS (50% width) │ │
│  │                               │  │                          │ │
│  │  AAPL News                    │  │  Key Metrics             │ │
│  │                               │  │                          │ │
│  │  ┌─────────────────────────┐ │  │  ┌────────┬─────────┐   │ │
│  │  │ Breaking News            │ │  │  │ Last   │ Day     │   │ │
│  │  │ AAPL rises 2% on strong │ │  │  │ Price  │ Range   │   │ │
│  │  │ earnings report          │ │  │  │ $182   │ L-H     │   │ │
│  │  │ 2 hours ago              │ │  │  │ +2.34% │         │   │ │
│  │  │ [Reuters] [AAPL]         │ │  │  └────────┴─────────┘   │ │
│  │  └─────────────────────────┘ │  │                          │ │
│  │                               │  │  ┌────────┬─────────┐   │ │
│  │  ┌─────────────────────────┐ │  │  │ 52W    │ Volume  │   │ │
│  │  │ Market Update            │ │  │  │ Range  │         │   │ │
│  │  │ Tech sector rallies on   │ │  │  │ L-H    │ 12.5M   │   │ │
│  │  │ positive outlook         │ │  │  │        │         │   │ │
│  │  │ 3 hours ago              │ │  │  └────────┴─────────┘   │ │
│  │  │ [Bloomberg]              │ │  │                          │ │
│  │  └─────────────────────────┘ │  │  ┌────────┬─────────┐   │ │
│  │                               │  │  │ Avg    │ Prev    │   │ │
│  │  ┌─────────────────────────┐ │  │  │ Vol    │ Close   │   │ │
│  │  │ Apple announces new      │ │  │  │ 8.2M   │ $180.11 │   │ │
│  │  │ product lineup           │ │  │  │        │         │   │ │
│  │  │ 5 hours ago              │ │  │  └────────┴─────────┘   │ │
│  │  │ [TechCrunch] [AAPL]     │ │  │                          │ │
│  │  └─────────────────────────┘ │  │  Data Source: Alpaca    │ │
│  │                               │  │  [IEX] [Cached]          │ │
│  │  [Scrollable]                 │  │                          │ │
│  │  Height: 600px                │  │                          │ │
│  │                               │  │                          │ │
│  └──────────────────────────────┘  └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout (< 1024px)

```
┌────────────────────┐
│    1. HEADER       │
│  [≡] [Search] [⚙] │
└────────────────────┘

┌────────────────────┐
│ 2. MARKET OVERVIEW │
│  ┌──────────────┐  │
│  │    AAPL      │  │
│  │  $182.45     │  │
│  │  +2.34%      │  │
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │   GOOGL      │  │
│  │  $142.67     │  │
│  │  -0.89%      │  │
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │    MSFT      │  │
│  │  $415.23     │  │
│  │  +1.12%      │  │
│  └──────────────┘  │
└────────────────────┘

┌────────────────────┐
│ 3. STOCK HEADER    │
│  AAPL              │
│  $182.45 +2.34%    │
└────────────────────┘

┌────────────────────┐
│ 4. MAIN CHART      │
│  (Full Width)      │
│                    │
│  [1D][5D][1M]...  │
│  [10m][1h][4h]    │
│                    │
│  ┌──────────────┐  │
│  │              │  │
│  │   Chart      │  │
│  │   560px      │  │
│  │              │  │
│  └──────────────┘  │
└────────────────────┘

┌────────────────────┐
│ 5. TECHNICAL       │
│    INDICATORS      │
│  (Full Width)      │
│                    │
│  [Indicators]      │
│  ┌──────────────┐  │
│  │   Charts     │  │
│  └──────────────┘  │
└────────────────────┘

┌────────────────────┐
│ 6. NEWS WIDGET     │
│    (Full Width)    │
│  ┌──────────────┐  │
│  │ News Item 1  │  │
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │ News Item 2  │  │
│  └──────────────┘  │
│  [Scrollable]      │
└────────────────────┘

┌────────────────────┐
│ 6. KEY METRICS     │
│    (Full Width)    │
│  ┌────┐  ┌────┐   │
│  │Last│  │Day │   │
│  │$182│  │Rng │   │
│  └────┘  └────┘   │
│  ┌────┐  ┌────┐   │
│  │Vol │  │Prev│   │
│  │12M │  │$180│   │
│  └────┘  └────┘   │
└────────────────────┘
```

---

## Key Features

### Main Chart (Full Width)
- **Advantage**: Maximum space for chart analysis
- **Controls**: Timeframe and interval buttons at top
- **Height**: 560px fixed
- **Features**: Interactive Plotly with zoom/pan
- **Indicators**: SuperTrend AI info displayed below chart

### Technical Indicators (Full Width)
- **Position**: Between chart and metrics
- **Advantage**: Clear separation of concerns
- **Features**: All technical analysis in one section
- **Selectable**: User can enable/disable indicators

### Split Layout (News + Metrics)
- **Desktop**: 50% width each, side-by-side
- **Mobile**: Full width, stacked vertically
- **News**: 
  - Symbol-specific articles
  - Scrollable feed (600px height)
  - Article metadata (time, source, symbols)
- **Metrics**:
  - 6 key metrics in 2x3 grid
  - Price, ranges, volume data
  - Data source indicators

---

## Advantages of Current Layout

### 1. **Better Chart Focus**
- Full width allows more data points visible
- Better for technical analysis
- Easier to spot patterns

### 2. **Logical Information Flow**
- Header → Watchlist → Selected Stock → Chart → Analysis → Metrics/News
- Each section builds on the previous

### 3. **Balanced Bottom Section**
- News and metrics given equal importance
- Easy to glance at both simultaneously
- Clean visual separation

### 4. **Responsive Design**
- Desktop: Optimal use of horizontal space
- Mobile: Logical vertical stacking
- Breakpoint at 1024px

---

## Grid System

```css
/* Main Chart */
section                    /* Full width container */

/* Technical Indicators */
section                    /* Full width container */

/* Split Layout */
grid grid-cols-1 lg:grid-cols-2 gap-6
  ├─ div                   /* News: 50% on desktop, 100% on mobile */
  └─ div                   /* Metrics: 50% on desktop, 100% on mobile */
```

---

## Component Heights

| Component | Height | Scrollable |
|-----------|--------|-----------|
| Chart | 560px | No (zoom/pan) |
| Technical Indicators | Variable | No |
| News Widget | 600px | Yes |
| Key Metrics | Auto | No |

---

## Data Flow

```
User selects stock
    ↓
selectedSymbol state updates
    ↓
Triggers parallel data fetches:
    ├─ Quote data → Stock Header + Key Metrics
    ├─ Historical data → Main Chart
    ├─ News data → News Widget
    └─ Calculated indicators → Technical Dashboard
```

---

## Comparison with Previous Layout

### Previous (Before Reorganization):
```
Header
Watchlist
Stock Header
Key Metrics (top)
Chart (2/3) | News (1/3)
Technical Indicators
```

### Current (After Reorganization):
```
Header
Watchlist
Stock Header
Chart (full width)
Technical Indicators (full width)
News (1/2) | Metrics (1/2)
```

### Benefits:
- ✅ Chart gets more horizontal space
- ✅ Technical indicators more prominent
- ✅ News and metrics balanced at bottom
- ✅ Better information hierarchy
- ✅ Cleaner visual flow

---

## Summary

The current layout provides:
- **Maximum chart visibility** for analysis
- **Dedicated technical indicators section** for traders
- **Balanced news and metrics** for quick reference
- **Responsive design** that works on all devices
- **Logical information flow** from general to specific

This layout is optimized for professional trading and technical analysis while maintaining easy access to news and key metrics.
