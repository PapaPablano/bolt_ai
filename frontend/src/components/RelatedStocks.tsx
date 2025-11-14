import { TrendingUp } from 'lucide-react';
import { StockLink, InternalLink } from './InternalLink';

interface RelatedStock {
  symbol: string;
  name: string;
  change?: number;
  sector?: string;
}

interface RelatedStocksProps {
  currentSymbol: string;
  stocks: RelatedStock[];
  title?: string;
  showCompareLink?: boolean;
}

export function RelatedStocks({
  currentSymbol,
  stocks,
  title = 'Related Stocks',
  showCompareLink = true,
}: RelatedStocksProps) {
  if (stocks.length === 0) {
    return null;
  }

  const compareUrl = `/compare?symbols=${[currentSymbol, ...stocks.map(s => s.symbol)].join(',')}`;

  return (
    <aside className="bg-slate-800/50 border border-slate-700 rounded-lg p-6" aria-label="Related stocks">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" aria-hidden="true" />
          {title}
        </h3>
      </div>

      <ul className="space-y-3" role="list">
        {stocks.map((stock) => (
          <li key={stock.symbol} className="flex items-center justify-between">
            <div className="flex-1">
              <StockLink
                symbol={stock.symbol}
                className="font-medium text-slate-200 hover:text-blue-400 transition-colors"
              >
                {stock.symbol}
              </StockLink>
              <div className="text-sm text-slate-400 mt-0.5">{stock.name}</div>
              {stock.sector && (
                <div className="text-xs text-slate-500 mt-0.5">{stock.sector}</div>
              )}
            </div>
            {stock.change !== undefined && (
              <div
                className={`text-sm font-semibold ${
                  stock.change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stock.change >= 0 ? '+' : ''}
                {stock.change.toFixed(2)}%
              </div>
            )}
          </li>
        ))}
      </ul>

      {showCompareLink && stocks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <InternalLink
            to={compareUrl}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors inline-flex items-center gap-1"
            aria-label={`Compare ${currentSymbol} with ${stocks.length} related stocks`}
          >
            Compare all {stocks.length + 1} stocks →
          </InternalLink>
        </div>
      )}
    </aside>
  );
}

export function SectorStocks({ sector, stocks }: { sector: string; stocks: RelatedStock[] }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-100">{sector} Stocks</h2>
        <InternalLink
          to={`/markets/sectors/${sector.toLowerCase().replace(/\s+/g, '-')}`}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          View all {sector} stocks →
        </InternalLink>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stocks.map((stock) => (
          <StockLink
            key={stock.symbol}
            symbol={stock.symbol}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-100">{stock.symbol}</div>
                <div className="text-sm text-slate-400 mt-1">{stock.name}</div>
              </div>
              {stock.change !== undefined && (
                <div
                  className={`text-sm font-semibold ${
                    stock.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stock.change >= 0 ? '+' : ''}
                  {stock.change.toFixed(2)}%
                </div>
              )}
            </div>
          </StockLink>
        ))}
      </div>
    </section>
  );
}
