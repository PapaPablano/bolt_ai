export interface GatePolicy {
  spreadSoft: number;
  spreadHard: number;
  oiSoft: number;
  oiHard: number;
  ivpSoft: number;
  ivpHard: number;
  multSoft: number;
  multHard: number;
}

export const DEFAULT_GATE_POLICY: GatePolicy = {
  spreadSoft: 0.20,
  spreadHard: 0.30,
  oiSoft: 100,
  oiHard: 50,
  ivpSoft: 0.85,
  ivpHard: 0.92,
  multSoft: 0.75,
  multHard: 0.0,
};

export function gatePenalty(args: {
  bid: number;
  ask: number;
  oi: number;
  ivp: number;
  policy?: Partial<GatePolicy>;
}): { mult: number; reasons: string[] } {
  const p: GatePolicy = { ...DEFAULT_GATE_POLICY, ...(args.policy || {}) };
  const mid = (args.bid + args.ask) / 2;
  const spreadPct = mid > 0 ? (args.ask - args.bid) / mid : 1;

  const reasons: string[] = [];
  let mult = 1;

  const hard =
    spreadPct > p.spreadHard ||
    args.oi < p.oiHard ||
    args.ivp > p.ivpHard;

  const soft =
    spreadPct > p.spreadSoft ||
    args.oi < p.oiSoft ||
    args.ivp > p.ivpSoft;

  if (hard) {
    mult = Math.min(mult, p.multHard);
    reasons.push('gate-hard');
  } else if (soft) {
    mult = Math.min(mult, p.multSoft);
    reasons.push('gate-soft');
  }

  if (spreadPct > p.spreadSoft) reasons.push(`spread=${(spreadPct * 100).toFixed(1)}%`);
  if (args.oi < p.oiSoft) reasons.push(`oi=${args.oi}`);
  if (args.ivp > p.ivpSoft) reasons.push(`ivp=${(args.ivp * 100).toFixed(0)}%`);

  return { mult, reasons };
}
