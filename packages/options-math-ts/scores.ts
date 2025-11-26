import { expectedMove } from './iv_stats.ts';

export function scoreEdge(theo: number, ask: number) {
  if (ask <= 0) return 0;
  return Math.max(0, Math.min(1, (theo - ask) / ask));
}

export function scoreDte(dte: number) {
  if (dte < 30) return 0;
  if (dte < 45) return (dte - 30) / 15;
  if (dte <= 90) return 1 - Math.abs(dte - 60) / 30;
  return Math.max(0, 1 - (dte - 90) / 60);
}

export function scoreIv(ivp: number) {
  return Math.max(0, Math.min(1, 1 - ivp));
}

export function scoreDelta(deltaAbs: number) {
  if (deltaAbs < 0.2 || deltaAbs > 0.8) return 0;
  const target = 0.5;
  return Math.max(0, 1 - Math.abs(deltaAbs - target) / 0.3);
}

export function scoreLiquidity(bid: number, ask: number, oi: number, vol: number) {
  const mid = (bid + ask) / 2;
  const spreadPct = mid > 0 ? (ask - bid) / mid : 1;
  const spreadScore = Math.max(0, 1 - spreadPct / 0.15);
  const oiScore = oi >= 500 ? 1 : oi >= 100 ? 0.6 : 0.2;
  const volScore = vol >= 100 ? 1 : vol >= 20 ? 0.5 : 0.1;
  return 0.60 * spreadScore + 0.25 * oiScore + 0.15 * volScore;
}

export function scoreCalendar(contract: any, chain: any[]) {
  const later = chain.filter((c) => c.strike === contract.strike && c.dte > contract.dte);
  if (!later.length) return 0;
  const next = [...later].sort((a, b) => a.dte - b.dte)[0];
  const priceDiff = contract.ask - next.ask;
  const ivSkew = contract.iv - next.iv;
  if (priceDiff > 0.05 && ivSkew > 0.02 && contract.ask > 0) {
    const magnitude = priceDiff / contract.ask;
    const timeRatio = Math.min(1, Math.sqrt(next.dte / contract.dte));
    const sigmoid = 1 / (1 + Math.exp(-10 * magnitude));
    return sigmoid * timeRatio;
  }
  return 0;
}

export function scoreEarnings(daysTo: number | null | undefined, dte: number) {
  if (daysTo == null) return 0;
  if (daysTo >= 0 && daysTo < 5) return -0.5;
  if (daysTo >= 5 && daysTo < 15) return 0;
  if (daysTo >= 15 && dte > daysTo) return 1;
  return 0;
}

export function popLong(breakeven: number, spot: number, iv: number, dte: number) {
  const em = expectedMove(spot, iv, dte);
  if (em <= 0) return 0.5;
  const z = Math.abs(breakeven - spot) / em;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
