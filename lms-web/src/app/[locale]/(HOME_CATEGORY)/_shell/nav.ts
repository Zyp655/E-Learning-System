import { stripLocale } from './chrome';

export interface NavItem {
  key: string;
  label: string;
  labelEn: string;
  path: string;
  icon: string;
  badge?: string;
  dot?: 'red' | 'green' | 'amber';
}

export const STUDENT_NAV_ITEMS: NavItem[] = [
  {
    key: 'discover',
    label: 'Khám phá Học phần',
    labelEn: 'Explore Catalog',
    path: '/',
    icon: 'home',
  },
  {
    key: 'student-dashboard',
    label: 'Tổng quan Học tập',
    labelEn: 'Student Dashboard',
    path: '/student/dashboard',
    icon: 'dashboard',
  },
  {
    key: 'smart-player',
    label: 'Học bài Thông minh (AI CV)',
    labelEn: 'Smart Learning Player',
    path: '/learn/101',
    icon: 'videocam',
    badge: 'Live AI',
  },
  {
    key: 'my-courses',
    label: 'Khóa học & Lớp học phần',
    labelEn: 'My Courses & Classes',
    path: '/student/my-courses',
    icon: 'menu_book',
  },
  {
    key: 'schedule',
    label: 'Thời khóa biểu & Điểm danh AI',
    labelEn: 'Schedule & AI Attendance',
    path: '/student/schedule',
    icon: 'event',
    dot: 'green',
  },
  {
    key: 'tasks',
    label: 'Bài tập & Quản lý Task',
    labelEn: 'Assignments & Tasks',
    path: '/student/tasks',
    icon: 'assignment',
    badge: '2',
  },
  {
    key: 'quizzes',
    label: 'Thi Thích ứng & Đấu trường Quiz',
    labelEn: 'Adaptive & Multiplayer Quiz',
    path: '/student/quizzes',
    icon: 'quiz',
  },
  {
    key: 'roadmap',
    label: 'Lộ trình DAG & Học kỳ',
    labelEn: 'DAG Roadmap & Study Plan',
    path: '/student/roadmap',
    icon: 'map',
  },
  {
    key: 'analytics',
    label: 'Phân tích Cá nhân & Heatmap',
    labelEn: 'Personal Analytics',
    path: '/student/analytics',
    icon: 'analytics',
  },
  {
    key: 'achievements',
    label: 'Thành tích & Bảng điểm',
    labelEn: 'Achievements & Transcript',
    path: '/student/achievements',
    icon: 'trophy',
  },
  {
    key: 'face-setup',
    label: 'Sinh trắc học Khuôn mặt (3 góc)',
    labelEn: '3-Pose Biometric Face ID',
    path: '/student/face-setup',
    icon: 'face_id',
  },
  {
    key: 'ai-assistant',
    label: 'Trợ lý Ảo AI Toàn màn hình',
    labelEn: 'AI Tutor Studio',
    path: '/ai-assistant',
    icon: 'sparkles',
  },
  {
    key: 'messages',
    label: 'Tin nhắn Giảng viên (1-1)',
    labelEn: 'Direct Messages',
    path: '/messages',
    icon: 'chat',
  },
];

export const TEACHER_NAV_ITEMS: NavItem[] = [
  {
    key: 'teacher-dashboard',
    label: 'Tổng quan Lớp & SV Nguy cơ',
    labelEn: 'Studio Overview & At-Risk',
    path: '/teacher/dashboard',
    icon: 'dashboard',
    badge: '3 At-Risk',
  },
  {
    key: 'teacher-analytics',
    label: 'Heatmap Bối rối & Báo cáo AI',
    labelEn: 'Confusion Heatmap & AI Report',
    path: '/teacher/analytics',
    icon: 'analytics',
    dot: 'red',
  },
  {
    key: 'teacher-courses',
    label: 'Quản lý Khóa học & AI Builder',
    labelEn: 'Course Studio & Whisper RAG',
    path: '/teacher/courses',
    icon: 'menu_book',
  },
  {
    key: 'teacher-classes',
    label: 'Lớp học phần & Điểm danh AI',
    labelEn: 'Classes, Excel Import & Attendance',
    path: '/teacher/classes',
    icon: 'groups',
  },
  {
    key: 'teacher-assignments',
    label: 'Bài tập & Chấm điểm AI Rubric',
    labelEn: 'Assignments & AI Rubric Grading',
    path: '/teacher/assignments',
    icon: 'approval_delegation',
    badge: 'AI Grade',
  },
  {
    key: 'teacher-quizzes',
    label: 'Ngân hàng Quiz & Phòng thi',
    labelEn: 'Multi-Source AI Quiz & Rooms',
    path: '/teacher/quizzes',
    icon: 'quiz',
  },
  {
    key: 'teacher-messages',
    label: 'Tin nhắn Sinh viên',
    labelEn: 'Student Messages',
    path: '/messages',
    icon: 'chat',
  },
  {
    key: 'back-catalog',
    label: 'Về Cổng Học phần Chung',
    labelEn: 'Back to Course Catalog',
    path: '/',
    icon: 'home',
  },
];

export function isNavActive(pathname: string, itemPath: string): boolean {
  const clean = stripLocale(pathname);
  if (itemPath === '/') return clean === '/';
  return clean === itemPath || clean.startsWith(`${itemPath}/`);
}
