import type { Range } from '@/types/prefs';
import { Button } from '@/components/ui/button';

const RANGE_OPTS: Range[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'MAX'];

export function RangeBar({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGE_OPTS.map((r) => (
        <Button key={r} variant={r === value ? 'default' : 'secondary'} size="sm" onClick={() => onChange(r)}>
          {r}
        </Button>
      ))}
    </div>
  );
}
