# Visual Guide - What You Should See

## Page Layout Overview

When you open the application, you'll see this layout from top to bottom:

### 1. Header & Search Bar
```
┌─────────────────────────────────────────────────┐
│  StockML Analytics        [Search: AAPL]  Market│
└─────────────────────────────────────────────────┘
```

### 2. Market Overview (Clickable Cards)
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│  AAPL    │ │  MSFT    │ │  GOOGL   │
│ $178.45  │ │ $412.78  │ │ $142.65  │
│  +1.33%  │ │  -0.30%  │ │  +2.30%  │
└──────────┘ └──────────┘ └──────────┘
```
Click any card to change the stock being analyzed.

### 3. Current Stock Header
```
AAPL  [$178.45]  [+2.34 (+1.33%)]
```
This updates when you select a different stock.

### 4. Key Metrics (6 boxes)
```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Market  │ │ P/E     │ │ 52W     │ │ 52W     │ │ Div     │ │ Beta    │
│ Cap     │ │ Ratio   │ │ High    │ │ Low     │ │ Yield   │ │         │
│ $2.75T  │ │ 28.45   │ │ $198.23 │ │ $142.56 │ │ 0.52%   │ │ 1.24    │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### 5. Main Price Chart (SEPARATE - Above Technical Indicators)
```
┌───────────────────────────────────────────────────────┐
│ AAPL Price Chart    [1D][5D][1M][3M][6M][1Y][5Y]      │
├───────────────────────────────────────────────────────┤
│                                                        │
│  180 ╭─────╮                                          │
│      │     │╭────╮                                    │
│  175 ╯     ╰╯    ╰╮                                   │
│                    ╰─────                             │
│  170                                                   │
│                                                        │
│   Oct 10      Oct 20      Oct 30      Nov 9           │
└───────────────────────────────────────────────────────┘
```
**This is your main area chart showing price movement.**

### 6. Technical Indicators Section
```
┌─────────────────────────────────────────────────────────────┐
│ Technical Indicators                                         │
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│ Technical    │  RSI (14) - Relative Strength Index          │
│ Indicators   │  ┌────────────────────────────────────────┐  │
│              │  │ 100 ─────────────[Overbought]────────  │  │
│ 3 selected   │  │  70 ════════════════════════════════   │  │
│              │  │  50 ─────────────────────────────────  │  │
│ ▶ Trend (1)  │  │  30 ════════════════════════════════   │  │
│  ☑ SMA 20    │  │   0 ─────────────[Oversold]──────────  │  │
│  ☐ SMA 50    │  │      Oct 10   Oct 20   Oct 30   Nov 9  │  │
│  ☐ SMA 200   │  └────────────────────────────────────────┘  │
│              │                                               │
│ ▶ Momentum(2)│  MACD - Moving Average Convergence Div.      │
│  ☑ RSI       │  ┌────────────────────────────────────────┐  │
│  ☑ MACD      │  │  MACD ─── Signal ─── Histogram ▁▂▃▄▅  │  │
│  ☐ Stochastic│  │      Oct 10   Oct 20   Oct 30   Nov 9  │  │
│              │  └────────────────────────────────────────┘  │
│ ▶ Volatility │                                               │
│ ▶ Volume     │                                               │
│              │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

## What Should Work

### ✅ Stock Selection
1. **Click any featured stock card** (AAPL, MSFT, GOOGL, etc.)
   - Main price chart updates
   - Technical indicator charts recalculate
   - Symbol in header changes
   
2. **Use search bar** in header
   - Type stock symbol (e.g., "TSLA")
   - Press Enter or click result
   - All charts update

### ✅ Date Display
Dates should show as:
- `Dec 1, '23` (Short month, day, 2-digit year)
- Angled at -45 degrees on X-axis
- No more "Invalid Date" errors

### ✅ Indicator Selection
1. Click accordion categories to expand:
   - **Trend** - Moving averages (SMA, EMA)
   - **Momentum** - RSI, MACD, Stochastic
   - **Volatility** - Bollinger Bands, ATR, ADX, Keltner
   - **Volume** - OBV, VROC, MFI

2. Check/uncheck indicators
   - Charts appear/disappear immediately
   - Badge shows count: "3 selected"

3. Default indicators (automatically checked):
   - ✅ SMA 20
   - ✅ RSI
   - ✅ MACD

## Chart Details

### RSI Chart (When Selected)
```
┌────────────────────────────────────────┐
│ RSI (14) - Relative Strength Index    │
├────────────────────────────────────────┤
│ 100 ════════ [RED ZONE] ══════════    │ ← Overbought (>70)
│  70 ────────────────────────────────   │
│  50 ╭───╮─────╭──╮────────────────    │ ← Neutral
│  30 ─────╰───╯────╰────────────────   │
│   0 ════════ [GREEN ZONE] ═════════    │ ← Oversold (<30)
└────────────────────────────────────────┘
```

### MACD Chart (When Selected)
```
┌────────────────────────────────────────┐
│ MACD - Moving Average Convergence     │
├────────────────────────────────────────┤
│   3 ─────╭────╮──────────────────     │ ← MACD Line (green)
│   1 ────╭╯    ╰╮─────────────────     │ ← Signal Line (red)
│   0 ════════════════════════════       │
│  -1 ▁▂▃▄▅▆▇█  (histogram bars)        │
└────────────────────────────────────────┘
```

## Troubleshooting

### If dates don't show properly:
- Check that historical data is loading
- Look for "Loading..." badge
- Verify API connection to Supabase

### If indicators don't calculate:
- Make sure you have enough data points (minimum 30)
- Check that indicators are selected (checkbox checked)
- Look for console errors in browser DevTools

### If stock selection doesn't work:
- Click directly on stock card (not just hover)
- Try using search bar as alternative
- Check that symbol is valid (e.g., "AAPL", not "Apple")

## Browser Console

You should see:
```
✓ Stock data loaded: AAPL (90 points)
✓ Indicators calculated: RSI, MACD
✓ Charts rendered: 2 indicators
```

You should NOT see:
```
✗ Invalid date format
✗ Calculation failed
✗ undefined is not a function
```

## Performance Notes

- Initial load: ~2-3 seconds
- Stock switch: ~1-2 seconds
- Indicator toggle: Instant
- Chart rendering: < 500ms per chart

---

**Everything working?** ✅ You should see:
1. Main price chart at top
2. Technical indicators below with selector
3. Dates formatted consistently
4. Charts updating when you change stocks

**Having issues?** Check:
1. Browser console for errors
2. Network tab for API calls
3. React DevTools for state updates
