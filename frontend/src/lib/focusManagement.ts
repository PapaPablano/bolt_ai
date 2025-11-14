type FocusableElement = HTMLElement & { focus: () => void };

export class FocusManager {
  private focusStack: FocusableElement[] = [];
  private focusTrapActive = false;
  private focusTrapContainer: HTMLElement | null = null;
  private lastFocusedElement: FocusableElement | null = null;
  private focusTrapListener: ((e: KeyboardEvent) => void) | null = null;

  saveFocus(): void {
    const activeElement = document.activeElement as FocusableElement;
    if (activeElement && activeElement !== document.body) {
      this.lastFocusedElement = activeElement;
      this.focusStack.push(activeElement);
    }
  }

  restoreFocus(): void {
    const elementToFocus = this.focusStack.pop();
    if (elementToFocus && document.body.contains(elementToFocus)) {
      try {
        elementToFocus.focus();
      } catch (error) {
        console.warn('Failed to restore focus:', error);
      }
    }
  }

  clearFocusStack(): void {
    this.focusStack = [];
    this.lastFocusedElement = null;
  }

  getFocusableElements(container: HTMLElement = document.body): FocusableElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(',');

    const elements = Array.from(
      container.querySelectorAll<FocusableElement>(focusableSelectors)
    );

    return elements.filter(el => {
      return (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        !el.hasAttribute('aria-hidden') &&
        window.getComputedStyle(el).visibility !== 'hidden'
      );
    });
  }

  trapFocus(container: HTMLElement): void {
    if (this.focusTrapActive) {
      this.releaseFocusTrap();
    }

    this.saveFocus();
    this.focusTrapContainer = container;
    this.focusTrapActive = true;

    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    this.focusTrapListener = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as FocusableElement;

      if (e.shiftKey) {
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', this.focusTrapListener);
  }

  releaseFocusTrap(): void {
    if (!this.focusTrapActive) return;

    this.focusTrapActive = false;
    this.focusTrapContainer = null;

    if (this.focusTrapListener) {
      document.removeEventListener('keydown', this.focusTrapListener);
      this.focusTrapListener = null;
    }

    this.restoreFocus();
  }

  moveFocusToElement(selector: string, container: HTMLElement = document.body): boolean {
    const element = container.querySelector<FocusableElement>(selector);
    if (element) {
      element.focus();
      return true;
    }
    return false;
  }

  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}

export const focusManager = new FocusManager();

export function createSkipLink(targetId: string, label: string): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = label;
  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.addEventListener('blur', () => {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
  });
  return skipLink;
}

export function manageFocusOnUpdate(
  container: HTMLElement,
  updateMessage: string,
  focusTarget?: HTMLElement | string
): void {
  focusManager.announceToScreenReader(updateMessage);

  if (focusTarget) {
    setTimeout(() => {
      if (typeof focusTarget === 'string') {
        focusManager.moveFocusToElement(focusTarget, container);
      } else {
        focusTarget.focus();
      }
    }, 100);
  }
}
