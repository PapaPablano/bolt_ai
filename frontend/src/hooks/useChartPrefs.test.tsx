import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartPrefs } from './useChartPrefs';

const getUserMock = vi.fn();
const fromMock = vi.fn();
const insertMock = vi.fn();
const upsertMock = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: fromMock }) }),
      insert: insertMock,
      upsert: upsertMock,
    }),
  },
}));

vi.mock('@/env', () => ({ env: { CALENDAR_ENABLED: true } }));

const setupAuthedUser = () => {
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
};

describe('useChartPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  it('returns defaults and does not crash when unauthenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    fromMock.mockResolvedValue({ data: null, error: null });

    const { result, waitForNextUpdate } = renderHook(() => useChartPrefs());

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.prefs.default_timeframe).toBeDefined();
    expect(result.current.prefs.default_range).toBeDefined();
  });

  it('allows updating TF preset and default TF', async () => {
    setupAuthedUser();
    fromMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    insertMock.mockResolvedValue({ error: null });

    const { result, waitForNextUpdate } = renderHook(() => useChartPrefs());

    await waitForNextUpdate();

    act(() => {
      result.current.setDefaultTf('1Hour');
      result.current.updateTfPreset('1Hour', { useKDJ: true });
    });

    expect(result.current.prefs.default_timeframe).toBe('1Hour');
    const preset = result.current.getTfPreset('1Hour');
    expect(preset.useKDJ).toBe(true);
  });
});
