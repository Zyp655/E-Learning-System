import React from 'react';
import { Drawer } from 'antd';
import AppSidebar from './AppSidebar';

function AppDrawer({ visible, onClose }) {
  return (
    <Drawer
      title={
        <span style={{ color: '#ffffff', fontWeight: 600 }}>
          LMS Vision Admin
        </span>
      }
      placement="left"
      closable
      onClose={onClose}
      open={visible}
      width={250}
      styles={{
        header: { backgroundColor: '#07243b', borderBottom: '1px solid rgba(255,255,255,0.1)' },
        body: { padding: 0, backgroundColor: '#0A3150' },
      }}
    >
      <AppSidebar onNavigate={onClose} />
    </Drawer>
  );
}

export default AppDrawer;
