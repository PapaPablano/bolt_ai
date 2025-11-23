export type WindowBounds = { from: number; to: number } | null;

export const windowsEqual = (a: WindowBounds, b: WindowBounds): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to;
};

export const normalizeBounds = (bounds: WindowBounds): WindowBounds => {
  if (!bounds) return null;
  if (!Number.isFinite(bounds.from) || !Number.isFinite(bounds.to)) return null;
  const from = Math.min(bounds.from, bounds.to);
  const to = Math.max(bounds.from, bounds.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return null;
  return { from: Math.floor(from), to: Math.floor(to) };
};

export const isTimeWithinBounds = (time: number, bounds: WindowBounds): boolean => {
  if (!bounds) return true;
  return time >= bounds.from && time <= bounds.to;
};
