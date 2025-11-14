# Focus Management Quick Reference

## Import Statements

```tsx
// Components
import { Modal } from './components/Modal';
import { SkipLinks } from './components/SkipLinks';
import { LiveRegion } from './components/LiveRegion';
import { DynamicContentUpdate } from './components/DynamicContentUpdate';
import { FocusIndicator } from './components/FocusIndicator';

// Hooks
import {
  useFocusTrap,
  useFocusReturn,
  useAutoFocus,
  useAnnouncement,
  useFocusOnUpdate,
  useKeyboardNavigation
} from './hooks/useFocusManagement';

// Utilities
import { focusManager, manageFocusOnUpdate } from './lib/focusManagement';
```

## Common Patterns

### Modal/Dialog

```tsx
const [isOpen, setIsOpen] = useState(false);
const announce = useAnnouncement();

const handleOpen = () => {
  setIsOpen(true);
  announce('Dialog opened', 'assertive');
};

const handleClose = () => {
  setIsOpen(false);
};

<Modal isOpen={isOpen} onClose={handleClose} title="My Dialog">
  <Content />
</Modal>
```

### Dynamic List

```tsx
const [items, setItems] = useState([]);
const [statusMessage, setStatusMessage] = useState('');
const announce = useAnnouncement();

const addItem = (text) => {
  setItems([...items, text]);
  setStatusMessage(`Added ${text}`);
  announce(`${text} added`, 'polite');
};

<DynamicContentUpdate updateMessage={statusMessage}>
  <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
</DynamicContentUpdate>

<LiveRegion message={statusMessage} priority="polite" />
```

### Auto-Focus Input

```tsx
const inputRef = useAutoFocus<HTMLInputElement>(true);

<input ref={inputRef} placeholder="Focus on mount" />
```

### Keyboard Shortcuts

```tsx
useKeyboardNavigation(
  () => handleEscape(),  // Escape key
  () => handleEnter(),   // Enter key
  isEnabled
);
```

### Screen Reader Announcements

```tsx
const announce = useAnnouncement();

// Polite (non-interrupting)
announce('Item saved', 'polite');

// Assertive (interrupting)
announce('Error occurred', 'assertive');
```

### Focus on Content Update

```tsx
const containerRef = useFocusOnUpdate(
  dataVersion,           // Dependency
  'Content updated',     // Announcement
  '#heading'            // Focus target selector
);

<div ref={containerRef}>
  <h2 id="heading" tabIndex={-1}>Title</h2>
  <Content />
</div>
```

## ARIA Attributes

```tsx
// Skip links target
<main id="main-content" role="main">

// Modal
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">

// Live region
<div role="status" aria-live="polite" aria-atomic="true">

// Alert
<div role="alert" aria-live="assertive">

// List
<ul role="list" aria-label="Items">

// Button labels
<button aria-label="Close dialog">

// Hidden content
<div aria-hidden="true">
```

## CSS Classes

```css
/* Screen reader only */
.sr-only

/* Skip link (shows on focus) */
.skip-link

/* Keyboard focus indicator */
body.keyboard-focus *:focus
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Move focus forward |
| Shift+Tab | Move focus backward |
| Escape | Close modal/dialog |
| Enter | Activate button/link |
| Space | Toggle checkbox/button |

## WCAG Success Criteria

| SC | Level | Requirement | Implementation |
|----|-------|-------------|----------------|
| 2.4.1 | A | Bypass Blocks | Skip links |
| 2.4.3 | A | Focus Order | Logical DOM order |
| 2.4.7 | AA | Focus Visible | CSS focus indicators |
| 3.2.1 | A | On Focus | No unexpected changes |
| 4.1.3 | AA | Status Messages | Live regions |

## Testing Checklist

- [ ] Tab through entire page
- [ ] Shift+Tab works backward
- [ ] Skip links appear on first Tab
- [ ] Focus visible on all elements
- [ ] Modal traps focus
- [ ] Escape closes modal
- [ ] Focus returns after modal close
- [ ] Screen reader announces updates
- [ ] No keyboard traps
- [ ] Logical focus order

## Common Issues

### Focus not visible
```css
/* Add to CSS */
*:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
```

### Modal not trapping focus
```tsx
// Ensure modal uses focus trap
const containerRef = useFocusTrap(isOpen);
<div ref={containerRef}>...</div>
```

### Announcements not working
```tsx
// Use correct priority
announce('Message', 'polite');  // or 'assertive'

// Or use LiveRegion component
<LiveRegion message={msg} priority="polite" />
```

### Focus order wrong
```html
<!-- Keep interactive elements in logical DOM order -->
<!-- Don't use tabindex > 0 -->
<button>First</button>
<button>Second</button>
<button>Third</button>
```

## File Locations

| Component/Utility | Path |
|-------------------|------|
| FocusManager | `src/lib/focusManagement.ts` |
| Hooks | `src/hooks/useFocusManagement.ts` |
| Modal | `src/components/Modal.tsx` |
| SkipLinks | `src/components/SkipLinks.tsx` |
| LiveRegion | `src/components/LiveRegion.tsx` |
| DynamicContentUpdate | `src/components/DynamicContentUpdate.tsx` |
| FocusIndicator | `src/components/FocusIndicator.tsx` |
| Demo | `src/components/FocusManagementDemo.tsx` |
| CSS | `src/index.css` |
| Types | `src/types/focus.ts` |
