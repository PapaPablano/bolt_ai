// Lightweight, dependency-free Bollinger Bands implementation
export function bollinger(close: number[], n = 20, k = 2) {
  const mid: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  const pctB: number[] = [];
  const bw: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i + 1 < n) {
      mid.push(NaN); upper.push(NaN); lower.push(NaN); pctB.push(NaN); bw.push(NaN); continue;
    }
    const start = i - n + 1;
    const win = close.slice(start, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / n;
    const s = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const up = mean + k * s; const lo = mean - k * s;
    mid.push(mean); upper.push(up); lower.push(lo);
    const denom = Math.max(1e-12, up - lo);
    pctB.push((close[i] - lo) / denom);
    bw.push(denom / Math.max(1e-12, mean));
  }
  return { mid, upper, lower, pctB, bw };
}
