import React from 'react';
import {
  DashboardOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  BankOutlined,
  ReadOutlined,
  CloudUploadOutlined,
  VideoCameraOutlined,
  RobotOutlined,
} from '@ant-design/icons';

const menu = [
  {
    key: '/app/home',
    icon: <DashboardOutlined />,
    label: 'Tổng quan Hệ thống',
  },
  {
    key: '/app/users',
    icon: <TeamOutlined />,
    label: 'Người dùng & Sinh trắc',
  },
  {
    key: '/app/proctoring',
    icon: <SafetyCertificateOutlined />,
    label: 'Giám sát Vi phạm & Đạo văn',
  },
  {
    key: '/app/teacher-applications',
    icon: <AuditOutlined />,
    label: 'Duyệt Hồ sơ Giảng viên',
  },
  {
    key: '/app/departments',
    icon: <BankOutlined />,
    label: 'Khoa · Ngành · Học kỳ',
  },
  {
    key: '/app/academic-courses',
    icon: <ReadOutlined />,
    label: 'Học phần & Lớp học phần',
  },
  {
    key: '/app/bulk-imports',
    icon: <CloudUploadOutlined />,
    label: 'Import Excel Hàng loạt',
  },
  {
    key: '/app/courses',
    icon: <VideoCameraOutlined />,
    label: 'Khóa học & Giáo trình',
  },
  {
    key: '/app/ai-settings',
    icon: <RobotOutlined />,
    label: 'Cấu hình AI & Confusion CV',
  },
];

export function getFilteredMenu() {
  return menu;
}

export default menu;
