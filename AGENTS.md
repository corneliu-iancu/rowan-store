# AGENTS.md

## Cursor Cloud specific instructions

This repository is the **Adobe Experience Manager (AEM) Edge Delivery Services + Adobe Commerce boilerplate** — a client-side-rendered storefront. There is no traditional backend in this repo; pages are static markup enriched by JS "drop-in" components that query hosted Adobe Commerce GraphQL endpoints (configured in `config.json`). Content is proxied from the remote AEM mountpoint defined in `fstab.yaml`.

### Services / commands

The update script already runs `npm install` (which triggers the `postinstall` → `install:dropins` step that copies `@dropins/*` packages into `scripts/__dropins__/`). Standard commands live in `package.json` and `cypress/package.json`; prefer those over duplicating here.

- **Dev server:** `npm start` (alias for `aem up`) serves the storefront on `http://localhost:3000/`. It is a reverse proxy to the remote AEM site from `fstab.yaml`, so it needs outbound network access. It does not "build" — it serves the working tree directly with live reload.
- **Lint:** `npm run lint` (runs `lint:js` = eslint, then `lint:css` = stylelint). This is the only CI gate in `.github/workflows/main.yaml`.
- **Tests:** Cypress E2E suite lives in `cypress/` (its own `package.json`/lockfile). Install with `npm install --prefix cypress`, then run from the `cypress/` dir: `npm run cypress:run` (PaaS) or `npm run cypress:saas:run` (SaaS). Tests require the dev server running on `localhost:3000` first.

### Non-obvious caveats

- After changing any `@dropins/*` dependency version you must re-run `npm run install:dropins` (or `npm run postinstall`) manually — npm does not run `postinstall` for installing a single specific package, and the served code reads from `scripts/__dropins__/`, not `node_modules`.
- The Cypress E2E specs are coupled to Adobe's official demo commerce backends (PaaS/SaaS) and reference demo-only SKUs. CI gates them with `if: github.repository == 'hlxsites/aem-boilerplate-commerce'`, so on a fork some specs may fail even though the harness is set up correctly. Treat the suite as optional for fork development.
- A harmless `404` for the index/`enrichment` block can appear in the browser console on product pages when the remote query index is not published for the proxied content; it does not block PDP rendering or the cart flow.
- The pre-commit hook (`.husky/pre-commit`) blocks commits that change `blocks/<name>/*.{js,css,html}` without a `blocks/<name>/README.md`, and auto-regenerates `component-*.json` when `models/_*.json` partials are staged.
