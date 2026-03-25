import { provideAppInitializer } from '@angular/core';
import { bootstrapVortexBlotterPerspective } from './perspective-bootstrap';

/**
 * One-line Angular integration: runs Perspective WASM init before the app boots.
 * Add to ApplicationConfig.providers (e.g. provideVortexBlotter() near the top).
 *
 * ## What the host app must still do (cannot be fully hidden)
 *
 * Perspective ships .wasm as separate files; your application bundler must emit them.
 * For @angular/build:application, set once in angular.json:
 *
 * "loader": { ".wasm": "file" }
 *
 * ## Styles (self-contained with the npm package)
 *
 * In angular.json → build.options.styles:
 *
 * "node_modules/vortex-blotter/perspective-themes.css"
 *
 * (Vendored copy of Perspective themes.css; re-sync from @perspective-dev/viewer when you bump that peer.)
 *
 * ## TypeScript (only if the compiler complains about .wasm?url imports)
 *
 * Include the package's ambient module declarations:
 *
 * "include": [ "src/**\/*.ts", "node_modules/vortex-blotter/perspective-wasm.d.ts" ]
 *
 * ## Peers
 *
 * Install the peerDependencies listed in vortex-blotter/package.json (@perspective-dev/*, Angular).
 *
 * ## Optional
 *
 * Call bootstrapVortexBlotterPerspective() manually instead if you cannot use provideAppInitializer
 * (e.g. non-Angular shell); still requires the same loader + peers.
 */
export function provideVortexBlotter() {
  return provideAppInitializer(async () => {
    await bootstrapVortexBlotterPerspective();
  });
}
