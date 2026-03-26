# Vortex

This repository is an **Angular 21** workspace that contains:

1. **Vortex** — a host application that showcases the library (header shell + full-height blotter region).
2. **`vortex-blotter`** — an Angular library under `projects/vortex-blotter/` that wraps **[Perspective](https://perspective.finos.org/)** (`@perspective-dev/*`) in a reusable **`<vortex-blotter>`** component, with vendored WASM binaries and theme CSS so consumers can integrate without bundling Perspective’s `.wasm` through the app compiler.

The library is built with **ng-packagr** into `dist/vortex-blotter/` and is intended to be published to npm as the **`vortex-blotter`** package.

---

## What `vortex-blotter` does

| Piece | Role |
|--------|------|
| **`VortexBlotter`** | Standalone Angular component (`selector: 'vortex-blotter'`) that hosts `<perspective-viewer>` (Pro Dark theme) and loads either **demo data** or a **remote Perspective table** over WebSocket. |
| **`provideVortexBlotter()`** | Registers an **app initializer** that runs **`bootstrapVortexBlotterPerspective()`** once before the app uses the viewer — loads Perspective’s server and client WASM via **`fetch()`** from URLs you expose as static assets. |
| **Vendored assets** | **`perspective-themes.css`** (Perspective themes) and **`wasm/perspective-server.wasm`** + **`wasm/perspective-viewer.wasm`** ship inside the package; the host app copies them into its build output. |

### Component behavior (`tableName` / `websocketUrl`)

Both inputs are optional **strings** (signal inputs):

- **Both set** — Connects with `perspective.websocket()`, opens the named hosted table, loads it into the viewer. `http://` / `https://` URLs are converted to `ws://` / `wss://` for the client.
- **Neither set** — Shows **demo rows** in a local worker table, plus inline controls (editable URL + table name with datalist suggestions). **Connect** switches to live mode using those values.
- **Only one set** — Shows an error: you must pass **both** or **neither**.

---

## Developing this repo

```bash
npm install
npm start          # ng serve — Vortex app
npm test           # Vitest via Angular unit-test builder
npm run build      # ng build — Vortex app
```

Build the library (output in `dist/vortex-blotter/`):

```bash
npx ng build vortex-blotter
```

While hacking in this monorepo, the app imports **`vortex-blotter`** via **`tsconfig.json` path mapping** to `projects/vortex-blotter/src/public-api.ts`, not only from `dist/`.

---

## Using the `vortex-blotter` npm package in another Angular app

After **`npm install vortex-blotter`** (from the registry or a local `npm pack` tarball), wire the following. Angular does **not** automatically copy files from `node_modules`; you must configure **assets** and **styles** yourself.

### 1. Install peer dependencies

Match the versions expected by the package (see **`vortex-blotter/package.json`** `peerDependencies`), for example:

- `@angular/core`, `@angular/common` (aligned with your app)
- `@perspective-dev/client`, `@perspective-dev/server`, `@perspective-dev/viewer`
- `@perspective-dev/viewer-datagrid`, `@perspective-dev/viewer-d3fc`

### 2. Copy WASM into the browser build

`provideVortexBlotter()` loads WASM from a **base URL** that defaults to:

**`/assets/vortex-blotter/wasm/`**

So the built app must serve **`perspective-server.wasm`** and **`perspective-viewer.wasm`** at:

- `/assets/vortex-blotter/wasm/perspective-server.wasm`
- `/assets/vortex-blotter/wasm/perspective-viewer.wasm`

In **`angular.json`** → **`projects.<your-app>.architect.build.options.assets`**, add:

```json
{
  "glob": "**/*",
  "input": "node_modules/vortex-blotter/wasm",
  "output": "assets/vortex-blotter/wasm"
}
```

If you use a different **`output`** path (or a CDN), set the base URL when providing the library:

```ts
provideVortexBlotter({ wasmAssetsBaseUrl: 'https://cdn.example.com/my-wasm/' })
```

Or provide the **`VORTEX_BLOTTER_WASM_ASSETS_BASE`** injection token. Trailing slash is optional; the library normalizes it.

**Deploy note:** The default base is an **absolute** path from the site origin (`/assets/...`). If the app is served under a **subpath** (non-root `base href`), adjust **`wasmAssetsBaseUrl`** so it matches where those two files are actually reachable.

### 3. Include Perspective themes CSS

In **`angular.json`** → **`build.options.styles`**, add:

```text
node_modules/vortex-blotter/perspective-themes.css
```

(Or the equivalent path if you vendor the file elsewhere.)

### 4. Bootstrap Perspective before first use

In **`app.config.ts`** (or your root **`ApplicationConfig`**):

```ts
import { ApplicationConfig } from '@angular/core';
import { provideVortexBlotter } from 'vortex-blotter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideVortexBlotter(),
    // ...other providers
  ],
};
```

You do **not** need **`loader: { ".wasm": "file" }`** in the app build for these two vendored files — they are loaded with **`fetch()`**, not as ES module imports.

### 5. Use the component

Import the standalone component and bind inputs as needed:

```ts
import { Component } from '@angular/core';
import { VortexBlotter } from 'vortex-blotter';

@Component({
  selector: 'app-root',
  imports: [VortexBlotter],
  template: `
    <vortex-blotter
      [tableName]="tableName"
      [websocketUrl]="websocketUrl"
    />
  `,
})
export class App {
  tableName = 'fx_executions';
  websocketUrl = 'http://localhost:8080/websocket';
}
```

Omit both inputs to get **demo data** plus the built-in **URL / table** controls and **Connect** button.

### 6. Public API surface (reference)

From **`vortex-blotter`**:

- **`VortexBlotter`** — component class.
- **`provideVortexBlotter(options?)`** — Angular providers (includes WASM init).
- **`bootstrapVortexBlotterPerspective(baseUrl?)`** — manual WASM init if you cannot use `provideAppInitializer`.
- **`VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE`** — default `/assets/vortex-blotter/wasm/`.
- **`VORTEX_BLOTTER_WASM_ASSETS_BASE`** — `InjectionToken<string>` for the WASM base URL.
- **`ProvideVortexBlotterOptions`** — type for `provideVortexBlotter` options.

Package **subpaths** (for assets / tooling): `vortex-blotter/perspective-themes.css`, `vortex-blotter/wasm/*`.

---

## Publishing the library

From the repo root, after a successful library build:

```bash
npx ng build vortex-blotter
cd dist/vortex-blotter
npm publish   # or npm pack to inspect the tarball
```

Bump **`version`** in **`projects/vortex-blotter/package.json`** before publishing. Keep vendored **`perspective-themes.css`** and WASM files in sync when upgrading **`@perspective-dev/*`** peers.

---

## Further reading

- [Perspective documentation](https://perspective.finos.org/)
- [Angular application build options](https://angular.dev/reference/configs/angular-workspace) (assets, styles)
