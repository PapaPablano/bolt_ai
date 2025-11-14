# SEO & Internal Linking Implementation Guide

## Quick Start

### 1. Install React Router (if not already installed)

```bash
npm install react-router-dom
```

### 2. Import Components

```tsx
// In your main component
import { Breadcrumbs } from './components/Breadcrumbs';
import { SiteFooter } from './components/SiteFooter';
import { InternalLink, StockLink } from './components/InternalLink';
import { RelatedStocks } from './components/RelatedStocks';
```

### 3. Add to Layout

```tsx
function Layout() {
  return (
    <div>
      <Header />
      <Breadcrumbs />
      <main>
        {/* Your content */}
      </main>
      <SiteFooter />
    </div>
  );
}
```

## Component Usage

### Breadcrumbs

**Auto-generated breadcrumbs:**
```tsx
<Breadcrumbs />
```

**Custom breadcrumbs:**
```tsx
<Breadcrumbs
  items={[
    { label: 'Home', path: '/' },
    { label: 'Markets', path: '/markets' },
    { label: 'Technology', path: '/markets/sectors/technology', current: true }
  ]}
/>
```

**With schema.org markup:**
```tsx
<BreadcrumbsWithSchema />
```

### Internal Links

**Basic link:**
```tsx
<InternalLink to="/watchlist">
  View Watchlist
</InternalLink>
```

**Stock-specific link:**
```tsx
<StockLink symbol="AAPL">
  Apple Inc.
</StockLink>

// Or with custom text
<StockLink symbol="AAPL" className="custom-class">
  View Apple Stock
</StockLink>
```

**Navigation link (with active state):**
```tsx
<NavLink to="/markets" active={currentPath === '/markets'}>
  Markets
</NavLink>
```

**External link:**
```tsx
<InternalLink to="https://external-site.com" external>
  External Resource
</InternalLink>
```

**Link with prefetch:**
```tsx
<InternalLink to="/stocks/AAPL" prefetch>
  Apple Stock
</InternalLink>
```

### Related Stocks

```tsx
<RelatedStocks
  currentSymbol="AAPL"
  stocks={[
    { symbol: 'MSFT', name: 'Microsoft', change: 1.5, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet', change: -0.3, sector: 'Technology' },
    { symbol: 'META', name: 'Meta', change: 2.1, sector: 'Technology' }
  ]}
  title="Related Tech Stocks"
  showCompareLink={true}
/>
```

**Sector stocks view:**
```tsx
<SectorStocks
  sector="Technology"
  stocks={techStocks}
/>
```

### Footer

```tsx
<SiteFooter />
```

The footer includes:
- Company information
- Market links
- Tool links
- Help & documentation links
- Social media links
- Copyright notice

## URL Helpers

### URLBuilder Class

```tsx
import { URLBuilder, ROUTES } from '@/lib/urlHelpers';

// Build stock URL
const url = URLBuilder.stock('AAPL').build();
// Result: /stocks/AAPL

// Build stock chart URL
const chartUrl = URLBuilder.stockChart('AAPL').build();
// Result: /stocks/AAPL/chart

// Build comparison URL
const compareUrl = URLBuilder.compare(['AAPL', 'MSFT', 'GOOGL']).build();
// Result: /compare?symbols=AAPL,MSFT,GOOGL

// Build with query parameters
const url = new URLBuilder()
  .addPath('screener')
  .addQuery('sector', 'technology')
  .addQuery('minPrice', 100)
  .addHash('results')
  .build();
// Result: /screener?sector=technology&minPrice=100#results
```

### Predefined Routes

```tsx
import { ROUTES } from '@/lib/urlHelpers';

// Use predefined routes
<InternalLink to={ROUTES.stock('AAPL')}>
  View Apple
</InternalLink>

<InternalLink to={ROUTES.compare(['AAPL', 'MSFT'])}>
  Compare Stocks
</InternalLink>

<InternalLink to={ROUTES.helpIndicator('rsi')}>
  Learn about RSI
</InternalLink>
```

## SEO Utilities

### Update Meta Tags

```tsx
import { updateMetaTags, generateStockMetadata } from '@/lib/seo';

// In your component
useEffect(() => {
  const metadata = generateStockMetadata('AAPL', 'Apple Inc.', 150.25);
  updateMetaTags(metadata);
}, [symbol]);
```

### Linkify Stock Symbols

```tsx
import { linkifyStockSymbols } from '@/lib/seo';

const newsText = "Apple and Microsoft announced partnership...";
const linkedText = linkifyStockSymbols(newsText, ['AAPL', 'MSFT']);
// Result: "<a href='/stocks/AAPL'>AAPL</a> and <a href='/stocks/MSFT'>MSFT</a> announced partnership..."
```

### Generate Structured Data

```tsx
import { generateStructuredData } from '@/lib/seo';

const schema = generateStructuredData('Organization', {
  name: 'Stock Whisperer',
  url: 'https://stockwhisperer.app'
});

// Add to head
<script type="application/ld+json">
  {schema}
</script>
```

## Best Practices

### 1. Always Use InternalLink Component

❌ **Don't:**
```tsx
<a href="/stocks/AAPL">View Apple</a>
```

✅ **Do:**
```tsx
<InternalLink to="/stocks/AAPL">View Apple</InternalLink>
```

### 2. Use Descriptive Anchor Text

❌ **Don't:**
```tsx
<InternalLink to="/stocks/AAPL">Click here</InternalLink>
```

✅ **Do:**
```tsx
<InternalLink to="/stocks/AAPL">View Apple (AAPL) stock analysis</InternalLink>
```

### 3. Add Breadcrumbs to All Pages

```tsx
function StockDetail({ symbol }) {
  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Home', path: '/' },
          { label: 'Stocks', path: '/stocks' },
          { label: symbol, path: `/stocks/${symbol}`, current: true }
        ]}
      />
      {/* Page content */}
    </div>
  );
}
```

### 4. Update Meta Tags for Each Page

```tsx
function StockDetail({ symbol, name, price }) {
  useEffect(() => {
    const metadata = generateStockMetadata(symbol, name, price);
    updateMetaTags(metadata);
  }, [symbol, name, price]);

  return (/* ... */);
}
```

### 5. Include Related Content

```tsx
function StockDetail({ symbol }) {
  const relatedStocks = useRelatedStocks(symbol);

  return (
    <div>
      {/* Main content */}

      <RelatedStocks
        currentSymbol={symbol}
        stocks={relatedStocks}
      />
    </div>
  );
}
```

### 6. Add Contextual Links

```tsx
function NewsItem({ article }) {
  const linkedContent = linkifyStockSymbols(
    article.content,
    article.mentionedSymbols
  );

  return (
    <div dangerouslySetInnerHTML={{ __html: linkedContent }} />
  );
}
```

## Accessibility

### Aria Labels

```tsx
<InternalLink
  to="/stocks/AAPL"
  aria-label="View complete Apple Inc. stock analysis"
>
  AAPL
</InternalLink>
```

### Current Page Indicator

```tsx
<NavLink
  to="/watchlist"
  active={isCurrentPage}
  aria-current={isCurrentPage ? 'page' : undefined}
>
  Watchlist
</NavLink>
```

### Skip Links

Already implemented in `<SkipLinks />` component.

## Testing

### Test Breadcrumbs

1. Navigate to different pages
2. Verify breadcrumbs show correct path
3. Check breadcrumbs are clickable
4. Verify structured data in HTML

### Test Internal Links

1. Click various internal links
2. Verify they navigate correctly
3. Check external links open in new tab
4. Verify prefetch works (check Network tab)

### Test SEO Meta Tags

1. Navigate to different pages
2. Check `<head>` for correct meta tags
3. Use tools like:
   - Google Rich Results Test
   - Facebook Sharing Debugger
   - Twitter Card Validator

### Test Footer Links

1. Verify all links work
2. Check they're organized logically
3. Verify social links open externally

## Performance

### Link Prefetching

The `InternalLink` component supports prefetching:

```tsx
<InternalLink to="/stocks/AAPL" prefetch>
  Apple Stock
</InternalLink>
```

On hover, it prefetches the page for faster navigation.

### Code Splitting

Combine with React Router's lazy loading:

```tsx
import { lazy } from 'react';

const StockDetail = lazy(() => import('./pages/StockDetail'));

// In router
{
  path: '/stocks/:symbol',
  element: <StockDetail />
}
```

## Sitemap Generation

```tsx
import { generateSitemap } from '@/lib/seo';

// Generate sitemap XML
const sitemap = generateSitemap();

// Save to public/sitemap.xml or serve dynamically
```

## Robots.txt

```tsx
import { generateRobotsTxt } from '@/lib/seo';

const robotsTxt = generateRobotsTxt();
```

Save to `public/robots.txt`.

## Analytics Tracking

Add to your link onClick handlers:

```tsx
<InternalLink
  to="/stocks/AAPL"
  onClick={() => {
    // Track click
    analytics.track('internal_link_click', {
      destination: '/stocks/AAPL',
      source: 'watchlist'
    });
  }}
>
  Apple Stock
</InternalLink>
```

## Monitoring

### Track These Metrics

1. **Click-through rate** on internal links
2. **Pages per session** (should increase)
3. **Bounce rate** (should decrease)
4. **Average session duration** (should increase)
5. **Search engine traffic** to key pages

### Regular Audits

Run these checks monthly:

```bash
# Check for broken links
npm run check-links

# Generate sitemap
npm run generate-sitemap

# Validate structured data
npm run validate-schema
```

## Troubleshooting

### Issue: Links not working

**Solution:** Ensure React Router is properly configured:

```tsx
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <App />
</BrowserRouter>
```

### Issue: Breadcrumbs not showing

**Solution:** Check that component is inside Router context.

### Issue: Meta tags not updating

**Solution:** Call `updateMetaTags()` in useEffect:

```tsx
useEffect(() => {
  updateMetaTags(metadata);
}, [/* dependencies */]);
```

### Issue: Footer links broken

**Solution:** Verify all routes are defined in your router configuration.

## Next Steps

1. ✅ Implement all components
2. ✅ Add breadcrumbs to pages
3. ✅ Replace `<a>` tags with `<InternalLink>`
4. ✅ Add footer to layout
5. ✅ Implement related stocks
6. ✅ Update meta tags per page
7. ✅ Generate sitemap
8. ✅ Monitor analytics
9. ✅ Iterate based on data

## Summary

This implementation provides:
- ✅ Semantic internal linking
- ✅ SEO-friendly breadcrumbs
- ✅ Comprehensive footer navigation
- ✅ URL structure helpers
- ✅ Meta tag management
- ✅ Structured data support
- ✅ Accessibility compliance
- ✅ Performance optimization

All components are fully typed, accessible, and SEO-optimized.
