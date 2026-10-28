import { ApiError, apiFetch, clearAuthTokens, setAuthTokens } from './client';

/** entity.User as returned by lms-api (only the fields lms-web uses). */
export interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  role: string; // student | teacher | admin
  status?: string;
  studentCode?: string;
  major?: string;
  academicYear?: number;
}

/** service.AuthTokenBundle returned by POST /v1/auth/login. */
export interface AuthTokenBundle {
  accessToken: string;
  refreshToken?: string;
  sessionToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

export type AccountMode = 'student' | 'teacher';

/** lms-web has two workspaces; teacher and admin accounts open Teacher Studio, everyone else the student area. */
export function accountModeForRole(role: string | undefined): AccountMode {
  const r = (role || '').toLowerCase();
  return r === 'teacher' || r === 'admin' || r === 'super' ? 'teacher' : 'student';
}

export const authApi = {
  /** Signs in against lms-api and stores the JWT under lms_access_token. Throws ApiError on failure. */
  login: async (email: string, password: string): Promise<AuthTokenBundle> => {
    clearAuthTokens();
    const bundle = await apiFetch<AuthTokenBundle>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password, scope: 'lms-web' }),
    });
    if (!bundle || !bundle.accessToken || !bundle.user) {
      throw new ApiError({
        status: 200,
        message: 'Máy chủ không trả về mã truy cập hợp lệ.',
        path: '/v1/auth/login',
        method: 'POST',
      });
    }
    setAuthTokens(bundle.accessToken, bundle.refreshToken);
    return bundle;
  },

  /** lms-api has no logout endpoint (JWTs are stateless), so signing out clears the stored tokens. */
  logout: () => clearAuthTokens(),
};
