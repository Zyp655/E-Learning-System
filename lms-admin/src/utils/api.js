import axios from 'axios';
import { message } from 'antd';
import { getCookie, removeCookie } from './cookie';
import appConfig from '../config';
import { isHttpError } from './httpError';

export { isHttpError };

const api = axios.create({
  baseURL: `${appConfig.API_URL}`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
    Scope: 'admin-dashboard',
  },
});

const AUTH_PAGES = ['/login', '/resetpassword', '/signup'];

// Toast policy (one toast per failed request):
// - The response interceptor toasts 401 (session expired, then redirects to /login) and 5xx, and marks the
//   rejected value with `toastShown: true`.
// - Callers that want to show their own message pass `{ skipErrorToast: true }` in the request config.
// - Page handlers report errors with showApiError(), which stays silent when the interceptor already toasted.
export const showApiError = (error, fallbackMessage) => {
  if (error?.toastShown) return null;
  const text = error?.data?.message || error?.response?.data?.message || fallbackMessage;
  if (text) message.error(text);
  return text;
};

api.interceptors.request.use(
  function (config) {
    const accessToken = getCookie('token');
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = 'Bearer ' + accessToken;
      if (config.headers.common) {
        config.headers.common['Authorization'] = 'Bearer ' + accessToken;
      }
    }
    config.headers['Scope'] = 'admin-dashboard';
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const rejected = (error && error.response) || error;
    const status = error?.response?.status;
    const skipToast = Boolean(error?.config?.skipErrorToast);
    const onAuthPage = AUTH_PAGES.includes(window.location.pathname);

    if (status === 401) {
      removeCookie('token');
      if (!onAuthPage) {
        if (!skipToast) {
          message.error(
            error.response?.data?.message || 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại!'
          );
          if (rejected && typeof rejected === 'object') rejected.toastShown = true;
        }
        window.location.href = '/login';
      }
    } else if (typeof status === 'number' && status >= 500 && !skipToast) {
      // Generic text on purpose: 5xx messages can carry internal details (SQL errors, stack hints).
      message.error('Internal server error');
      if (rejected && typeof rejected === 'object') rejected.toastShown = true;
    }

    return Promise.reject(rejected);
  }
);

export default api;
