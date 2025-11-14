import { useEffect } from 'react';
import { Grid } from 'lucide-react';
import { SectorStocks } from '../components/RelatedStocks';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

const SECTOR_DATA = [
  {
    sector: 'Technology',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', change: 1.23 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', change: 0.95 },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', change: 2.34 },
    ],
  },
  {
    sector: 'Consumer Discretionary',
    stocks: [
      { symbol: 'AMZN', name: 'Amazon.com Inc.', change: 0.67 },
      { symbol: 'TSLA', name: 'Tesla Inc.', change: -1.12 },
      { symbol: 'NKE', name: 'Nike Inc.', change: 0.34 },
    ],
  },
  {
    sector: 'Financials',
    stocks: [
      { symbol: 'JPM', name: 'JPMorgan Chase', change: 0.41 },
      { symbol: 'GS', name: 'Goldman Sachs', change: -0.22 },
      { symbol: 'MS', name: 'Morgan Stanley', change: 0.18 },
    ],
  },
];

export function MarketSectorsPage() {
  useEffect(() => {
    updateMetaTags(generatePageMetadata('markets'));
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-blue-400 text-sm uppercase tracking-[0.35em]">
          <Grid className="w-4 h-4" aria-hidden="true" />
          Sector Playback
        </div>
        <h2 className="text-3xl font-semibold text-slate-50">Where Capital Is Rotating</h2>
        <p className="text-slate-400 max-w-2xl">
          Measure weekly and monthly rotation to confirm relative strength breakouts before they appear on traditional charts.
        </p>
      </header>

      {SECTOR_DATA.map((sector) => (
        <SectorStocks key={sector.sector} sector={sector.sector} stocks={sector.stocks} />
      ))}
    </div>
  );
}
