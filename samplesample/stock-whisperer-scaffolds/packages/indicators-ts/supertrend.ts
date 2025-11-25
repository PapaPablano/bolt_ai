// Base Supertrend bands with ATR as RMA of True Range
export type Bar = { t: number; o: number; h: number; l: number; c: number };
export type STPoint = { t: number; upper: number; lower: number; trend: 1 | -1 };

export function supertrendBands(bars: Bar[], atrPeriod = 10, factor = 3): STPoint[] {
  const n = bars.length; if (!n) return [];
  const tr: number[] = new Array(n).fill(0);
  const atr: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const prevClose = i > 0 ? bars[i - 1].c : bars[i].c;
    const range = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - prevClose),
      Math.abs(bars[i].l - prevClose)
    );
    tr[i] = range;
    atr[i] = i === 0 ? range : atr[i - 1] + (range - atr[i - 1]) / atrPeriod; // RMA
  }

  const out: STPoint[] = [];
  let upper = NaN, lower = NaN, trend: 1 | -1 = 1;
  for (let i = 0; i < n; i++) {
    const mid = (bars[i].h + bars[i].l) / 2;
    const bu = mid + factor * atr[i];
    const bl = mid - factor * atr[i];

    if (i === 0) { upper = bu; lower = bl; trend = 1; }
    else {
      // carry-forward rules
      upper = (bu < upper || bars[i - 1].c > upper) ? bu : upper;
      lower = (bl > lower || bars[i - 1].c < lower) ? bl : lower;
      // flips
      if (bars[i].c > upper) { trend = 1; lower = bl; }
      else if (bars[i].c < lower) { trend = -1; upper = bu; }
    }
    out.push({ t: bars[i].t, upper, lower, trend });
  }
  return out;
}
