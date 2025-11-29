import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { SkipLinks } from './components/SkipLinks';
import { FocusIndicator } from './components/FocusIndicator';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { SearchBar } from './components/SearchBar';
import { BreadcrumbsWithSchema } from './components/Breadcrumbs';
import { SiteFooter } from './components/SiteFooter';
import { NavLink } from './components/InternalLink';
import { OptionsDockProvider, useOptionsDock } from '@/contexts/OptionsDockContext';
import OptionsDock from '@/components/options/OptionsDock';
import { ROUTES } from './lib/urlHelpers';
import { generateStructuredData } from './lib/seo';

const DEFAULT_SYMBOL = 'AAPL';

const readInitialSymbol = () => {
  if (typeof window === 'undefined') return DEFAULT_SYMBOL;
  try {
    const params = new URLSearchParams(window.location.search);
    const paramSymbol = params.get('symbol');
    return (paramSymbol ?? DEFAULT_SYMBOL).toUpperCase();
  } catch {
    return DEFAULT_SYMBOL;
  }
};

export type AppOutletContext = {
  selectedSymbol: string;
  handleSymbolChange: (symbol: string, options?: { navigate?: boolean }) => void;
};

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => readInitialSymbol());
  const navigate = useNavigate();
  const location = useLocation();
  const optionsDock = useOptionsDock();
  const optionsBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleSymbolChange = useCallback(
    (symbol: string, options: { navigate?: boolean } = {}) => {
      const normalized = symbol.toUpperCase();
      setSelectedSymbol(normalized);

      if (options.navigate) {
        const destination = ROUTES.stock(normalized);
        if (location.pathname !== destination) {
          navigate(destination);
        }
      }
    },
    [location.pathname, navigate]
  );

  const dockOpen = optionsDock.open;

  const navItems = useMemo(
    () => [
      {
        label: 'Dashboard',
        to: ROUTES.home(),
        isActive: location.pathname === '/' || location.pathname.startsWith('/stocks'),
        kind: 'link' as const,
      },
      { label: 'Watchlist', to: ROUTES.watchlist(), isActive: location.pathname.startsWith('/watchlist'), kind: 'link' as const },
      { label: 'Markets', to: ROUTES.markets(), isActive: location.pathname.startsWith('/markets'), kind: 'link' as const },
      { label: 'Compare', to: ROUTES.compare(), isActive: location.pathname.startsWith('/compare'), kind: 'link' as const },
      { label: 'Options', to: '/options', isActive: dockOpen, kind: 'options' as const },
      { label: 'Help', to: ROUTES.help(), isActive: location.pathname.startsWith('/help'), kind: 'link' as const },
    ],
    [location.pathname, dockOpen]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" data-testid="app-shell">
      <FocusIndicator />
      <SkipLinks />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <GlobalStructuredData />

      <header
        id="app-header"
        className="border-b border-slate-900 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-40"
        role="banner"
      >
        <div className="container mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-500" aria-hidden="true" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-400">Stock Whisperer</p>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Intelligent Market Navigation
                </h1>
              </div>
            </div>
            <nav aria-label="Primary" className="flex flex-wrap gap-4">
              {navItems.map((item) => {
                if (item.kind === 'options') {
                  const isOpen = dockOpen;
                  const commonProps = {
                    id: 'options-toggle',
                    ref: optionsBtnRef,
                    type: 'button' as const,
                    'aria-controls': 'options-dock',
                    'aria-haspopup': 'dialog' as const,
                    onClick: () => optionsDock.setOpen((v) => !v),
                    className: `text-sm font-medium px-3 py-1 rounded transition-colors ${
                      isOpen
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
                    }`,
                  };

                  return isOpen ? (
                    <button key={item.label} aria-expanded="true" aria-pressed="true" {...commonProps}>
                      {item.label}
                    </button>
                  ) : (
                    <button key={item.label} aria-expanded="false" aria-pressed="false" {...commonProps}>
                      {item.label}
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    active={item.isActive}
                    className={`text-sm font-medium transition-colors ${item.isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div role="search" aria-label="Global symbol search">
            <SearchBar onSelectSymbol={(symbol) => handleSymbolChange(symbol, { navigate: true })} />
          </div>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-8 flex-1 w-full" role="main">
        <BreadcrumbsWithSchema />
        <Suspense fallback={<div className="text-slate-400">Loading page...</div>}>
          <Outlet context={{ selectedSymbol, handleSymbolChange }} />
        </Suspense>
      </main>

      <SiteFooter />
      <OptionsDock triggerRef={optionsBtnRef} />
    </div>
  );
}

export default function AppWithProviders() {
  return (
    <OptionsDockProvider>
      <RouteCloseOptionsDock />
      <App />
    </OptionsDockProvider>
  );
}

function RouteCloseOptionsDock() {
  const location = useLocation();
  const { setOpen } = useOptionsDock();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, setOpen]);

  return null;
}

function GlobalStructuredData() {
  const organizationSchema = useMemo(() => generateStructuredData('Organization', {}), []);
  const webAppSchema = useMemo(() => generateStructuredData('WebApplication', {}), []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationSchema }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: webAppSchema }}
      />
    </>
  );
}
