# Anchor Text Best Practices Guide

## Overview

This guide provides comprehensive anchor text variations and best practices for Stock Whisperer's internal linking strategy.

## Principles

1. **Descriptive** - Tell users exactly what they'll find
2. **Natural** - Fits seamlessly into content
3. **Varied** - Avoid repetitive anchor text
4. **Accessible** - Clear for screen readers
5. **SEO-Friendly** - Contains relevant keywords without stuffing

## Anchor Text Variations by Page Type

### Stock Detail Pages

#### Primary Variations (Use Most Often)

```tsx
// Full name with ticker
<StockLink symbol="AAPL">Apple Inc. (AAPL)</StockLink>

// Ticker only
<StockLink symbol="AAPL">AAPL</StockLink>

// Company name only
<StockLink symbol="AAPL">Apple Inc.</StockLink>

// With action word
<InternalLink to="/stocks/AAPL">View Apple stock</InternalLink>
<InternalLink to="/stocks/AAPL">Analyze AAPL</InternalLink>
```

#### Contextual Variations

```tsx
// In watchlist
<StockLink symbol="AAPL">Apple (AAPL) stock</StockLink>

// In news
<StockLink symbol="AAPL">Apple</StockLink>

// In comparison
<StockLink symbol="AAPL">AAPL analysis</StockLink>

// In related stocks
<StockLink symbol="AAPL">Apple Inc.</StockLink>
```

#### With Descriptors

```tsx
<InternalLink to="/stocks/AAPL/chart">AAPL price chart</InternalLink>
<InternalLink to="/stocks/AAPL/news">Apple stock news</InternalLink>
<InternalLink to="/stocks/AAPL/analysis">AAPL technical analysis</InternalLink>
```

#### Long-Tail Variations

```tsx
<InternalLink to="/stocks/AAPL">Apple stock price today</InternalLink>
<InternalLink to="/stocks/AAPL">AAPL real-time quote</InternalLink>
<InternalLink to="/stocks/AAPL">Apple Inc. financial data</InternalLink>
```

### Dashboard/Home

```tsx
// From logo
<InternalLink to="/">Stock Whisperer</InternalLink>

// From breadcrumbs
<InternalLink to="/">Home</InternalLink>

// From content
<InternalLink to="/">Dashboard</InternalLink>
<InternalLink to="/">Return to dashboard</InternalLink>
<InternalLink to="/">Go to home page</InternalLink>

// From footer
<InternalLink to="/">Stock Whisperer Home</InternalLink>
```

### Watchlist

```tsx
// Primary
<InternalLink to="/watchlist">My Watchlist</InternalLink>
<InternalLink to="/watchlist">Watchlist</InternalLink>

// Action-oriented
<InternalLink to="/watchlist">View watchlist</InternalLink>
<InternalLink to="/watchlist">Manage watchlist</InternalLink>
<InternalLink to="/watchlist">Go to watchlist</InternalLink>

// Descriptive
<InternalLink to="/watchlist">Saved stocks</InternalLink>
<InternalLink to="/watchlist">Track your stocks</InternalLink>
<InternalLink to="/watchlist">Stock watchlist manager</InternalLink>
```

### Comparison Tool

```tsx
// Primary
<InternalLink to="/compare">Compare Stocks</InternalLink>
<InternalLink to="/compare">Stock Comparison</InternalLink>

// Action-oriented
<InternalLink to="/compare">Compare multiple stocks</InternalLink>
<InternalLink to="/compare">Compare stock performance</InternalLink>

// Specific comparisons
<InternalLink to="/compare?symbols=AAPL,MSFT">
  Compare AAPL vs MSFT
</InternalLink>
<InternalLink to="/compare?symbols=AAPL,MSFT,GOOGL">
  Compare tech giants
</InternalLink>

// Contextual
<InternalLink to="/compare?base=AAPL">
  Compare AAPL with other stocks
</InternalLink>
```

### Market Pages

```tsx
// Overview
<InternalLink to="/markets">Market Overview</InternalLink>
<InternalLink to="/markets">Markets</InternalLink>
<InternalLink to="/markets">View all markets</InternalLink>

// Indices
<InternalLink to="/markets/indices">Market Indices</InternalLink>
<InternalLink to="/markets/indices">Stock market indices</InternalLink>
<InternalLink to="/markets/indices">View S&P 500, Dow Jones</InternalLink>

// Sectors
<InternalLink to="/markets/sectors">Market Sectors</InternalLink>
<InternalLink to="/markets/sectors">Sector Performance</InternalLink>
<InternalLink to="/markets/sectors">Industry sectors</InternalLink>

// Specific sector
<InternalLink to="/markets/sectors/technology">
  Technology stocks
</InternalLink>
<InternalLink to="/markets/sectors/healthcare">
  Healthcare sector
</InternalLink>
```

### Tools & Features

```tsx
// Screener
<InternalLink to="/screener">Stock Screener</InternalLink>
<InternalLink to="/screener">Find stocks</InternalLink>
<InternalLink to="/screener">Screen stocks by criteria</InternalLink>

// Alerts
<InternalLink to="/alerts">Price Alerts</InternalLink>
<InternalLink to="/alerts">Set price alerts</InternalLink>
<InternalLink to="/alerts">Manage alerts</InternalLink>

// Portfolio
<InternalLink to="/portfolio">Portfolio Tracker</InternalLink>
<InternalLink to="/portfolio">My Portfolio</InternalLink>
<InternalLink to="/portfolio">Track your investments</InternalLink>
```

### Help & Documentation

```tsx
// Main help
<InternalLink to="/help">Help Center</InternalLink>
<InternalLink to="/help">Documentation</InternalLink>
<InternalLink to="/help">Get help</InternalLink>

// Getting started
<InternalLink to="/help/getting-started">Getting Started</InternalLink>
<InternalLink to="/help/getting-started">Quick start guide</InternalLink>
<InternalLink to="/help/getting-started">New user guide</InternalLink>

// Indicators
<InternalLink to="/help/indicators">Technical Indicators</InternalLink>
<InternalLink to="/help/indicators">Learn about indicators</InternalLink>
<InternalLink to="/help/indicators">Indicator documentation</InternalLink>

// Specific indicator
<InternalLink to="/help/indicators/rsi">RSI Indicator</InternalLink>
<InternalLink to="/help/indicators/macd">MACD explained</InternalLink>
<InternalLink to="/help/indicators/bollinger-bands">
  Bollinger Bands guide
</InternalLink>
```

## Context-Specific Examples

### In Sentence Context

```tsx
// Good
<p>
  Check out the latest{' '}
  <InternalLink to="/stocks/AAPL">Apple (AAPL) analysis</InternalLink>
  {' '}for today's market insights.
</p>

// Better
<p>
  <StockLink symbol="AAPL">Apple</StockLink> announced record earnings.
  View the complete{' '}
  <InternalLink to="/stocks/AAPL/analysis">
    technical analysis
  </InternalLink>.
</p>
```

### In Lists

```tsx
<ul>
  <li><StockLink symbol="AAPL">Apple Inc.</StockLink></li>
  <li><StockLink symbol="MSFT">Microsoft Corp.</StockLink></li>
  <li><StockLink symbol="GOOGL">Alphabet Inc.</StockLink></li>
</ul>
```

### In Buttons/CTAs

```tsx
<button>
  <InternalLink to="/stocks/AAPL">View AAPL Chart</InternalLink>
</button>

<button>
  <InternalLink to="/compare?base=AAPL">Compare Stocks</InternalLink>
</button>
```

### In Cards

```tsx
<div className="stock-card">
  <h3><StockLink symbol="AAPL">AAPL</StockLink></h3>
  <p>Apple Inc.</p>
  <InternalLink to="/stocks/AAPL/chart">View Chart →</InternalLink>
</div>
```

## What to Avoid

### ❌ Generic Anchor Text

**Don't:**
```tsx
<InternalLink to="/stocks/AAPL">Click here</InternalLink>
<InternalLink to="/stocks/AAPL">Read more</InternalLink>
<InternalLink to="/stocks/AAPL">Link</InternalLink>
<InternalLink to="/stocks/AAPL">This page</InternalLink>
```

**Do:**
```tsx
<InternalLink to="/stocks/AAPL">View Apple stock analysis</InternalLink>
<InternalLink to="/stocks/AAPL">Apple (AAPL) details</InternalLink>
<InternalLink to="/stocks/AAPL">AAPL technical indicators</InternalLink>
<InternalLink to="/stocks/AAPL">Apple Inc. stock page</InternalLink>
```

### ❌ Keyword Stuffing

**Don't:**
```tsx
<InternalLink to="/stocks/AAPL">
  Apple stock AAPL Apple Inc stock price AAPL stock
</InternalLink>
```

**Do:**
```tsx
<InternalLink to="/stocks/AAPL">
  Apple Inc. (AAPL) stock
</InternalLink>
```

### ❌ URL as Anchor Text

**Don't:**
```tsx
<InternalLink to="/stocks/AAPL">
  https://stockwhisperer.app/stocks/AAPL
</InternalLink>
```

**Do:**
```tsx
<InternalLink to="/stocks/AAPL">
  Apple stock page
</InternalLink>
```

### ❌ Too Long

**Don't:**
```tsx
<InternalLink to="/stocks/AAPL">
  Click here to view the complete Apple Inc. (AAPL) stock analysis
  including technical indicators, price charts, and news
</InternalLink>
```

**Do:**
```tsx
<InternalLink to="/stocks/AAPL">
  View complete Apple (AAPL) analysis
</InternalLink>
```

## Anchor Text Distribution

### Recommended Ratios

For a stock like AAPL across the site:

- **40%** - Exact match: "AAPL"
- **30%** - Branded: "Apple Inc. (AAPL)", "Apple stock"
- **20%** - Descriptive: "View AAPL chart", "AAPL analysis"
- **10%** - Long-tail: "Apple stock price today", "AAPL technical indicators"

### Example Distribution

On 10 links to AAPL stock page:

1. "AAPL"
2. "Apple Inc. (AAPL)"
3. "AAPL"
4. "Apple stock"
5. "View AAPL analysis"
6. "AAPL"
7. "Apple Inc."
8. "AAPL technical indicators"
9. "AAPL"
10. "Apple stock price"

## Accessibility Considerations

### Screen Reader Friendly

```tsx
// Good
<InternalLink
  to="/stocks/AAPL"
  aria-label="View Apple Inc. complete stock analysis"
>
  AAPL
</InternalLink>

// Better for context
<InternalLink to="/stocks/AAPL">
  Apple Inc. (AAPL)
</InternalLink>
```

### Icon-Only Links

```tsx
<InternalLink
  to="/settings"
  aria-label="Settings"
>
  <SettingsIcon aria-hidden="true" />
</InternalLink>
```

### Current Page

```tsx
<NavLink
  to="/watchlist"
  active={true}
  aria-current="page"
>
  Watchlist
</NavLink>
```

## SEO Optimization

### Title Tag Keywords

Match anchor text to page title:

```tsx
// Page title: "AAPL Stock | Apple Inc. Analysis | Stock Whisperer"
// Anchor text options:
<StockLink symbol="AAPL">AAPL stock</StockLink>
<StockLink symbol="AAPL">Apple Inc. analysis</StockLink>
<StockLink symbol="AAPL">AAPL</StockLink>
```

### LSI Keywords (Latent Semantic Indexing)

Use related terms:

```tsx
// For stock pages
<InternalLink to="/stocks/AAPL">Apple stock</InternalLink>
<InternalLink to="/stocks/AAPL">AAPL shares</InternalLink>
<InternalLink to="/stocks/AAPL">Apple equity</InternalLink>
<InternalLink to="/stocks/AAPL">AAPL ticker</InternalLink>
```

### Location-Based (if applicable)

```tsx
<InternalLink to="/stocks/AAPL">
  Apple stock in US market
</InternalLink>
<InternalLink to="/stocks/AAPL">
  AAPL on NASDAQ
</InternalLink>
```

## Testing Your Anchor Text

### Checklist

- [ ] Describes destination clearly
- [ ] Makes sense out of context
- [ ] Contains relevant keywords
- [ ] Not too long (under 60 characters)
- [ ] Unique on the page
- [ ] Natural in sentence flow
- [ ] Screen reader friendly
- [ ] No generic phrases

### A/B Testing

Test different anchor text variations:

**Variation A:**
```tsx
<InternalLink to="/stocks/AAPL">View Details</InternalLink>
```

**Variation B:**
```tsx
<InternalLink to="/stocks/AAPL">View AAPL Analysis</InternalLink>
```

Track click-through rates to optimize.

## Quick Reference

### Stock Pages

- ✅ "Apple Inc. (AAPL)"
- ✅ "AAPL stock"
- ✅ "View AAPL chart"
- ✅ "Apple analysis"
- ❌ "Click here"
- ❌ "Read more"

### Features

- ✅ "Compare stocks"
- ✅ "Stock screener"
- ✅ "My watchlist"
- ✅ "Price alerts"
- ❌ "Tool"
- ❌ "Feature"

### Navigation

- ✅ "Market overview"
- ✅ "Help center"
- ✅ "Getting started"
- ✅ "Technical indicators"
- ❌ "Page"
- ❌ "Section"

## Summary

**Good anchor text is:**
- Descriptive and specific
- Natural in context
- Varied across the site
- Accessible to all users
- SEO-friendly
- Action-oriented when appropriate

**Avoid:**
- Generic phrases
- Keyword stuffing
- URLs as text
- Overly long text
- Same text for different pages
- Ambiguous references

Use this guide to create effective internal links that help both users and search engines understand your site structure and content.
