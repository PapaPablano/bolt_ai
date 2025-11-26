export const DEFAULT_WEIGHTS = {
  edge: 0.35,
  iv: 0.20,
  dte: 0.15,
  delta: 0.12,
  liq: 0.10,
  cal: 0.05,
  earn: 0.03,
} as const;

export type Weights = typeof DEFAULT_WEIGHTS;
