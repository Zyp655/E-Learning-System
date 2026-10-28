import api from '../../utils/api';
import { isHttpError } from '../../utils/httpError';
import { LOGIN, LOGOUT, GET_AUTH_USER, UPDATE_AUTH_USER } from '../types';
import { setCookie, removeCookie, getCookie } from '../../utils/cookie';
import { message } from 'antd';

// Offline demo mode is opt-in (REACT_APP_DEMO_MODE=true) and only used when lms-api cannot be reached at all
// (no HTTP response). A wrong password, a banned account or any other HTTP error never yields a session.
export const DEMO_TOKEN = 'lms-admin-offline-demo';
export const isDemoModeEnabled = () => process.env.REACT_APP_DEMO_MODE === 'true';

const DEMO_ADMIN = {
  id: 0,
  email: 'demo@offline.local',
  full_name: 'Chế độ Demo ngoại tuyến (không kết nối lms-api)',
  fullName: 'Chế độ Demo ngoại tuyến (không kết nối lms-api)',
  role: 'admin',
  isDemo: true,
};

// lms-api entity.User.role is a string (student | teacher | admin); the admin JWT group also allows "super".
export const isAdminRole = (role) => ['admin', 'super'].includes(String(role ?? '').toLowerCase());

const clearSession = () => {
  removeCookie('token');
  localStorage.removeItem('role');
};

const withDisplayName = (user) => ({ ...user, full_name: user.full_name || user.fullName || user.email });

export class AuthError extends Error {
  constructor(msg, cause) {
    super(msg);
    this.name = 'AuthError';
    this.cause = cause;
  }
}

export const login = (credentials) => async (dispatch) => {
  let res;
  try {
    // The login page shows the error itself, so the interceptor must not toast as well.
    res = await api.post(
      '/v1/auth/login',
      { email: credentials?.email, password: credentials?.password, scope: 'admin-dashboard' },
      { skipErrorToast: true }
    );
  } catch (err) {
    clearSession();
    if (!isHttpError(err) && isDemoModeEnabled()) {
      setCookie('token', DEMO_TOKEN, 1);
      localStorage.setItem('role', 'admin');
      dispatch({ type: LOGIN, payload: { user: DEMO_ADMIN, token: DEMO_TOKEN } });
      message.warning('Không kết nối được lms-api: đang ở CHẾ ĐỘ DEMO ngoại tuyến, dữ liệu là dữ liệu mẫu.');
      return { user: DEMO_ADMIN, token: DEMO_TOKEN, demo: true };
    }
    const reason = isHttpError(err)
      ? err?.data?.message || 'Đăng nhập thất bại'
      : 'Không kết nối được máy chủ lms-api';
    throw new AuthError(reason, err);
  }

  // lms-api LoginRes embeds service.AuthTokenBundle: { accessToken, refreshToken, sessionToken, expiresIn, user }.
  const bundle = res?.data?.data || {};
  const token = bundle.accessToken;
  const user = bundle.user;
  if (!token || typeof token !== 'string' || !user) {
    clearSession();
    throw new AuthError('Phản hồi đăng nhập từ lms-api không hợp lệ (thiếu accessToken)');
  }
  if (!isAdminRole(user.role)) {
    clearSession();
    throw new AuthError('Tài khoản này không có quyền quản trị (role admin)');
  }

  const authUser = withDisplayName(user);
  setCookie('token', token, 7);
  localStorage.setItem('role', 'admin');
  dispatch({ type: LOGIN, payload: { user: authUser, token } });
  message.success('Đăng nhập quản trị thành công!');
  return { user: authUser, token };
};

export const getAuthUser = () => async (dispatch) => {
  const token = getCookie('token');
  if (!token) {
    dispatch({ type: LOGOUT });
    return null;
  }
  if (token === DEMO_TOKEN) {
    if (isDemoModeEnabled()) {
      dispatch({ type: GET_AUTH_USER, payload: DEMO_ADMIN });
      return DEMO_ADMIN;
    }
    clearSession();
    dispatch({ type: LOGOUT });
    return null;
  }

  try {
    const res = await api.get('/v1/user/profile', { skipErrorToast: true });
    // lms-api GetProfileRes: { user, studentProfile, streak, hasFaceRegistered }.
    const user = res?.data?.data?.user;
    if (!user || !isAdminRole(user.role)) {
      clearSession();
      dispatch({ type: LOGOUT });
      return null;
    }
    const authUser = withDisplayName(user);
    dispatch({ type: GET_AUTH_USER, payload: authUser });
    return authUser;
  } catch (err) {
    // HTTP errors (401 expired token, 403 wrong scope, 404 deleted user) invalidate the session; the
    // interceptor already removed the cookie on 401. A network error keeps the cookie so a reload can retry,
    // but the user is still not authenticated, so AppRoutes redirects to /login.
    if (isHttpError(err)) clearSession();
    dispatch({ type: LOGOUT });
    return null;
  }
};

export const updateAuthUser = (data) => async (dispatch) => {
  dispatch({ type: UPDATE_AUTH_USER, payload: data });
  message.success('Đã cập nhật thông tin quản trị viên');
  return true;
};

export const logout = () => (dispatch) => {
  clearSession();
  localStorage.removeItem('menu_paths');
  dispatch({ type: LOGOUT });
  return Promise.resolve(true);
};
