export class URLBuilder {
  private baseUrl: string;
  private pathSegments: string[];
  private queryParams: Map<string, string>;
  private hashFragment?: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.pathSegments = [];
    this.queryParams = new Map();
  }

  static stock(symbol: string): URLBuilder {
    return new URLBuilder().addPath('stocks').addPath(symbol.toUpperCase());
  }

  static stockChart(symbol: string): URLBuilder {
    return URLBuilder.stock(symbol).addPath('chart');
  }

  static stockNews(symbol: string): URLBuilder {
    return URLBuilder.stock(symbol).addPath('news');
  }

  static compare(symbols: string[]): URLBuilder {
    return new URLBuilder()
      .addPath('compare')
      .addQuery('symbols', symbols.map(s => s.toUpperCase()).join(','));
  }

  static watchlist(): URLBuilder {
    return new URLBuilder().addPath('watchlist');
  }

  static markets(section?: string): URLBuilder {
    const builder = new URLBuilder().addPath('markets');
    if (section) {
      builder.addPath(section);
    }
    return builder;
  }

  addPath(segment: string): this {
    this.pathSegments.push(this.sanitizePath(segment));
    return this;
  }

  addQuery(key: string, value: string | number | boolean): this {
    this.queryParams.set(key, String(value));
    return this;
  }

  addHash(fragment: string): this {
    this.hashFragment = fragment;
    return this;
  }

  build(): string {
    let url = this.baseUrl;

    if (this.pathSegments.length > 0) {
      url += '/' + this.pathSegments.join('/');
    }

    if (this.queryParams.size > 0) {
      const params = Array.from(this.queryParams.entries())
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      url += '?' + params;
    }

    if (this.hashFragment) {
      url += '#' + this.hashFragment;
    }

    return url;
  }

  private sanitizePath(segment: string): string {
    return segment
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  toString(): string {
    return this.build();
  }
}

export function parseStockUrl(url: string): { symbol: string; view?: string } | null {
  const match = url.match(/\/stocks\/([A-Z]+)(?:\/([a-z]+))?/);
  if (!match) return null;

  return {
    symbol: match[1],
    view: match[2]
  };
}

export function buildShareUrl(path: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}${path}`;
}

export function getQueryParam(key: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function setQueryParam(key: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.pushState({}, '', url.toString());
}

export function removeQueryParam(key: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  window.history.pushState({}, '', url.toString());
}

export function normalizeUrl(url: string): string {
  let normalized = url.toLowerCase().trim();

  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createBreadcrumbUrl(segments: string[]): string {
  return '/' + segments.map(s => slugify(s)).join('/');
}

export const ROUTES = {
  home: () => '/',
  stocks: () => '/stocks',
  stock: (symbol: string) => `/stocks/${symbol.toUpperCase()}`,
  stockChart: (symbol: string) => `/stocks/${symbol.toUpperCase()}/chart`,
  stockNews: (symbol: string) => `/stocks/${symbol.toUpperCase()}/news`,
  stockAnalysis: (symbol: string) => `/stocks/${symbol.toUpperCase()}/analysis`,
  watchlist: () => '/watchlist',
  compare: (symbols?: string[]) => {
    const base = '/compare';
    return symbols?.length ? `${base}?symbols=${symbols.join(',')}` : base;
  },
  markets: () => '/markets',
  marketIndices: () => '/markets/indices',
  marketSectors: () => '/markets/sectors',
  sector: (name: string) => `/markets/sectors/${slugify(name)}`,
  screener: () => '/screener',
  alerts: () => '/alerts',
  portfolio: () => '/portfolio',
  settings: () => '/settings',
  liveChartDemo: () => '/live-chart-demo',
  help: () => '/help',
  helpGettingStarted: () => '/help/getting-started',
  helpIndicators: () => '/help/indicators',
  helpFocusManagement: () => '/help/focus-management',
  helpLinkingStrategy: () => '/help/internal-linking',
  helpIndicator: (name: string) => `/help/indicators/${slugify(name)}`,
  schwabConnect: () => '/schwab/connect',
  schwabCallback: () => '/schwab/callback',
  about: () => '/about',
  privacy: () => '/privacy',
  terms: () => '/terms',
  sitemap: () => '/sitemap'
} as const;
