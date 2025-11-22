import type { IndicatorStylePrefs } from './indicator-styles';

export type TF = '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
export type Range = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'MAX';

export type CalendarPrefs = {
  countries: string[];
  minImpact: 'low' | 'medium' | 'high';
};

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
  // Extended toggles
  useSTAI?: boolean;
  stAiAtrLen?: number;
  stAiMin?: number;
  stAiMid?: number;
  stAiMax?: number;
  useMACD?: boolean;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  useVWAP?: boolean;
  vwapMult?: number;
  useSTPerf?: boolean;
  stPerfAtrSpan?: number;
  stPerfMin?: number;
  stPerfMax?: number;
  stPerfStep?: number;
  stPerfK?: 2 | 3;
  stPerfFrom?: 'Best' | 'Average' | 'Worst';
  stPerfAlpha?: number;
  stPerfDenomSpan?: number;
  stPerfUseAMA?: boolean;
  stPerfApplyImmediateOnFlip?: boolean;
  useKDJ?: boolean;
  kdjPeriod?: number;
  kdjKSmooth?: number;
  kdjDSmooth?: number;
  kdjSessionAnchored?: boolean;
  useCalendar?: boolean;
};

export type ChartPrefs = {
  default_timeframe: TF;
  default_range: Range;
  presets: Record<TF, TfPreset>;
  calendar: CalendarPrefs;
  kdjEnabled?: boolean;
  kdjPeriod?: number;
  kdjKSmooth?: number;
  kdjDSmooth?: number;
  kdjSessionAnchored?: boolean;
  styles?: IndicatorStylePrefs;
};

export const DEFAULT_TF: TF = '1Hour';
export const DEFAULT_RANGE: Range = '1Y';
export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  countries: ['US', 'EU', 'GB'],
  minImpact: 'medium',
};

export const DEFAULT_PRESETS: Record<TF, TfPreset> = {
  '1Min': {
    useSMA: false,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 21,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: true,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '5Min': {
    useSMA: false,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 21,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: true,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '10Min': {
    useSMA: false,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 21,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: true,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '15Min': {
    useSMA: false,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 21,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: true,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '1Hour': {
    useSMA: true,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 50,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: false,
    vwapMult: 1,
    useSTPerf: true,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '4Hour': {
    useSMA: true,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 50,
    useBB: false,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: false,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
  '1Day': {
    useSMA: true,
    smaPeriod: 20,
    useEMA: true,
    emaPeriod: 50,
    useBB: true,
    bbPeriod: 20,
    bbMult: 2,
    useRSI: false,
    rsiPeriod: 14,
    useSTAI: true,
    stAiAtrLen: 14,
    stAiMin: 1.5,
    stAiMid: 2.0,
    stAiMax: 3.0,
    useMACD: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useVWAP: false,
    vwapMult: 1,
    useSTPerf: false,
    stPerfAtrSpan: 14,
    stPerfMin: 1.2,
    stPerfMax: 4.0,
    stPerfStep: 0.2,
    stPerfK: 3,
    stPerfFrom: 'Best',
    stPerfAlpha: 10,
    stPerfDenomSpan: 10,
    stPerfUseAMA: true,
    stPerfApplyImmediateOnFlip: false,
    useKDJ: true,
    kdjPeriod: 9,
    kdjKSmooth: 3,
    kdjDSmooth: 3,
    kdjSessionAnchored: true,
    useCalendar: false,
  },
};
