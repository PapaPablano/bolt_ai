# Modal Component

**Location:** `src/components/Modal.tsx`
**Category:** Feedback/Overlay
**Status:** Stable
**Version:** 1.0.0

---

## Purpose

### Overview
A fully accessible modal dialog component that displays content in a layer above the application, with focus trapping, keyboard navigation, and screen reader support. Built with WCAG 2.1 Level AA compliance.

### Use Cases
- **Primary:** Display important information or forms that require user attention and action
- **Secondary:** Confirmation dialogs, multi-step forms, image galleries, detailed views
- **Anti-patterns:**
  - Don't use for non-critical information (use tooltips or popovers)
  - Avoid nested modals (causes confusing focus management)
  - Don't auto-open modals on page load (poor UX and accessibility)

### Design Rationale
This modal uses React portals for proper DOM hierarchy, implements WCAG-compliant focus trapping with the focusManager utility, and provides flexible sizing options. The backdrop blur effect provides visual context without completely obscuring the underlying content, helping users understand they're in an overlay state.

---

## API Reference

### Props/Parameters

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | - | Controls the visibility of the modal |
| `onClose` | `() => void` | Yes | - | Callback function invoked when modal should close |
| `title` | `string` | Yes | - | Modal title, used for heading and accessibility labels |
| `children` | `ReactNode` | Yes | - | Content to display inside the modal body |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | No | `'md'` | Controls the maximum width of the modal |
| `closeOnEscape` | `boolean` | No | `true` | Whether pressing Escape key closes the modal |
| `closeOnBackdropClick` | `boolean` | No | `true` | Whether clicking outside modal closes it |

### TypeScript Interfaces

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
}
```

### Return Type
Returns `JSX.Element | null` - renders the modal when `isOpen` is true, returns null when closed.

---

## Usage Examples

### Basic Usage

```tsx
import { Modal } from '@/components/Modal';
import { useState } from 'react';

function ParentComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Modal
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Welcome"
      >
        <p>This is the modal content.</p>
      </Modal>
    </>
  );
}
```

### Advanced Usage

```tsx
// Large modal with custom close behavior
<Modal
  isOpen={showConfirmation}
  onClose={handleCancel}
  title="Confirm Action"
  size="lg"
  closeOnEscape={false}
  closeOnBackdropClick={false}
>
  <div>
    <p>Are you sure you want to proceed? This action cannot be undone.</p>
    <div className="flex gap-4 mt-6">
      <button onClick={handleConfirm} className="btn-primary">
        Confirm
      </button>
      <button onClick={handleCancel} className="btn-secondary">
        Cancel
      </button>
    </div>
  </div>
</Modal>
```

### Common Patterns

#### Pattern 1: Confirmation Dialog
```tsx
function DeleteConfirmation() {
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    await deleteResource();
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Confirm Delete"
      size="sm"
    >
      <p className="text-slate-300">
        Are you sure you want to delete this item?
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Delete
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
```

#### Pattern 2: Form Modal
```tsx
function EditProfileModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(userId, formData);
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Edit Profile"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 rounded"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 rounded"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" className="px-4 py-2 bg-blue-600 rounded">
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-slate-700 rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

### Integration Examples

#### With React Hook Form
```tsx
import { useForm } from 'react-hook-form';

function FormModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = (data: any) => {
    console.log(data);
    setIsOpen(false);
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        reset();
      }}
      title="Submit Form"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <input {...register('fieldName')} />
        <button type="submit">Submit</button>
      </form>
    </Modal>
  );
}
```

#### With State Management (useState)
```tsx
function StockDetailsModal({ symbol }: { symbol: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchStockDetails(symbol).then(setDetails);
    }
  }, [isOpen, symbol]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={`${symbol} Details`}
      size="lg"
    >
      {details ? (
        <StockDetailsView data={details} />
      ) : (
        <LoadingSpinner />
      )}
    </Modal>
  );
}
```

---

## Styling & Theming

### Default Styles
- **Backdrop:** Black overlay with 70% opacity and blur effect
- **Container:** Dark slate background (slate-800) with rounded corners and subtle border
- **Header:** Title with close button, separated by bottom border
- **Body:** Scrollable content area with max-height constraint
- **Z-index:** 50 (ensures modal appears above other content)

### Customization Options

| Method | Description | Example |
|--------|-------------|---------|
| `size` prop | Controls maximum width | `size="lg"` for wide content |
| Children styling | Style modal body content directly | Add className to child elements |
| CSS variables | Override theme colors globally | Not currently implemented |

### Size Classes

```typescript
const sizeClasses = {
  sm: 'max-w-md',    // 448px - Small confirmations
  md: 'max-w-2xl',   // 672px - Standard forms
  lg: 'max-w-4xl',   // 896px - Wide content
  xl: 'max-w-6xl',   // 1152px - Full-width views
};
```

### Style Dependencies
- Requires: Tailwind CSS with slate color palette, lucide-react for X icon
- Optional: Custom focus-visible styles for enhanced keyboard navigation

### Responsive Behavior
- **Mobile:** 16px horizontal margins, full-width within viewport
- **Tablet/Desktop:** Centered with size-based max-width constraints
- **Body scrolling:** Disabled when modal is open (prevents background scroll)
- **Content overflow:** Vertical scroll with max-height constraint

---

## Accessibility

### WCAG Compliance
- **Level:** AA
- **Standards Met:**
  - 2.1.1 Keyboard (Level A) - Full keyboard navigation support
  - 2.4.3 Focus Order (Level A) - Focus trapped within modal
  - 3.2.1 On Focus (Level A) - No unexpected context changes
  - 4.1.2 Name, Role, Value (Level A) - Proper ARIA attributes

### ARIA Implementation

| Attribute | Value/Usage | Purpose |
|-----------|-------------|---------|
| `role="dialog"` | On modal container | Identifies element as dialog |
| `aria-modal="true"` | On modal container | Indicates modal behavior |
| `aria-labelledby` | Points to `modal-title` | Associates title with dialog |
| `aria-label` | On close button | Provides accessible button name |
| `role="presentation"` | On backdrop | Marks backdrop as decorative |

### Keyboard Navigation

| Key | Action | Notes |
|-----|--------|-------|
| `Tab` | Focus next element | Cycles through modal elements only (focus trap) |
| `Shift + Tab` | Focus previous element | Reverse tab within modal |
| `Escape` | Close modal | Configurable via `closeOnEscape` prop |
| `Enter` / `Space` | Activate close button | When close button is focused |

### Screen Reader Behavior
- **On open:** Announces "[Title] dialog opened" assertively
- **On close:** Announces "[Title] dialog closed" politely
- **Focus management:**
  - Focus automatically trapped within modal
  - Initial focus on first focusable element (close button if no other elements)
  - Focus returns to trigger element on close
- **Live regions:** Uses focusManager for screen reader announcements

### Testing Recommendations
- **Test with:** NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS), TalkBack (Android)
- **Verify:**
  - Modal announces when opened/closed
  - Focus trapped within modal
  - Escape key closes modal
  - Focus returns to trigger on close
  - Close button has clear label
  - Title is properly announced

---

## State Management

### Internal State
- `modalRef`: React ref for focus trap container
- `closeButtonRef`: React ref for close button element

### External State Requirements
- Parent component must manage `isOpen` boolean state
- Parent component must provide `onClose` callback

### State Lifecycle
1. **Initial render:** Component returns null if `isOpen` is false
2. **Opening:**
   - Focus trap activated
   - Screen reader announcement (assertive)
   - Body scroll disabled
3. **Open:** Focus contained within modal
4. **Closing:**
   - Focus trap released
   - Screen reader announcement (polite)
   - Body scroll re-enabled
5. **Unmount:** All event listeners and effects cleaned up

---

## Performance Considerations

### Rendering Behavior
- **Initial render:** Lightweight - returns null when closed
- **Re-renders:** Only re-renders when props change
- **Memoization:** No built-in memoization - wrap in React.memo if needed

### Optimization Tips
1. Keep modal content lightweight - lazy load heavy components
2. Consider code-splitting large modal content
3. Avoid putting modals inside frequently re-rendering components
4. Use callback refs for dynamic content instead of frequent prop changes

```tsx
// Good: Modal at app level
function App() {
  const [modalOpen, setModalOpen] = useState(false);
  return <Modal isOpen={modalOpen} ... />;
}

// Avoid: Modal inside frequently updating component
function FrequentUpdates() {
  const [count, setCount] = useState(0); // Updates every second
  return <Modal isOpen={modalOpen} ... />; // Re-renders unnecessarily
}
```

### Bundle Impact
- **Size:** ~2KB minified + gzipped (excluding dependencies)
- **Dependencies:**
  - lucide-react (X icon) - ~1KB for single icon
  - focusManager utility - ~1.5KB
- **Tree-shaking:** Fully tree-shakeable when not imported

---

## Edge Cases & Error Handling

### Edge Cases

#### Empty/Null Values
```tsx
<Modal isOpen={true} onClose={() => {}} title="" children={null} />
// Result: Modal renders with empty title and no body content
// Recommendation: Always provide meaningful title and content
```

#### Rapid Open/Close
```tsx
// Rapidly toggling isOpen
setIsOpen(true);
setIsOpen(false);
setIsOpen(true);
// Result: Focus management handles rapid changes gracefully
// Clean-up effects prevent memory leaks
```

#### Long Content
```tsx
<Modal title="Long Content">
  <div style={{ height: '2000px' }}>Very long content...</div>
</Modal>
// Result: Modal body scrolls, max-height prevents viewport overflow
```

#### Nested Interactive Elements
```tsx
<Modal title="Complex Form">
  <input type="text" />
  <select>...</select>
  <button>Submit</button>
</Modal>
// Result: All interactive elements accessible via Tab, focus trap works correctly
```

### Error Handling

#### Missing Required Props
```tsx
// TypeScript will catch these at compile time
<Modal isOpen={true} /> // Error: Missing required props
```

#### onClose Not Provided
```tsx
<Modal isOpen={true} onClose={undefined} title="Test">
  Content
</Modal>
// Result: Runtime error when trying to close
// Prevention: TypeScript enforces required callback
```

#### Focus Trap Failures
- If modal contains no focusable elements, close button receives focus
- If focusManager fails, modal still functions but without focus trap
- Error logged to console for debugging

### Fallback Behavior
```tsx
// If focusManager unavailable, modal still renders
// Graceful degradation: loses focus trap but remains functional
```

---

## Dependencies

### Required Dependencies
```json
{
  "react": "^18.0.0",
  "lucide-react": "^0.263.1"
}
```

### Peer Dependencies
- React 18+ (uses hooks, ref forwarding)
- TypeScript 5+ (for proper type inference)

### Internal Dependencies
- `@/lib/focusManagement`: Focus trap and screen reader announcements
  - `focusManager.trapFocus(element)`
  - `focusManager.releaseFocusTrap()`
  - `focusManager.announceToScreenReader(message, priority)`

---

## Testing

### Unit Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        Content
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close Test Modal dialog');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key pressed', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        Content
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when closeOnEscape is false', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        closeOnEscape={false}
      >
        Content
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        Content
      </Modal>
    );

    const backdrop = screen.getByRole('presentation');
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('applies correct size class', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test" size="sm">
        Content
      </Modal>
    );

    let dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-md');

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} title="Test" size="xl">
        Content
      </Modal>
    );

    dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-6xl');
  });
});
```

### Integration Tests

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Modal Integration', () => {
  it('traps focus within modal', async () => {
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <input data-testid="input1" />
        <input data-testid="input2" />
        <button data-testid="button1">Action</button>
      </Modal>
    );

    const input1 = screen.getByTestId('input1');
    const input2 = screen.getByTestId('input2');
    const button = screen.getByTestId('button1');
    const closeBtn = screen.getByLabelText(/close/i);

    // Tab through elements
    await user.tab();
    expect(closeBtn).toHaveFocus();

    await user.tab();
    expect(input1).toHaveFocus();

    await user.tab();
    expect(input2).toHaveFocus();

    await user.tab();
    expect(button).toHaveFocus();

    await user.tab();
    // Should cycle back to close button
    expect(closeBtn).toHaveFocus();
  });

  it('manages body scroll lock', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Content
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={() => {}} title="Test">
        Content
      </Modal>
    );

    expect(document.body.style.overflow).toBe('');
  });
});
```

### Accessibility Tests

```tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Modal Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Accessible Modal">
        <p>This is accessible content.</p>
        <button>Action</button>
      </Modal>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper ARIA attributes', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        Content
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

    const title = screen.getByText('Test Modal');
    expect(title).toHaveAttribute('id', 'modal-title');
  });
});
```

### Test Coverage Goals
- [x] All props validated
- [x] User interactions tested (click, keyboard)
- [x] Error states covered
- [x] Accessibility verified
- [x] Edge cases handled (rapid toggle, empty content)
- [x] Focus management tested
- [x] Body scroll lock tested

---

## Browser Support

### Supported Browsers
- Chrome/Edge: 90+ (full support)
- Firefox: 88+ (full support)
- Safari: 14+ (full support)
- Mobile browsers: iOS Safari 14+, Chrome Mobile 90+

### Known Issues
- **Safari < 14:** Focus trap may not work reliably with certain form elements
  - **Workaround:** Add explicit tabIndex to form elements
- **IE 11:** Not supported (uses modern React features)

### Polyfills Required
None - component uses only modern browser APIs available in supported versions.

---

## Migration Guide

### From Previous Versions

This is the initial stable version (1.0.0), no migration needed.

### Breaking Changes
None yet - initial release.

---

## Related Components

### Alternatives
- `AlertDialog`: Use for simple yes/no confirmations (lighter weight)
- `Drawer`: Use for side-panel content that doesn't need to completely block the UI
- `Popover`: Use for contextual information that doesn't require modal behavior

### Composed With
- Often used with: `Form`, `Button`, `LoadingSpinner`
- Part of pattern: Overlay components family

### Similar Components
- `Sheet`: Similar overlay pattern but slides in from side
- `Dialog`: HTML5 native dialog element (less control, less styling)

---

## Changelog

### Version History

**v1.0.0** (2025-01-14)
- Initial: Stable release
- Added: Full WCAG AA accessibility support
- Added: Focus trapping with focusManager integration
- Added: Configurable sizes (sm, md, lg, xl)
- Added: Optional Escape key and backdrop click handling
- Added: Screen reader announcements on open/close
- Added: Body scroll lock when modal is open

---

## Contributing

### Modification Guidelines
- Must maintain WCAG AA compliance
- All new props must have TypeScript types
- Include tests for new features
- Update this documentation
- Maintain focus trap behavior
- Don't break existing size classes

### Code Review Checklist
- [ ] Types properly defined in ModalProps interface
- [ ] Accessibility features maintained (ARIA, keyboard, focus)
- [ ] Tests pass with 80%+ coverage
- [ ] Documentation updated
- [ ] No performance regressions (test with React DevTools Profiler)
- [ ] Browser compatibility verified (Chrome, Firefox, Safari)
- [ ] Focus management works correctly
- [ ] Screen reader announcements tested

---

## Support & Resources

### Further Reading
- [WAI-ARIA Authoring Practices: Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Focus Trap Implementation Guide](../lib/focusManagement.ts)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Getting Help
- File issues: Check project repository issue tracker
- Discussions: Team Slack #frontend channel
- Component owner: Frontend team

### Maintainers
- Primary: Frontend Team
- Reviewers: Accessibility specialists

---

## License

Project license applies.
