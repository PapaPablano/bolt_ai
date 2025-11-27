import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: React.ReactNode | string;
  children: React.ReactNode;
  /** Optional fixed width of the card (used for clamping near screen edges) */
  width?: number;
  /** Optional fixed height of the card (used for clamping near screen edges) */
  height?: number;
};

export default function Tooltip({ content, children, width = 280, height = 200 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const idRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  function onEnter(e: React.MouseEvent) {
    setOpen(true);
    setPos({ x: e.clientX, y: e.clientY });
  }
  function onMove(e: React.MouseEvent) {
    if (open) setPos({ x: e.clientX, y: e.clientY });
  }
  function onLeave() {
    setOpen(false);
  }
  function clampX(x: number) {
    if (typeof window === 'undefined') return x;
    return Math.min(window.innerWidth - width - 12, x + 16);
  }
  function clampY(y: number) {
    if (typeof window === 'undefined') return y;
    return Math.min(window.innerHeight - height - 12, y + 16);
  }

  return (
    <>
      <span
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onFocus={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          setPos({ x: r.right, y: r.top });
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        aria-describedby={open ? idRef.current : undefined}
        className="inline-flex items-center"
      >
        {children}
      </span>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[100000] pointer-events-none w-[280px]"
              style={{ left: clampX(pos.x), top: clampY(pos.y) }}
              role="tooltip"
            >
              <div
                id={idRef.current}
                className="rounded-xl bg-slate-900/95 text-slate-100 text-xs px-3 py-2 shadow-2xl border border-slate-700 max-w-[280px]"
              >
                {typeof content === 'string' ? <span>{content}</span> : content}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
