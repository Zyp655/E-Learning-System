export type ShellChrome = 'app' | 'detail';

export function stripLocale(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  if (segs[0] === 'vi' || segs[0] === 'en') {
    const rest = segs.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname || '/';
}

export function chromeFor(pathname: string): ShellChrome {
  const clean = stripLocale(pathname);
  const segs = clean.split('/').filter(Boolean);
  const [first, second] = segs;
  if (first === 'learn' && second) return 'detail';
  if (first === 'courses' && second) return 'detail';
  return 'app';
}

export function isTeacherPath(pathname: string): boolean {
  const clean = stripLocale(pathname);
  return clean === '/teacher' || clean.startsWith('/teacher/');
}
