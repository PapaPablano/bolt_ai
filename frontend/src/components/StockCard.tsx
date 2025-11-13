import { type StockQuote } from '../lib/api';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StockCardProps {
  quote: StockQuote;
  onClick?: () => void;
  isSelected?: boolean;
}

export function StockCard({ quote, onClick, isSelected }: StockCardProps) {
  const isPositive = quote.change >= 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all duration-200',
        'hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20',
        isSelected
          ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/20'
          : 'bg-slate-800/50 border-slate-700'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{quote.symbol}</h3>
          <p className="text-sm text-slate-400">Real-time</p>
        </div>
        <div className={cn('flex items-center gap-1 text-sm font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {formatPercent(quote.changePercent)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-slate-100">
          {formatCurrency(quote.price)}
        </div>
        <div className={cn('text-sm font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
          {isPositive ? '+' : ''}{formatCurrency(quote.change)}
        </div>
      </div>
    </button>
  );
}
