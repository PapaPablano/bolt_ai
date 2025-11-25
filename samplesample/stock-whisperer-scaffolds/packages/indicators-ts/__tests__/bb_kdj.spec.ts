import { describe, it, expect } from 'vitest';
import { bollinger } from '../bollinger';
import { kdj } from '../kdj';

describe('Bollinger', () => {
  it('computes bands and derived metrics', () => {
    const close = Array.from({length:50}, (_,i)=>100+Math.sin(i/3));
    const { mid, upper, lower, pctB, bw } = bollinger(close, 20, 2) as any;
    expect(mid.length).toBe(50);
    expect(upper[upper.length-1]).toBeTypeOf('number');
    expect(pctB.some((x:number)=>Number.isNaN(x))).toBeTruthy(); // warmup
  });
});

describe('KDJ', () => {
  it('emits aligned K,D,J arrays', () => {
    const high = Array.from({length:60}, (_,i)=>101+Math.sin(i/5)+1);
    const low  = Array.from({length:60}, (_,i)=> 99+Math.sin(i/5)-1);
    const close= Array.from({length:60}, (_,i)=>100+Math.sin(i/5));
    const { K, D, J } = kdj(high, low, close, 9, 3, 3, 'ema');
    expect(K.length).toBe(60); expect(D.length).toBe(60); expect(J.length).toBe(60);
    expect(J[59]).toBeCloseTo(3*K[59]-2*D[59], 8);
  });
});
