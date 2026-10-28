import { LOGIN, LOGOUT, GET_AUTH_USER, UPDATE_AUTH_USER } from '../types';

// No user until lms-api has authenticated one (login or GET /v1/user/profile with a valid token).
const INIT_STATE = {
  authUser: null,
  token: null,
};

export default function AuthReducer(state = INIT_STATE, action) {
  switch (action.type) {
    case LOGIN:
      return {
        ...state,
        authUser: action.payload?.user || null,
        token: action.payload?.token || null,
      };
    case GET_AUTH_USER:
      return {
        ...state,
        authUser: action.payload || null,
      };
    case UPDATE_AUTH_USER:
      return {
        ...state,
        authUser: state.authUser ? { ...state.authUser, ...action.payload } : state.authUser,
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
