export type LineWidth = 1 | 2 | 3 | 4;
export type HistThickness = 'thin' | 'normal' | 'wide';

export type IndicatorStyle = {
  lineWidth?: LineWidth;
  histThickness?: HistThickness;
};

export type IndicatorStylePrefs = {
  global: IndicatorStyle;
  perIndicator?: Partial<{
    stAi: IndicatorStyle;
    ema: IndicatorStyle;
    rsi: IndicatorStyle;
    vwap: IndicatorStyle;
    bb: IndicatorStyle;
    macdLine: IndicatorStyle;
    macdSignal: IndicatorStyle;
    macdHist: IndicatorStyle;
    kdjK: IndicatorStyle;
    kdjD: IndicatorStyle;
    kdjJ: IndicatorStyle;
    volume: IndicatorStyle;
  }>;
};

export const DEFAULT_INDICATOR_STYLE_PREFS: IndicatorStylePrefs = {
  global: { lineWidth: 2, histThickness: 'normal' },
  perIndicator: {},
};

export const cloneIndicatorStylePrefs = (prefs?: IndicatorStylePrefs): IndicatorStylePrefs => {
  const source = prefs ?? DEFAULT_INDICATOR_STYLE_PREFS;
  const perIndicator = source.perIndicator
    ? (Object.entries(source.perIndicator).reduce((acc, [key, value]) => {
        if (value) acc[key as keyof NonNullable<IndicatorStylePrefs['perIndicator']>] = { ...value };
        return acc;
      }, {} as NonNullable<IndicatorStylePrefs['perIndicator']>))
    : undefined;
  return {
    global: { ...DEFAULT_INDICATOR_STYLE_PREFS.global, ...source.global },
    perIndicator,
  };
};

export const clampLineWidth = (value?: number): LineWidth => {
  const numeric = Number.isFinite(value) ? Number(value) : DEFAULT_INDICATOR_STYLE_PREFS.global.lineWidth ?? 2;
  const clamped = Math.max(1, Math.min(4, Math.round(numeric))) as LineWidth;
  return clamped;
};
