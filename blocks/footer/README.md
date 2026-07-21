# Footer Block

## Overview

The Footer block renders the site footer from a fragment and, on multistore
sites, adds a store switcher. The switcher is a modal listing the available
store views grouped by region; selecting one navigates to that store's
path-prefixed root (e.g. `/ro/`), which sets the locale, currency, and Catalog
Service scope for the session. On single-store sites the switcher is omitted
and only the footer content is rendered.

## Integration

### Block Configuration

No block configuration is read via `readBlockConfig()`.

### URL Parameters

No URL parameters are read by this block. The active store is derived from the
URL path prefix via `getRootPath()`.

### Local Storage

No localStorage keys are used directly by this block.

### Events

No events are emitted or listened to by this block.

### Metadata

- `footer` - Path to the footer fragment (default: `/footer`)

### Configuration Values

Read via `@dropins/tools/lib/aem/configs.js`:

- `isMultistore()` - When true, the store switcher is rendered
- `getRootPath()` - Current store root (e.g. `/`, `/ro/`), used to mark the
  active store and resolve the per-root switcher fragment

## Behavior Patterns

### Fragments

Two fragments are loaded, both resolved relative to the current root:

1. **Footer** (`/footer`) - Main footer content, always rendered.
2. **Store Switcher** (`/store-switcher`) - Region/store list, rendered only
   when `isMultistore()` is true. Because `loadFragment()` prepends the current
   root, each store root must author its own copy (e.g. `/ro/store-switcher`).

### Store Switcher Structure

The switcher fragment is a nested list: each top-level item is a region label
(plain text) whose child list holds the store links. Each store link points at
a store root and carries the `#nolocal` hash so link localization leaves it
untouched. The switcher button label reflects the current store — the first
link whose pathname starts with the active root is treated as selected.

### User Interaction Flows

1. Users click the store switcher button in the footer to open the modal.
2. Regions with multiple stores expand/collapse as accordions; single-store
   regions collapse into a direct link.
3. Selecting a store navigates to its path-prefixed root.
4. Accordion sections are keyboard accessible (Enter/Space toggle, tab focus).

### Error Handling

- **Missing footer fragment**: `loadFragment()` returns null and the footer
  renders empty rather than throwing.
- **Missing store switcher fragment**: A failed or missing switcher fragment
  must not take down the whole footer. The main footer content is still
  appended and only the switcher is skipped, so store roots that have not yet
  authored a `store-switcher` fragment degrade gracefully.

## Files

- `footer.js` - Main block logic, fragment loading, and store switcher setup
- `footer.css` - Styles for footer content and the store switcher modal
