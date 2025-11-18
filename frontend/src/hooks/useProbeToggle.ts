import { useEffect, useState } from 'react';

/**
 * Dev-only toggle for showing chart diagnostics without code changes.
 */
export function useProbeToggle(key = 'chart_probe') {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('probe') === '1') {
        localStorage.setItem(key, '1');
        return true;
      }
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        setEnabled((v) => {
          const next = !v;
          localStorage.setItem(key, next ? '1' : '0');
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key]);

  return { enabled, setEnabled };
}
