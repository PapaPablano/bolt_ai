import { cn } from '../lib/utils';

interface TimeframeSelectorProps {
  selected: string;
  onChange: (timeframe: string) => void;
}

const TIMEFRAMES = [
  { value: '1D', label: '1D' },
  { value: '5D', label: '5D' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
];

export function TimeframeSelector({ selected, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            selected === tf.value
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
