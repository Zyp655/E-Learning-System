import React from 'react';
import { useHistory, useLocation, withRouter } from 'react-router-dom';
import { Menu } from 'antd';
import menu from '../menu';

function AppSidebar({ onNavigate }) {
  const history = useHistory();
  const location = useLocation();
  const { pathname } = location;

  const handleClick = ({ key }) => {
    history.push(key);
    if (onNavigate) onNavigate(key);
  };

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[pathname]}
      style={{
        backgroundColor: '#0A3150',
        borderRight: 0,
        paddingTop: 8,
      }}
      onClick={handleClick}
      items={menu}
    />
  );
}

export default withRouter(AppSidebar);
