// Lightweight, dependency-free Bollinger Bands implementation
// SPEC-1A: mid, upper, lower, %B and Bandwidth over a closing-price series.
export function bollinger(close, n = 20, k = 2) {
    const mid = [];
    const upper = [];
    const lower = [];
    const pctB = [];
    const bw = [];
    for (let i = 0; i < close.length; i++) {
        if (i + 1 < n) {
            mid.push(NaN);
            upper.push(NaN);
            lower.push(NaN);
            pctB.push(NaN);
            bw.push(NaN);
            continue;
        }
        const start = i - n + 1;
        const win = close.slice(start, i + 1);
        const mean = win.reduce((a, b) => a + b, 0) / n;
        const s = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
        const up = mean + k * s;
        const lo = mean - k * s;
        mid.push(mean);
        upper.push(up);
        lower.push(lo);
        const denom = Math.max(1e-12, up - lo);
        const safeMid = Math.max(1e-12, Math.abs(mean));
        pctB.push((close[i] - lo) / denom);
        bw.push(denom / safeMid);
    }
    return { mid, upper, lower, pctB, bw };
}
