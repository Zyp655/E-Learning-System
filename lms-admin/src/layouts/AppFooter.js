import React from 'react';
import { Layout } from 'antd';

const { Footer } = Layout;

export default function AppFooter() {
  return (
    <Footer
      style={{
        textAlign: 'center',
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 24px',
        color: '#6b7280',
        fontSize: 13,
      }}
    >
      LMS Vision &amp; Proactive AI Tutor Admin Dashboard ©2026 — Powered by GoFrame v2 · pgvector · MediaPipe 478 Landmarks &amp; BiLSTM
    </Footer>
  );
}
