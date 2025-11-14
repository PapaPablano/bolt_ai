import { useEffect, useRef, ReactNode } from 'react';
import { manageFocusOnUpdate } from '../lib/focusManagement';

interface DynamicContentUpdateProps {
  children: ReactNode;
  updateMessage: string;
  focusTarget?: string;
  shouldAnnounce?: boolean;
}

export function DynamicContentUpdate({
  children,
  updateMessage,
  focusTarget,
  shouldAnnounce = true,
}: DynamicContentUpdateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousContent = useRef<string>('');

  useEffect(() => {
    const currentContent = containerRef.current?.textContent || '';

    if (shouldAnnounce && currentContent !== previousContent.current && previousContent.current !== '') {
      if (containerRef.current) {
        manageFocusOnUpdate(containerRef.current, updateMessage, focusTarget);
      }
    }

    previousContent.current = currentContent;
  }, [children, updateMessage, focusTarget, shouldAnnounce]);

  return (
    <div ref={containerRef} role="region" aria-live="polite" aria-atomic="false">
      {children}
    </div>
  );
}
