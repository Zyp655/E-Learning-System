/**
 * Cross-check: every lms-api call made by the lms-web API layer (src/api/*.ts) must hit a route that
 * lms-api registers. Backend routes come from the GoFrame request structs (g.Meta `path:"..." method:"..."`)
 * under lms-api/api/<domain>/v1 that internal/router/route.go binds (<Name>Req -> <ctrl>.<Name>), plus
 * the raw r.GET/r.POST handlers in route.go (SSE / WebSocket). Everything lives under the /v1 prefix.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_API_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const API_ROOT = path.join(REPO_ROOT, 'lms-api/api');
const ROUTE_GO = path.join(REPO_ROOT, 'lms-api/internal/router/route.go');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

function loadBackendRoutes(): Set<string> {
  const routeGo = fs.readFileSync(ROUTE_GO, 'utf8');
  const routes = new Set<string>();
  for (const file of walk(API_ROOT).filter((f) => f.endsWith('.go'))) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /type\s+(\w+)Req\s+struct\s*{\s*g\.Meta\s+`[^`]*?path:"([^"]+)"[^`]*?method:"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const [, name, routePath, method] = m;
      if (new RegExp(`\\b\\w+Ctrl\\.${name}\\b`).test(routeGo)) routes.add(`${method.toUpperCase()} /v1${routePath}`);
    }
  }
  const raw = /\br\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = raw.exec(routeGo))) routes.add(`${m[1]} /v1${m[2]}`);
  return routes;
}

interface WebCall {
  file: string;
  method: string;
  path: string;
}

/** Finds apiFetch(...) / fetch(buildApiUrl(...)) calls with a literal path in src/api/*.ts. */
function loadWebCalls(): WebCall[] {
  const calls: WebCall[] = [];
  for (const file of fs.readdirSync(WEB_API_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(WEB_API_DIR, file), 'utf8');
    const consts = new Map<string, string>();
    for (const c of src.matchAll(/const\s+(\w+)\s*=\s*'(\/v1\/[^']+)'/g)) consts.set(c[1], c[2]);

    // apiFetch<...>(`path`, { method: 'X', ... }) where the generic may span lines; the method is the
    // first `method:` right after the path (options objects put it first), defaulting to GET.
    const re = /\bapiFetch\b(?:<[\s\S]*?>)?\(\s*([`'"])(\/v1\/[^`'"]+)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const options = /^\s*,\s*\{\s*method:\s*'(\w+)'/.exec(src.slice(re.lastIndex, re.lastIndex + 120));
      const method = options?.[1] || 'GET';
      calls.push({ file, method: method.toUpperCase(), path: m[2] });
    }
    for (const f of src.matchAll(/fetch\(buildApiUrl\((\w+)\)\s*,\s*\{\s*method(?::\s*'(\w+)')?/g)) {
      const p = consts.get(f[1]);
      if (p) calls.push({ file, method: (f[2] || 'POST').toUpperCase(), path: p });
    }
  }
  return calls.map((c) => ({ ...c, path: c.path.split('?')[0].replace(/\$\{[^}]+\}/g, ':param') }));
}

const matches = (callPath: string, routePath: string) => {
  const a = callPath.split('/');
  const b = routePath.split('/');
  return (
    a.length === b.length &&
    a.every((seg, i) => seg === b[i] || ((seg === ':param' || /^\d+$/.test(seg)) && b[i].startsWith(':')))
  );
};

describe('lms-web API layer only calls routes registered in lms-api', () => {
  const routes = [...loadBackendRoutes()].map((r) => {
    const [method, p] = r.split(' ');
    return { method, path: p };
  });
  const calls = loadWebCalls();

  it('finds the backend routes and the web calls', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(calls.length).toBeGreaterThan(25);
    expect(calls).toContainEqual({ file: 'tutorStream.ts', method: 'POST', path: '/v1/student/tutor/stream-chat' });
    expect(calls).toContainEqual({ file: 'auth.ts', method: 'POST', path: '/v1/auth/login' });
  });

  it('every call matches a bound backend route (method + path)', () => {
    const missing = calls.filter((c) => !routes.some((r) => r.method === c.method && matches(c.path, r.path)));
    expect(missing).toEqual([]);
  });
});
