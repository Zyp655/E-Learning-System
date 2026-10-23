import { GET_CONFIG } from '../types';

const INIT_STATE = {
  systemName: 'LMS Vision & AI Tutor Admin',
  locale: 'vi',
};

export default function ConfigReducer(state = INIT_STATE, action) {
  switch (action.type) {
    case GET_CONFIG:
      return { ...state, ...action.payload };
    default:
      return state;
  }
}
