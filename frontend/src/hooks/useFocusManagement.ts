import { useEffect, useRef, useCallback } from 'react';
import { focusManager } from '../lib/focusManagement';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      focusManager.trapFocus(containerRef.current);
    }

    return () => {
      if (isActive) {
        focusManager.releaseFocusTrap();
      }
    };
  }, [isActive]);

  return containerRef;
}

export function useFocusReturn() {
  useEffect(() => {
    focusManager.saveFocus();

    return () => {
      focusManager.restoreFocus();
    };
  }, []);
}

export function useAutoFocus<T extends HTMLElement>(shouldFocus: boolean = true) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (shouldFocus && elementRef.current) {
      const timer = setTimeout(() => {
        elementRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [shouldFocus]);

  return elementRef;
}

export function useAnnouncement() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    focusManager.announceToScreenReader(message, priority);
  }, []);

  return announce;
}

export function useFocusOnUpdate(
  dependency: unknown,
  message: string,
  focusSelector?: string
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      focusManager.announceToScreenReader(message);

      if (focusSelector) {
        setTimeout(() => {
          focusManager.moveFocusToElement(focusSelector, containerRef.current!);
        }, 100);
      }
    }
  }, [dependency, message, focusSelector]);

  return containerRef;
}

export function useKeyboardNavigation(
  onEscape?: () => void,
  onEnter?: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      } else if (e.key === 'Enter' && onEnter && !e.shiftKey) {
        onEnter();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, onEnter, enabled]);
}
