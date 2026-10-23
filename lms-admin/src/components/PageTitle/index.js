import React from 'react';
import { Breadcrumb, Space, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { withRouter, Link } from 'react-router-dom';

const { Title, Text } = Typography;

function PageTitle({ title, subtitle, routes = [], extra, showBack = false, history }) {
  return (
    <div className="site-page-header">
      {routes.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={routes.map((r, idx) => ({
            key: idx,
            title:
              idx === routes.length - 1 || !r.path ? (
                <span>{r.breadcrumbName}</span>
              ) : (
                <Link to={r.path}>{r.breadcrumbName}</Link>
              ),
          }))}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space align="center" size={12}>
          {showBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => history.goBack()}
            />
          )}
          <div>
            <Title level={4} style={{ margin: 0, color: '#0A3150' }}>
              {title}
            </Title>
            {subtitle && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {subtitle}
              </Text>
            )}
          </div>
        </Space>
        {extra && <Space wrap>{extra}</Space>}
      </div>
    </div>
  );
}

export default withRouter(PageTitle);
