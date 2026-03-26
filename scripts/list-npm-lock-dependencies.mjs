/**
 * Lists every package in package-lock.json (including transitive deps), one per line:
 *   name,version
 *
 * Usage (from repo root):
 *   node scripts/list-npm-lock-dependencies.mjs
 *   npm run deps:list
 *
 * Optional: first argument = output file path (default: dependencies-npm.txt in repo root).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const lockPath = join(repoRoot, 'package-lock.json');
const outPath = process.argv[2] ?? join(repoRoot, 'dependencies-npm.txt');

const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const packages = lock.packages ?? {};
const pairs = new Map();

const root = packages[''];
if (root?.name && root?.version) {
  pairs.set(`${root.name}\t${root.version}`, [root.name, root.version]);
}

for (const [key, meta] of Object.entries(packages)) {
  if (key === '' || !meta.version) continue;
  const idx = key.lastIndexOf('node_modules/');
  const name = idx >= 0 ? key.slice(idx + 'node_modules/'.length) : key;
  const dedupeKey = `${name}\t${meta.version}`;
  if (!pairs.has(dedupeKey)) {
    pairs.set(dedupeKey, [name, meta.version]);
  }
}

const rows = [...pairs.values()].sort((a, b) =>
  a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
);

const body = rows.map(([name, version]) => `${name},${version}`).join('\n') + '\n';
writeFileSync(outPath, body, 'utf8');

console.error(`Wrote ${rows.length} unique name,version lines to ${outPath}`);
