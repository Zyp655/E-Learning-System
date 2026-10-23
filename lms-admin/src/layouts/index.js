import React, { useState } from 'react';
import { Layout, Grid } from 'antd';
import { Link, withRouter } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppDrawer from './AppDrawer';
import AppFooter from './AppFooter';

const { Content, Sider } = Layout;

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = Grid.useBreakpoint();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {screens.lg ? (
        <Sider
          width={250}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            backgroundColor: '#0A3150',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="admin-sider-logo">
            <Link to="/app/home" style={{ textDecoration: 'none' }}>
              {collapsed ? (
                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 18 }}>
                  LMS
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      background: '#da1f27',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    AI
                  </div>
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                      LMS VISION ADMIN
                    </div>
                    <div style={{ color: '#93c5fd', fontSize: 11, lineHeight: 1.2 }}>
                      Computer Vision &amp; AI Tutor
                    </div>
                  </div>
                </div>
              )}
            </Link>
          </div>
          <AppSidebar />
        </Sider>
      ) : (
        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}

      <Layout className="site-layout">
        <AppHeader
          showMobileMenu={!screens.lg}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <Content style={{ margin: '16px 20px', overflow: 'auto' }}>
          <div className="site-layout-background" style={{ minHeight: 540 }}>
            {children}
          </div>
        </Content>
        <AppFooter />
      </Layout>
    </Layout>
  );
};

export default withRouter(AppLayout);
