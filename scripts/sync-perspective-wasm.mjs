/**
 * Copies Perspective WASM binaries from node_modules into the library assets folder.
 * The .wasm bytes must match the @perspective-dev/viewer / @perspective-dev/server
 * JS version, or WebAssembly.instantiate() fails (e.g. "__wbg_*: requires a callable").
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'projects', 'vortex-blotter', 'assets', 'wasm');

const copies = [
  [
    join(root, 'node_modules', '@perspective-dev', 'viewer', 'dist', 'wasm', 'perspective-viewer.wasm'),
    join(outDir, 'perspective-viewer.wasm'),
  ],
  [
    join(root, 'node_modules', '@perspective-dev', 'server', 'dist', 'wasm', 'perspective-server.wasm'),
    join(outDir, 'perspective-server.wasm'),
  ],
];

mkdirSync(outDir, { recursive: true });
for (const [from, to] of copies) {
  copyFileSync(from, to);
  console.log(`sync-perspective-wasm: ${to}`);
}
