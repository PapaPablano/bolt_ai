#!/usr/bin/env python3
"""
Python reference implementation for SuperTrend-AI parity testing.
Reads JSON on stdin: { "candles": [...], "params": {...} }.
Outputs JSON with the selected factor, line points, and flip signals.
"""
import json
import math
import sys
from typing import Any, Dict, List, Optional, Tuple


def ewm(values: List[float], alpha: float) -> List[float]:
    out: List[float] = [float("nan")] * len(values)
    s: Optional[float] = None
    for i, v in enumerate(values):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out[i] = s if s is not None else float("nan")
            continue
        s = v if s is None else s + alpha * (v - s)
        out[i] = s
    return out


def rma(values: List[float], length: int) -> List[float]:
    if length <= 1:
        return values[:]
    out: List[float] = [float("nan")] * len(values)
    s: Optional[float] = None
    alpha = 1.0 / float(length)
    for i, v in enumerate(values):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out[i] = s if s is not None else float("nan")
            continue
        s = v if s is None else (1 - alpha) * s + alpha * v
        out[i] = s
    return out


def true_range(bars: List[Dict[str, float]]) -> List[float]:
    tr: List[float] = []
    for i, bar in enumerate(bars):
        prev = bars[i - 1] if i > 0 else bar
        hl = bar["high"] - bar["low"]
        hc = abs(bar["high"] - prev["close"])
        lc = abs(bar["low"] - prev["close"])
        tr.append(max(hl, hc, lc))
    return tr


def atr_series(bars: List[Dict[str, float]], span: int, mode: str) -> List[float]:
    tr = true_range(bars)
    if mode.upper() == "RMA":
        return rma(tr, span)
    alpha = 2.0 / (span + 1.0) if span > 1 else 1.0
    return ewm(tr, alpha)


def supertrend_classic(
    bars: List[Dict[str, float]], atr: List[float], factor: float
) -> Tuple[List[Dict[str, float]], List[int]]:
    n = len(bars)
    upper = [float("nan")] * n
    lower = [float("nan")] * n
    final_upper = [float("nan")] * n
    final_lower = [float("nan")] * n
    direction = [0] * n
    line: List[Dict[str, float]] = [dict(time=bars[i]["time"], value=float("nan")) for i in range(n)]

    for i in range(n):
        if not isinstance(atr[i], (int, float)) or math.isnan(atr[i]):
            continue
        basis = (bars[i]["high"] + bars[i]["low"]) / 2.0
        upper[i] = basis + factor * atr[i]
        lower[i] = basis - factor * atr[i]

        if i == 0:
            final_upper[i] = upper[i]
            final_lower[i] = lower[i]
            direction[i] = 1
            line[i]["value"] = final_lower[i]
            continue

        final_upper[i] = (
            upper[i] if bars[i - 1]["close"] > final_upper[i - 1] else min(upper[i], final_upper[i - 1])
        )
        final_lower[i] = (
            lower[i] if bars[i - 1]["close"] < final_lower[i - 1] else max(lower[i], final_lower[i - 1])
        )

        if direction[i - 1] >= 0:
            if bars[i]["close"] > final_upper[i]:
                direction[i] = 1
            elif bars[i]["close"] < final_lower[i]:
                direction[i] = -1
            else:
                direction[i] = 1
        else:
            if bars[i]["close"] < final_lower[i]:
                direction[i] = -1
            elif bars[i]["close"] > final_upper[i]:
                direction[i] = 1
            else:
                direction[i] = -1

        line[i]["value"] = final_lower[i] if direction[i] == 1 else final_upper[i]

    return line, direction


def kmeans1d(values: List[float], k: int) -> List[int]:
    if not values:
        return [0] * len(values)

    seeds = sorted(values)
    picks = [0.25, 0.5, 0.75]
    centers = [seeds[max(0, min(len(seeds) - 1, int(p * (len(seeds) - 1))))] for p in picks][:k]
    labels = [0] * len(values)

    for _ in range(40):
        changed = False
        for i, val in enumerate(values):
            best = min(range(len(centers)), key=lambda c: abs(val - centers[c]))
            if labels[i] != best:
                labels[i] = best
                changed = True
        if not changed:
            break
        for j in range(len(centers)):
            cluster = [values[i] for i, lbl in enumerate(labels) if lbl == j]
            if cluster:
                centers[j] = sum(cluster) / len(cluster)
    return labels


def perf_for_factor(
    bars: List[Dict[str, float]],
    line: List[Dict[str, float]],
    alpha: float,
    start_idx: int,
) -> float:
    perf = 0.0
    for i in range(max(1, start_idx), len(bars)):
        prev_line = line[i - 1]["value"]
        anchor = bars[i - 1]["close"] if (prev_line is None or math.isnan(prev_line)) else prev_line
        bias = math.copysign(1.0, bars[i - 1]["close"] - anchor) if anchor is not None else 1.0
        delta = bars[i]["close"] - bars[i - 1]["close"]
        perf = perf + alpha * ((delta if bias == 0 else delta * bias) - perf)
    return perf


def run_reference(bars: List[Dict[str, float]], params: Dict[str, Any]):
    atr = atr_series(bars, int(params.get("atrSpan", 14)), params.get("atrMode", "RMA"))
    candidates: List[float] = []
    fac = float(params.get("factorMin", 1.5))
    while fac <= float(params.get("factorMax", 5.0)) + 1e-9:
        candidates.append(round(fac, 6))
        fac += float(params.get("factorStep", 0.5))

    lookback = max(50, min(int(params.get("perfLookback", 1500)), len(bars)))
    start_idx = len(bars) - lookback
    pa = float(params.get("perfAlpha", 10))
    alpha = (2.0 / (pa + 1.0)) if pa > 1 else max(0.001, min(0.999, pa))

    perfs: List[float] = []
    lines: List[List[Dict[str, float]]] = []
    for candidate in candidates:
        line, _ = supertrend_classic(bars, atr, candidate)
        lines.append(line)
        perfs.append(perf_for_factor(bars, line, alpha, start_idx))

    labels = kmeans1d(perfs, int(params.get("k", 3)))
    grouped: Dict[int, List[int]] = {}
    for idx, lbl in enumerate(labels):
        grouped.setdefault(lbl, []).append(idx)

    scored = []
    for gid, members in grouped.items():
        mean_perf = sum(perfs[i] for i in members) / max(1, len(members))
        scored.append((gid, mean_perf, members))
    scored.sort(key=lambda item: item[1])

    pick = params.get("fromCluster", "Best")
    if not scored:
        return (candidates[0] if candidates else 0.0), (lines[0] if lines else []), []

    chosen = scored[-1] if pick == "Best" else scored[0] if pick == "Worst" else scored[len(scored) // 2]
    target_idx = chosen[2][0]
    if pick == "Best":
        target_idx = max(chosen[2], key=lambda i: perfs[i])
    elif pick == "Worst":
        target_idx = min(chosen[2], key=lambda i: perfs[i])
    else:
        target = chosen[1]
        target_idx = min(chosen[2], key=lambda i: abs(perfs[i] - target))

    factor = candidates[target_idx]
    line, direction = supertrend_classic(bars, atr, factor)

    signals: List[Dict[str, Any]] = []
    for i in range(1, len(bars)):
        if direction[i] != direction[i - 1] and direction[i - 1] != 0:
            signals.append(
                {
                    "time": bars[i]["time"],
                    "price": line[i]["value"],
                    "dir": 1 if direction[i] > 0 else -1,
                }
            )
    return factor, line, signals


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    bars = payload.get("candles", [])
    params = payload.get("params", {})
    factor, line, signals = run_reference(bars, params)
    print(json.dumps({"factor": factor, "raw": line, "signals": signals}))


if __name__ == "__main__":
    main()
