export type StrategyMode = 'sell_premium' | 'buy_premium';

export interface OptionRow {
  exp: string;
  strike: number;
  type: 'C' | 'P';
  bid?: number;
  ask?: number;
  last?: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  volume?: number;
  oi?: number;
  spot: number;
}

export interface RankedOption extends OptionRow {
  mid: number;
  spread_bps: number;
  iv_pctile?: number;
  emr?: number;
  rr?: number;
  pop?: number;
  score: number;
}

function safeNumber(value: number | undefined | null): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) return undefined;
  return value;
}

function computeMid(bid?: number, ask?: number, last?: number): number | undefined {
  const b = safeNumber(bid);
  const a = safeNumber(ask);
  const l = safeNumber(last);
  if (b !== undefined && a !== undefined && a > 0) return (b + a) / 2;
  if (l !== undefined && l > 0) return l;
  if (b !== undefined && b > 0) return b;
  if (a !== undefined && a > 0) return a;
  return undefined;
}

function zscores(values: (number | undefined)[]): number[] {
  const xs = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (xs.length === 0) return values.map(() => 0);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varSum = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0);
  const std = Math.sqrt(varSum / xs.length) || 1;
  return values.map(v => {
    if (v === undefined || !Number.isFinite(v)) return 0;
    return (v - mean) / std;
  });
}

function normalize01(values: (number | undefined)[]): number[] {
  const xs = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (xs.length === 0) return values.map(() => 0.5);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min === max) return values.map(() => 0.5);
  return values.map(v => {
    if (v === undefined || !Number.isFinite(v)) return 0.5;
    return (v - min) / (max - min);
  });
}

function percentileScores(values: (number | undefined)[]): (number | undefined)[] {
  const xs = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== undefined && Number.isFinite(p.v));
  if (xs.length === 0) return values.map(() => undefined);
  xs.sort((a, b) => a.v - b.v);
  const result: (number | undefined)[] = Array(values.length).fill(undefined);
  xs.forEach((p, rank) => {
    const pct = (rank / (xs.length - 1 || 1)) * 100;
    result[p.i] = pct;
  });
  return result;
}

function clip01(values: number[], lowerPct = 0.05, upperPct = 0.95): number[] {
  if (values.length === 0) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor((sorted.length - 1) * lowerPct)];
  const hi = sorted[Math.floor((sorted.length - 1) * upperPct)];
  if (lo === hi) return values.map(() => 0.5);
  return values.map(v => {
    const clamped = Math.min(Math.max(v, lo), hi);
    return (clamped - lo) / (hi - lo);
  });
}

export function rankChain(rows: OptionRow[], mode: StrategyMode): RankedOption[] {
  if (rows.length === 0) return [];

  const mids: (number | undefined)[] = rows.map(r => computeMid(r.bid, r.ask, r.last));
  const spreadBps: (number | undefined)[] = rows.map((r, idx) => {
    const bid = safeNumber(r.bid);
    const ask = safeNumber(r.ask);
    const mid = mids[idx];
    if (bid === undefined || ask === undefined || mid === undefined || mid <= 0) return undefined;
    const raw = ((ask - bid) / mid) * 10000;
    if (!Number.isFinite(raw) || raw <= 0) return undefined;
    return raw;
  });

  const vols = rows.map(r => {
    const v = r.volume ?? 0;
    return v > 0 ? Math.log1p(v) : 0;
  });
  const ois = rows.map(r => {
    const v = r.oi ?? 0;
    return v > 0 ? Math.log1p(v) : 0;
  });

  const zVol = zscores(vols);
  const zOi = zscores(ois);
  const zSpread = zscores(spreadBps.map(v => (v === undefined ? undefined : v)));
  const liqBase = zVol.map((v, i) => v + zOi[i] - zSpread[i]);
  const liq01 = clip01(normalize01(liqBase), 0.05, 0.95);
  const liq100 = liq01.map(v => v * 100);

  const grkTarget = mode === 'sell_premium' ? 0.3 : 0.5;
  const grkRaw = rows.map(r => {
    const d = Math.abs(safeNumber(r.delta) ?? 0);
    return -Math.abs(d - grkTarget);
  });
  const grk01 = clip01(normalize01(grkRaw), 0.05, 0.95);
  const grk100 = grk01.map(v => v * 100);

  const ivPcts = percentileScores(rows.map(r => safeNumber(r.iv)));
  const ivScore = ivPcts.map(p => {
    if (p === undefined) return 50;
    return mode === 'sell_premium' ? p : 100 - p;
  });

  const emrRaw: (number | undefined)[] = rows.map(() => undefined);
  const byStrike = new Map<number, { call?: number; put?: number; spot: number }>();
  rows.forEach((r, idx) => {
    const mid = mids[idx];
    if (mid === undefined || r.spot <= 0) return;
    const key = r.strike;
    const entry = byStrike.get(key) ?? { spot: r.spot };
    if (r.type === 'C') entry.call = mid;
    if (r.type === 'P') entry.put = mid;
    byStrike.set(key, entry);
  });
  const strikes = Array.from(byStrike.keys()).sort((a, b) => a - b);
  let bestStrike: number | undefined;
  let bestDiff = Infinity;
  const spotRef = rows[0]?.spot ?? 0;
  strikes.forEach(s => {
    const diff = Math.abs(s - spotRef);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestStrike = s;
    }
  });
  if (bestStrike !== undefined) {
    const entry = byStrike.get(bestStrike);
    if (entry && entry.call !== undefined && entry.put !== undefined && entry.spot > 0) {
      const straddleMid = entry.call + entry.put;
      const impliedMove = straddleMid / entry.spot;
      rows.forEach((r, idx) => {
        if (r.strike === bestStrike) {
          emrRaw[idx] = impliedMove;
        }
      });
    }
  }
  const emr01 = clip01(normalize01(emrRaw), 0.05, 0.95);
  const emr100 = emr01.map(v => (mode === 'sell_premium' ? v * 100 : (1 - v) * 100));

  const rrRaw: (number | undefined)[] = rows.map((r, idx) => {
    const mid = mids[idx];
    if (mid === undefined || r.spot <= 0) return undefined;
    return mid / r.spot;
  });
  const rr01 = clip01(normalize01(rrRaw), 0.05, 0.95);
  const rr100 = rr01.map(v => v * 100);

  const popRaw: (number | undefined)[] = rows.map((r, idx) => {
    const mid = mids[idx];
    const iv = safeNumber(r.iv);
    const spot = r.spot;
    const strike = r.strike;
    if (mid === undefined || iv === undefined || iv <= 0 || spot <= 0) return undefined;
    const daysToExp = 30;
    const t = daysToExp / 252;
    const sigma = iv * Math.sqrt(t);
    if (!Number.isFinite(sigma) || sigma <= 0) return undefined;
    let breakeven: number;
    if (r.type === 'P') breakeven = strike - mid;
    else breakeven = strike + mid;
    const z = (breakeven - spot) / sigma;
    const pop = 0.5 * (1 + erf(z / Math.SQRT2));
    return pop;
  });
  const pop01 = normalize01(popRaw);
  const pop100 = pop01.map(v => v * 100);

  const rrPop100 = rr100.map((rr, i) => 0.6 * rr + 0.4 * pop100[i]);

  const ranked: RankedOption[] = rows.map((row, idx) => {
    const mid = mids[idx] ?? 0;
    const spread = spreadBps[idx] ?? 0;
    const liq = liq100[idx] ?? 0;
    const grk = grk100[idx] ?? 0;
    const ivs = ivScore[idx] ?? 50;
    const em = emr100[idx] ?? 50;
    const rrVal = rr100[idx] ?? 50;
    const popVal = pop100[idx] ?? 50;
    const rrPopVal = rrPop100[idx] ?? 50;
    const score =
      0.35 * liq +
      0.2 * grk +
      0.2 * ivs +
      0.15 * em +
      0.1 * rrPopVal;

    return {
      ...row,
      mid,
      spread_bps: spread,
      iv_pctile: ivPcts[idx],
      emr: em,
      rr: rrVal,
      pop: popVal,
      score,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * ax);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return sign * y;
}
