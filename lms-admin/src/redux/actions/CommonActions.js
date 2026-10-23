import { PUBLISH_ENTITY, UNPUBLISH_ENTITY } from '../types';

export const publish = (payload) => (dispatch) => {
  dispatch({ type: PUBLISH_ENTITY, payload });
  return Promise.resolve(true);
};

export const unpublish = (payload) => (dispatch) => {
  dispatch({ type: UNPUBLISH_ENTITY, payload });
  return Promise.resolve(true);
};
