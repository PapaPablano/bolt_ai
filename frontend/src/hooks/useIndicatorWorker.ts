import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IndicatorResults,
  IndicatorWorkerParams,
  IndicatorWorkerRequest,
  IndicatorWorkerResponse,
  IndicatorWorkerName,
} from '@/lib/indicators';
import type { Bar as ChartBar } from '@/utils/bars';

type WorkerInstance = Worker & { onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null };

export function useIndicatorWorker() {
  const workerRef = useRef<WorkerInstance | null>(null);
  const requestIdRef = useRef(0);
  const inflightRequestRef = useRef<number | null>(null);

  const [indicators, setIndicators] = useState<IndicatorResults | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/indicator.worker.ts', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<IndicatorWorkerResponse>) => {
      const message = event.data;
      if (!message || message.requestId !== inflightRequestRef.current) return;

      if (message.type === 'INDICATORS_READY') {
        setIndicators(message.results);
        setComputing(false);
        setError(null);
      } else if (message.type === 'ERROR') {
        setError(message.error);
        setComputing(false);
      }
    };

    return () => {
      worker.terminate();
      inflightRequestRef.current = null;
    };
  }, []);

  const calculate = useCallback(
    (data: ChartBar[], indicatorNames: IndicatorWorkerName[], params?: IndicatorWorkerParams) => {
      if (!workerRef.current || indicatorNames.length === 0) {
        setIndicators(null);
        setComputing(false);
        return;
      }
      const nextId = ++requestIdRef.current;
      inflightRequestRef.current = nextId;
      setComputing(true);
      const payload: IndicatorWorkerRequest = {
        type: 'CALCULATE_INDICATORS',
        requestId: nextId,
        data,
        indicators: indicatorNames,
        params,
      };
      workerRef.current.postMessage(payload);
    },
    [],
  );

  return { indicators, computing, error, calculate };
}
