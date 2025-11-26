// Black–Scholes prices & Greeks (calls + puts) with vanna/charm (Edge-safe)

export type Side = 'call' | 'put';

const SQRT2PI = Math.sqrt(2 * Math.PI);

export function normPdf(x: number) {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

export function normCdf(x: number) {
  // Abramowitz–Stegun-style approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function priceCall(S: number, K: number, T: number, r: number, sigma: number) {
  if (T <= 0 || sigma <= 0) return Math.max(0, S - K);
  const sT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sT);
  const d2 = d1 - sigma * sT;
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

export function pricePut(S: number, K: number, T: number, r: number, sigma: number) {
  if (T <= 0 || sigma <= 0) return Math.max(0, K - S);
  const sT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sT);
  const d2 = d1 - sigma * sT;
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export type Greeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  vanna: number;
  charm: number;
  d1: number;
  d2: number;
};

export function greeksCall(S: number, K: number, T: number, r: number, sigma: number): Greeks {
  if (T <= 0 || sigma <= 0) {
    return {
      delta: S > K ? 1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      vanna: 0,
      charm: 0,
      d1: 0,
      d2: 0,
    };
  }
  const sT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sT);
  const d2 = d1 - sigma * sT;
  const phi = normPdf(d1);
  const delta = normCdf(d1);
  const gamma = phi / (S * sigma * sT);
  const theta = -(S * phi * sigma) / (2 * sT) - r * K * Math.exp(-r * T) * normCdf(d2); // per year
  const vega = S * phi * sT; // per 1.0 vol
  const vanna = -(phi * d2) / sigma;
  const charm = -phi * (2 * r * T - d2 * sigma * sT) / (2 * T * sigma * sT);
  return { delta, gamma, theta, vega, vanna, charm, d1, d2 };
}

export function greeksPut(S: number, K: number, T: number, r: number, sigma: number): Greeks {
  if (T <= 0 || sigma <= 0) {
    return {
      delta: S < K ? -1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      vanna: 0,
      charm: 0,
      d1: 0,
      d2: 0,
    };
  }
  const sT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sT);
  const d2 = d1 - sigma * sT;
  const phi = normPdf(d1);
  const delta = normCdf(d1) - 1; // put delta is negative
  const gamma = phi / (S * sigma * sT);
  const theta = (-(S * phi * sigma) / (2 * sT) + r * K * Math.exp(-r * T) * normCdf(-d2));
  const vega = S * phi * sT;
  const vanna = -(phi * d2) / sigma;
  const charm = -phi * (2 * r * T - d2 * sigma * sT) / (2 * T * sigma * sT);
  return { delta, gamma, theta, vega, vanna, charm, d1, d2 };
}
