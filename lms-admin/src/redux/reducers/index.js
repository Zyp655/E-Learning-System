import { combineReducers } from 'redux';
import AuthReducer from './AuthReducer';
import ConfigReducer from './ConfigReducer';

const rootReducer = combineReducers({
  auth: AuthReducer,
  config: ConfigReducer,
});

export default rootReducer;
