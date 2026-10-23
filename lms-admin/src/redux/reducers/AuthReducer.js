import { LOGIN, LOGOUT, GET_AUTH_USER, UPDATE_AUTH_USER } from '../types';

const DEFAULT_ADMIN_USER = {
  id: 1,
  email: 'admin@lms-university.edu.vn',
  full_name: 'TS. Nguyễn Quản Trị (System Admin)',
  role: 'admin',
  role_code: 2,
  department_name: 'Phòng Đào tạo & Công nghệ AI',
};

const INIT_STATE = {
  authUser: DEFAULT_ADMIN_USER,
  token: null,
};

export default function AuthReducer(state = INIT_STATE, action) {
  switch (action.type) {
    case LOGIN:
      return {
        ...state,
        authUser: action.payload?.user || action.payload || DEFAULT_ADMIN_USER,
        token: action.payload?.token?.accessToken || action.payload?.token || 'demo-admin-jwt',
      };
    case GET_AUTH_USER:
      return {
        ...state,
        authUser: action.payload || state.authUser || DEFAULT_ADMIN_USER,
      };
    case UPDATE_AUTH_USER:
      return {
        ...state,
        authUser: { ...state.authUser, ...action.payload },
      };
    case LOGOUT:
      return {
        ...state,
        authUser: null,
        token: null,
      };
    default:
      return state;
  }
}
