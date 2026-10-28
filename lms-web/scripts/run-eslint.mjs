#!/usr/bin/env node
/**
 * Runs ESLint (eslint.config.mjs) non-interactively from the isolated toolchain in tools/eslint.
 *
 *   npm run lint:setup   # once: installs tools/eslint from its package-lock.json (works offline from the npm cache)
 *   npm run lint         # eslint . (exit 1 on errors; warnings are reported but do not fail)
 *
 * Extra arguments are forwarded to ESLint, e.g. `npm run lint -- --fix src/api`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESLINT_BIN = path.join(ROOT, 'tools/eslint/node_modules/eslint/bin/eslint.js');

if (!fs.existsSync(ESLINT_BIN)) {
  console.error('ESLint toolchain is not installed. Run `npm run lint:setup` first.');
  process.exit(1);
}

const forwarded = process.argv.slice(2);
const args = forwarded.length > 0 ? forwarded : ['.'];
const result = spawnSync(process.execPath, [ESLINT_BIN, ...args], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
