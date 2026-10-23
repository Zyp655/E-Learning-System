const appConfig = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  WEB_URL: process.env.REACT_APP_WEB_URL || 'http://localhost:3000',
  APP_NAME: 'LMS Vision Admin',
  DEFAULT_SCOPE: 'admin-dashboard',
};

export default appConfig;
