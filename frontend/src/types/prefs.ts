export type TF = '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
export type Range = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'MAX';

export type TfPreset = {
  useSMA: boolean;
  smaPeriod: number;
  useEMA: boolean;
  emaPeriod: number;
  useBB: boolean;
  bbPeriod: number;
  bbMult: number;
  useRSI: boolean;
  rsiPeriod: number;
};

export type ChartPrefs = {
  default_timeframe: TF;
  default_range: Range;
  presets: Record<TF, TfPreset>;
};

export const DEFAULT_TF: TF = '1Hour';
export const DEFAULT_RANGE: Range = '1Y';

export const DEFAULT_PRESETS: Record<TF, TfPreset> = {
  '1Min': { useSMA: true, smaPeriod: 20, useEMA: false, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '5Min': { useSMA: true, smaPeriod: 20, useEMA: false, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '10Min': { useSMA: true, smaPeriod: 20, useEMA: false, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '15Min': { useSMA: true, smaPeriod: 20, useEMA: false, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '1Hour': { useSMA: true, smaPeriod: 20, useEMA: true, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '4Hour': { useSMA: true, smaPeriod: 20, useEMA: true, emaPeriod: 50, useBB: false, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
  '1Day': { useSMA: true, smaPeriod: 20, useEMA: true, emaPeriod: 50, useBB: true, bbPeriod: 20, bbMult: 2, useRSI: false, rsiPeriod: 14 },
};
