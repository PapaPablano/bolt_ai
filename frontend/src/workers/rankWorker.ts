export type RankInput = { rows: Array<Record<string, number>> };
export type RankOutput = { rows: Array<Record<string, number>> };

function rank({ rows }: RankInput): RankOutput {
  const scored = rows.map((r) => ({
    ...r,
    score: (r.iv ?? 0) * 0.4 + (r.theta ?? 0) * -0.2 + (r.delta ?? 0) * 0.1,
  }));
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { rows: scored };
}

self.onmessage = (e: MessageEvent<RankInput & { _tag?: string }>) => {
  const out = rank(e.data);
  (self as unknown as Worker).postMessage({ _tag: e.data._tag, ...out });
};
