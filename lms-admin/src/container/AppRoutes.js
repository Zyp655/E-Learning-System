import React, { Suspense } from 'react';
import { Spin } from 'antd';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from '../layouts';
import { routes } from '../routes';
import NotFoundPage from '../routes/error/NotFoundPage';

function RouteFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <Spin size="large" />
    </div>
  );
}

const AppRoutes = ({ match }) => {
  const authUser = useSelector((state) => state.auth.authUser);

  if (!authUser) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          {routes.map((routeItem) => (
            <Route
              key={routeItem.path}
              exact={routeItem.exact !== false}
              path={`${match.url}/${routeItem.path}`}
              component={routeItem.component}
            />
          ))}
          <Route component={NotFoundPage} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
};

export default withRouter(AppRoutes);
