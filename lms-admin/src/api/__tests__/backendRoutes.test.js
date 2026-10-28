/**
 * Cross-check: every HTTP call made by the lms-admin API modules must hit a route that lms-api registers.
 *
 * Backend routes are read from the GoFrame request structs (g.Meta `path:"..." method:"..."`) under
 * lms-api/api/<domain>/v1, and a request struct only counts when internal/router/route.go binds its
 * controller method (<Name>Req -> <ctrl>.<Name>). All routes live under the /v1 prefix.
 */
const fs = require('fs');
const path = require('path');

const ADMIN_SRC = path.resolve(__dirname, '..');
const API_ROOT = path.resolve(__dirname, '../../../../lms-api/api');
const ROUTE_GO = path.resolve(__dirname, '../../../../lms-api/internal/router/route.go');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const loadBackendRoutes = () => {
  const routeGo = fs.readFileSync(ROUTE_GO, 'utf8');
  const routes = new Set();
  const unbound = [];
  walk(API_ROOT)
    .filter((f) => f.endsWith('.go'))
    .forEach((file) => {
      const src = fs.readFileSync(file, 'utf8');
      const re = /type\s+(\w+)Req\s+struct\s*{\s*g\.Meta\s+`[^`]*?path:"([^"]+)"[^`]*?method:"([^"]+)"/g;
      let m;
      while ((m = re.exec(src))) {
        const [, name, routePath, method] = m;
        const key = `${method.toUpperCase()} /v1${routePath}`;
        if (new RegExp(`\\b\\w+Ctrl\\.${name}\\b`).test(routeGo)) routes.add(key);
        else unbound.push(key);
      }
    });
  return { routes, unbound };
};

// Turns `/v1/admin/users/${id}/face` into a matcher against `/v1/admin/users/:id/face`.
const toPattern = (p) => p.replace(/\$\{[^}]+\}/g, ':param');
const matches = (callPath, routePath) => {
  const a = callPath.split('/');
  const b = routePath.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === b[i] || (seg === ':param' && b[i].startsWith(':')));
};

const loadAdminCalls = () => {
  const calls = [];
  fs.readdirSync(ADMIN_SRC)
    .filter((f) => f.endsWith('.js'))
    .forEach((file) => {
      const src = fs.readFileSync(path.join(ADMIN_SRC, file), 'utf8');
      const re = /\bapi\.(get|post|put|delete|patch)\(\s*([`'"])([^`'"]+)\2/g;
      let m;
      while ((m = re.exec(src))) {
        calls.push({ file, method: m[1].toUpperCase(), path: toPattern(m[3].split('?')[0]) });
      }
    });
  return calls;
};

describe('lms-admin API modules only call routes registered in lms-api', () => {
  const { routes } = loadBackendRoutes();
  const calls = loadAdminCalls();

  it('finds the backend routes and the admin calls', () => {
    expect(routes.size).toBeGreaterThan(100);
    expect(calls.length).toBeGreaterThan(40);
  });

  it('every call matches a bound backend route', () => {
    const routeList = [...routes].map((r) => {
      const [method, p] = r.split(' ');
      return { method, path: p };
    });
    const missing = calls.filter(
      (c) => !routeList.some((r) => r.method === c.method && matches(c.path, r.path))
    );
    expect(missing).toEqual([]);
  });

  // Regressions from QA_REPORT 5.3: these paths were called but never registered.
  it.each([
    ['PUT', '/v1/admin/teacher-applications/:param'],
    ['GET', '/v1/admin/courses/:param'],
    ['PUT', '/v1/admin/reviews/:param'],
    ['PUT', '/v1/admin/proctoring/submissions/:param'],
    ['GET', '/v1/admin/proctoring/violations'],
  ])('no longer calls %s %s', (method, p) => {
    expect(calls.filter((c) => c.method === method && c.path === p)).toEqual([]);
  });

  it('does not call DELETE /v1/student/face (it deletes the caller, i.e. the admin)', () => {
    expect(calls.filter((c) => c.path === '/v1/student/face')).toEqual([]);
  });
});
