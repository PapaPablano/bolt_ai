import type { Bar as ChartBar } from '@/utils/bars';
import { sma, ema, bollinger, rsi } from '@/utils/indicators';

export type IndicatorWorkerName = 'sma' | 'ema' | 'bollinger' | 'rsi';

export type IndicatorWorkerParams = {
  sma?: { period: number };
  ema?: { period: number };
  bollinger?: { period: number; mult: number };
  rsi?: { period: number };
};

export type IndicatorResults = Partial<{
  sma: { time: number; value: number }[];
  ema: { time: number; value: number }[];
  bollinger: {
    upper: { time: number; value: number }[];
    middle: { time: number; value: number }[];
    lower: { time: number; value: number }[];
  };
  rsi: { time: number; value: number }[];
}>;

export type IndicatorWorkerRequest = {
  type: 'CALCULATE_INDICATORS';
  requestId: number;
  data: ChartBar[];
  indicators: IndicatorWorkerName[];
  params?: IndicatorWorkerParams;
};

export type IndicatorWorkerSuccess = {
  type: 'INDICATORS_READY';
  requestId: number;
  results: IndicatorResults;
  computeTime: number;
};

export type IndicatorWorkerError = {
  type: 'ERROR';
  requestId: number;
  error: string;
};

export type IndicatorWorkerResponse = IndicatorWorkerSuccess | IndicatorWorkerError;

export class IndicatorEngine {
  calculate(data: ChartBar[], indicators: IndicatorWorkerName[], params: IndicatorWorkerParams = {}): IndicatorResults {
    const unique = [...new Set(indicators)];
    const result: IndicatorResults = {};
    const safeData = Array.isArray(data) ? data : [];

    for (const indicator of unique) {
      switch (indicator) {
        case 'sma': {
          const period = params.sma?.period ?? 20;
          result.sma = sma(safeData, period);
          break;
        }
        case 'ema': {
          const period = params.ema?.period ?? 20;
          result.ema = ema(safeData, period);
          break;
        }
        case 'bollinger': {
          const period = params.bollinger?.period ?? 20;
          const mult = params.bollinger?.mult ?? 2;
          const bands = bollinger(safeData, period, mult);
          result.bollinger = bands;
          break;
        }
        case 'rsi': {
          const period = params.rsi?.period ?? 14;
          result.rsi = rsi(safeData, period);
          break;
        }
        default:
          break;
      }
    }

    return result;
  }
}
