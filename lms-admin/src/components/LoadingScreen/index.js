import React from 'react';
import { Spin } from 'antd';

export function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f6f9',
        gap: 12,
      }}
    >
      <Spin size="large" />
      <span style={{ color: '#0A3150', fontWeight: 500 }}>
        Đang khởi tạo LMS Vision Admin Dashboard...
      </span>
    </div>
  );
}

export default LoadingScreen;
