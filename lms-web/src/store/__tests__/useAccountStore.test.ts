import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/api/client';
import { installLocalStorage } from '@/api/__tests__/testUtils';
import { useAccountStore } from '../useAccountStore';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Regression (review round 1): useAccountStore.logout existed but no component called it, so a user on a shared
// machine could not sign out (tokens were only cleared by a 401).
describe('sign out', () => {
  it('useAccountStore.logout clears both tokens and returns to the student workspace', () => {
    const store = installLocalStorage({ [ACCESS_TOKEN_KEY]: 'a', [REFRESH_TOKEN_KEY]: 'b' });
    useAccountStore.getState().setMode('teacher');
    useAccountStore.getState().logout();
    expect(store.size).toBe(0);
    expect(useAccountStore.getState().mode).toBe('student');
    expect(useAccountStore.getState().role).toBe('student');
  });

  it('the account menu (AppHeader) wires a sign-out action to logout and the login page', () => {
    // No DOM in this vitest setup (environment: node), so the wiring is checked on the component source.
    const src = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(HOME_CATEGORY)/_shell/AppHeader.tsx'),
      'utf8',
    );
    expect(src).toMatch(/const \{[^}]*\blogout\b[^}]*\} = useAccountStore\(\)/);
    const handler = src.match(/const handleSignOut = \(\) => \{([\s\S]*?)\n {2}\};/);
    expect(handler).not.toBeNull();
    expect(handler![1]).toContain('logout();');
    expect(handler![1]).toContain("withLocale('/login', locale)");
    expect(src).toContain('onClick={handleSignOut}');
    expect(src).toContain('Đăng xuất');
  });
});
