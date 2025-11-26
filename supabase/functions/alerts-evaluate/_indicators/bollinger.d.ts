export declare function bollinger(close: number[], n?: number, k?: number): {
    mid: number[];
    upper: number[];
    lower: number[];
    pctB: number[];
    bw: number[];
};
