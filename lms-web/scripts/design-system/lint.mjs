#!/usr/bin/env node
/**
 * Kiểm tra quy tắc giao diện (DESIGN_SYSTEM.md) trên file .ts/.tsx/.js/.jsx trong src/.
 *
 *   node scripts/design-system/lint.mjs                 # file thay đổi so với HEAD (+ untracked)
 *   node scripts/design-system/lint.mjs --staged        # file đang staged (pre-commit)
 *   node scripts/design-system/lint.mjs --base <ref>    # file khác so với <ref>, vd origin/main (CI)
 *   node scripts/design-system/lint.mjs --all           # toàn bộ src/
 *   thêm --warn                                         # chỉ cảnh báo, luôn exit 0
 *
 * Ngoại lệ có chủ đích: thêm comment `ds-ignore-next-line` ngay dòng trên (ghi rõ lý do).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const STAGED = args.includes('--staged');
const WARN = args.includes('--warn');
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

const HOME = 'src/app/[locale]/(HOME_CATEGORY)/';
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** [regex, message, scope, allowFiles?] — scope 'all' | 'home' (chỉ file trong (HOME_CATEGORY)). */
const RULES = [
  [/(?<![\w-])(?:text|bg|border(?:-[xytrblse])?|ring|fill|stroke|from|via|to|divide|outline|placeholder|decoration|shadow)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\()/g, 'màu tuỳ ý → dùng token (text-primary/secondary, bg-muted, border-line, brand, seller…)', 'all'],
  [/(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g, 'cỡ chữ tuỳ ý → text-body / text-h* / text-sm…', 'all'],
  [/(?<![\w-])leading-\[\d+(?:\.\d+)?(?:px|rem)?\]/g, 'line-height tuỳ ý → leading-N / leading-relaxed', 'all'],
  [/(?<![\w-])rounded(?:-[a-z]{1,2})?-\[\d+(?:\.\d+)?(?:px|rem)\]/g, 'bo góc tuỳ ý → rounded-button (nút) / rounded-xl / rounded-2xl…', 'all'],
  [/(?<![\w-])font-(?:light|thin|extralight|extrabold|black|\[\d+\]|\['[^\]]*\]|serif|mono)(?![\w-])/g, 'font ngoài hệ thống → Plus Jakarta Sans, weight normal/medium/semibold', 'all'],
  [/(?<![\w-])(?:text|bg|border|ring|from|via|to|fill|stroke)-(?:slate|zinc|neutral|stone|sky|cyan|indigo|rose|pink|orange|yellow|lime|violet|fuchsia)-\d+/g, 'họ màu đã bị gỡ (class không có tác dụng) → gray/blue/red/amber/green/purple', 'all'],
  [/(?<![\w-])shadow-(?:xl|2xl)(?![\w-])/g, 'shadow-xl/2xl đã bị gỡ → shadow-md / shadow-lg', 'all'],
  [/(?:fontFamily|fontSize|color)\s*:\s*['"`\d]/g, 'style inline (fontFamily/fontSize/color) → dùng class token', 'all'],
  [/from\s+['"]next\/font\/google['"]/g, 'chỉ dùng Plus Jakarta Sans (đã nạp ở [locale]/layout.tsx) — không thêm font Google', 'all'],
  [/from\s+['"](?:lucide-react|react-icons[^'"]*)['"]/g, 'icon: chỉ Heroicons qua <Icon name="…" /> (_components/primitives)', 'home'],
  [/(?<![\w-])font-bold(?![\w-])/g, 'không in đậm 700 → font-semibold (tiêu đề, giá) / font-medium (nút, nhãn, nhấn mạnh)', 'home'],
  [/(?<![\w-])text-gray-(?:300|400|500|600)(?![\w-])/g, 'chữ xám → text-secondary / text-tertiary (đủ tương phản trên nền xám)', 'home'],
  [/(?<![\w-])-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|w|h|min-[wh]|max-[wh]|size|top|left|right|bottom|inset(?:-[xy])?)-\[\d+(?:\.\d+)?px\]/g, 'kích thước px tuỳ ý → dùng scale (p-4, gap-3, size-10, max-w-md…)', 'home'],
  [/<svg\b/g, 'SVG tự vẽ → <Icon name="…" /> (Heroicons). Logo / cờ / minh hoạ có chủ đích: thêm `ds-ignore`', 'home'],
  // Popup: MỘT component dùng chung — `@/components/catalyst/dialog` (hoặc API shadcn `@/components/ui/dialog` bọc quanh nó).
  [/from\s+['"](?:@radix-ui\/react-(?:alert-)?dialog|react-modal|vaul)['"]|<(?:Dialog\.Panel|DialogPanel|DialogBackdrop|Headless\.Dialog)\b/g, 'popup → dùng Dialog dùng chung `@/components/catalyst/dialog` (bottom sheet mobile sẵn)', 'all', [/src\/components\/(?:catalyst|ui)\//]],
  [/(?<![\w-])fixed inset-0(?![\w-])(?=[^'"`]*(?:bg-black\/|bg-gray-950\/|bg-navy\/))/g, 'popup tự dựng (overlay fixed inset-0) → dùng Dialog dùng chung `@/components/catalyst/dialog`. Lightbox / overlay có chủ đích: thêm `ds-ignore`', 'all', [/src\/components\/(?:catalyst|ui)\//]],
];
const ALLOW_FILES = [/src\/app\/\[locale\]\/layout\.tsx$/]; // nơi DUY NHẤT được import next/font/google

function walkAllSrcFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkAllSrcFiles(f, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(path.relative(ROOT, f));
  }
  return out;
}

function listFiles() {
  const ok = (f) => /^src\/.*\.(tsx?|jsx?)$/.test(f) && fs.existsSync(path.join(ROOT, f));
  if (ALL) {
    return walkAllSrcFiles(path.join(ROOT, 'src')).filter(ok);
  }
  try {
    let out;
    if (STAGED) out = sh('git diff --cached --name-only --diff-filter=ACMR');
    else if (BASE) out = sh(`git diff --name-only --diff-filter=ACMR ${BASE}...HEAD`);
    else out = sh('git diff --name-only HEAD && git ls-files --others --exclude-standard');
    const gitFiles = [...new Set(out.split('\n').filter(ok))];
    if (gitFiles.length > 0) return gitFiles;
  } catch {
    // Fallback to walking src/ if git is not initialized or has no commits yet
  }
  return walkAllSrcFiles(path.join(ROOT, 'src')).filter(ok);
}

/** Dòng được thêm/sửa (1-based) theo diff; null = xét toàn file. */
function changedLines(file) {
  if (!STAGED && !BASE) return null;
  const diff = STAGED
    ? sh(`git diff --cached -U0 -- "${file}"`)
    : sh(`git diff -U0 ${BASE}...HEAD -- "${file}"`);
  const lines = new Set();
  for (const m of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return lines;
}

/**
 * File ngoài (HOME_CATEGORY) nhưng được các trang trong đó import (trực tiếp hoặc gián
 * tiếp: src/components/…, src/features/…) → hiển thị trong App Shell nên cũng áp quy tắc 'home'.
 */
function homeDeps() {
  const resolve = (from, spec) => {
    let p;
    if (spec.startsWith('@/')) p = path.join(ROOT, 'src', spec.slice(2));
    else if (spec.startsWith('.')) p = path.resolve(path.dirname(from), spec);
    else return null;
    for (const c of [`${p}.tsx`, `${p}.ts`, path.join(p, 'index.tsx'), path.join(p, 'index.ts')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
  };
  const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f, out);
      else if (/\.tsx?$/.test(e.name)) out.push(f);
    }
    return out;
  };
  const seen = new Set();
  const stack = walk(path.join(ROOT, HOME));
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const r = resolve(f, m[1]);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f)).filter((f) => !f.startsWith('src/components/ui/')));
}

let count = 0;
const files = listFiles();
const HOME_DEPS = files.some((f) => !f.startsWith(HOME)) ? homeDeps() : new Set();
for (const rel of files) {
  const only = changedLines(rel);
  const home = rel.startsWith(HOME) || rel.startsWith('src/features/') || HOME_DEPS.has(rel);
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  text.forEach((line, i) => {
    if (only && !only.has(i + 1)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // bỏ qua comment
    // Ngoại lệ có chủ đích: `// ds-ignore-next-line` ở dòng trên, hoặc `ds-ignore` cuối dòng.
    if (/ds-ignore(?!-next-line)/.test(line) || /ds-ignore-next-line/.test(text[i - 1] || '')) return;
    for (const [re, msg, scope, allow] of RULES) {
      if (scope === 'home' && !home) continue;
      if (allow?.some((r) => r.test(rel))) continue;
      if (msg.startsWith('chỉ dùng Plus Jakarta') && ALLOW_FILES.some((r) => r.test(rel))) continue;
      for (const m of line.matchAll(re)) {
        count++;
        console.log(`${rel}:${i + 1}  ${m[0]}  — ${msg}`);
      }
    }
  });
}

if (count) {
  console.log(`\n✗ ${count} vi phạm quy tắc giao diện — xem DESIGN_SYSTEM.md`);
} else {
  console.log(`✓ design system OK (${files.length} file)`);
}
process.exit(count && !WARN ? 1 : 0);
