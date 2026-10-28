import api from '../../../utils/api';
import { setCookie, removeCookie, getCookie } from '../../../utils/cookie';
import { message } from 'antd';
import { login, getAuthUser, DEMO_TOKEN } from '../AuthActions';
import { LOGIN, LOGOUT, GET_AUTH_USER } from '../../types';
import authReducer from '../../reducers/AuthReducer';

jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('../../../utils/cookie', () => ({
  setCookie: jest.fn(),
  removeCookie: jest.fn(),
  getCookie: jest.fn(),
}));
jest.mock('antd', () => ({
  message: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

// Rejections as produced by utils/api: the axios response when lms-api answered, the raw error otherwise.
const httpError = (status, msg) => ({ status, data: { code: status * 100 + 8, message: msg } });
const networkError = () => new Error('Network Error');

// lms-api POST /v1/auth/login -> { code, message, data: AuthTokenBundle }.
const loginResponse = (user) => ({
  data: {
    code: 0,
    message: 'OK',
    data: {
      accessToken: 'real.jwt.token',
      refreshToken: 'refresh.jwt',
      sessionToken: 'uuid',
      expiresIn: 86400,
      user,
    },
  },
});
const adminUser = { id: 1, email: 'admin@lms.edu.vn', fullName: 'Quản trị viên', role: 'admin' };

describe('admin login (QA 5.3 High: fake Demo-mode session)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.REACT_APP_DEMO_MODE;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('wrong password: rejects with the backend message, no cookie, no LOGIN', async () => {
    api.post.mockRejectedValue(httpError(401, 'Email hoặc mật khẩu không chính xác'));
    const dispatch = jest.fn();
    await expect(login({ email: 'admin@lms.edu.vn', password: 'wrong' })(dispatch)).rejects.toThrow(
      'Email hoặc mật khẩu không chính xác'
    );
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: LOGIN }));
    expect(message.success).not.toHaveBeenCalled();
  });

  it('wrong password is rejected even when demo mode is enabled', async () => {
    process.env.REACT_APP_DEMO_MODE = 'true';
    api.post.mockRejectedValue(httpError(401, 'Email hoặc mật khẩu không chính xác'));
    const dispatch = jest.fn();
    await expect(login({ email: 'a@b.c', password: 'x' })(dispatch)).rejects.toThrow();
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('network error without demo mode: rejects, no session', async () => {
    api.post.mockRejectedValue(networkError());
    const dispatch = jest.fn();
    await expect(login({ email: 'a@b.c', password: 'x' })(dispatch)).rejects.toThrow(
      'Không kết nối được máy chủ lms-api'
    );
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('network error with REACT_APP_DEMO_MODE=true: clearly labelled offline demo session', async () => {
    process.env.REACT_APP_DEMO_MODE = 'true';
    api.post.mockRejectedValue(networkError());
    const dispatch = jest.fn();
    const res = await login({ email: 'a@b.c', password: 'x' })(dispatch);
    expect(res.demo).toBe(true);
    expect(setCookie).toHaveBeenCalledWith('token', DEMO_TOKEN, 1);
    expect(dispatch.mock.calls[0][0].payload.user.isDemo).toBe(true);
    expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('DEMO'));
  });

  it('success: stores the real accessToken from AuthTokenBundle and sends the admin scope', async () => {
    api.post.mockResolvedValue(loginResponse(adminUser));
    const dispatch = jest.fn();
    const res = await login({ email: 'admin@lms.edu.vn', password: '123456' })(dispatch);
    expect(api.post).toHaveBeenCalledWith(
      '/v1/auth/login',
      { email: 'admin@lms.edu.vn', password: '123456', scope: 'admin-dashboard' },
      { skipErrorToast: true }
    );
    expect(res.token).toBe('real.jwt.token');
    expect(setCookie).toHaveBeenCalledWith('token', 'real.jwt.token', 7);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe(LOGIN);
    expect(action.payload.token).toBe('real.jwt.token');
    expect(action.payload.user).toMatchObject({ id: 1, email: 'admin@lms.edu.vn', role: 'admin' });
  });

  it('response without accessToken is rejected (no placeholder token)', async () => {
    api.post.mockResolvedValue({ data: { code: 0, data: { user: adminUser } } });
    const dispatch = jest.fn();
    await expect(login({ email: 'a', password: 'b' })(dispatch)).rejects.toThrow('accessToken');
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['student', 'teacher'])('non-admin role %s is rejected', async (role) => {
    api.post.mockResolvedValue(loginResponse({ ...adminUser, role }));
    const dispatch = jest.fn();
    await expect(login({ email: 'a', password: 'b' })(dispatch)).rejects.toThrow('quyền quản trị');
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('getAuthUser (no invented session)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REACT_APP_DEMO_MODE;
  });

  it('without a token: LOGOUT, no profile request, no cookie created', async () => {
    getCookie.mockReturnValue(undefined);
    const dispatch = jest.fn();
    await expect(getAuthUser()(dispatch)).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: LOGOUT });
  });

  it('401 on profile: clears the session and dispatches LOGOUT instead of a fallback admin', async () => {
    getCookie.mockReturnValue('expired.jwt');
    api.get.mockRejectedValue(httpError(401, 'TOKEN_EXPIRED'));
    const dispatch = jest.fn();
    await expect(getAuthUser()(dispatch)).resolves.toBeNull();
    expect(removeCookie).toHaveBeenCalledWith('token');
    expect(setCookie).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: LOGOUT });
  });

  it('valid admin token: uses GetProfileRes.user', async () => {
    getCookie.mockReturnValue('real.jwt.token');
    api.get.mockResolvedValue({ data: { code: 0, data: { user: adminUser, hasFaceRegistered: false } } });
    const dispatch = jest.fn();
    const user = await getAuthUser()(dispatch);
    expect(user).toMatchObject({ id: 1, role: 'admin', full_name: 'Quản trị viên' });
    expect(dispatch).toHaveBeenCalledWith({ type: GET_AUTH_USER, payload: user });
  });

  it('token of a non-admin user: LOGOUT', async () => {
    getCookie.mockReturnValue('student.jwt');
    api.get.mockResolvedValue({ data: { code: 0, data: { user: { ...adminUser, role: 'student' } } } });
    const dispatch = jest.fn();
    await expect(getAuthUser()(dispatch)).resolves.toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: LOGOUT });
  });

  it('demo token is ignored when demo mode is off', async () => {
    getCookie.mockReturnValue(DEMO_TOKEN);
    const dispatch = jest.fn();
    await expect(getAuthUser()(dispatch)).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: LOGOUT });
  });
});

describe('AuthReducer', () => {
  it('starts without an authenticated admin', () => {
    expect(authReducer(undefined, { type: '@@INIT' })).toEqual({ authUser: null, token: null });
  });

  it('LOGIN without a token does not invent one', () => {
    const s = authReducer(undefined, { type: LOGIN, payload: { user: adminUser } });
    expect(s.token).toBeNull();
  });
});
