import perspective from '@perspective-dev/client';
import perspectiveViewer from '@perspective-dev/viewer';

/**
 * Default URL prefix where the app serves vendored WASM (see angular.json assets).
 * Must match the `output` path you configure for `projects/vortex-blotter/assets/wasm`.
 */
export const VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE = '/assets/vortex-blotter/wasm/';

let initPromise: Promise<void> | undefined;

function normalizeWasmBase(base: string): string {
  const t = base.trim();
  return t.endsWith('/') ? t : `${t}/`;
}

/**
 * Initializes Perspective WASM for perspective-viewer (call once before first use).
 * Loads vendored perspective-server.wasm and perspective-viewer.wasm via fetch().
 *
 * Host apps must copy the library wasm folder into the build output (angular.json assets),
 * e.g. input projects/vortex-blotter/assets/wasm, output assets/vortex-blotter/wasm.
 * Published consumers: use node_modules/vortex-blotter/wasm as the asset input path.
 *
 * After upgrading `@perspective-dev/*`, run `npm run postinstall` (or
 * `node scripts/sync-perspective-wasm.mjs`) so vendored `.wasm` files match the JS;
 * mismatched WASM causes `WebAssembly.instantiate` / `__wbg_*` import errors.
 *
 * Override wasmAssetsBaseUrl if you use a different output path (trailing slash optional).
 */
export function bootstrapVortexBlotterPerspective(
  wasmAssetsBaseUrl: string = VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
): Promise<void> {
  const base = normalizeWasmBase(wasmAssetsBaseUrl);
  initPromise ??= Promise.all([
    perspective.init_server(fetch(`${base}perspective-server.wasm`)),
    perspectiveViewer.init_client(fetch(`${base}perspective-viewer.wasm`)),
  ]).then(() => undefined);
  return initPromise;
}
