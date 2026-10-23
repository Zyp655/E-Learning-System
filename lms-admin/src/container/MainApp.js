import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { withRouter, Redirect, Switch, Route } from 'react-router-dom';
import Login from '../routes/auth/Login';
import { getAuthUser } from '../redux/actions/AuthActions';
import { LoadingScreen } from '../components/LoadingScreen';
import AppRoutes from './AppRoutes';

function MainApp(props) {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const isMount = useRef(false);

  useEffect(() => {
    isMount.current = true;
    dispatch(getAuthUser())
      .then(() => {
        if (isMount.current) setLoading(false);
      })
      .catch(() => {
        if (isMount.current) setLoading(false);
      });

    return () => {
      isMount.current = false;
    };
  }, [dispatch]);

  if (loading) {
    return <LoadingScreen />;
  }

  const { location, match } = props;

  if (location.pathname === '/' || location.pathname === '/app') {
    return <Redirect to="/app/home" />;
  }

  return (
    <Switch>
      <Route exact path="/login" component={Login} />
      <Route path={`${match.url}app`} component={AppRoutes} />
      <Redirect to="/app/home" />
    </Switch>
  );
}

export default withRouter(MainApp);
