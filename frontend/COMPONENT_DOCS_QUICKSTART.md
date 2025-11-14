# Component Documentation Quick Start Guide

This guide helps you quickly document components using the comprehensive template.

## Quick Checklist

When documenting a new component, ensure you cover:

- [ ] **Purpose** - Why does this component exist?
- [ ] **API** - Props, types, and interfaces
- [ ] **Usage** - At least 3 realistic examples
- [ ] **Accessibility** - WCAG compliance, ARIA, keyboard nav
- [ ] **Edge Cases** - Empty states, errors, boundary conditions
- [ ] **Tests** - Unit, integration, and a11y test examples

## Minimum Viable Documentation

If pressed for time, at minimum document these sections:

### 1. Purpose (2-3 sentences)
```markdown
## Purpose
Modal component displays content in an overlay layer above the application.
Includes focus trapping, keyboard navigation, and WCAG AA compliance.
Use for important actions requiring user attention.
```

### 2. API Reference (props table)
```markdown
## API Reference

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | - | Controls visibility |
| `onClose` | `() => void` | Yes | - | Close callback |
```

### 3. Basic Usage Example
```tsx
## Usage

import { ComponentName } from '@/components/ComponentName';

<ComponentName
  requiredProp="value"
  onAction={() => console.log('action')}
>
  Content here
</ComponentName>
```

### 4. Accessibility Notes
```markdown
## Accessibility

- WCAG Level: AA
- Keyboard: Tab to navigate, Escape to close
- Screen readers: Announces state changes
- Focus: Trapped within modal when open
```

## Documentation Workflow

### Step 1: Use the Template
Copy from: `frontend/COMPONENT_DOCUMENTATION_TEMPLATE.md`

### Step 2: Fill Essential Sections
Start with these sections in order:
1. Component name and metadata
2. Purpose and use cases
3. Props/API reference
4. Basic usage example
5. Accessibility features

### Step 3: Add Advanced Content
Then expand with:
6. Advanced usage patterns
7. Edge cases
8. Test examples
9. Performance notes

### Step 4: Review & Update
- Ensure code examples work
- Verify all props are documented
- Check accessibility claims with actual tests
- Update version history

## Documentation by Component Type

### UI Components (Button, Input, Card)
Focus on:
- Visual variants (sizes, colors, states)
- User interaction patterns
- Form integration
- Accessibility (focus, labels, roles)

### Layout Components (Grid, Stack, Container)
Focus on:
- Responsive behavior
- Spacing system
- Nesting rules
- Common layout patterns

### Data Display (Table, List, Chart)
Focus on:
- Data structure requirements
- Empty state handling
- Loading states
- Performance with large datasets

### Form Components (Input, Select, Checkbox)
Focus on:
- Validation patterns
- Error handling
- Label associations
- Form library integration

### Feedback Components (Modal, Toast, Alert)
Focus on:
- When to use vs alternatives
- User dismissal patterns
- Accessibility announcements
- Focus management

## Example: Documenting SearchBar

Here's a condensed example for the SearchBar component:

```markdown
# SearchBar Component

**Location:** `src/components/SearchBar.tsx`
**Category:** Form/Search
**Status:** Stable

## Purpose

Autocomplete search input for finding stocks by symbol or company name.
Queries Supabase edge function and displays results in a dropdown listbox.
Fully accessible with ARIA autocomplete pattern.

## API Reference

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSelectSymbol` | `(symbol: string) => void` | Yes | - | Callback when user selects a stock |

## Usage

import { SearchBar } from '@/components/SearchBar';

function App() {
  const handleSelect = (symbol: string) => {
    console.log('Selected:', symbol);
  };

  return <SearchBar onSelectSymbol={handleSelect} />;
}

## Accessibility

- **Role:** search region with listbox pattern
- **ARIA:** Uses aria-controls, aria-expanded, aria-autocomplete
- **Keyboard:**
  - Type to search
  - Tab to navigate results
  - Enter to select
  - Escape to close results
- **Screen reader:** Announces search status and result count

## Edge Cases

### Empty Query
<SearchBar onSelectSymbol={...} />
// User types nothing: No API call, no results shown

### No Results
// User types "ZZZZZ": Shows no results message

### Network Error
// API fails: Logs error, shows empty results (graceful degradation)

## Performance

- Debounced search (controlled by input onChange)
- Results limited to 10 items
- No results caching (future enhancement)
```

## Common Mistakes to Avoid

### ❌ Don't Do This
```markdown
## Props
- isOpen: controls the modal
```

### ✅ Do This Instead
```markdown
## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | - | Controls modal visibility. When true, modal displays with focus trap active. When false, modal is hidden and removed from DOM. |
```

### ❌ Don't Do This
```markdown
## Usage
<Modal />
```

### ✅ Do This Instead
```markdown
## Usage

import { Modal } from '@/components/Modal';
import { useState } from 'react';

function Example() {
  const [open, setOpen] = useState(false);

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Example">
      <p>Modal content here</p>
    </Modal>
  );
}
```

## Tips for Great Documentation

### 1. Write for Your Future Self
Assume you'll forget how this works in 6 months. What would you need to know?

### 2. Show Real Examples
Don't use `foo` and `bar`. Use realistic data from your domain:
```tsx
// ❌ Bad
<StockCard symbol="FOO" price={123} />

// ✅ Good
<StockCard symbol="AAPL" price={182.45} />
```

### 3. Document the Why, Not Just the What
```markdown
// ❌ Just what
Uses focus trap.

// ✅ What and why
Uses focus trap to keep keyboard navigation within modal, preventing users from
accidentally interacting with background content (WCAG 2.4.3).
```

### 4. Include Failure Cases
```tsx
## Edge Cases

### API Failure
If the stock-search function fails, component logs the error and displays
empty results. User can try again by typing a new query.

// Test this scenario:
<SearchBar onSelectSymbol={...} />
// Temporarily disable internet, type in search box
// Expected: No results shown, console error logged, no crash
```

### 5. Keep It Up to Date
Set a reminder to review documentation when:
- Adding new props
- Changing behavior
- Fixing bugs
- Getting user feedback about confusion

## Documentation Review Checklist

Before considering documentation complete:

- [ ] All props documented with types
- [ ] At least one working code example
- [ ] Accessibility features explained
- [ ] Edge cases covered
- [ ] Known issues listed
- [ ] Code examples are copy-paste ready
- [ ] TypeScript types are accurate
- [ ] Related components mentioned
- [ ] Version/status indicated

## File Organization

Store component docs alongside components:

```
src/components/
├── Modal.tsx
├── Modal.md              ← Component documentation
├── Modal.test.tsx
├── SearchBar.tsx
├── SearchBar.md          ← Component documentation
└── SearchBar.test.tsx
```

## Templates for Specific Sections

### Accessibility Section Template
```markdown
## Accessibility

### WCAG Compliance
- Level: [A/AA/AAA]
- Standards: 2.1.1, 4.1.2, [others]

### Keyboard Navigation
| Key | Action |
|-----|--------|
| Tab | Move to next element |
| Enter | Activate |

### Screen Reader
- Announces: [what it announces]
- Role: [ARIA role]
- Labels: [how it's labeled]
```

### Edge Cases Section Template
```markdown
## Edge Cases

### Empty/Null Data
tsx
<Component data={null} />
// Result: [what happens]

### Boundary Values
tsx
<Component count={0} />      // [behavior]
<Component count={999999} /> // [behavior]

### Error States
tsx
// When API fails:
// - [what happens]
// - [how user can recover]
```

## Getting Help

If you're unsure how to document something:
1. Check existing component docs (Modal.md, SearchBar examples)
2. Refer to the full template (COMPONENT_DOCUMENTATION_TEMPLATE.md)
3. Ask team members for review
4. Start with minimum viable docs and iterate

## Remember

> "Documentation is love letter to your future self."
> — Damian Conway

Good documentation saves hours of debugging and confusion. Invest 30 minutes now to save hours later.
