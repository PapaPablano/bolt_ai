import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOptionsDock } from '@/contexts/OptionsDockContext';
import { OptionsPanel } from '@/pages/OptionsPage';

interface OptionsDockProps {
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

export default function OptionsDock({ triggerRef }: OptionsDockProps) {
  const { open, setOpen } = useOptionsDock();
  const rootRef = useRef<HTMLElement | null>(null);

  // Focus management: focus inside on open, restore to trigger on close
  useEffect(() => {
    const root = rootRef.current;
    if (open) {
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusables[0] ?? root).focus();
    } else {
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  return createPortal(
    <>
      <div
        className={`fixed inset-x-0 top-16 h-[calc(100vh-64px)] bg-black transition-opacity ${
          open ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        id="options-dock"
        role="dialog"
        aria-modal="false"
        aria-labelledby="options-dock-title"
        aria-hidden={!open}
        {...({ inert: !open } as any)}
        tabIndex={-1}
        ref={rootRef as any}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'Tab') {
            const root = e.currentTarget;
            const focusables = root.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (!e.shiftKey && active === last) {
              e.preventDefault();
              first.focus();
            } else if (e.shiftKey && active === first) {
              e.preventDefault();
              last.focus();
            }
          }
        }}
        className={[
          'fixed right-0 z-40 bg-slate-900/95 backdrop-blur',
          'w-full sm:w-[560px] lg:w-[760px] xl:w-[980px]',
          'top-16 h-[calc(100vh-64px)]',
          'shadow-2xl border-l border-slate-800',
          'transition-transform duration-300 flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <h2 id="options-dock-title" className="text-sm font-medium">
            Options
          </h2>
          <button
            type="button"
            className="text-xs px-2 py-1 border rounded"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">
          <OptionsPanel />
        </div>
      </aside>
    </>,
    document.body,
  );
}
