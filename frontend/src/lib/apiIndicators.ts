export type BBRow = {
  ts: string;
  mid: number;
  upper: number;
  lower: number;
  pct_b: number;
  bandwidth: number;
};

export type KDJRow = {
  ts: string;
  k: number;
  d: number;
  j: number;
};

export type STPoint = {
  t: number;
  upper: number;
  lower: number;
  trend: 1 | -1;
};

export type STAIResponse = {
  bands: STPoint[];
  factor: number[];
  perf: number[];
  cluster: ('LOW' | 'AVG' | 'TOP')[];
};

const base = '/api';

export async function fetchBB(
  symbol: string,
  tf: string,
  n = 20,
  k = 2,
): Promise<BBRow[]> {
  const r = await fetch(`${base}/indicators/bbands?symbol=${symbol}&tf=${tf}&n=${n}&k=${k}`);
  if (!r.ok) throw new Error(`bbands ${r.status}`);
  return r.json();
}

export async function fetchKDJ(
  symbol: string,
  tf: string,
  n = 9,
  m = 3,
  l = 3,
  mode: 'ema' | 'rma' = 'ema',
): Promise<KDJRow[]> {
  const r = await fetch(
    `${base}/indicators/kdj?symbol=${symbol}&tf=${tf}&n=${n}&m=${m}&l=${l}&mode=${mode}`,
  );
  if (!r.ok) throw new Error(`kdj ${r.status}`);
  return r.json();
}

export async function fetchSTAI(
  symbol: string,
  tf: string,
  params?: Partial<{
    atr: number;
    fmin: number;
    fmax: number;
    fstep: number;
    alpha: number;
    persist: boolean;
  }>,
): Promise<STAIResponse> {
  const p = new URLSearchParams({
    symbol,
    tf,
    atr: String(params?.atr ?? 10),
    fmin: String(params?.fmin ?? 1),
    fmax: String(params?.fmax ?? 5),
    fstep: String(params?.fstep ?? 0.5),
    alpha: String(params?.alpha ?? 0.2),
    ...(params?.persist ? { persist: '1' } : {}),
  });

  const r = await fetch(`${base}/regimes/supertrend?${p.toString()}`);
  if (!r.ok) throw new Error(`stai ${r.status}`);
  return r.json();
}

export async function fireAlerts(symbol: string, tf: string) {
  const r = await fetch(`${base}/alerts-evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ symbol, tf }),
  });
  if (!r.ok) throw new Error(`alerts-evaluate ${r.status}`);
  return r.json();
}
