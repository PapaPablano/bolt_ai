# Phase 1 Dashboard Design - Stock Whisperer

## Visual Layout Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER (Sticky)                                                     │
│  ┌─────────┐  Stock Whisperer                        [Search Bar]   │
│  │ 📊 Logo │                                                          │
│  └─────────┘                                                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  WATCHLIST SECTION                                                   │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐       │
│  │ AAPL  │ │ MSFT  │ │GOOGL │ │ AMZN  │ │ TSLA  │ │ NVDA  │       │
│  │$182.50│ │$378.91│ │$141.20│ │$175.30│ │$242.84│ │$502.15│       │
│  │+2.3% ↑│ │+1.1% ↑│ │-0.5% ↓│ │+3.2% ↑│ │+5.1% ↑│ │+0.8% ↑│       │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SELECTED STOCK HEADER                                               │
│  AAPL                                    [Compare] [1D|5D|1M|3M|..] │
│  Current: $182.50 USD                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  MAIN CONTENT (2/3 Chart + 1/3 News)                                │
│                                                                       │
│  ┌────────────────────────────────┐  ┌─────────────────────┐       │
│  │  CANDLESTICK CHART             │  │  LATEST NEWS        │       │
│  │                                 │  │  ┌─────────────────┐│       │
│  │     /\    /\                   │  │  │ Apple reports... ││       │
│  │    /  \  /  \    /\           │  │  │ 2h ago          ││       │
│  │   /    \/    \  /  \          │  │  └─────────────────┘│       │
│  │  /            \/              │  │  ┌─────────────────┐│       │
│  │ /                             │  │  │ iPhone sales... ││       │
│  │                                │  │  │ 4h ago          ││       │
│  │ + Volume Bars Below            │  │  └─────────────────┘│       │
│  │                                 │  │  ┌─────────────────┐│       │
│  │ Drawing Tools: [Trend] [Rect]  │  │  │ Market analysis ││       │
│  │                 [Circle] [Text] │  │  │ 6h ago          ││       │
│  └────────────────────────────────┘  └─────────────────────┘       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  PATTERN DETECTION ALERTS                                │       │
│  │  🔺 Head and Shoulders (75% confidence)                  │       │
│  │     Bearish reversal pattern detected                    │       │
│  │  🔵 Double Bottom (70% confidence)                       │       │
│  │     Bullish reversal pattern detected                    │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  FOOTER                                                              │
│  Stock Whisperer - Phase 1: Enhanced Charting Foundation            │
│  Powered by Alpaca Market Data & Supabase                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Design System

### Color Palette
```css
Background:      #0f172a (slate-900) - Deep dark blue
Cards:           #1e293b (slate-800) - Elevated surfaces
Borders:         #334155 (slate-700) - Subtle separation
Text Primary:    #f8fafc (slate-100) - High contrast
Text Secondary:  #94a3b8 (slate-400) - Lower emphasis
Accent:          #3b82f6 (blue-500)  - Interactive elements
Success:         #22c55e (green-500) - Positive changes
Danger:          #ef4444 (red-500)   - Negative changes
```

### Typography
```css
Logo:           2xl, bold, gradient (blue-400 to cyan-400)
Section Headers: lg, semibold, slate-300
Stock Symbols:   lg, bold, slate-100
Prices:          2xl, bold, slate-100
Changes:         sm, medium, green/red
Labels:          sm, slate-400
```

### Component Spacing
```css
Container:      mx-auto px-4 (responsive padding)
Sections:       mb-6 (24px between major sections)
Cards:          p-4 (16px internal padding)
Grid Gap:       gap-4 (16px between grid items)
```

## Responsive Breakpoints

### Mobile (< 768px)
```
┌─────────────────┐
│   Header        │
├─────────────────┤
│ [Stock Card 1]  │
│ [Stock Card 2]  │
│ [Stock Card 3]  │
├─────────────────┤
│ Chart (Full)    │
├─────────────────┤
│ News (Full)     │
└─────────────────┘
```

### Tablet (768px - 1024px)
```
┌─────────────────────────┐
│      Header             │
├─────────────────────────┤
│ [Card 1] [Card 2]       │
│ [Card 3] [Card 4]       │
│ [Card 5] [Card 6]       │
├─────────────────────────┤
│ Chart (Full)            │
├─────────────────────────┤
│ News (Full)             │
└─────────────────────────┘
```

### Desktop (> 1024px)
```
┌───────────────────────────────────────────┐
│           Header                          │
├───────────────────────────────────────────┤
│ [C1] [C2] [C3] [C4] [C5] [C6]            │
├───────────────────────────────────────────┤
│ Chart (66%)         │ News (33%)         │
│                     │                     │
├─────────────────────┴────────────────────┤
│ Pattern Detection                         │
└───────────────────────────────────────────┘
```

## Interactive Elements

### Stock Cards
- **Hover**: Blue border glow + shadow
- **Selected**: Solid blue border + elevated shadow
- **Click**: Instant feedback, loads new chart
- **States**: Loading (pulse), Error (red tint)

### Charts
- **Zoom**: Pinch or scroll to zoom
- **Pan**: Click and drag to navigate
- **Crosshair**: Hover for detailed info
- **Drawing Tools**: Click to activate, draw on chart

### Buttons
```css
Primary:   bg-blue-600, hover:bg-blue-700
Secondary: bg-slate-700, hover:bg-slate-600
Active:    bg-blue-600 + shadow-lg
```

## Feature Highlights

### 1. Watchlist Grid
- **6 default stocks** displayed prominently
- **Real-time updates** every 30 seconds
- **Color-coded changes** (green/red with arrows)
- **Click to select** for detailed view
- **Responsive grid**: 1-6 columns based on screen size

### 2. Professional Charting
- **Candlestick visualization** with volume overlay
- **Smooth animations** on data updates
- **Dark theme** optimized for readability
- **Responsive sizing** adapts to container
- **Touch-friendly** on mobile devices

### 3. Drawing Tools Toolbar
```
┌─────────────────────────────────────────┐
│ [↖] [/] [─] [□] [○] [T] [✏] | [🗑]     │
│ Move Line Horz Rect Circ Text Free Clear│
└─────────────────────────────────────────┘
```

### 4. Pattern Detection Panel
- **Auto-detection** runs on chart data
- **Confidence scores** shown as percentages
- **Color-coded icons** (green=bullish, red=bearish)
- **Descriptions** explain each pattern
- **Position markers** highlight pattern location

### 5. News Panel (Right Sidebar)
- **Fixed height** (600px) with scroll
- **10 latest articles** per stock
- **Metadata**: Source, time, related symbols
- **External links** to full articles
- **Timestamp formatting** (2h ago, 1d ago, etc.)

## Current Implementation Status

### ✅ Implemented
- Modern dark theme with professional styling
- Responsive watchlist grid (1-6 columns)
- Real-time stock card updates
- Candlestick chart with lightweight-charts
- Volume visualization
- Interactive chart controls
- Skeleton loading states
- Error handling

### 🔜 To Add (Full Phase 1)
- Search bar for symbol lookup
- Timeframe selector (1D, 5D, 1M, etc.)
- Drawing tools toolbar
- Pattern detection panel
- News sidebar panel
- Comparison mode modal
- Additional indicator overlays
- Chart zoom/pan UX improvements

## Design Inspiration

**Perplexity Finance Style:**
- Clean, minimal interface
- Focus on content over chrome
- Intelligent data presentation
- Contextual information architecture

**TradingView Technical Prowess:**
- Professional charting capabilities
- Rich drawing tools
- Pattern recognition
- Multiple timeframes and intervals
- Technical indicator overlays

**Unique Stock Whisperer Elements:**
- ML prediction overlays (Phase 3)
- AI research assistant (Phase 2)
- Simplified UX for mass accessibility
- Integrated news + chart view
- Pattern confidence scoring

## Performance Targets

- **First Paint**: < 1.5s
- **Interactive**: < 2.5s
- **Chart Render**: < 500ms
- **Symbol Switch**: < 300ms
- **Data Update**: 30s interval (configurable)

## Accessibility

- **Keyboard Navigation**: Full support
- **Screen Readers**: ARIA labels on interactive elements
- **High Contrast**: Color choices tested for readability
- **Focus Indicators**: Visible on all interactive elements
- **Mobile Touch**: 44x44px minimum touch targets

---

**This design balances professional trading capabilities with mass-market accessibility, setting the foundation for Phases 2-4.**
