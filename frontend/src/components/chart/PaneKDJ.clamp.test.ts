import { describe, it, expect } from 'vitest';
import { __test as KdjTest } from './PaneKDJ';

describe('PaneKDJ clamp', () => {
  it('clamps undefined -> 2', () => {
    expect(KdjTest.clamp(undefined)).toBe(2);
  });

  it('clamps 0 -> 1', () => {
    expect(KdjTest.clamp(0)).toBe(1);
  });

  it('clamps 5 -> 4', () => {
    expect(KdjTest.clamp(5)).toBe(4);
  });

  it('passes 3 unchanged', () => {
    expect(KdjTest.clamp(3)).toBe(3);
  });
});
