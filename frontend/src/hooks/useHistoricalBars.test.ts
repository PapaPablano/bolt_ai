import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHistoricalBars } from './useHistoricalBars';

vi.mock('@/lib/api/ohlc', () => ({
  buildRangeBounds: vi.fn(() => ({ tf: '1Day', startMs: 1000, endMs: 2000 })),
  fetchOHLC: vi.fn(async () => [
    {
      time: '2024-01-01T00:00:00Z',
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
    },
  ]),
}));

vi.mock('@/lib/bars', () => ({
  normalizeBarsPayload: vi.fn(({ bars }) => bars),
}));

vi.mock('@/lib/symbols', () => ({
  isValidSymbol: (s: string) => s.toUpperCase() === 'AAPL',
  normalizeSymbol: (s: string) => s.trim().toUpperCase(),
}));

const createWrapper = () => {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
};

describe('useHistoricalBars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes symbol and range and runs query for valid symbol', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useHistoricalBars(' aapl ', '1Day', '1d'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { time: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
    ]);

    expect(result.current).toMatchObject({
      isLoading: false,
    });
  });

  it('disables query for invalid symbol', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useHistoricalBars('???', '1Day', '6M'),
      { wrapper },
    );

    // enabled=false should keep query idle
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
