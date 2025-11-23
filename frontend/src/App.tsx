import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { SkipLinks } from './components/SkipLinks';
import { FocusIndicator } from './components/FocusIndicator';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { SearchBar } from './components/SearchBar';
import { BreadcrumbsWithSchema } from './components/Breadcrumbs';
import { SiteFooter } from './components/SiteFooter';
import { NavLink, InternalLink } from './components/InternalLink';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const MarketsPage = lazy(() => import('./pages/MarketsPage').then(m => ({ default: m.MarketsPage })));
const MarketIndicesPage = lazy(() => import('./pages/MarketIndicesPage').then(m => ({ default: m.MarketIndicesPage })));
const MarketSectorsPage = lazy(() => import('./pages/MarketSectorsPage').then(m => ({ default: m.MarketSectorsPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage').then(m => ({ default: m.ScreenerPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const LiveChartDemoPage = lazy(() => import('./pages/LiveChartDemoPage').then(m => ({ default: m.LiveChartDemoPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const HelpGettingStartedPage = lazy(() => import('./pages/help/GettingStartedPage').then(m => ({ default: m.HelpGettingStartedPage })));
const HelpIndicatorsPage = lazy(() => import('./pages/help/IndicatorsGuidePage').then(m => ({ default: m.HelpIndicatorsPage })));
const HelpFocusManagementPage = lazy(() => import('./pages/help/FocusManagementGuidePage').then(m => ({ default: m.HelpFocusManagementPage })));
const HelpInternalLinkingPage = lazy(() => import('./pages/help/InternalLinkingGuidePage').then(m => ({ default: m.HelpInternalLinkingPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const SitemapPage = lazy(() => import('./pages/SitemapPage').then(m => ({ default: m.SitemapPage })));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));
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

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => readInitialSymbol());
  const navigate = useNavigate();
  const location = useLocation();

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

  const navItems = useMemo(
    () => [
      {
        label: 'Dashboard',
        to: ROUTES.home(),
        isActive: location.pathname === '/' || location.pathname.startsWith('/stocks')
      },
      { label: 'Watchlist', to: ROUTES.watchlist(), isActive: location.pathname.startsWith('/watchlist') },
      { label: 'Markets', to: ROUTES.markets(), isActive: location.pathname.startsWith('/markets') },
      { label: 'Compare', to: ROUTES.compare(), isActive: location.pathname.startsWith('/compare') },
      { label: 'Help', to: ROUTES.help(), isActive: location.pathname.startsWith('/help') },
    ],
    [location.pathname]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" data-testid="app-shell">
      <FocusIndicator />
      <SkipLinks />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <GlobalStructuredData />

      <header className="border-b border-slate-900 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-40" role="banner">
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
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  active={item.isActive}
                  className={`text-sm font-medium transition-colors ${item.isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div role="search" aria-label="Global symbol search">
            <SearchBar onSelectSymbol={(symbol) => handleSymbolChange(symbol, { navigate: true })} />
          </div>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-8 flex-1 w-full" role="main">
        <BreadcrumbsWithSchema />
        <Suspense fallback={<div className="text-slate-400">Loading page</div>}>
          <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                selectedSymbol={selectedSymbol}
                onSymbolChange={handleSymbolChange}
              />
            }
          />
          <Route
            path="/stocks/:symbol"
            element={
              <RoutedDashboardPage
                selectedSymbol={selectedSymbol}
                onSymbolChange={handleSymbolChange}
              />
            }
          />
          <Route
            path={ROUTES.watchlist()}
            element={<WatchlistPage onSymbolSelect={handleSymbolChange} />}
          />
          <Route path={ROUTES.markets()} element={<MarketsPage />} />
          <Route path={ROUTES.marketIndices()} element={<MarketIndicesPage />} />
          <Route path={ROUTES.marketSectors()} element={<MarketSectorsPage />} />
          <Route path={ROUTES.compare()} element={<ComparePage />} />
          <Route path={ROUTES.screener()} element={<ScreenerPage />} />
          <Route path={ROUTES.alerts()} element={<AlertsPage />} />
          <Route path={ROUTES.portfolio()} element={<PortfolioPage />} />
          <Route path={ROUTES.liveChartDemo()} element={<LiveChartDemoPage />} />
          <Route path={ROUTES.help()} element={<HelpPage />} />
          <Route path={ROUTES.helpGettingStarted()} element={<HelpGettingStartedPage />} />
          <Route path={ROUTES.helpIndicators()} element={<HelpIndicatorsPage />} />
          <Route path={ROUTES.helpFocusManagement()} element={<HelpFocusManagementPage />} />
          <Route path={ROUTES.helpLinkingStrategy()} element={<HelpInternalLinkingPage />} />
          <Route path={ROUTES.about()} element={<AboutPage />} />
          <Route path={ROUTES.privacy()} element={<PrivacyPage />} />
          <Route path={ROUTES.terms()} element={<TermsPage />} />
          <Route path={ROUTES.sitemap()} element={<SitemapPage />} />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page not found"
                description="The page you are looking for is not available. Use the navigation or return to the dashboard to continue exploring live market data."
                metadata={{
                  title: 'Page Not Found | Stock Whisperer',
                  description: 'The page you requested could not be found.',
                  canonical: location.pathname,
                  noindex: true,
                }}
              >
                <div className="grid gap-3 md:grid-cols-2" aria-label="Suggested destinations">
                  <InternalLink to={ROUTES.sitemap()} className="text-blue-400 hover:text-blue-300">
                    Browse the sitemap →
                  </InternalLink>
                  <InternalLink to={ROUTES.help()} className="text-blue-400 hover:text-blue-300">
                    Visit the help center →
                  </InternalLink>
                  <InternalLink to={ROUTES.helpGettingStarted()} className="text-blue-400 hover:text-blue-300">
                    Read the getting started guide →
                  </InternalLink>
                  <InternalLink to={ROUTES.markets()} className="text-blue-400 hover:text-blue-300">
                    Check today&apos;s market overview →
                  </InternalLink>
                </div>
              </PlaceholderPage>
            }
          />
        </Routes>
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}

export default App;

interface RoutedDashboardPageProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string, options?: { navigate?: boolean }) => void;
}

function RoutedDashboardPage({ selectedSymbol, onSymbolChange }: RoutedDashboardPageProps) {
  const { symbol } = useParams<{ symbol: string }>();

  useEffect(() => {
    if (symbol && symbol.toUpperCase() !== selectedSymbol) {
      onSymbolChange(symbol, { navigate: false });
    }
  }, [symbol, onSymbolChange, selectedSymbol]);

  return (
    <DashboardPage
      selectedSymbol={selectedSymbol}
      onSymbolChange={onSymbolChange}
    />
  );
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
