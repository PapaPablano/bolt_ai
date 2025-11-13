import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { detectPatterns, type Pattern } from '../lib/chartPatterns';
import { type BarData } from '../lib/api';
import { cn } from '../lib/utils';

interface PatternDetectorProps {
  data: BarData[];
}

export function PatternDetector({ data }: PatternDetectorProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);

  useEffect(() => {
    if (data.length > 0) {
      const detected = detectPatterns(data);
      setPatterns(detected.slice(0, 5));
    } else {
      setPatterns([]);
    }
  }, [data]);

  if (patterns.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-100">Pattern Detection</h3>
        </div>
        <p className="text-sm text-slate-400">No patterns detected in current timeframe</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-slate-100">Pattern Detection</h3>
      </div>

      <div className="space-y-3">
        {patterns.map((pattern, index) => (
          <div
            key={`${pattern.type}-${index}`}
            className={cn(
              'p-4 rounded-lg border',
              pattern.bullish
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-red-900/20 border-red-700/50'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {pattern.bullish ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
                <h4 className="font-semibold text-slate-100">{pattern.name}</h4>
              </div>
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  pattern.bullish
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                )}
              >
                {pattern.confidence}% confidence
              </span>
            </div>
            <p className="text-sm text-slate-300">{pattern.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
