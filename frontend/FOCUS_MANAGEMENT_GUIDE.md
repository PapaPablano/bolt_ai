# Focus Management Implementation Guide

## Overview

This guide covers the comprehensive focus management system implemented for WCAG 2.1 compliance, specifically addressing Success Criterion 2.4.3 (Focus Order) and related accessibility requirements.

## Features Implemented

### 1. Skip Links (WCAG 2.4.1 - Bypass Blocks)

Skip links allow keyboard users to bypass repetitive navigation and jump directly to main content areas.

**Location:** `frontend/src/components/SkipLinks.tsx`

**Implementation:**
```tsx
<SkipLinks />
```

**Behavior:**
- Hidden by default
- Visible on focus (Tab key)
- Jumps to main content sections
- Automatically manages focus when activated

**Skip Targets:**
- Main content
- Watchlist
- Chart
- News panel

### 2. Modal Focus Management

Modals automatically trap focus and restore it when closed.

**Location:** `frontend/src/components/Modal.tsx`

**Features:**
- Automatic focus trap on open
- Focus restoration on close
- Keyboard navigation (Tab/Shift+Tab cycles within modal)
- Escape key to close
- Screen reader announcements
- Backdrop click to close (optional)

**Usage:**
```tsx
import { Modal } from './components/Modal';

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Dialog Title"
  size="md"
  closeOnEscape={true}
  closeOnBackdropClick={true}
>
  <YourContent />
</Modal>
```

### 3. Focus Manager Utility

Central focus management system with comprehensive utilities.

**Location:** `frontend/src/lib/focusManagement.ts`

**Core Methods:**

#### Save and Restore Focus
```typescript
import { focusManager } from './lib/focusManagement';

// Save current focus
focusManager.saveFocus();

// Restore previous focus
focusManager.restoreFocus();
```

#### Focus Trapping
```typescript
// Trap focus within a container
const container = document.getElementById('modal');
focusManager.trapFocus(container);

// Release the focus trap
focusManager.releaseFocusTrap();
```

#### Get Focusable Elements
```typescript
// Get all focusable elements in a container
const focusableElements = focusManager.getFocusableElements(container);
```

#### Screen Reader Announcements
```typescript
// Announce a message to screen readers
focusManager.announceToScreenReader('Item added', 'polite');
focusManager.announceToScreenReader('Error occurred', 'assertive');
```

#### Move Focus
```typescript
// Move focus to a specific element
focusManager.moveFocusToElement('#my-button', container);
```

### 4. React Hooks for Focus Management

**Location:** `frontend/src/hooks/useFocusManagement.ts`

#### useFocusTrap
Trap focus within a container (for modals, dropdowns).

```tsx
import { useFocusTrap } from './hooks/useFocusManagement';

function MyModal({ isOpen }) {
  const containerRef = useFocusTrap(isOpen);

  return <div ref={containerRef}>Modal content</div>;
}
```

#### useFocusReturn
Automatically save and restore focus.

```tsx
import { useFocusReturn } from './hooks/useFocusManagement';

function MyComponent() {
  useFocusReturn(); // Focus restored when unmounted
  return <div>Content</div>;
}
```

#### useAutoFocus
Automatically focus an element when mounted.

```tsx
import { useAutoFocus } from './hooks/useFocusManagement';

function MyForm() {
  const inputRef = useAutoFocus<HTMLInputElement>(true);

  return <input ref={inputRef} />;
}
```

#### useAnnouncement
Make screen reader announcements.

```tsx
import { useAnnouncement } from './hooks/useFocusManagement';

function MyComponent() {
  const announce = useAnnouncement();

  const handleClick = () => {
    announce('Item added successfully', 'polite');
  };

  return <button onClick={handleClick}>Add Item</button>;
}
```

#### useFocusOnUpdate
Manage focus when content updates dynamically.

```tsx
import { useFocusOnUpdate } from './hooks/useFocusManagement';

function MyList({ items }) {
  const containerRef = useFocusOnUpdate(
    items.length,
    'List updated',
    'button:first-child'
  );

  return <div ref={containerRef}>{/* items */}</div>;
}
```

#### useKeyboardNavigation
Handle keyboard shortcuts.

```tsx
import { useKeyboardNavigation } from './hooks/useFocusManagement';

function MyComponent() {
  useKeyboardNavigation(
    () => handleClose(),  // Escape handler
    () => handleSubmit(), // Enter handler
    isEnabled
  );
}
```

### 5. Dynamic Content Updates

Manage focus when content changes dynamically.

**Location:** `frontend/src/components/DynamicContentUpdate.tsx`

**Usage:**
```tsx
import { DynamicContentUpdate } from './components/DynamicContentUpdate';

<DynamicContentUpdate
  updateMessage="Chart data updated"
  focusTarget="#chart-title"
  shouldAnnounce={true}
>
  <ChartComponent data={data} />
</DynamicContentUpdate>
```

### 6. Live Regions

ARIA live regions for screen reader announcements.

**Location:** `frontend/src/components/LiveRegion.tsx`

**Usage:**
```tsx
import { LiveRegion } from './components/LiveRegion';

const [message, setMessage] = useState('');

<LiveRegion
  message={message}
  priority="polite"
  clearAfter={3000}
/>
```

### 7. Focus Visibility Indicator

Manages visual focus indicators for keyboard vs. mouse users.

**Location:** `frontend/src/components/FocusIndicator.tsx`

**Usage:**
```tsx
import { FocusIndicator } from './components/FocusIndicator';

// Place at the root of your app
<FocusIndicator />
```

**Behavior:**
- Adds `.keyboard-focus` class to body when Tab is pressed
- Removes class on mouse interaction
- Enables conditional styling for keyboard-only focus indicators

## CSS Styling

**Location:** `frontend/src/index.css`

### Skip Links
```css
.skip-link {
  /* Hidden by default */
  position: absolute;
  left: -10000px;
}

.skip-link:focus {
  /* Visible on focus */
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 9999;
}
```

### Focus Indicators
```css
*:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
```

### Screen Reader Only
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Integration Examples

### Basic Modal with Focus Management

```tsx
import { useState } from 'react';
import { Modal } from './components/Modal';
import { useAnnouncement } from './hooks/useFocusManagement';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const announce = useAnnouncement();

  const handleOpen = () => {
    setIsOpen(true);
    announce('Settings dialog opened', 'assertive');
  };

  const handleClose = () => {
    setIsOpen(false);
    announce('Settings dialog closed', 'polite');
  };

  return (
    <>
      <button onClick={handleOpen}>Open Settings</button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Settings">
        <div>
          <p>Your settings here</p>
          <button onClick={handleClose}>Save</button>
        </div>
      </Modal>
    </>
  );
}
```

### Dynamic List with Focus Management

```tsx
import { useState } from 'react';
import { DynamicContentUpdate } from './components/DynamicContentUpdate';
import { LiveRegion } from './components/LiveRegion';
import { useAnnouncement } from './hooks/useFocusManagement';

function TodoList() {
  const [items, setItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const announce = useAnnouncement();

  const addItem = (text) => {
    const newItems = [...items, text];
    setItems(newItems);
    setStatusMessage(`Added ${text}. Total items: ${newItems.length}`);
    announce(`${text} added`, 'polite');
  };

  const removeItem = (index) => {
    const removed = items[index];
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    setStatusMessage(`Removed ${removed}. Total items: ${newItems.length}`);
    announce(`${removed} removed`, 'polite');
  };

  return (
    <div>
      <DynamicContentUpdate updateMessage={statusMessage}>
        <ul role="list" aria-label="Todo items">
          {items.map((item, index) => (
            <li key={index}>
              <span>{item}</span>
              <button
                onClick={() => removeItem(index)}
                aria-label={`Remove ${item}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </DynamicContentUpdate>

      <LiveRegion message={statusMessage} priority="polite" />
    </div>
  );
}
```

### Chart with Focus Management

```tsx
import { useState, useEffect } from 'react';
import { DynamicContentUpdate } from './components/DynamicContentUpdate';
import { useAnnouncement } from './hooks/useFocusManagement';

function StockChart({ symbol }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const announce = useAnnouncement();

  useEffect(() => {
    loadChartData();
  }, [symbol]);

  const loadChartData = async () => {
    setIsLoading(true);
    announce(`Loading chart for ${symbol}`, 'polite');

    try {
      const result = await fetchData(symbol);
      setData(result);
      announce(`Chart loaded for ${symbol}`, 'polite');
    } catch (error) {
      announce(`Error loading chart for ${symbol}`, 'assertive');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DynamicContentUpdate
      updateMessage={`Chart updated for ${symbol}`}
      focusTarget="#chart-title"
    >
      <div id="chart-container">
        <h2 id="chart-title" tabIndex={-1}>{symbol} Chart</h2>
        {isLoading ? (
          <div role="status" aria-live="polite">Loading...</div>
        ) : (
          <ChartComponent data={data} />
        )}
      </div>
    </DynamicContentUpdate>
  );
}
```

## WCAG 2.1 Compliance

### Success Criterion 2.4.1 - Bypass Blocks (Level A)
- **Implementation:** Skip links component
- **Status:** ✅ Compliant
- **How:** Users can skip to main content areas using keyboard

### Success Criterion 2.4.3 - Focus Order (Level A)
- **Implementation:** Logical DOM order, focus management utilities
- **Status:** ✅ Compliant
- **How:** Focus moves in a logical sequence through all interactive elements

### Success Criterion 2.4.7 - Focus Visible (Level AA)
- **Implementation:** CSS focus indicators, focus visibility system
- **Status:** ✅ Compliant
- **How:** Clear visual indicators show which element has keyboard focus

### Success Criterion 3.2.1 - On Focus (Level A)
- **Implementation:** No context changes on focus
- **Status:** ✅ Compliant
- **How:** Receiving focus doesn't trigger unexpected actions

### Success Criterion 4.1.3 - Status Messages (Level AA)
- **Implementation:** ARIA live regions, announcements
- **Status:** ✅ Compliant
- **How:** Dynamic content changes announced to screen readers

## Testing Focus Management

### Manual Testing

1. **Keyboard Navigation**
   - Press Tab to navigate forward
   - Press Shift+Tab to navigate backward
   - Verify focus order is logical
   - Check focus is always visible

2. **Skip Links**
   - Tab immediately when page loads
   - Verify skip links appear
   - Activate each skip link
   - Verify focus moves to correct location

3. **Modals**
   - Open a modal
   - Press Tab - focus should stay within modal
   - Press Escape - modal should close
   - Verify focus returns to trigger element

4. **Dynamic Content**
   - Add/remove items from a list
   - Verify screen reader announces changes
   - Check focus management on updates

### Screen Reader Testing

Test with:
- **NVDA** (Windows) with Firefox
- **JAWS** (Windows) with Chrome
- **VoiceOver** (macOS) with Safari
- **TalkBack** (Android) with Chrome

### Automated Testing

```bash
# Install testing tools
npm install --save-dev @testing-library/react @testing-library/user-event

# Run accessibility tests
npm test
```

Example test:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

test('modal traps focus', async () => {
  const user = userEvent.setup();

  render(
    <Modal isOpen={true} onClose={jest.fn()} title="Test">
      <button>Button 1</button>
      <button>Button 2</button>
    </Modal>
  );

  const button1 = screen.getByText('Button 1');
  const button2 = screen.getByText('Button 2');

  // Tab should cycle within modal
  await user.tab();
  expect(button1).toHaveFocus();

  await user.tab();
  expect(button2).toHaveFocus();

  await user.tab();
  // Should cycle back to beginning
  expect(screen.getByLabelText(/close/i)).toHaveFocus();
});
```

## Browser Support

Focus management works in:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

1. **Focus Trap** - Minimal overhead, only active when modal is open
2. **Screen Reader Announcements** - Debounced to prevent spam
3. **Focus Indicators** - CSS-only, no JavaScript overhead
4. **Skip Links** - No performance impact when hidden

## Best Practices

### DO
- ✅ Always provide skip links on pages with repeated content
- ✅ Trap focus in modals and dialogs
- ✅ Restore focus when closing overlays
- ✅ Announce dynamic content changes
- ✅ Maintain logical focus order in DOM
- ✅ Use semantic HTML
- ✅ Test with keyboard only
- ✅ Test with screen readers

### DON'T
- ❌ Don't move focus unexpectedly
- ❌ Don't trap focus permanently
- ❌ Don't rely on mouse-only interactions
- ❌ Don't remove focus indicators
- ❌ Don't use tabindex > 0
- ❌ Don't create keyboard traps
- ❌ Don't ignore screen reader announcements

## Troubleshooting

### Issue: Focus not visible
**Solution:** Check CSS, ensure `:focus-visible` styles are applied

### Issue: Focus trap not working in modal
**Solution:** Verify modal container is passed correctly to `useFocusTrap` hook

### Issue: Skip links not appearing
**Solution:** Check CSS, ensure `.skip-link:focus` styles are defined

### Issue: Screen reader not announcing
**Solution:** Verify ARIA live regions are present, check announcement priority

### Issue: Focus order is wrong
**Solution:** Review DOM order, avoid using tabindex > 0

## Resources

- [WCAG 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html)
- [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [MDN: Focus Management](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets)
- [WAI-ARIA: Live Regions](https://www.w3.org/WAI/ARIA/apg/practices/live-regions/)

## Demo Component

See `frontend/src/components/FocusManagementDemo.tsx` for a comprehensive demonstration of all focus management features.

To add the demo to your app:
```tsx
import { FocusManagementDemo } from './components/FocusManagementDemo';

// Add to your routes or render directly
<FocusManagementDemo />
```
