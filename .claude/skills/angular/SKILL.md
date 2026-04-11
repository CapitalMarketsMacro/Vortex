---
name: angular
description: Angular 21 best practices for this workspace (Vortex app + vortex-blotter ng-packagr library). Use when authoring or editing any *.ts / *.html / *.css under src/ or projects/vortex-blotter/. Covers standalone components, signals, host bindings, native control flow, and the monorepo path-mapping gotcha.
---

# Angular 21 in this workspace

This is an **Angular 21** workspace (`@angular/core ^21.2.0`) containing:

- **`src/`** — the Vortex host application.
- **`projects/vortex-blotter/`** — a standalone-component **library** built with **`ng-packagr`** and published as the `vortex-blotter` npm package. Built output lands in `dist/vortex-blotter/`.

While hacking in the monorepo, the app imports the library via **`tsconfig.json` path mapping** to `projects/vortex-blotter/src/public-api.ts` — **not** from `dist/`. Anything you add to the library must be re-exported from `public-api.ts` to be visible to the app. Anything you export there becomes part of the library's public API surface.

Build commands:

- `npm start` — `ng serve` the host app.
- `npm test` — Vitest via Angular unit-test builder (not Karma).
- `npx ng build vortex-blotter` — build the library.

## Hard rules (from `.claude/CLAUDE.md`)

These are project instructions — follow them exactly:

### TypeScript

- Strict type checking; prefer inference when the type is obvious.
- **No `any`.** Use `unknown` when uncertain, then narrow.

### Components

- **Always standalone.** Do **not** write NgModules.
- Do **not** set `standalone: true` in the decorator — it's the default in v20+ and writing it is treated as noise.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` on every `@Component`.
- Use `input()` / `output()` **functions** (signal-based), never the `@Input()` / `@Output()` decorators.
- Use `computed()` for derived state; keep state transformations pure.
- Signals: use `.set(...)` or `.update(fn)` — never `.mutate()`.
- Prefer **inline templates** for small components; when using external template/style files, reference them with paths **relative to the component TS file** (e.g. `templateUrl: './vortex-blotter.html'`).
- Prefer **Reactive forms** over Template-driven forms.
- In templates:
  - Use native control flow **`@if` / `@for` / `@switch`** — never `*ngIf`, `*ngFor`, `*ngSwitch`.
  - Use **class bindings** (`[class.foo]="..."`), not `ngClass`.
  - Use **style bindings** (`[style.foo]="..."`), not `ngStyle`.
  - Use the `async` pipe for observables.
  - Do not assume globals like `new Date()` are available in templates.
- Use `NgOptimizedImage` for static images (not for base64 inline images).

### Host bindings — important gotcha

**Do not use `@HostBinding` or `@HostListener` decorators.** Put host bindings and listeners inside the **`host` object** of the `@Component` / `@Directive` decorator:

```ts
@Component({
  selector: 'vortex-blotter',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
    '[class.is-loading]': 'loading()',
  },
  // ...
})
```

Note: `projects/vortex-blotter/src/lib/vortex-blotter.ts` currently uses `@HostListener('document:keydown', ...)` — it predates this rule. If you touch that file, migrate it to the `host` object rather than adding another `@HostListener`.

### Services

- Single responsibility.
- `@Injectable({ providedIn: 'root' })` for singletons.
- Use `inject()` inside class fields / constructors — do **not** use constructor-parameter injection.

### State

- Local component state → signals.
- Derived state → `computed()`.
- For cross-component state, prefer a `providedIn: 'root'` service that exposes signals (and `computed`-derived views), not RxJS `BehaviorSubject` unless you genuinely need stream semantics.

### Accessibility (non-negotiable)

- Must pass all **AXE** checks.
- Must meet **WCAG AA** minimums: focus management, color contrast, ARIA attributes.
- Every interactive control needs an accessible name. Dialogs and disclosure panels need correct `role`, `aria-expanded`, `aria-controls`, and focus trapping where applicable (see how `vortex-blotter.ts` wires `*TitleId` / `*PanelId` signals for this).

## Library-specific conventions

- The library uses custom elements from Perspective, so `vortex-blotter.ts` declares `schemas: [CUSTOM_ELEMENTS_SCHEMA]`. Any new component that embeds `<perspective-viewer>` must do the same.
- `imports: []` is fine for components that only use native control flow — no `CommonModule` needed.
- When you add a new public symbol to the library, export it from `projects/vortex-blotter/src/public-api.ts`. Reorganizing lib internals without touching `public-api.ts` is a silent breakage for consumers.
- Bump `projects/vortex-blotter/package.json` `version` before publishing.

## Tests

- Tests run under **Vitest** (`vitest` devDependency, `npm test` via the Angular unit-test builder) — not Karma/Jasmine. Use Vitest's `describe` / `it` / `expect` API. There is a `jsdom` devDependency for DOM-like environments.

## When stuck

- Angular application build options (assets, styles, path mapping): https://angular.dev/reference/configs/angular-workspace
- ng-packagr publishing model: https://github.com/ng-packagr/ng-packagr
- When in doubt about v21 API, prefer the signal-based form — the workspace is committed to signals.
