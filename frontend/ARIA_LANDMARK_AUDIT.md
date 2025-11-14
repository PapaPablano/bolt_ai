# ARIA Landmark Regions Audit & Implementation

## Current Status Analysis

### ✅ What's Already Good

1. **Banner (Header)** - `<header role="banner">` ✓
2. **Main Content** - `<main id="main-content" role="main">` ✓
3. **Contentinfo (Footer)** - `<footer role="contentinfo">` ✓
4. **Section Labels** - Some sections have `aria-label` ✓

### ❌ Issues Found

1. **Missing Navigation Landmark** - Search bar should be in `<nav>`
2. **NewsPanel Missing Complementary** - Sidebar content needs `role="complementary"`
3. **SearchBar Missing Role** - Search should have `role="search"`
4. **Sections Missing Labels** - Some sections lack descriptive `aria-label`
5. **Nested Landmark Issues** - Chart tools need proper region structure
6. **Modal Missing Region** - Comparison mode should have `role="dialog"`

## ARIA Landmark Hierarchy

```
<body>
  ├── <header role="banner">                  ✅ Site header
  │   └── <nav role="navigation">             ❌ MISSING - Search/nav
  │       └── <form role="search">            ❌ MISSING - Search form
  ├── <main role="main">                      ✅ Main content
  │   ├── <section aria-label="Watchlist">    ✅ Watchlist section
  │   └── <section aria-label="Chart">        ✅ Chart section
  │       ├── Chart content (main)
  │       └── <aside role="complementary">    ❌ MISSING - News sidebar
  └── <footer role="contentinfo">             ✅ Site footer
```

## Landmark Regions Explained

### 1. Banner (`role="banner"`)
- **Purpose**: Site header with logo and primary navigation
- **Count**: Exactly 1 per page
- **Contains**: Logo, site title, global navigation
- **Current**: ✅ Implemented

### 2. Navigation (`role="navigation"`)
- **Purpose**: Major navigation blocks
- **Count**: Multiple allowed (should have `aria-label`)
- **Contains**: Navigation menus, search
- **Current**: ❌ Missing

### 3. Search (`role="search"`)
- **Purpose**: Search functionality
- **Count**: Usually 1 (can have more)
- **Contains**: Search input and button
- **Current**: ❌ Missing

### 4. Main (`role="main"`)
- **Purpose**: Primary page content
- **Count**: Exactly 1 per page
- **Contains**: Main page content
- **Current**: ✅ Implemented

### 5. Complementary (`role="complementary"`)
- **Purpose**: Supporting content (sidebars)
- **Count**: Multiple allowed
- **Contains**: Related info, news, widgets
- **Current**: ❌ Missing on NewsPanel

### 6. Contentinfo (`role="contentinfo"`)
- **Purpose**: Site footer
- **Count**: Exactly 1 per page
- **Contains**: Copyright, links, contact
- **Current**: ✅ Implemented

### 7. Region (`role="region"`)
- **Purpose**: Important content area
- **Count**: Multiple allowed (needs `aria-label`)
- **Contains**: Significant page sections
- **Current**: ⚠️ Partial (some sections)

### 8. Form (`role="form"`)
- **Purpose**: Form content
- **Count**: Multiple allowed
- **Contains**: Form controls
- **Current**: ⚠️ Implicit in search

## Implementation Plan

### Phase 1: Header Navigation
```tsx
<header role="banner">
  <nav role="navigation" aria-label="Main navigation">
    <div role="search">
      <SearchBar />
    </div>
  </nav>
</header>
```

### Phase 2: Complementary Sidebar
```tsx
<aside role="complementary" aria-label="Stock news">
  <NewsPanel />
</aside>
```

### Phase 3: Enhanced Sections
```tsx
<section aria-labelledby="watchlist-heading">
  <h2 id="watchlist-heading">Watchlist</h2>
</section>
```

### Phase 4: Form Regions
```tsx
<div role="search" aria-label="Search stocks">
  <form role="search">
    <input type="search" />
  </form>
</div>
```

## Screen Reader Navigation Commands

### JAWS
- `R` - Navigate to next region/landmark
- `Shift+R` - Previous region/landmark
- `M` - Navigate to next main region
- `N` - Navigate to next navigation region
- `F` - Navigate to next form
- `;` - List all landmarks

### NVDA
- `D` - Navigate to next landmark
- `Shift+D` - Previous landmark
- Insert+F7 - List all landmarks

### VoiceOver (Mac)
- `VO+U` - Open rotor
- Navigate to "Landmarks" option
- Arrow keys to navigate

## Testing Checklist

- [ ] Header is announced as "banner"
- [ ] Navigation is announced as "navigation"
- [ ] Search is announced as "search"
- [ ] Main content is announced as "main"
- [ ] News sidebar is announced as "complementary"
- [ ] Footer is announced as "contentinfo"
- [ ] All landmarks have unique labels
- [ ] Landmark navigation works with keyboard
- [ ] Screen reader can jump between landmarks
- [ ] All content is within a landmark

## Best Practices

### ✅ DO
- Use semantic HTML (`<header>`, `<nav>`, `<main>`)
- Add ARIA roles to reinforce semantics
- Provide unique `aria-label` for multiple same-role landmarks
- Keep landmark hierarchy flat
- Include all page content in landmarks

### ❌ DON'T
- Nest landmarks unnecessarily
- Use generic `<div>` without roles
- Forget to label multiple same-role landmarks
- Over-use `role="region"`
- Leave content outside landmarks

## Implementation Priority

### High Priority (Do First)
1. ✅ Wrap SearchBar in navigation landmark
2. ✅ Add complementary role to NewsPanel
3. ✅ Add search role to SearchBar
4. ✅ Enhance section labels

### Medium Priority
5. ✅ Add region roles to chart sections
6. ✅ Improve modal accessibility
7. ✅ Add form landmarks where appropriate

### Low Priority
8. Document landmark usage
9. Add landmark navigation guide
10. Create accessibility testing suite

## Expected User Experience

### Before Implementation
```
Screen Reader User presses "R":
- Jumps to main
- No other landmarks discovered
- Must navigate sequentially through content
```

### After Implementation
```
Screen Reader User presses "R":
1. Banner (header)
2. Navigation (search)
3. Main (content start)
4. Complementary (news sidebar)
5. Contentinfo (footer)

User can quickly jump to any section!
```

## Validation

### Automated Testing
```bash
# Use axe-core
npm install --save-dev @axe-core/cli
npx axe http://localhost:5173
```

### Manual Testing
1. Tab through page - verify logical order
2. Use screen reader landmark navigation
3. Check each landmark is announced
4. Verify all content is in a landmark

### Browser Extensions
- axe DevTools
- WAVE Extension
- Accessibility Insights

## Success Metrics

- ✅ All page content within landmarks
- ✅ 6-8 landmarks total (not too many)
- ✅ Each landmark has clear purpose
- ✅ Landmark navigation works
- ✅ Screen reader users can navigate efficiently
- ✅ Zero axe-core landmark errors
