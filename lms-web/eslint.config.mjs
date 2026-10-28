// ESLint flat config for lms-web (Next.js 15: next/core-web-vitals + next/typescript).
//
// The ESLint packages live in the isolated toolchain under tools/eslint (installed with
// `npm run lint:setup`), so every shareable config and plugin is resolved from there.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLCHAIN_DIR = path.join(__dirname, 'tools/eslint');
const toolchainRequire = createRequire(path.join(TOOLCHAIN_DIR, 'package.json'));
const { FlatCompat } = toolchainRequire('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: TOOLCHAIN_DIR,
  resolvePluginsRelativeTo: TOOLCHAIN_DIR,
});

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'tools/**', 'public/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
