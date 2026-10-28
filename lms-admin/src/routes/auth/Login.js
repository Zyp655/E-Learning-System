import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { login, isDemoModeEnabled } from '../../redux/actions/AuthActions';

const { Title, Text } = Typography;

// Created by lms-api internal/storage/postgres/seed.go only when APP_ENV is dev/test.
const DEV_SEED_ADMIN = { email: 'admin@lms.edu.vn', password: '123456' };
const showDevAccount = process.env.NODE_ENV === 'development';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const dispatch = useDispatch();
  const history = useHistory();

  const handleFinish = async (values) => {
    setLoading(true);
    setLoginError(null);
    try {
      await dispatch(login(values));
      history.push('/app/home');
    } catch (err) {
      // Single place that reports a failed login (the request is sent with skipErrorToast).
      setLoginError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #07243b 0%, #0A3150 60%, #124873 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: 430,
          maxWidth: '100%',
          borderRadius: 2,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 4,
              background: '#0A3150',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 20,
              marginBottom: 12,
            }}
          >
            LMS
          </div>
          <Title level={4} style={{ margin: 0, color: '#0A3150' }}>
            LMS Vision &amp; AI Tutor Admin
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Cổng quản trị Hệ thống Học trực tuyến &amp; Phát hiện Bối rối CV
          </Text>
        </div>

        {showDevAccount && (
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined />}
            style={{ marginBottom: 20 }}
            message="Tài khoản quản trị seed (chỉ môi trường development)"
            description={`Email: ${DEV_SEED_ADMIN.email} · Mật khẩu: ${DEV_SEED_ADMIN.password} (lms-api APP_ENV=dev, seed mặc định)`}
          />
        )}

        {isDemoModeEnabled() && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
            message="REACT_APP_DEMO_MODE=true"
            description="Nếu không kết nối được lms-api, trang quản trị sẽ chạy ở chế độ demo ngoại tuyến với dữ liệu mẫu. Sai mật khẩu vẫn bị từ chối."
          />
        )}

        {loginError && (
          <Alert
            type="error"
            showIcon
            role="alert"
            style={{ marginBottom: 20 }}
            message={loginError}
          />
        )}

        <Form
          layout="vertical"
          initialValues={showDevAccount ? { email: DEV_SEED_ADMIN.email } : undefined}
          onFinish={handleFinish}
        >
          <Form.Item
            label="Email Quản trị viên"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Định dạng email không hợp lệ' },
            ]}
          >
            <Input
              size="large"
              prefix={<MailOutlined />}
              placeholder="admin@lms.edu.vn"
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="••••••••"
            />
          </Form.Item>

          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              Đăng nhập Quản trị (Scope: admin-dashboard)
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
