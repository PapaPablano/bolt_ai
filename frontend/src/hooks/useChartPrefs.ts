import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ChartPrefs, TF, Range, TfPreset } from '@/types/prefs';
import { DEFAULT_PRESETS, DEFAULT_RANGE, DEFAULT_TF } from '@/types/prefs';

const LS_KEY = 'chart_prefs_v1';

const mergeDefaults = (p?: Partial<ChartPrefs>): ChartPrefs => ({
  default_timeframe: (p?.default_timeframe ?? DEFAULT_TF) as TF,
  default_range: (p?.default_range ?? DEFAULT_RANGE) as Range,
  presets: { ...DEFAULT_PRESETS, ...(p?.presets ?? {}) },
});

const readLocal = (): ChartPrefs => {
  if (typeof window === 'undefined') return mergeDefaults();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
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
        });
    }, 400) as unknown as number;

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [prefs, authed, userId]);

  const getTfPreset = useMemo(
    () => (tf: TF): TfPreset => prefs.presets[tf],
    [prefs.presets],
  );
  const updateTfPreset = (tf: TF, patch: Partial<TfPreset>) =>
    setPrefs((p) => ({ ...p, presets: { ...p.presets, [tf]: { ...p.presets[tf], ...patch } } }));
  const setDefaultTf = (tf: TF) => setPrefs((p) => ({ ...p, default_timeframe: tf }));
  const setDefaultRange = (range: Range) => setPrefs((p) => ({ ...p, default_range: range }));

  return { loading, prefs, getTfPreset, updateTfPreset, setDefaultTf, setDefaultRange };
}
