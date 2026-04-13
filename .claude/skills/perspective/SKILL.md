---
name: perspective
description: Integration knowledge for Perspective (@perspective-dev/* v4.4.x) as used by the vortex-blotter library. Use when touching the Perspective viewer, WASM bootstrap, themes, layout save/restore, row styling, column headers, or anything under libs/vortex-blotter/src/lib/perspective-*.ts.
---

# Perspective (`@perspective-dev/*`) in vortex-blotter

This workspace wraps **Perspective** (the high-performance data-visualization engine, originally from FINOS, maintained at https://github.com/perspective-dev/perspective) in a reusable Angular component, **`<vortex-blotter>`**. The library lives in `libs/vortex-blotter/` and is published to npm as `vortex-blotter`.

Perspective version pinned here: **`@perspective-dev/* ^4.4.0`**.

The packages we depend on:

| Package | Role |
|---|---|
| `@perspective-dev/client` | JS API — `perspective.worker()`, `perspective.websocket()`, `Table`, `View`. |
| `@perspective-dev/server` | Server-side WASM module (for in-browser worker tables). |
| `@perspective-dev/viewer` | `<perspective-viewer>` custom element. |
| `@perspective-dev/viewer-datagrid` | Datagrid plugin (side-effect import registers it). |
| `@perspective-dev/viewer-d3fc` | D3FC chart plugin (side-effect import registers it). |
| `@perspective-dev/viewer-openlayers` | OpenLayers map plugin (not currently imported by the lib). |

Upstream docs: https://perspective.finos.org/ and https://perspective-dev.github.io/guide/.

## The WASM bootstrap (critical)

Perspective ships two `.wasm` files that must be loaded **before** `<perspective-viewer>` is used:

- `perspective-server.wasm` (from `@perspective-dev/server`)
- `perspective-viewer.wasm` (from `@perspective-dev/viewer`)

This library does **not** use the ES-module `loader: { ".wasm": "file" }` approach. Instead it **vendors** both files in `libs/vortex-blotter/assets/wasm/` and loads them via `fetch()` in `perspective-bootstrap.ts`:

```ts
await Promise.all([
  perspective.init_server(fetch(`${base}perspective-server.wasm`)),
  perspectiveViewer.init_client(fetch(`${base}perspective-viewer.wasm`)),
]);
```

The `base` defaults to **`/assets/vortex-blotter/wasm/`** and is exposed to consumers via:

- `bootstrapVortexBlotterPerspective(baseUrl?)` — imperative.
- `provideVortexBlotter({ wasmAssetsBaseUrl? })` — Angular `ApplicationConfig` providers, wired through `provideAppInitializer` so init runs before the app uses the viewer.
- `VORTEX_BLOTTER_WASM_ASSETS_BASE` — `InjectionToken<string>` for DI overrides.

### WASM sync gotcha

Vendored `.wasm` files are **version-locked** to the matching JS in `@perspective-dev/*`. If they drift (e.g. after an upgrade), you get cryptic `WebAssembly.instantiate` / `__wbg_*` import errors in the browser. Fix: run

```bash
npm run postinstall   # or: node scripts/sync-perspective-wasm.mjs
```

which copies the current `.wasm` files from `node_modules/@perspective-dev/{server,viewer}` into `libs/vortex-blotter/assets/wasm/`. Do this on every version bump. `perspective-themes.css` is vendored the same way and must also be kept in sync.

### Consumer-side setup

Downstream Angular apps that install `vortex-blotter` from npm must:

1. Add an `angular.json` `assets` entry copying `node_modules/vortex-blotter/wasm` to `assets/vortex-blotter/wasm` (or to wherever they point `wasmAssetsBaseUrl`).
2. Add `node_modules/vortex-blotter/perspective-themes.css` to `angular.json` `build.options.styles`.
3. Call `provideVortexBlotter()` in their root `ApplicationConfig`.

If the app is served under a **sub-path** (non-root `base href`), the default absolute `/assets/vortex-blotter/wasm/` will 404 — override `wasmAssetsBaseUrl` to match the real URL.

## Using the viewer (component pattern)

`vortex-blotter.ts` shows the canonical flow. The key shape that matters across the code:

```ts
type PerspectiveViewerEl = HTMLElement & {
  load: (table: unknown) => Promise<void>;
  save?: () => Promise<unknown>;
  restore?: (config: unknown) => Promise<unknown>;
  resize?: (force?: boolean | null) => Promise<unknown>;
  resetThemes?: (names: readonly string[]) => Promise<unknown>;
};
```

- Side-effect imports `@perspective-dev/viewer-datagrid` and `@perspective-dev/viewer-d3fc` register plugins. Import them once in the component file.
- Embed `<perspective-viewer>` in the template and use `viewChild` + `ElementRef` to access the custom element. The component that owns the viewer must set `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.
- **Load a table** with `viewer.load(table)`. Sources:
  - `perspective.worker()` → `worker.table(rows)` for local in-browser data (used for demo mode).
  - `perspective.websocket(wsUrl)` → `client.open_table(name)` for a hosted Perspective server (used for live mode). Convert `http://` / `https://` → `ws://` / `wss://` before calling — see `toWebSocketUrl`.
- Guard every async `load` path with a **sequence number** (`this.loadSeq`) so stale loads can't overwrite a newer one. This pattern is repeated for column reads (`columnsLoadSeq`).
- After `await viewer.load(table)`, keep the `Table` reference in a signal — downstream effects (row styles, header labels, column-name refresh) depend on it.

## Layout save / restore

`collectLayoutSnapshot()` calls `viewer.save()` to capture the Perspective view config (columns, filters, groupings, expressions, plugin state) as an opaque token. `applyLayoutSnapshot()` calls `viewer.restore(token)` to re-apply it.

Important: the restore token is opaque and version-sensitive. **Clone it through JSON before persisting** (see `clonePerspectiveTokenForJson`) to strip any non-serializable bits, and be prepared for `restore()` to fail after an upstream upgrade — the library treats that as a soft failure (`perspectiveFailed` flag) rather than an error, because row-style and column-header state can still apply. Docs: https://perspective-dev.github.io/guide/how_to/javascript/save_restore.html.

## Row styles, column headers, themes

Three concerns layered over the viewer, each in its own module:

- **`perspective-row-styles.ts`** — `attachVortexBlotterRowStyles(viewer, table, rules)` returns an async cleanup fn. Use the cleanup idiom: call the previous cleanup, then attach anew. Row-style rules are merged from two sources: the `rowStyleRules` input and the in-component editor — higher `order` wins.
- **`perspective-column-headers.ts`** — `attachVortexBlotterColumnHeaderLabels(viewer, table, labels)` for friendly display names. Same cleanup-fn pattern.
- **`perspective-theme-css.ts` / `perspective-theme-tokens.ts`** — registers custom Perspective themes via `viewer.resetThemes([...])`. The Perspective theme attribute is `theme="pro-dark" | "carbon" | "neo-quantum"`; the chosen theme is persisted to `localStorage`. `registerPerspectiveThemeList` polls for `resetThemes` availability for up to ~600ms after `customElements.whenDefined('perspective-viewer')` because the method appears asynchronously.

Never call `viewer.resetThemes` before `customElements.whenDefined('perspective-viewer')` resolves and `resetThemes` is actually defined on the element — the library guards against this explicitly.

## Known pitfalls

- **Loading both a name and URL, or neither** — partial config (only one of `tableName` / `websocketUrl`) is an error state; surface it as `loadError`, don't silently fall back to demo mode.
- **Effects that touch the viewer** must re-read `this.viewerRef()?.nativeElement` each run — the element ref can change or not yet exist during early change-detection cycles.
- **`await viewer.load(...)` ordering** — always await it before reading columns; `table.columns()` on a not-yet-loaded table may race.
- **WASM base URL** always ends in `/`; `normalizeWasmBase` enforces this. Don't concatenate URL fragments without it.
- **Do not commit `.wasm` upgrades without bumping the `@perspective-dev/*` peer/dep versions together.** Mismatch = runtime crash.

## Quick links

- Perspective docs: https://perspective.finos.org/
- Dev fork / source: https://github.com/perspective-dev/perspective
- Save/restore API: https://perspective-dev.github.io/guide/how_to/javascript/save_restore.html
- JS API reference (Table, View, Viewer): https://perspective-dev.github.io/guide/
