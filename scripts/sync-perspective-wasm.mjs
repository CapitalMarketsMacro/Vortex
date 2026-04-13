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
const angularDir = join(root, 'libs', 'vortex-blotter', 'assets', 'wasm');
const coreDir = join(root, 'libs', 'vortex-blotter-core', 'assets', 'wasm');
const reactPublicDir = join(root, 'apps', 'vortex-react', 'public', 'assets', 'vortex-blotter', 'wasm');

const wasmFiles = [
  {
    src: join(root, 'node_modules', '@perspective-dev', 'viewer', 'dist', 'wasm', 'perspective-viewer.wasm'),
    name: 'perspective-viewer.wasm',
  },
  {
    src: join(root, 'node_modules', '@perspective-dev', 'server', 'dist', 'wasm', 'perspective-server.wasm'),
    name: 'perspective-server.wasm',
  },
];

for (const dir of [angularDir, coreDir, reactPublicDir]) {
  mkdirSync(dir, { recursive: true });
}

for (const { src, name } of wasmFiles) {
  for (const dir of [angularDir, coreDir, reactPublicDir]) {
    const dest = join(dir, name);
    copyFileSync(src, dest);
    console.log(`sync-perspective-wasm: ${dest}`);
  }
}

// Copy perspective-themes.css to Angular lib assets and React public dir
const themeSrc = join(root, 'node_modules', '@perspective-dev', 'viewer', 'dist', 'css', 'perspective-themes.css');
const themeTargets = [
  join(root, 'libs', 'vortex-blotter', 'assets', 'perspective-themes.css'),
  join(root, 'libs', 'vortex-blotter-core', 'assets', 'perspective-themes.css'),
  join(root, 'apps', 'vortex-react', 'public', 'assets', 'vortex-blotter', 'perspective-themes.css'),
];
for (const dest of themeTargets) {
  try {
    copyFileSync(themeSrc, dest);
    console.log(`sync-perspective-wasm: ${dest}`);
  } catch {
    // perspective-themes.css source may differ by version; skip on error
  }
}
