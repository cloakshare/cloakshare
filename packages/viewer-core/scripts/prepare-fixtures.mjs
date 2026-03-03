/**
 * Copy the built IIFE bundle and harness to fixtures/ before running e2e tests.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Copy IIFE bundle
const src = resolve(root, 'dist/index.global.js');
const dest = resolve(root, 'fixtures/cloak-viewer.iife.js');

if (!existsSync(src)) {
  console.error('Build the package first: pnpm build');
  process.exit(1);
}

copyFileSync(src, dest);
console.log('Copied IIFE bundle to fixtures/');

// Copy harness files
const harnessDir = resolve(root, 'e2e/harness');
const fixtureHarnessDir = resolve(root, 'fixtures/harness');
if (existsSync(harnessDir)) {
  mkdirSync(fixtureHarnessDir, { recursive: true });
  for (const file of readdirSync(harnessDir)) {
    copyFileSync(resolve(harnessDir, file), resolve(fixtureHarnessDir, file));
  }
  console.log('Copied harness files to fixtures/harness/');
}
