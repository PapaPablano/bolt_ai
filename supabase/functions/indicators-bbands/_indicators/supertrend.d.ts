export type Bar = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
};
export type STPoint = {
    t: number;
    upper: number;
    lower: number;
    trend: 1 | -1;
};
export declare function supertrendBands(bars: Bar[], atrPeriod?: number, factor?: number): STPoint[];
