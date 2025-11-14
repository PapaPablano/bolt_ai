import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
}

export function Breadcrumbs({ items, maxItems = 5 }: BreadcrumbsProps) {
  const location = useLocation();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items;

    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const isLast = index === paths.length - 1;

      breadcrumbs.push({
        label: formatLabel(path),
        path: currentPath,
        current: isLast
      });
    });

    return breadcrumbs;
  };

  const formatLabel = (path: string): string => {
    const pathMap: Record<string, string> = {
      'stocks': 'Stocks',
      'watchlist': 'Watchlist',
      'compare': 'Compare',
      'markets': 'Markets',
      'indices': 'Market Indices',
      'sectors': 'Sectors',
      'help': 'Help Center',
      'getting-started': 'Getting Started',
      'indicators': 'Technical Indicators',
      'chart': 'Chart Analysis',
      'news': 'News',
      'analysis': 'Analysis',
      'screener': 'Stock Screener',
      'alerts': 'Price Alerts',
      'portfolio': 'Portfolio',
      'settings': 'Settings',
      'about': 'About'
    };

    if (pathMap[path]) {
      return pathMap[path];
    }

    if (path.length <= 5 && /^[A-Z]+$/.test(path)) {
      return path.toUpperCase();
    }

    return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
  };

  const breadcrumbs = generateBreadcrumbs();

  const displayedBreadcrumbs = breadcrumbs.length > maxItems
    ? [
        breadcrumbs[0],
        { label: '...', path: '', current: false },
        ...breadcrumbs.slice(-2)
      ]
    : breadcrumbs;

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center space-x-2 text-sm text-slate-400 mb-6 overflow-x-auto"
    >
      <ol className="flex items-center space-x-2" role="list">
        {displayedBreadcrumbs.map((item, index) => (
          <li key={item.path || index} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className="w-4 h-4 mx-2 flex-shrink-0"
                aria-hidden="true"
              />
            )}

            {item.label === '...' ? (
              <span className="px-2 text-slate-500">...</span>
            ) : item.current ? (
              <span
                className="font-medium text-slate-200"
                aria-current="page"
              >
                {index === 0 && (
                  <Home className="w-4 h-4 inline mr-1" aria-hidden="true" />
                )}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-slate-200 transition-colors flex items-center"
                aria-label={index === 0 ? 'Go to home page' : `Go to ${item.label}`}
              >
                {index === 0 && (
                  <Home className="w-4 h-4 inline mr-1" aria-hidden="true" />
                )}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BreadcrumbsWithSchema({ items }: { items?: BreadcrumbItem[] }) {
  const breadcrumbs = items || [];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.label,
      'item': `${window.location.origin}${item.path}`
    }))
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Breadcrumbs items={items} />
    </>
  );
}
