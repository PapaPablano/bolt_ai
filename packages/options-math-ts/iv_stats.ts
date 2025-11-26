export function ivPercentile(currentIv: number, history: number[]) {
  if (!history?.length) return 0.5;
  const sorted = [...history].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < currentIv).length;
  return below / sorted.length;
}

export function expectedMove(spot: number, iv: number, dte: number) {
  return spot * iv * Math.sqrt(Math.max(0, dte) / 365);
}

export function hvIvRatio(history: number[]) {
  if (!history?.length) return 1;
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const cur = history[history.length - 1];
  return avg > 0 ? cur / avg : 1;
}
