/**
 * Technical Indicators Calculation Library
 * 
 * Provides calculations for various technical analysis indicators
 */

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================
// TREND INDICATORS
// ============================================

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  // First value is SMA
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(ema);
    } else {
      ema = (data[i] - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  
  return result;
}

// ============================================
// MOMENTUM INDICATORS
// ============================================

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const changes: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const recentChanges = changes.slice(i - period, i);
      const gains = recentChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
      const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
      
      if (losses === 0) {
        result.push(100);
      } else {
        const rs = gains / losses;
        const rsi = 100 - (100 / (1 + rs));
        result.push(rsi);
      }
    }
  }
  
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine: (number | null)[] = fastEMA.map((fast, i) => {
    const slow = slowEMA[i];
    return (fast !== null && slow !== null) ? fast - slow : null;
  });
  
  const macdValues = macdLine.filter(v => v !== null) as number[];
  const signalEMA = calculateEMA(macdValues, signalPeriod);
  
  const signalLine: (number | null)[] = [];
  let signalIndex = 0;
  
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(signalEMA[signalIndex] || null);
      signalIndex++;
    }
  }
  
  const histogram = macdLine.map((macd, i) => {
    const signal = signalLine[i];
    return (macd !== null && signal !== null) ? macd - signal : null;
  });
  
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Stochastic Oscillator (Basic)
 */
export function calculateStochastic(
  prices: PriceData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const kValues: (number | null)[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(null);
    } else {
      const period = prices.slice(i - kPeriod + 1, i + 1);
      const high = Math.max(...period.map(p => p.high));
      const low = Math.min(...period.map(p => p.low));
      const close = prices[i].close;
      
      const range = high - low;
      const k = range === 0 ? 50 : ((close - low) / range) * 100;
      kValues.push(k);
    }
  }
  
  const kValuesFiltered = kValues.filter(v => v !== null) as number[];
  const dSMA = calculateSMA(kValuesFiltered, dPeriod);
  
  const dValues: (number | null)[] = [];
  let dIndex = 0;
  
  for (let i = 0; i < kValues.length; i++) {
    if (kValues[i] === null) {
      dValues.push(null);
    } else {
      dValues.push(dSMA[dIndex] || null);
      dIndex++;
    }
  }
  
  return { k: kValues, d: dValues };
}

/**
 * KDJ Indicator (Stochastic with J line)
 * 
 * KDJ is an extension of the Stochastic Oscillator that adds a J line
 * which is more sensitive to price changes. J = 3*K - 2*D
 * 
 * Formula:
 *   RSV = (Close - Lowest Low) / (Highest High - Lowest Low) * 100
 *   K = SMA(RSV, k_smooth)
 *   D = SMA(K, d_smooth)
 *   J = 3*K - 2*D
 * 
 * The J line is particularly useful for identifying early reversals.
 */
export function calculateKDJ(
  prices: PriceData[],
  period: number = 9,
  kSmooth: number = 3,
  dSmooth: number = 3
): {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
  jMinusD: (number | null)[];
} {
  // Calculate RSV (Raw Stochastic Value)
  const rsvValues: (number | null)[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      rsvValues.push(null);
    } else {
      const periodData = prices.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...periodData.map(p => p.high));
      const lowestLow = Math.min(...periodData.map(p => p.low));
      const close = prices[i].close;
      
      const range = highestHigh - lowestLow;
      const rsv = range === 0 ? 50 : ((close - lowestLow) / range) * 100;
      rsvValues.push(rsv);
    }
  }
  
  // Calculate K line (SMA of RSV)
  const rsvFiltered = rsvValues.filter(v => v !== null) as number[];
  const kSMA = calculateSMA(rsvFiltered, kSmooth);
  
  const kValues: (number | null)[] = [];
  let kIndex = 0;
  
  for (let i = 0; i < rsvValues.length; i++) {
    if (rsvValues[i] === null) {
      kValues.push(null);
    } else {
      kValues.push(kSMA[kIndex] || null);
      kIndex++;
    }
  }
  
  // Calculate D line (SMA of K)
  const kFiltered = kValues.filter(v => v !== null) as number[];
  const dSMA = calculateSMA(kFiltered, dSmooth);
  
  const dValues: (number | null)[] = [];
  let dIndex = 0;
  
  for (let i = 0; i < kValues.length; i++) {
    if (kValues[i] === null) {
      dValues.push(null);
    } else {
      dValues.push(dSMA[dIndex] || null);
      dIndex++;
    }
  }
  
  // Calculate J line (3*K - 2*D)
  const jValues: (number | null)[] = kValues.map((k, i) => {
    const d = dValues[i];
    return (k !== null && d !== null) ? (3 * k - 2 * d) : null;
  });
  
  // Calculate J - D divergence
  const jMinusD: (number | null)[] = jValues.map((j, i) => {
    const d = dValues[i];
    return (j !== null && d !== null) ? (j - d) : null;
  });
  
  return { k: kValues, d: dValues, j: jValues, jMinusD };
}

// ============================================
// VOLATILITY INDICATORS
// ============================================

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = middle[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period;
      const sd = Math.sqrt(variance);
      
      upper.push(avg + (sd * stdDev));
      lower.push(avg - (sd * stdDev));
    }
  }
  
  return { middle, upper, lower };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(prices: PriceData[], period: number = 14): (number | null)[] {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i].high;
    const low = prices[i].low;
    const prevClose = prices[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  const atr = calculateEMA(trueRanges, period);
  return [null, ...atr]; // Add null for first value
}

/**
 * Keltner Channel
 */
export function calculateKeltnerChannel(
  prices: PriceData[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2
): {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const closes = prices.map(p => p.close);
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(prices, atrPeriod);
  
  const upper = middle.map((mid, i) => {
    const atrVal = atr[i];
    return (mid !== null && atrVal !== null) ? mid + (atrVal * multiplier) : null;
  });
  
  const lower = middle.map((mid, i) => {
    const atrVal = atr[i];
    return (mid !== null && atrVal !== null) ? mid - (atrVal * multiplier) : null;
  });
  
  return { middle, upper, lower };
}

// ============================================
// VOLUME INDICATORS
// ============================================

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(prices: PriceData[]): number[] {
  const obv: number[] = [prices[0].volume];
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].close > prices[i - 1].close) {
      obv.push(obv[i - 1] + prices[i].volume);
    } else if (prices[i].close < prices[i - 1].close) {
      obv.push(obv[i - 1] - prices[i].volume);
    } else {
      obv.push(obv[i - 1]);
    }
  }
  
  return obv;
}

/**
 * Volume Rate of Change (VROC)
 */
export function calculateVROC(volumes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < volumes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const currentVol = volumes[i];
      const pastVol = volumes[i - period];
      const vroc = ((currentVol - pastVol) / pastVol) * 100;
      result.push(vroc);
    }
  }
  
  return result;
}

/**
 * Money Flow Index (MFI)
 */
export function calculateMFI(prices: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const typicalPrices: number[] = [];
  const moneyFlows: number[] = [];
  
  // Calculate typical price and money flow
  for (let i = 0; i < prices.length; i++) {
    const tp = (prices[i].high + prices[i].low + prices[i].close) / 3;
    typicalPrices.push(tp);
    moneyFlows.push(tp * prices[i].volume);
  }
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let positiveFlow = 0;
      let negativeFlow = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += moneyFlows[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += moneyFlows[j];
        }
      }
      
      if (negativeFlow === 0) {
        result.push(100);
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        const mfi = 100 - (100 / (1 + moneyRatio));
        result.push(mfi);
      }
    }
  }
  
  return result;
}

/**
 * Average Directional Index (ADX)
 */
export function calculateADX(prices: PriceData[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [null]; // First value is null
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  // Calculate +DM, -DM, and TR
  for (let i = 1; i < prices.length; i++) {
    const highDiff = prices[i].high - prices[i - 1].high;
    const lowDiff = prices[i - 1].low - prices[i].low;
    
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    
    const trueRange = Math.max(
      prices[i].high - prices[i].low,
      Math.abs(prices[i].high - prices[i - 1].close),
      Math.abs(prices[i].low - prices[i - 1].close)
    );
    tr.push(trueRange);
  }
  
  // Smooth with EMA
  const plusDI = calculateEMA(plusDM, period);
  const minusDI = calculateEMA(minusDM, period);
  const trSmoothed = calculateEMA(tr, period);
  
  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    if (plusDI[i] !== null && minusDI[i] !== null && trSmoothed[i] !== null) {
      const pdi = (plusDI[i]! / trSmoothed[i]!) * 100;
      const mdi = (minusDI[i]! / trSmoothed[i]!) * 100;
      const dxVal = Math.abs(pdi - mdi) / (pdi + mdi) * 100;
      dx.push(dxVal);
    }
  }
  
  const adx = calculateSMA(dx, period);
  return [null, ...adx];
}
