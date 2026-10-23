import axios from 'axios';
import { message } from 'antd';
import { getCookie, removeCookie } from './cookie';
import appConfig from '../config';

const api = axios.create({
  baseURL: `${appConfig.API_URL}`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
    Scope: 'admin-dashboard',
  },
});

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
    if (error && error.response && error.response.status === 401) {
      removeCookie('token');
      const errMsg =
        error.response?.data?.message ||
        'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại!';

      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/resetpassword' &&
        window.location.pathname !== '/signup'
      ) {
        message.error(errMsg);
        window.location.href = '/login';
      }
    }
    if (error && error.response && error.response.status === 500) {
      message.error('Internal server error');
    }

    return Promise.reject(error.response || error);
  }
);

export default api;
