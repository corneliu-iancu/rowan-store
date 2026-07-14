# Collection Block

## Overview

The Collection block renders a curated, paginated grid of products from an authored list of SKUs. Unlike the Product List Page block (which relies on the Live Search `productSearch` dropin for category browse), this block fetches products directly from the Catalog Service `products()` query. This makes it self-contained and independent of Live Search indexing, so it works even where category browse / faceted search is unavailable.

Each product renders as a card (image, name, price) linking to its PDP. Pagination is handled entirely client-side.

## Configuration Options

Block configuration is read via `readBlockConfig(block)`.

| Option     | Effect |
|------------|--------|
| `title`    | Heading shown above the grid. Defaults to `Browse the collection`. |
| `pagesize` | Number of products per page. Defaults to `12` if not set or invalid. |
| `skus`     | Comma- or newline-separated list of product SKUs to display. Order is preserved; SKUs that do not resolve are silently dropped. Required — with no SKUs the block shows an empty state. |

## Integration

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `page`    | Current page number (1-based). Read on load and written with `pushState` when the user paginates. Invalid or missing values default to page 1. |

The block listens for `popstate` so browser back/forward navigation re-renders the correct page.

### Data Source

Products are fetched with a single `products(skus: [...])` GraphQL query through `CS_FETCH_GRAPHQL` (Catalog Service). The query requests `SimpleProductView` and `ComplexProductView` fragments to cover both price shapes. Image URLs are normalized to protocol-relative (`//...`).

### Events

This block does not emit or listen to dropin events.

### Local Storage

This block does not use localStorage.

## Behavior Patterns

### User Interaction Flows

1. **Initial load**: Block reads `title`, `pagesize`, and `skus` from config, fetches all products in one request, reorders them to match the authored SKU order, then renders the page indicated by the `page` URL parameter.
2. **Pagination**: Clicking a page control updates the `page` URL parameter (`pushState`), re-renders the grid, and scrolls to the top. Previous/next controls are disabled at the first/last page.
3. **Product navigation**: Each card links to the PDP via `getProductLink(urlKey, sku)`.

### Error Handling

- **No SKUs configured**: The block adds `collection--empty` and shows "No products configured for this collection."
- **Fetch failure**: The GraphQL call is wrapped in try/catch; on error the block shows "Unable to load products right now."
- **No resolvable products**: If the query returns nothing usable, the block shows "No products found."
