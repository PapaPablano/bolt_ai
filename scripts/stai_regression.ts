import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import {
  supertrendPerfSeries,
  type Candle,
  type LinePt,
  type Signal,
  type StPerfParams,
} from '../frontend/src/utils/indicators-supertrend-perf';

type CliParams = {
  csv: string;
  tf: string;
  outDir: string;
  tol: number;
  params: StPerfParams & {
    atrMode: 'RMA' | 'EMA';
    perfLookback: number;
  };
  pyPath: string;
};

type CompareRow = { time: number; ts: number; py: number; diff: number };

type PyResponse = {
  factor?: number;
  raw: LinePt[];
  signals?: Signal[];
};

function parseArgs(): CliParams {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : fallback;
  };
  const flag = (name: string) => args.includes(name);

  const csv = get('--csv');
  if (!csv) throw new Error('--csv is required');

  const tf = get('--tf', '1Hour')!;
  const outDir = get('--out', 'out')!;
  const tol = Number(get('--tol', '0.05'));
  if (!Number.isFinite(tol)) throw new Error('--tol must be a number');

  const atrSpan = Number(get('--atr-span', '14'));
  const factorMin = Number(get('--factor-min', '1.5'));
  const factorMax = Number(get('--factor-max', '5'));
  const factorStep = Number(get('--factor-step', '0.5'));
  const atrMode = (get('--atr-mode', 'EMA') as 'RMA' | 'EMA') ?? 'EMA';
  const k = Number(get('--k', '3')) as 3 | 2;
  const fromCluster = (get('--from-cluster', 'Best') as 'Best' | 'Average' | 'Worst') ?? 'Best';
  const perfAlpha = Number(get('--perf-alpha', '10'));
  const perfLookback = Number(get('--lookback', '1000'));
  const denomSpan = Number(get('--denom-span', '10'));
  const useAMA = flag('--ama');
  const applyImmediateOnFlip = flag('--apply-now');
  const pyPath = get('--python', 'scripts/supertrend_ai_ref.py')!;

  return {
    csv,
    tf,
    outDir,
    tol,
    params: {
      atrSpan,
      factorMin,
      factorMax,
      factorStep,
      k,
      fromCluster,
      perfAlpha,
      perfLookback,
      denomSpan,
      useAMA,
      applyImmediateOnFlip,
      atrMode,
    },
    pyPath,
  };
}

function toUnixSeconds(value: string): number {
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    if (n > 1e12) return Math.floor(n / 1000);
    return Math.floor(n);
  }
  return Math.floor(new Date(value).getTime() / 1000);
}

function readCsv(path: string): Candle[] {
  const raw = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  if (!raw.length) {
    throw new Error(`CSV ${path} is empty`);
  }

  const headers = raw[0].split(',').map((s) => s.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const ti = idx('time');
  const oi = idx('open');
  const hi = idx('high');
  const li = idx('low');
  const ci = idx('close');
  const vi = idx('volume');

  if ([ti, oi, hi, li, ci].some((val) => val < 0)) {
    throw new Error('CSV header must include time,open,high,low,close[,volume]');
  }

  const parseRow = (row: string) => row.split(',').map((s) => s.trim());
  const candles: Candle[] = [];

  for (let i = 1; i < raw.length; i++) {
    const parts = parseRow(raw[i]);
    if (!parts[ti]) continue;
    candles.push({
      time: toUnixSeconds(parts[ti]),
      open: Number(parts[oi]),
      high: Number(parts[hi]),
      low: Number(parts[li]),
      close: Number(parts[ci]),
      volume: vi >= 0 ? Number(parts[vi]) : undefined,
    });
  }

  candles.sort((a, b) => a.time - b.time);
  return candles;
}

function runPython(pyPath: string, candles: Candle[], params: CliParams['params']): Promise<PyResponse> {
  return new Promise<PyResponse>((resolveP, rejectP) => {
    const proc = spawn('python3', [pyPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    const payload = JSON.stringify({ candles, params });
    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
    });
    proc.on('error', rejectP);
    proc.on('exit', (code) => {
      if (code !== 0) {
        rejectP(new Error(`Python ref exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(buf) as PyResponse;
        resolveP(parsed);
      } catch (err) {
        rejectP(err);
      }
    });
    proc.stdin.write(payload);
    proc.stdin.end();
  });
}

function alignAndDiff(tsLine: LinePt[], pyLine: LinePt[]) {
  const pyMap = new Map<number, number>();
  for (const pt of pyLine) {
    if (Number.isFinite(pt.value)) {
      pyMap.set(pt.time, pt.value);
    }
  }

  const rows: CompareRow[] = [];
  for (const pt of tsLine) {
    if (!Number.isFinite(pt.value)) continue;
    const py = pyMap.get(pt.time);
    if (py === undefined) continue;
    const diff = pt.value! - py;
    rows.push({ time: pt.time, ts: pt.value!, py, diff });
  }

  let mae = 0;
  let mse = 0;
  let maxAbs = 0;

  for (const row of rows) {
    const ad = Math.abs(row.diff);
    mae += ad;
    mse += row.diff * row.diff;
    if (ad > maxAbs) maxAbs = ad;
  }

  const n = rows.length || 1;
  return {
    rows,
    mae: mae / n,
    rmse: Math.sqrt(mse / n),
    maxAbs,
  };
}

function compareSignals(tsSignals: Signal[], pySignals: Signal[]) {
  const matched = Math.min(tsSignals.length, pySignals.length);
  let sumAbsDelta = 0;
  let maxAbsDelta = 0;
  let directionMismatches = 0;

  for (let i = 0; i < matched; i++) {
    const delta = tsSignals[i].time - pySignals[i].time;
    const abs = Math.abs(delta);
    sumAbsDelta += abs;
    if (abs > maxAbsDelta) maxAbsDelta = abs;
    if (tsSignals[i].dir !== pySignals[i].dir) directionMismatches++;
  }

  return {
    matched,
    tsCount: tsSignals.length,
    pyCount: pySignals.length,
    meanAbsSeconds: matched ? sumAbsDelta / matched : 0,
    maxAbsSeconds: maxAbsDelta,
    directionMismatches,
  };
}

function writeCompare(outPath: string, rows: CompareRow[]) {
  const header = 'time,ts_value,py_value,diff\n';
  const body = rows.map((row) => `${row.time},${row.ts},${row.py},${row.diff}`).join('\n');
  if (!existsSync(dirname(outPath))) {
    mkdirSync(dirname(outPath), { recursive: true });
  }
  writeFileSync(outPath, header + body, 'utf8');
}

(async function main() {
  const opts = parseArgs();
  const csvPath = resolve(opts.csv);
  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }
  const pyAbsPath = resolve(opts.pyPath);
  if (!existsSync(pyAbsPath)) {
    throw new Error(`Python reference not found: ${pyAbsPath}`);
  }
  const candles = readCsv(csvPath);

  const tsBatch = supertrendPerfSeries(candles, opts.params);
  const pyOut = await runPython(pyAbsPath, candles, opts.params);

  const cmp = alignAndDiff(tsBatch.raw, pyOut.raw ?? []);
  const symbol = csvPath.replace(/.*\//, '').replace(/\.csv$/i, '');
  const outFile = resolve(opts.outDir, `compare_${symbol}_${opts.tf}.csv`);
  writeCompare(outFile, cmp.rows);

  console.log(`Bars compared: ${cmp.rows.length}`);
  console.log(`MAE: ${cmp.mae.toFixed(6)}  RMSE: ${cmp.rmse.toFixed(6)}  MaxAbs: ${cmp.maxAbs.toFixed(6)}`);
  console.log(`Factor (TS): ${tsBatch.factor.toFixed(6)}${pyOut.factor ? `  Factor (PY): ${pyOut.factor.toFixed(6)}` : ''}`);
  console.log(`Compare file: ${outFile}`);

  if (tsBatch.signals?.length || pyOut.signals?.length) {
    const sigStats = compareSignals(tsBatch.signals ?? [], pyOut.signals ?? []);
    console.log(
      `Signals TS/PY: ${sigStats.tsCount}/${sigStats.pyCount}  ` +
        `Matched: ${sigStats.matched}  MeanΔt(s): ${sigStats.meanAbsSeconds.toFixed(2)}  ` +
        `MaxΔt(s): ${sigStats.maxAbsSeconds.toFixed(2)}  Dir mismatches: ${sigStats.directionMismatches}`,
    );
  }

  if (cmp.maxAbs > opts.tol) {
    console.error(`FAIL: max abs diff ${cmp.maxAbs} > tol ${opts.tol}`);
    process.exit(1);
  } else {
    console.log(`PASS: max abs diff ${cmp.maxAbs} <= tol ${opts.tol}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
