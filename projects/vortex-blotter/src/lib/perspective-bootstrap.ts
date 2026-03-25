/// <reference path="../perspective-wasm.d.ts" />

/**
 * Initializes Perspective WASM for `<perspective-viewer>` (call once before first use).
 * Uses `*.wasm?url` so Vite and Angular’s esbuild both emit fetchable URLs.
 *
 * **Angular apps** must set `loader: { ".wasm": "file" }` on the application build
 * (Perspective’s ESM packages require a bundler that exposes `.wasm` as URLs).
 */
import perspective from '@perspective-dev/client';
import perspectiveViewer from '@perspective-dev/viewer';
import SERVER_WASM from '@perspective-dev/server/dist/wasm/perspective-server.wasm?url';
import CLIENT_WASM from '@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm?url';

let initPromise: Promise<void> | undefined;

export function bootstrapVortexBlotterPerspective(): Promise<void> {
  initPromise ??= Promise.all([
    perspective.init_server(fetch(SERVER_WASM)),
    perspectiveViewer.init_client(fetch(CLIENT_WASM)),
  ]).then(() => undefined);
  return initPromise;
}
