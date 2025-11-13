import { type BarData } from './api';

export interface Pattern {
  type: string;
  name: string;
  confidence: number;
  description: string;
  bullish: boolean;
  startIndex: number;
  endIndex: number;
}

export function detectPatterns(data: BarData[]): Pattern[] {
  if (data.length < 20) return [];

  const patterns: Pattern[] = [];

  patterns.push(...detectHeadAndShoulders(data));
  patterns.push(...detectDoubleTops(data));
  patterns.push(...detectDoubleBottoms(data));
  patterns.push(...detectTriangles(data));
  patterns.push(...detectFlags(data));

  return patterns;
}

function detectHeadAndShoulders(data: BarData[]): Pattern[] {
  const patterns: Pattern[] = [];
  const prices = data.map(d => d.close);

  for (let i = 10; i < prices.length - 10; i++) {
    const leftShoulder = prices[i - 8];
    const head = prices[i];
    const rightShoulder = prices[i + 8];
    const neckline = Math.min(prices[i - 4], prices[i + 4]);

    if (
      head > leftShoulder * 1.05 &&
      head > rightShoulder * 1.05 &&
      Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.03 &&
      leftShoulder > neckline &&
      rightShoulder > neckline
    ) {
      patterns.push({
        type: 'head-and-shoulders',
        name: 'Head and Shoulders',
        confidence: 75,
        description: 'Bearish reversal pattern with three peaks',
        bullish: false,
        startIndex: i - 10,
        endIndex: i + 10,
      });
    }
  }

  return patterns;
}

function detectDoubleTops(data: BarData[]): Pattern[] {
  const patterns: Pattern[] = [];
  const prices = data.map(d => d.high);

  for (let i = 5; i < prices.length - 5; i++) {
    const firstPeak = prices[i];
    const valley = Math.min(...prices.slice(i + 1, i + 6));
    const secondPeak = Math.max(...prices.slice(i + 6, i + 11));

    if (
      Math.abs(firstPeak - secondPeak) / firstPeak < 0.02 &&
      valley < firstPeak * 0.95
    ) {
      patterns.push({
        type: 'double-top',
        name: 'Double Top',
        confidence: 70,
        description: 'Bearish reversal pattern with two peaks at similar levels',
        bullish: false,
        startIndex: i - 2,
        endIndex: i + 11,
      });
    }
  }

  return patterns;
}

function detectDoubleBottoms(data: BarData[]): Pattern[] {
  const patterns: Pattern[] = [];
  const prices = data.map(d => d.low);

  for (let i = 5; i < prices.length - 5; i++) {
    const firstBottom = prices[i];
    const peak = Math.max(...prices.slice(i + 1, i + 6));
    const secondBottom = Math.min(...prices.slice(i + 6, i + 11));

    if (
      Math.abs(firstBottom - secondBottom) / firstBottom < 0.02 &&
      peak > firstBottom * 1.05
    ) {
      patterns.push({
        type: 'double-bottom',
        name: 'Double Bottom',
        confidence: 70,
        description: 'Bullish reversal pattern with two troughs at similar levels',
        bullish: true,
        startIndex: i - 2,
        endIndex: i + 11,
      });
    }
  }

  return patterns;
}

function detectTriangles(data: BarData[]): Pattern[] {
  const patterns: Pattern[] = [];
  if (data.length < 30) return patterns;

  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  for (let i = 0; i < data.length - 20; i++) {
    const segmentHighs = highs.slice(i, i + 20);
    const segmentLows = lows.slice(i, i + 20);

    const highTrend = calculateTrend(segmentHighs);
    const lowTrend = calculateTrend(segmentLows);

    if (highTrend < -0.0005 && Math.abs(lowTrend) < 0.0005) {
      patterns.push({
        type: 'descending-triangle',
        name: 'Descending Triangle',
        confidence: 65,
        description: 'Bearish continuation pattern with descending highs',
        bullish: false,
        startIndex: i,
        endIndex: i + 20,
      });
    }

    if (highTrend > 0.0005 && Math.abs(lowTrend) < 0.0005) {
      patterns.push({
        type: 'ascending-triangle',
        name: 'Ascending Triangle',
        confidence: 65,
        description: 'Bullish continuation pattern with ascending lows',
        bullish: true,
        startIndex: i,
        endIndex: i + 20,
      });
    }
  }

  return patterns;
}

function detectFlags(data: BarData[]): Pattern[] {
  const patterns: Pattern[] = [];
  if (data.length < 15) return patterns;

  const prices = data.map(d => d.close);

  for (let i = 5; i < prices.length - 10; i++) {
    const poleStart = prices[i - 5];
    const poleEnd = prices[i];
    const flagEnd = prices[i + 8];

    const poleMove = (poleEnd - poleStart) / poleStart;

    if (poleMove > 0.15) {
      const flagMove = (flagEnd - poleEnd) / poleEnd;
      if (flagMove < 0 && flagMove > -0.08) {
        patterns.push({
          type: 'bull-flag',
          name: 'Bull Flag',
          confidence: 68,
          description: 'Bullish continuation pattern with upward pole and slight pullback',
          bullish: true,
          startIndex: i - 5,
          endIndex: i + 8,
        });
      }
    }

    if (poleMove < -0.15) {
      const flagMove = (flagEnd - poleEnd) / poleEnd;
      if (flagMove > 0 && flagMove < 0.08) {
        patterns.push({
          type: 'bear-flag',
          name: 'Bear Flag',
          confidence: 68,
          description: 'Bearish continuation pattern with downward pole and slight rally',
          bullish: false,
          startIndex: i - 5,
          endIndex: i + 8,
        });
      }
    }
  }

  return patterns;
}

function calculateTrend(values: number[]): number {
  const n = values.length;
  const xSum = (n * (n - 1)) / 2;
  const ySum = values.reduce((a, b) => a + b, 0);
  const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
  const xxSum = (n * (n - 1) * (2 * n - 1)) / 6;

  return (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
}
