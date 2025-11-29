import type { BusinessDay, Time } from 'lightweight-charts';

const isBusinessDay = (value: Time): value is BusinessDay =>
  typeof value === 'object' && value !== null && 'year' in value;

/**
 * Converts a Lightweight Charts time value to seconds.
 * @param value Time union (number | string | BusinessDay)
 * @param useTradingView Whether the upstream chart emits ms timestamps (TradingView compatibility)
 */
export const fromChartTimeValue = (value: Time, useTradingView = false): number => {
  if (typeof value === 'number') {
    return useTradingView ? Math.floor(value / 1000) : value;
  }

  if (typeof value === 'string') {
    const [y, m, d] = value.split('-').map(Number);
    const ts = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
    return Math.floor(ts / 1000);
  }

  if (isBusinessDay(value)) {
    const ts = Date.UTC(value.year, (value.month ?? 1) - 1, value.day ?? 1);
    return Math.floor(ts / 1000);
  }

  return 0;
};
