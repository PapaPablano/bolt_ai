import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ChartPrefs, TF, Range, TfPreset } from '@/types/prefs';
import { DEFAULT_CALENDAR_PREFS, DEFAULT_PRESETS, DEFAULT_RANGE, DEFAULT_TF } from '@/types/prefs';
import { DEFAULT_INDICATOR_STYLE_PREFS, cloneIndicatorStylePrefs, type IndicatorStylePrefs } from '@/types/indicator-styles';
import { env } from '@/env';

const LS_KEY = 'chart_prefs_v2';
const LEGACY_KEYS = ['chart_prefs_v1'];

const ensureStyles = (styles?: IndicatorStylePrefs): IndicatorStylePrefs => ({
  global: {
    lineWidth: styles?.global?.lineWidth ?? 2,
    histThickness: styles?.global?.histThickness ?? 'normal',
  },
  perIndicator: styles?.perIndicator ?? {},
});

const deriveCalendarToggle = (value?: boolean) => {
  if (!env.CALENDAR_ENABLED) return false;
  return typeof value === 'boolean' ? value : env.CALENDAR_ENABLED;
};

const mergeDefaults = (p?: Partial<ChartPrefs>): ChartPrefs => {
  const presets = (Object.keys(DEFAULT_PRESETS) as TF[]).reduce<Record<TF, TfPreset>>((acc, tf) => {
    const merged = { ...DEFAULT_PRESETS[tf], ...(p?.presets?.[tf] ?? {}) };
    acc[tf] = { ...merged, useCalendar: deriveCalendarToggle(merged.useCalendar) };
    return acc;
  }, {} as Record<TF, TfPreset>);

  return {
    default_timeframe: (p?.default_timeframe ?? DEFAULT_TF) as TF,
    default_range: (p?.default_range ?? DEFAULT_RANGE) as Range,
    presets,
    styles: cloneIndicatorStylePrefs(ensureStyles(p?.styles ?? DEFAULT_INDICATOR_STYLE_PREFS)),
    calendar: p?.calendar ?? DEFAULT_CALENDAR_PREFS,
  };
};

const readLocal = (): ChartPrefs => {
  if (typeof window === 'undefined') return mergeDefaults();
  try {
    const raw = window.localStorage.getItem(LS_KEY) ?? LEGACY_KEYS.map((k) => window.localStorage.getItem(k)).find(Boolean);
    return raw ? mergeDefaults(JSON.parse(raw)) : mergeDefaults();
  } catch {
    return mergeDefaults();
  }
};

export function useChartPrefs() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<ChartPrefs>(() => readLocal());
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      const user = data?.user;
      if (error || !user) {
        setAuthed(false);
        setUserId(null);
        setLoading(false);
        return;
      }

      setAuthed(true);
      setUserId(user.id);

      const { data: row, error: selectError } = await supabase
        .from('chart_prefs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;
      if (selectError && selectError.code !== 'PGRST116') {
        setLoading(false);
        return;
      }

      if (!row) {
        const initial = readLocal();
        await supabase.from('chart_prefs').insert({
          user_id: user.id,
          default_timeframe: initial.default_timeframe,
          default_range: initial.default_range,
          presets: initial.presets,
          styles: initial.styles,
          calendar: initial.calendar,
        });
        setPrefs(initial);
      } else {
        const serverPrefs = mergeDefaults(row as Partial<ChartPrefs>);
        setPrefs(serverPrefs);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LS_KEY, JSON.stringify(serverPrefs));
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    }
    if (!authed || !userId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await supabase
        .from('chart_prefs')
        .upsert({
          user_id: userId,
          default_timeframe: prefs.default_timeframe,
          default_range: prefs.default_range,
          presets: prefs.presets,
          styles: prefs.styles,
          calendar: prefs.calendar,
        });
    }, 400) as unknown as number;

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [prefs, authed, userId]);

  const getTfPreset = useMemo(
    () =>
      (tf: TF): TfPreset => {
        const preset = prefs.presets[tf];
        return { ...preset, useKDJ: preset.useKDJ ?? false };
      },
    [prefs.presets],
  );
  const updateTfPreset = (tf: TF, patch: Partial<TfPreset>) =>
    setPrefs((p) => ({ ...p, presets: { ...p.presets, [tf]: { ...p.presets[tf], ...patch } } }));
  const setDefaultTf = (tf: TF) => setPrefs((p) => ({ ...p, default_timeframe: tf }));
  const setDefaultRange = (range: Range) => setPrefs((p) => ({ ...p, default_range: range }));
  const setIndicatorStyles = (styles: IndicatorStylePrefs) =>
    setPrefs((p) => ({ ...p, styles: cloneIndicatorStylePrefs(ensureStyles(styles)) }));

  return { loading, prefs, getTfPreset, updateTfPreset, setDefaultTf, setDefaultRange, setIndicatorStyles };
}
