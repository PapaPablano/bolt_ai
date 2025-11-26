import type { Bar, STPoint } from './supertrend';
export interface STAIOpts {
    atrPeriod: number;
    factorMin: number;
    factorMax: number;
    factorStep: number;
    perfAlpha: number;
    k?: number;
    seed?: number;
}
export declare function supertrendAI(bars: Bar[], opts: STAIOpts): {
    bands: STPoint[];
    factor: number[];
    perf: number[];
    cluster: ('LOW' | 'AVG' | 'TOP')[];
};
