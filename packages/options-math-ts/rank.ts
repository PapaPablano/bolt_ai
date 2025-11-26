import { priceCall, pricePut, greeksCall, greeksPut, type Side } from './bsm.ts';
import { ivPercentile, expectedMove, hvIvRatio } from './iv_stats.ts';
import {
  scoreEdge,
  scoreDte,
  scoreIv,
  scoreDelta,
  scoreLiquidity,
  scoreCalendar,
  scoreEarnings,
  popLong,
} from './scores.ts';
import { DEFAULT_WEIGHTS, type Weights } from './weights.ts';
import { DEFAULT_GATE_POLICY, gatePenalty, type GatePolicy } from './gates.ts';

export type Contract = {
  id?: number | string;
  strike: number;
  expiry: string;
  dte: number;
  bid: number;
  ask: number;
  iv: number;
  oi: number;
  vol: number;
  delta?: number;
};

export type Ranked = {
  rank: number;
  contract: Contract & { side: Side };
  theo: number;
  ivp: number;
  scores: Record<string, number>;
  finalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  adjustments: string[];
  gate: { mult: number; reasons: string[] };
};

export function rankOptions(args: {
  side: Side;
  contracts: Contract[];
  spot: number;
  r: number;
  ivHistory: number[];
  daysToEarnings?: number | null;
  weights?: Partial<Weights>;
  gatePolicy?: Partial<GatePolicy>;
  emMode?: 'bonus' | 'filter';
  correlationGuard?: boolean;
}): Ranked[] {
  const w: Weights = { ...DEFAULT_WEIGHTS, ...(args.weights || {}) };
  const gp: GatePolicy = { ...DEFAULT_GATE_POLICY, ...(args.gatePolicy || {}) };
  const hviv = hvIvRatio(args.ivHistory);
  const isCall = args.side === 'call';

  const rows: Ranked[] = [];

  for (const c of args.contracts) {
    const T = c.dte / 252;
    const theo = isCall
      ? priceCall(args.spot, c.strike, T, args.r, c.iv)
      : pricePut(args.spot, c.strike, T, args.r, c.iv);
    const g = isCall
      ? greeksCall(args.spot, c.strike, T, args.r, c.iv)
      : greeksPut(args.spot, c.strike, T, args.r, c.iv);
    const delta = c.delta ?? g.delta;
    const ivp = ivPercentile(c.iv, args.ivHistory);

    const core = {
      edge: scoreEdge(theo, c.ask),
      dte: scoreDte(c.dte),
      iv: scoreIv(ivp),
      delta: scoreDelta(Math.abs(delta)),
      liq: scoreLiquidity(c.bid, c.ask, c.oi, c.vol),
      cal: scoreCalendar(c, args.contracts),
      earn: scoreEarnings(args.daysToEarnings ?? null, c.dte),
    };

    let coreScore =
      w.edge * core.edge +
      w.iv * core.iv +
      w.dte * core.dte +
      w.delta * core.delta +
      w.liq * core.liq +
      w.cal * core.cal +
      w.earn * core.earn;

    const adjustments: string[] = [];

    const breakeven = isCall ? c.strike + c.ask : c.strike - c.ask;
    const pop = popLong(breakeven, args.spot, c.iv, c.dte);
    const em = expectedMove(args.spot, c.iv, c.dte);

    if (args.correlationGuard) {
      const popBoost = pop > 0.55 ? 1.03 : 1.0;
      const emBoost = Math.abs(c.strike - args.spot) < 0.5 * em ? 1.04 : 1.0;
      const best = Math.max(popBoost, emBoost);
      if (best > 1.0) {
        coreScore *= best;
        adjustments.push(best === popBoost ? 'POP+' : 'ExpMove+');
      }
    } else {
      if (pop > 0.55) {
        coreScore *= 1.03;
        adjustments.push('POP+');
      }
      if (Math.abs(c.strike - args.spot) < 0.5 * em) {
        if ((args.emMode ?? 'bonus') === 'bonus') {
          coreScore *= 1.04;
          adjustments.push('ExpMove+');
        } else {
          coreScore *= 0.98;
          adjustments.push('EM-filter');
        }
      }
    }

    if (Math.abs(g.vanna) > 0.01) {
      coreScore *= 1.02;
      adjustments.push('Vanna+');
    }

    if (hviv > 1.1) {
      coreScore *= 0.97;
      adjustments.push('HVIV-');
    }

    const gate = gatePenalty({ bid: c.bid, ask: c.ask, oi: c.oi, ivp, policy: gp });
    const finalScore = Math.max(0, coreScore * gate.mult);

    const grade: Ranked['grade'] =
      finalScore > 0.7 ? 'A' : finalScore > 0.5 ? 'B' : finalScore > 0.35 ? 'C' : 'D';

    rows.push({
      rank: 0,
      contract: { ...c, side: args.side },
      theo,
      ivp,
      scores: core,
      finalScore,
      grade,
      adjustments,
      gate,
    });
  }

  rows.sort((a, b) => b.finalScore - a.finalScore);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rows;
}
