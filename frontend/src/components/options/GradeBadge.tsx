import Tooltip from '@/components/ui/Tooltip';

type GradeBadgeProps = {
  grade: 'A' | 'B' | 'C' | 'D';
  score: number;
  scores?: Record<string, number>;
  adjustments?: string[];
};

function wClassFromPercent(p: number) {
  const pct = Math.max(0, Math.min(100, Math.round(p)));
  const steps = [
    ['w-0', 0],
    ['w-4', 10],
    ['w-8', 20],
    ['w-12', 30],
    ['w-16', 40],
    ['w-20', 50],
    ['w-28', 60],
    ['w-36', 70],
    ['w-44', 80],
    ['w-56', 90],
    ['w-64', 100],
  ] as const;
  const match = steps.find(([, t]) => pct <= t);
  return (match?.[0] as string) ?? 'w-64';
}

export function GradeBadge({ grade, score, scores, adjustments }: GradeBadgeProps) {
  const color =
    grade === 'A'
      ? 'bg-emerald-600'
      : grade === 'B'
      ? 'bg-sky-600'
      : grade === 'C'
      ? 'bg-amber-600'
      : 'bg-rose-600';

  const top = scores
    ? Object.entries(scores)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .slice(0, 3)
    : [];

  const content = (
    <div className="space-y-2">
      <div className="font-medium">
        {grade} grade · score {score.toFixed(3)}
      </div>
      {top.length > 0 && (
        <div className="space-y-1">
          {top.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <div className="w-16 shrink-0 capitalize text-slate-300">{k}</div>
              <div className="h-1.5 rounded bg-slate-700 w-40 overflow-hidden">
                <div
                  className={`h-1.5 rounded bg-slate-100 ${wClassFromPercent(
                    (v ?? 0) * 100,
                  )}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {adjustments?.length ? (
        <div className="text-slate-300 text-[11px]">
          <span className="text-slate-400">Adj:</span> {adjustments.join(', ')}
        </div>
      ) : null}
    </div>
  );

  return (
    <Tooltip content={content}>
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs ${color}`}
        aria-label={`Grade ${grade}`}
        role="img"
      >
        {grade}
      </span>
    </Tooltip>
  );
}
