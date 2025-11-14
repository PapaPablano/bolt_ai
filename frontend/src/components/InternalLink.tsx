import { Link as RouterLink } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ReactNode } from 'react';

interface InternalLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  prefetch?: boolean;
  rel?: string;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  onClick?: () => void;
}

export function InternalLink({
  to,
  children,
  className = '',
  external = false,
  prefetch = false,
  rel,
  title,
  onClick,
  ...ariaProps
}: InternalLinkProps) {
  const isExternal = external || to.startsWith('http');

  const handleMouseEnter = () => {
    if (prefetch && !isExternal) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = to;
      document.head.appendChild(link);
    }
  };

  if (isExternal) {
    return (
      <a
        href={to}
        className={`inline-flex items-center gap-1 ${className}`}
        target="_blank"
        rel={rel || 'noopener noreferrer'}
        title={title}
        onClick={onClick}
        {...ariaProps}
      >
        {children}
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
      </a>
    );
  }

  return (
    <RouterLink
      to={to}
      className={className}
      title={title}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
      {...ariaProps}
    >
      {children}
    </RouterLink>
  );
}

export function StockLink({
  symbol,
  children,
  className = '',
}: {
  symbol: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <InternalLink
      to={`/stocks/${symbol.toUpperCase()}`}
      className={`stock-link hover:text-blue-400 transition-colors ${className}`}
      aria-label={`View ${symbol} stock details`}
      prefetch
    >
      {children || symbol.toUpperCase()}
    </InternalLink>
  );
}

export function NavLink({
  to,
  children,
  active = false,
  className = '',
}: {
  to: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <InternalLink
      to={to}
      className={`nav-link ${active ? 'active' : ''} ${className}`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </InternalLink>
  );
}
