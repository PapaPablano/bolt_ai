import { InternalLink } from './InternalLink';
import { BarChart3, Github, Twitter, Mail } from 'lucide-react';

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 border-t border-slate-800 mt-auto" role="contentinfo">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-500" aria-hidden="true" />
              <span className="text-lg font-bold text-slate-100">Stock Whisperer</span>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Professional stock trading and analysis platform with real-time market data and ML-powered insights.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-100 transition-colors"
                aria-label="Visit our GitHub"
              >
                <Github className="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-100 transition-colors"
                aria-label="Follow us on Twitter"
              >
                <Twitter className="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="mailto:support@stockwhisperer.app"
                className="text-slate-400 hover:text-slate-100 transition-colors"
                aria-label="Email us"
              >
                <Mail className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <nav aria-label="Markets navigation">
            <h3 className="text-slate-100 font-semibold mb-4">Markets</h3>
            <ul className="space-y-2" role="list">
              <li>
                <InternalLink
                  to="/markets"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Market Overview
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/markets/indices"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Market Indices
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/markets/sectors"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Sector Performance
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/stocks"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  All Stocks
                </InternalLink>
              </li>
            </ul>
          </nav>

          <nav aria-label="Tools navigation">
            <h3 className="text-slate-100 font-semibold mb-4">Tools</h3>
            <ul className="space-y-2" role="list">
              <li>
                <InternalLink
                  to="/watchlist"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  My Watchlist
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/compare"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Stock Comparison
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/screener"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Stock Screener
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/alerts"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Price Alerts
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/portfolio"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Portfolio Tracker
                </InternalLink>
              </li>
            </ul>
          </nav>

          <nav aria-label="Help and information navigation">
            <h3 className="text-slate-100 font-semibold mb-4">Help & Info</h3>
            <ul className="space-y-2" role="list">
              <li>
                <InternalLink
                  to="/help"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Help Center
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/help/getting-started"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Getting Started
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/help/indicators"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Technical Indicators
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/about"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  About Us
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/privacy"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Privacy Policy
                </InternalLink>
              </li>
              <li>
                <InternalLink
                  to="/terms"
                  className="text-slate-400 hover:text-slate-100 text-sm transition-colors"
                >
                  Terms of Service
                </InternalLink>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © {currentYear} Stock Whisperer. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <InternalLink
              to="/privacy"
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              Privacy
            </InternalLink>
            <InternalLink
              to="/terms"
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              Terms
            </InternalLink>
            <InternalLink
              to="/sitemap"
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              Sitemap
            </InternalLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
