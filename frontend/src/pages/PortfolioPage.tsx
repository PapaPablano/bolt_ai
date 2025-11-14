import { useEffect } from 'react';
import { PieChart } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

const HOLDINGS = [
  { symbol: 'AAPL', name: 'Apple Inc.', weight: 18, gain: 12.4, costBasis: 142.3, currentPrice: 198.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 16, gain: 10.8, costBasis: 245.7, currentPrice: 410.2 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 14, gain: 34.1, costBasis: 195.2, currentPrice: 875.4 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 12, gain: 6.3, costBasis: 112.5, currentPrice: 172.8 },
];

export function PortfolioPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('portfolio'));
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Capital Allocation</p>
        <h2 className="text-3xl font-semibold text-slate-50">Portfolio Command Center</h2>
        <p className="text-slate-400 max-w-3xl">
          Visualize weightings, performance, and risk concentrations so you can rebalance with conviction.
        </p>
      </header>

      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-blue-400" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-100">Current Allocation</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
              <tr>
                <th className="py-2">Symbol</th>
                <th className="py-2">Name</th>
                <th className="py-2">% Weight</th>
                <th className="py-2">Gain/Loss</th>
                <th className="py-2">Cost Basis</th>
                <th className="py-2">Current Price</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {HOLDINGS.map((holding) => (
                <tr key={holding.symbol} className="border-t border-slate-800 text-slate-200">
                  <td className="py-3 font-semibold">{holding.symbol}</td>
                  <td className="py-3">{holding.name}</td>
                  <td className="py-3">{holding.weight}%</td>
                  <td className={`py-3 font-semibold ${holding.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {holding.gain >= 0 ? '+' : ''}
                    {holding.gain.toFixed(1)}%
                  </td>
                  <td className="py-3">${holding.costBasis.toFixed(2)}</td>
                  <td className="py-3">${holding.currentPrice.toFixed(2)}</td>
                  <td className="py-3">
                    <InternalLink to={`/stocks/${holding.symbol}`} className="text-blue-400 hover:text-blue-300 text-sm">
                      Analyze
                    </InternalLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
