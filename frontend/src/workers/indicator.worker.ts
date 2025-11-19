/// <reference lib="webworker" />

import { IndicatorEngine, type IndicatorWorkerRequest, type IndicatorWorkerResponse } from '../lib/indicators';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const engine = new IndicatorEngine();

ctx.addEventListener('message', (event) => {
  const { type, requestId, data, indicators, params } = event.data as IndicatorWorkerRequest;
  if (type !== 'CALCULATE_INDICATORS') return;

  try {
    const start = performance.now();
    const results = engine.calculate(data, indicators, params);
    const end = performance.now();
    const message: IndicatorWorkerResponse = {
      type: 'INDICATORS_READY',
      requestId,
      results,
      computeTime: end - start,
    };
    ctx.postMessage(message);
  } catch (error) {
    const message: IndicatorWorkerResponse = {
      type: 'ERROR',
      requestId,
      error: error instanceof Error ? error.message : String(error),
    };
    ctx.postMessage(message);
  }
});
