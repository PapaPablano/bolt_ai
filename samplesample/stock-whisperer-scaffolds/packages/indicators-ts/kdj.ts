// KDJ with EMA smoothing by default; returns arrays aligned to inputs
export function kdj(
  high: number[], low: number[], close: number[],
  n = 9, m = 3, l = 3,
  mode: 'ema' | 'rma' = 'ema'
) {
  const len = close.length;
  const rsv: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    const a = Math.max(0, i - n + 1);
    let hi = -Infinity, lo = Infinity;
    for (let j = a; j <= i; j++) { hi = Math.max(hi, high[j]); lo = Math.min(lo, low[j]); }
    const den = Math.max(1e-12, hi - lo);
    rsv[i] = 100 * (close[i] - lo) / den;
  }
  const smooth = (src: number[], p: number) => {
    const out: number[] = new Array(len).fill(NaN);
    if (mode === 'ema') {
      const a = 2 / (p + 1); let prev = src[0];
      for (let i = 0; i < len; i++) { prev = i ? (a * src[i] + (1 - a) * prev) : src[i]; out[i] = prev; }
    } else { // RMA
      let prev = src[0]; out[0] = prev;
      for (let i = 1; i < len; i++) { prev = prev + (src[i] - prev) / p; out[i] = prev; }
    }
    return out;
  };
  const K = smooth(rsv, m);
  const D = smooth(K, l);
  const J = K.map((k, i) => 3 * k - 2 * D[i]);
  return { K, D, J };
}
