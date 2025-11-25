import type { LinePt as WorkerLinePt } from '@/hooks/useIndicatorWorker';
import { isTimeWithinBounds } from '@/workers/windowBounds';

export const mergePanePatch = (prev: WorkerLinePt[], patch?: WorkerLinePt[]): WorkerLinePt[] => {
  if (!patch?.length) return prev;
  const next = patch[patch.length - 1];
  if (!next) return prev;
  if (prev.length && prev[prev.length - 1].time === next.time) {
    return [...prev.slice(0, -1), next];
  }
  return [...prev, next];
};

export const shouldIgnoreLiveBar = (
  alignedSeconds: number,
  bounds: { from: number; to: number } | null,
): boolean => !isTimeWithinBounds(alignedSeconds, bounds);
