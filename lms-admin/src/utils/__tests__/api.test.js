import { message } from 'antd';
import api, { showApiError } from '../api';

jest.mock('antd', () => ({
  message: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

// Drive the real axios instance and interceptors with a fake adapter that answers with an HTTP status.
const respondWith = (status, body) => {
  api.defaults.adapter = (config) => {
    const response = { status, statusText: String(status), data: body, headers: {}, config };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    const err = new Error(`Request failed with status code ${status}`);
    err.config = config;
    err.response = response;
    err.isAxiosError = true;
    return Promise.reject(err);
  };
};
const failNetwork = () => {
  api.defaults.adapter = (config) => {
    const err = new Error('Network Error');
    err.config = config;
    err.isAxiosError = true;
    return Promise.reject(err);
  };
};

// What a page does: call the API, report failures with showApiError.
const pageLoad = async (config) => {
  try {
    await api.get('/v1/admin/proctoring-violations', config);
  } catch (error) {
    showApiError(error, 'Không tải được dữ liệu');
    return error;
  }
  return null;
};

describe('one toast per failed request (review v2 Low: double toast)', () => {
  const originalLocation = window.location;
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.location;
    window.location = { pathname: '/app/proctoring', href: '/app/proctoring' };
  });
  afterAll(() => {
    window.location = originalLocation;
  });

  it('500: interceptor toasts once, the page handler stays silent', async () => {
    respondWith(500, { code: 50021, message: 'pq: relation does not exist' });
    const err = await pageLoad();
    expect(err.toastShown).toBe(true);
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('Internal server error');
  });

  it('401: one toast and a redirect to /login', async () => {
    respondWith(401, { code: 40101, message: 'Phiên đăng nhập hết hạn' });
    await pageLoad();
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('Phiên đăng nhập hết hạn');
    expect(window.location.href).toBe('/login');
  });

  it('400 validation error: only the page toasts, with the backend message', async () => {
    respondWith(400, { code: 40001, message: 'thetaOff must be < thetaOn' });
    const err = await pageLoad();
    expect(err.status).toBe(400);
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('thetaOff must be < thetaOn');
  });

  it('skipErrorToast: the interceptor leaves the 500 to the caller (still exactly one toast)', async () => {
    respondWith(500, { code: 50021, message: 'db' });
    const err = await pageLoad({ skipErrorToast: true });
    expect(err.toastShown).toBeUndefined();
    expect(message.error).toHaveBeenCalledTimes(1);
  });

  it('401 on the login page: no interceptor toast, no redirect', async () => {
    window.location = { pathname: '/login', href: '/login' };
    respondWith(401, { code: 40108, message: 'INVALID_CREDENTIALS' });
    await expect(api.post('/v1/auth/login', {}, { skipErrorToast: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(message.error).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('network error: rejects with the raw error (no HTTP status) and no interceptor toast', async () => {
    failNetwork();
    await expect(api.get('/v1/admin/stats')).rejects.toThrow('Network Error');
    expect(message.error).not.toHaveBeenCalled();
  });
});
