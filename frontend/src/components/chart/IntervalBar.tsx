import type { TF } from '@/types/prefs';
import { Button } from '@/components/ui/button';

const TF_OPTS: TF[] = ['1Min', '5Min', '10Min', '15Min', '1Hour', '4Hour', '1Day'];
const LABEL: Record<TF, string> = { '1Min': '1m', '5Min': '5m', '10Min': '10m', '15Min': '15m', '1Hour': '1h', '4Hour': '4h', '1Day': '1d' };

export function IntervalBar({ value, onChange }: { value: TF; onChange: (v: TF) => void }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="interval-bar">
      {TF_OPTS.map((tf) => (
        <Button
          key={tf}
          data-testid={`tf-${tf}`}
          variant={tf === value ? 'default' : 'secondary'}
          size="sm"
          onClick={() => onChange(tf)}
        >
          {LABEL[tf]}
        </Button>
      ))}
    </div>
  );
}
