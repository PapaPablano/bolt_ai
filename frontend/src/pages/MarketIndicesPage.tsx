import { useEffect } from 'react';
import { ActivitySquare } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

const INDICES = [
  { name: 'S&P 500', symbol: 'SPX', level: 5234.1, change: 0.34, ytd: 12.4 },
  { name: 'NASDAQ 100', symbol: 'NDX', level: 18234.9, change: 0.58, ytd: 16.7 },
  { name: 'Dow Jones', symbol: 'DJI', level: 39120.4, change: -0.12, ytd: 8.3 },
  { name: 'Russell 2000', symbol: 'RUT', level: 2114.6, change: 0.91, ytd: 4.2 },
  { name: 'FTSE 100', symbol: 'FTSE', level: 7933.2, change: 0.17, ytd: 3.1 },
  { name: 'Nikkei 225', symbol: 'N225', level: 38900.5, change: 0.42, ytd: 18.5 },
];

export function MarketIndicesPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('markets'));
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-[0.35em]">
          <ActivitySquare className="w-4 h-4" aria-hidden="true" />
          Index Monitor
        </div>
        <h2 className="text-3xl font-semibold text-slate-50">Global Benchmarks</h2>
        <p className="text-slate-400 max-w-2xl">
          Track the heartbeat of risk assets with intraday performance, YTD momentum, and quick links into dashboard detail views.
        </p>
      </header>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-400 text-left">
            <tr>
              <th className="px-6 py-3 font-medium">Index</th>
              <th className="px-6 py-3 font-medium">Level</th>
              <th className="px-6 py-3 font-medium">Change</th>
              <th className="px-6 py-3 font-medium">YTD</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {INDICES.map((index) => (
              <tr key={index.symbol} className="border-t border-slate-800 text-slate-200">
                <td className="px-6 py-4">
                  <div className="font-semibold">{index.name}</div>
                  <div className="text-xs text-slate-400">{index.symbol}</div>
                </td>
                <td className="px-6 py-4">{index.level.toLocaleString()}</td>
                <td className={`px-6 py-4 font-semibold ${index.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {index.change >= 0 ? '+' : ''}
                  {index.change.toFixed(2)}%
                </td>
                <td className={`px-6 py-4 font-semibold ${index.ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {index.ytd >= 0 ? '+' : ''}
                  {index.ytd.toFixed(1)}%
                </td>
                <td className="px-6 py-4">
                  <InternalLink
                    to={`/stocks/${index.symbol}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Open chart →
                  </InternalLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
