export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  noindex?: boolean;
  nofollow?: boolean;
}

export function updateMetaTags(metadata: SEOMetadata): void {
  document.title = metadata.title;

  updateMetaTag('name', 'description', metadata.description);

  if (metadata.keywords) {
    updateMetaTag('name', 'keywords', metadata.keywords.join(', '));
  }

  if (metadata.canonical) {
    updateLinkTag('canonical', metadata.canonical);
  }

  updateMetaTag('property', 'og:title', metadata.ogTitle || metadata.title);
  updateMetaTag('property', 'og:description', metadata.ogDescription || metadata.description);
  updateMetaTag('property', 'og:type', metadata.ogType || 'website');

  if (metadata.ogImage) {
    updateMetaTag('property', 'og:image', metadata.ogImage);
  }

  updateMetaTag('name', 'twitter:card', metadata.twitterCard || 'summary_large_image');
  updateMetaTag('name', 'twitter:title', metadata.ogTitle || metadata.title);
  updateMetaTag('name', 'twitter:description', metadata.ogDescription || metadata.description);

  if (metadata.ogImage) {
    updateMetaTag('name', 'twitter:image', metadata.ogImage);
  }

  const robotsContent = [];
  if (metadata.noindex) robotsContent.push('noindex');
  if (metadata.nofollow) robotsContent.push('nofollow');
  if (robotsContent.length > 0) {
    updateMetaTag('name', 'robots', robotsContent.join(', '));
  }
}

function updateMetaTag(attribute: string, key: string, content: string): void {
  let element = document.querySelector(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string): void {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;

  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
}

export function generateStockMetadata(symbol: string, name: string, price?: number): SEOMetadata {
  const priceText = price ? ` - $${price.toFixed(2)}` : '';

  return {
    title: `${symbol} Stock${priceText} | ${name} Analysis | Stock Whisperer`,
    description: `Real-time ${symbol} stock analysis with technical indicators, price charts, and news. Track ${name} performance and make informed trading decisions.`,
    keywords: [
      symbol,
      `${symbol} stock`,
      `${name}`,
      `${symbol} price`,
      `${symbol} analysis`,
      'stock trading',
      'technical analysis',
      'stock charts'
    ],
    canonical: `/stocks/${symbol}`,
    ogTitle: `${symbol} - ${name}${priceText}`,
    ogDescription: `View real-time ${symbol} stock data, technical analysis, and market insights on Stock Whisperer.`,
    ogImage: `/og-images/stock-${symbol}.png`,
    ogType: 'article',
    twitterCard: 'summary_large_image'
  };
}

export function generateComparisonMetadata(symbols: string[]): SEOMetadata {
  const symbolList = symbols.join(', ');

  return {
    title: `Compare ${symbolList} | Stock Comparison Tool | Stock Whisperer`,
    description: `Compare ${symbolList} stocks side-by-side. Analyze performance, technical indicators, and trends to make informed investment decisions.`,
    keywords: [...symbols, 'stock comparison', 'compare stocks', 'stock analysis'],
    canonical: `/compare?symbols=${symbols.join(',')}`,
    ogTitle: `Compare ${symbolList} Stocks`,
    ogDescription: `Side-by-side comparison of ${symbolList} with technical analysis and performance metrics.`,
    twitterCard: 'summary_large_image'
  };
}

export function generatePageMetadata(page: string): SEOMetadata {
  const metadata: Record<string, SEOMetadata> = {
    home: {
      title: 'Stock Whisperer | Professional Trading Platform with Real-Time Market Data',
      description: 'Track stocks, analyze charts, and make informed trading decisions with Stock Whisperer. Real-time quotes, technical indicators, and ML-powered insights.',
      keywords: ['stock trading', 'stock analysis', 'market data', 'technical indicators', 'stock charts'],
      canonical: '/'
    },
    watchlist: {
      title: 'My Watchlist | Track Your Favorite Stocks | Stock Whisperer',
      description: 'Manage and monitor your stock watchlist. Track real-time prices, set alerts, and analyze your favorite stocks all in one place.',
      keywords: ['stock watchlist', 'track stocks', 'portfolio tracker'],
      canonical: '/watchlist'
    },
    markets: {
      title: 'Market Overview | Indices, Sectors & Trends | Stock Whisperer',
      description: 'Comprehensive market overview with real-time indices, sector performance, and market trends. Stay informed about market movements.',
      keywords: ['market overview', 'market indices', 'sector performance', 'stock market'],
      canonical: '/markets'
    },
    screener: {
      title: 'Stock Screener | Find Stocks by Criteria | Stock Whisperer',
      description: 'Advanced stock screener to find stocks based on technical indicators, fundamentals, and custom criteria. Discover investment opportunities.',
      keywords: ['stock screener', 'stock finder', 'investment research'],
      canonical: '/screener'
    },
    help: {
      title: 'Help Center | Stock Whisperer Documentation & Guides',
      description: 'Learn how to use Stock Whisperer with comprehensive guides, tutorials, and documentation. Get help with features and trading strategies.',
      keywords: ['help', 'documentation', 'trading guide', 'how to trade'],
      canonical: '/help'
    },
    'help-getting-started': {
      title: 'Getting Started | Walkthrough & Environment Setup | Stock Whisperer',
      description: 'Configure your environment, connect Supabase, and learn the fastest workflows for navigating Stock Whisperer.',
      keywords: ['getting started', 'setup guide', 'stock whisperer onboarding'],
      canonical: '/help/getting-started'
    },
    'help-indicators': {
      title: 'Technical Indicators Guide | Stock Whisperer',
      description: 'Understand RSI, MACD, KDJ, and on-chart overlays within Stock Whisperer along with tuning guidance.',
      keywords: ['technical indicators', 'RSI', 'MACD', 'KDJ'],
      canonical: '/help/indicators'
    },
    'help-focus-management': {
      title: 'Focus Management & Accessibility | Stock Whisperer',
      description: 'Review WCAG-aligned focus handling patterns, skip links, and accessible UI primitives used across the platform.',
      keywords: ['focus management', 'accessibility', 'WCAG'],
      canonical: '/help/focus-management'
    },
    'help-internal-linking': {
      title: 'Internal Linking Strategy | Stock Whisperer',
      description: 'Anchor text guidelines, contextual linking playbooks, and SEO considerations for Stock Whisperer content.',
      keywords: ['internal linking', 'SEO anchors', 'site architecture'],
      canonical: '/help/internal-linking'
    },
    sitemap: {
      title: 'Sitemap | Stock Whisperer Site Structure',
      description: 'Explore every public page, help resource, and market tool available on Stock Whisperer.',
      keywords: ['sitemap', 'site navigation'],
      canonical: '/sitemap'
    }
  };

  return metadata[page] || metadata.home;
}

export function linkifyStockSymbols(text: string, knownSymbols: string[]): string {
  let result = text;

  knownSymbols.forEach(symbol => {
    const regex = new RegExp(`\\b${symbol}\\b(?![^<]*>)`, 'g');
    result = result.replace(
      regex,
      `<a href="/stocks/${symbol}" class="stock-mention">${symbol}</a>`
    );
  });

  return result;
}

export function generateSitemap(): string {
  const baseUrl = 'https://stockwhisperer.app';
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/stocks', priority: '0.9', changefreq: 'daily' },
    { loc: '/watchlist', priority: '0.8', changefreq: 'daily' },
    { loc: '/compare', priority: '0.8', changefreq: 'weekly' },
    { loc: '/markets', priority: '0.9', changefreq: 'daily' },
    { loc: '/markets/indices', priority: '0.8', changefreq: 'daily' },
    { loc: '/markets/sectors', priority: '0.8', changefreq: 'daily' },
    { loc: '/screener', priority: '0.7', changefreq: 'weekly' },
    { loc: '/alerts', priority: '0.6', changefreq: 'weekly' },
    { loc: '/portfolio', priority: '0.7', changefreq: 'daily' },
    { loc: '/help', priority: '0.6', changefreq: 'monthly' },
    { loc: '/help/getting-started', priority: '0.5', changefreq: 'monthly' },
    { loc: '/help/indicators', priority: '0.5', changefreq: 'monthly' },
    { loc: '/help/focus-management', priority: '0.4', changefreq: 'quarterly' },
    { loc: '/help/internal-linking', priority: '0.4', changefreq: 'quarterly' },
    { loc: '/about', priority: '0.4', changefreq: 'monthly' },
    { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
    { loc: '/sitemap', priority: '0.2', changefreq: 'monthly' }
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

export function generateRobotsTxt(): string {
  const baseUrl = 'https://stockwhisperer.app';

  return `# Stock Whisperer Robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /*.json$

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay
Crawl-delay: 1`;
}

export function getCanonicalUrl(path: string): string {
  const baseUrl = 'https://stockwhisperer.app';
  return `${baseUrl}${path}`;
}

export function generateStructuredData(type: 'Organization' | 'WebApplication' | 'BreadcrumbList', data: any) {
  const schemas: Record<string, any> = {
    Organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Stock Whisperer',
      'url': 'https://stockwhisperer.app',
      'logo': 'https://stockwhisperer.app/icons/icon-512x512.png',
      'description': 'Professional stock trading and analysis platform',
      'sameAs': [
        'https://twitter.com/stockwhisperer',
        'https://github.com/stockwhisperer'
      ]
    },
    WebApplication: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'Stock Whisperer',
      'url': 'https://stockwhisperer.app',
      'applicationCategory': 'FinanceApplication',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'operatingSystem': 'Any'
    }
  };

  return JSON.stringify({ ...schemas[type], ...data });
}
