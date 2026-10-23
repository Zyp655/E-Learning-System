import React from 'react';
import { Layout, Space, Tag, Dropdown, Avatar, Button, Badge, Tooltip } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { logout } from '../redux/actions/AuthActions';

const { Header } = Layout;

export default function AppHeader({ onOpenDrawer, showMobileMenu }) {
  const authUser = useSelector((state) => state.auth.authUser);
  const dispatch = useDispatch();
  const history = useHistory();

  const handleLogout = async () => {
    await dispatch(logout());
    history.push('/login');
  };

  const userMenuItems = [
    {
      key: 'proctoring',
      icon: <SafetyCertificateOutlined />,
      label: 'Giám sát Sinh trắc & Đạo văn',
      onClick: () => history.push('/app/proctoring'),
    },
    {
      key: 'ai-settings',
      icon: <SettingOutlined />,
      label: 'Cấu hình Ngưỡng AI & pgvector',
      onClick: () => history.push('/app/ai-settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ];

  return (
    <Header
      style={{
        background: '#ffffff',
        padding: '0 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Space size={12} align="center">
        {showMobileMenu && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onOpenDrawer}
          />
        )}
        <span style={{ fontWeight: 600, fontSize: 16, color: '#0A3150' }}>
          Hệ thống Quản trị Đào tạo &amp; AI Phát hiện Bối rối Đa phương thức
        </span>
        <Tag color="blue" icon={<RobotOutlined />}>
          Scope: admin-dashboard
        </Tag>
      </Space>

      <Space size={16} align="center">
        <Tooltip title="Trạng thái Mô hình MLP 10-Features & pgvector RAG">
          <Badge status="processing" text="AI Engine & pgvector Ready" />
        </Tooltip>

        <Tag
          color="green"
          icon={<SafetyCertificateOutlined />}
          style={{ cursor: 'pointer' }}
          onClick={() => history.push('/app/proctoring')}
        >
          FaceGuard 192-d Active
        </Tag>

        <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              style={{ backgroundColor: '#0A3150' }}
              icon={<UserOutlined />}
            />
            <span style={{ fontWeight: 500, color: '#111827' }}>
              {authUser?.full_name || authUser?.fullName || 'System Admin'}
            </span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
