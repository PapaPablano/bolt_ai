import { useEffect, useMemo, useRef } from 'react';
import type { RankInput, RankOutput } from '@/workers/rankWorker';

export function useRankWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('@/workers/rankWorker.ts', import.meta.url), {
      type: 'module',
    });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const rank = useMemo(() => {
    return (input: RankInput) =>
      new Promise<RankOutput>((resolve) => {
        const tag = Math.random().toString(36).slice(2);
        const handler = (ev: MessageEvent<RankOutput & { _tag?: string }>) => {
          if (ev.data._tag === tag) {
            workerRef.current?.removeEventListener('message', handler);
            resolve(ev.data);
          }
        };
        workerRef.current?.addEventListener('message', handler);
        workerRef.current?.postMessage({ _tag: tag, ...input });
      });
  }, []);

  return { rank };
}
