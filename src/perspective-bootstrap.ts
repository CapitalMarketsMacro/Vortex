/**
 * Perspective ESM bootstrap. Use `*.wasm?url` so Vite (e.g. Vitest) resolves WASM as asset URLs.
 * @see https://vite.dev/guide/features.html#webassembly
 * @see https://perspective-dev.github.io/guide/how_to/javascript/importing.html#vite
 */
import perspective from '@perspective-dev/client';
import perspectiveViewer from '@perspective-dev/viewer';
import SERVER_WASM from '@perspective-dev/server/dist/wasm/perspective-server.wasm?url';
import CLIENT_WASM from '@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm?url';

export async function bootstrapPerspective(): Promise<void> {
  await Promise.all([
    perspective.init_server(fetch(SERVER_WASM)),
    perspectiveViewer.init_client(fetch(CLIENT_WASM)),
  ]);
}
