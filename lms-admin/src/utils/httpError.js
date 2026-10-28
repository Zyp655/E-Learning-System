// utils/api rejects with the axios response when lms-api answered (it has a numeric HTTP status) and with
// the raw axios error when the server was unreachable (network error, timeout, CORS). Kept in its own module
// so API modules can use it even when tests mock utils/api.
export const isHttpError = (error) =>
  typeof (error?.status ?? error?.response?.status) === 'number';
