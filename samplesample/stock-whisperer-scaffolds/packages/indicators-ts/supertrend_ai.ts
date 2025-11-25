import type { Bar, STPoint } from './supertrend';
import { supertrendBands } from './supertrend';

export interface STAIOpts {
  atrPeriod: number;          // e.g., 10
  factorMin: number;          // e.g., 1
  factorMax: number;          // e.g., 5
  factorStep: number;         // e.g., 0.5
  perfAlpha: number;          // performance memory (0,1]
  k?: number;                 // clusters (default 3)
  seed?: number;              // RNG seed for determinism
}

// Tiny deterministic KMeans (k=3 default) for 2-D points [perf, slope]
function kmeans2D(data: number[][], k: number, seed = 42) {
  const rnd = mulberry32(seed);
  const n = data.length; const idxs = new Set<number>();
  while (idxs.size < k) idxs.add(Math.floor(rnd() * n));
  let centroids = [...idxs].map(i => data[i].slice(0));
  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    // assign
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = data[i][0] - centroids[c][0];
        const dy = data[i][1] - centroids[c][1];
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = c; }
      }
      labels[i] = best;
    }
    // update
    const sums = Array.from({ length: k }, () => [0, 0, 0]); // x, y, count
    for (let i = 0; i < n; i++) { const l = labels[i]; sums[l][0] += data[i][0]; sums[l][1] += data[i][1]; sums[l][2]++; }
    const next = centroids.map((c, j) => sums[j][2] ? [sums[j][0] / sums[j][2], sums[j][1] / sums[j][2]] : c);
    if (centroids.every((c, j) => Math.abs(c[0] - next[j][0]) < 1e-9 && Math.abs(c[1] - next[j][1]) < 1e-9)) break;
    centroids = next;
  }
  return { labels, centroids };
}
function mulberry32(a: number) { return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }

export function supertrendAI(
  bars: Bar[],
  opts: STAIOpts
): { bands: STPoint[]; factor: number[]; perf: number[]; cluster: ('LOW'|'AVG'|'TOP')[] } {
  const { atrPeriod, factorMin, factorMax, factorStep, perfAlpha } = opts;
  const k = opts.k ?? 3; const seed = opts.seed ?? 42;
  const factors: number[] = []; for (let f = factorMin; f <= factorMax + 1e-12; f += factorStep) factors.push(+f.toFixed(6));

  // Precompute per-factor bands + signals + performance memory
  type PF = { factor: number; bands: STPoint[]; signal: (1|-1)[]; perf: number[] };
  const perFactor: PF[] = factors.map(f => {
    const bands = supertrendBands(bars, atrPeriod, f);
    const signal = bands.map(b => b.trend);
    const perf = new Array(bars.length).fill(0);
    for (let i = 1; i < bars.length; i++) {
      const dC = bars[i].c - bars[i - 1].c;
      perf[i] = perf[i - 1] + perfAlpha * (dC * signal[i - 1] - perf[i - 1]);
    }
    return { factor: f, bands, signal, perf };
  });

  const outBands: STPoint[] = []; const outFactor: number[] = []; const outPerf: number[] = []; const outCluster: ('LOW'|'AVG'|'TOP')[] = [];
  for (let i = 1; i < bars.length; i++) {
    const feats = perFactor.map(p => [p.perf[i], p.perf[i] - p.perf[i - 1]]);
    const { labels, centroids } = kmeans2D(feats, k, seed);
    const order = centroids.map((c, idx) => ({ idx, mu: c[0] })).sort((a, b) => b.mu - a.mu).map(x => x.idx);
    const top = order[0]; const second = order[1] ?? order[0];
    // Split factors by cluster
    const topF: number[] = []; const secondF: number[] = []; const topP: number[] = []; const secondP: number[] = [];
    labels.forEach((cid, j) => {
      const f = perFactor[j].factor; const p = feats[j][0];
      if (cid === top) { topF.push(f); topP.push(p); }
      else if (cid === second) { secondF.push(f); secondP.push(p); }
    });
    const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const fTop = mean(topF); const fSec = mean(secondF);
    const pTop = Math.abs(mean(topP)) + 1e-9; const pSec = Math.abs(mean(secondP)) + 1e-9;
    const fStar = (!isFinite(fTop) ? fSec : (!isFinite(fSec) ? fTop : (pTop * fTop + pSec * fSec) / (pTop + pSec)));

    const bands = supertrendBands(bars.slice(0, i + 1), atrPeriod, fStar);
    const last = bands[bands.length - 1];
    outBands.push(last); outFactor.push(fStar); outPerf.push(pTop); outCluster.push('TOP');
  }
  return { bands: outBands, factor: outFactor, perf: outPerf, cluster: outCluster };
}
