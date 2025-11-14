export interface FocusableElement extends HTMLElement {
  focus: () => void;
}

export type AriaLivePriority = 'polite' | 'assertive' | 'off';

export interface FocusTrapOptions {
  initialFocus?: string | HTMLElement;
  returnFocusOnDeactivate?: boolean;
  escapeDeactivates?: boolean;
  clickOutsideDeactivates?: boolean;
}

export interface FocusManagerState {
  isTrapped: boolean;
  container: HTMLElement | null;
  previousFocus: FocusableElement | null;
}

export interface SkipLinkConfig {
  targetId: string;
  label: string;
  order?: number;
}

export interface AnnouncementOptions {
  priority?: AriaLivePriority;
  clearAfter?: number;
  politeness?: 'polite' | 'assertive';
}

export interface FocusManagementConfig {
  skipLinks?: SkipLinkConfig[];
  modalSelector?: string;
  announceUpdates?: boolean;
  restoreFocusOnUnmount?: boolean;
}
