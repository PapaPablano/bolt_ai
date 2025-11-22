export type PanelIndicatorName =
  | 'STAI'
  | 'EMA'
  | 'RSI'
  | 'VWAP'
  | 'BB'
  | 'MACD'
  | 'KDJ'
  | 'Calendar';

export type WorkerIndicatorName = Exclude<PanelIndicatorName, 'KDJ' | 'Calendar'>;

const WORKER_INDICATORS: ReadonlySet<WorkerIndicatorName> = new Set([
  'STAI',
  'EMA',
  'RSI',
  'VWAP',
  'BB',
  'MACD',
]);

export function isWorkerIndicator(name: string): name is WorkerIndicatorName {
  return WORKER_INDICATORS.has(name as WorkerIndicatorName);
}
