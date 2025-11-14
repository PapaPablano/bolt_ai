import { Flame } from 'lucide-react';
import { InternalLink, StockLink } from './InternalLink';
import { ROUTES } from '../lib/urlHelpers';

export interface TrendingStockItem {
  symbol: string;
  name: string;
  price?: number;
  changePercent?: number;
  sector?: string;
}

interface TrendingStocksProps {
  items: TrendingStockItem[];
  onSelectSymbol?: (symbol: string) => void;
}

export function TrendingStocks({ items, onSelectSymbol }: TrendingStocksProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" aria-label="Trending stocks">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" aria-hidden="true" />
          Trending now
        </h2>
        <InternalLink to={ROUTES.screener()} className="text-sm text-blue-400 hover:text-blue-300">
          Open screener
        </InternalLink>
      </div>

      <ul className="divide-y divide-slate-800" role="list">
        {items.map((item) => (
          <li key={item.symbol} className="py-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[180px]">
              <StockLink symbol={item.symbol} className="text-lg font-semibold" />
              <p className="text-sm text-slate-400">{item.name}</p>
              {item.sector && (
                <InternalLink
                  to={ROUTES.sector(item.sector)}
                  className="text-xs text-slate-400 hover:text-blue-300"
                >
                  {item.sector} sector →
                </InternalLink>
              )}
            </div>
            <div className="text-right min-w-[100px]">
              {typeof item.price === 'number' && (
                <p className="text-slate-200 font-medium">${item.price.toFixed(2)}</p>
              )}
              {typeof item.changePercent === 'number' && (
                <p
                  className={`text-sm font-semibold ${
                    item.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {item.changePercent >= 0 ? '+' : ''}
                  {item.changePercent.toFixed(2)}%
                </p>
              )}
            </div>
            {onSelectSymbol && (
              <button
                onClick={() => onSelectSymbol(item.symbol)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:border-blue-500 transition-colors"
              >
                Load chart
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
