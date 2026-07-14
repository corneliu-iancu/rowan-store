# Hero Block

## Overview

The Hero block renders a full-width banner at the top of a page: a background image with the page heading overlaid on top. It is created automatically by the `buildHeroBlock` auto-blocking logic in `scripts.js` when a section begins with an `<h1>` and a `<picture>` — no explicit authoring of a "hero" block is required. The block has no JavaScript behavior; it is styled entirely via `hero.css`.

## Configuration Options

This block has no configuration options. Its content is derived from the auto-blocked heading and image:

| Element   | Source |
|-----------|--------|
| Background image | The first `<picture>` in the section. |
| Heading   | The first `<h1>` in the section, overlaid on the image (bottom-right, with a text shadow for legibility). |

## Integration

### URL Parameters, Events, Local Storage

This block does not read URL parameters, emit or listen to events, or use localStorage.

## Behavior Patterns

- **Auto-blocking**: `buildHeroBlock(main)` prepends a hero section when an `<h1>` and `<picture>` are present and not already inside a `.hero` block. Duplicate hero blocks are avoided by checking `h1.closest('.hero')`.
- **Responsive**: The banner grows taller on larger viewports (min-height increases at the `1200px` breakpoint). The heading is positioned over the image and remains readable via a shadow.

### Error Handling

The block is presentational and has no runtime error handling. If no `<h1>`/`<picture>` pair exists, no hero is built.
