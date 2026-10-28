'use client';

import { create } from 'zustand';
import { clearAuthTokens } from '@/api/client';
import { MOCK_STUDENT_PROFILE } from '@/api/mockData';
import type { StudentAcademicProfile, UserRole } from '@/api/types';

export interface SmartNotificationItem {
  id: string;
  type: 'morning_summary' | 'reminder_12' | 'reminder_16' | 'urgent_20' | 'teacher_nudge' | 'grade_published';
  title: string;
  message: string;
  time: string;
  read: boolean;
  href?: string;
}

interface AccountState {
  role: UserRole;
  mode: 'student' | 'teacher';
  profile: StudentAcademicProfile;
  faceEmbeddings: {
    front: number[] | null;
    left: number[] | null;
    right: number[] | null;
  };
  notifications: SmartNotificationItem[];
  setMode: (mode: 'student' | 'teacher') => void;
  /** Signs out: clears lms_access_token / lms_refresh_token and returns to the student workspace. */
  logout: () => void;
  setFacePoseEmbedding: (pose: 'front' | 'left' | 'right', vec: number[]) => void;
  resetFaceEmbeddings: () => void;
  setCameraConsent: (granted: boolean) => void;
  updateAcademicProfile: (partial: Partial<StudentAcademicProfile>) => void;
  completeFaceRegistration: () => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<SmartNotificationItem, 'id' | 'read'>) => void;
}

// Generate deterministic L2-normalized 192-d baseline vector for demo owner verification
function createNormalized192(seed: number): number[] {
  const raw = Array.from({ length: 192 }, (_, i) => Math.sin(seed * 17.3 + i * 0.41) * 0.6 + Math.cos(i * 0.19) * 0.4);
  const norm = Math.sqrt(raw.reduce((acc, v) => acc + v * v, 0)) || 1;
  return raw.map((v) => Number((v / norm).toFixed(5)));
}

export const useAccountStore = create<AccountState>((set) => ({
  role: 'student',
  mode: 'student',
  profile: MOCK_STUDENT_PROFILE,
  faceEmbeddings: {
    front: createNormalized192(1),
    left: createNormalized192(2),
    right: createNormalized192(3),
  },
  notifications: [
    {
      id: 'n1',
      type: 'urgent_20',
      title: 'Cảnh báo Điểm danh AI 20:00 (AttendanceEngine)',
      message:
        'Lớp IT4593 (Kiến trúc Backend): Bạn mới đạt 71% thời lượng video và chưa làm Segment Quiz. Vui lòng hoàn thành >= 80% trước 23:59 để được tính Có mặt (Present).',
      time: '15 phút trước',
      read: false,
      href: '/learn/101',
    },
    {
      id: 'n2',
      type: 'grade_published',
      title: 'AI Rubric đã chấm xong Bài tập thực hành số 2',
      message:
        'PGS.TS. Trần Quang Minh đã công bố điểm bài nộp Phiên bản 2 của bạn: 94/100 điểm (Độ tự tin AI: 93%).',
      time: '1 giờ trước',
      read: false,
      href: '/student/tasks',
    },
    {
      id: 'n3',
      type: 'morning_summary',
      title: 'Tóm tắt Lịch học Thông minh 07:00 sáng',
      message:
        'Hôm nay bạn có 1 buổi học trực tuyến môn IT4409 (Học sâu & Thị giác Máy tính) và 1 mục tiêu chuỗi ngày học (Streak ngày thứ 14).',
      time: '07:00 hôm nay',
      read: true,
      href: '/student/schedule',
    },
  ],
  setMode: (mode) => set({ mode, role: mode }),
  logout: () => {
    clearAuthTokens();
    set({ mode: 'student', role: 'student' });
  },
  setFacePoseEmbedding: (pose, vec) =>
    set((state) => {
      const next = { ...state.faceEmbeddings, [pose]: vec };
      const allReady = Boolean(next.front && next.left && next.right);
      return {
        faceEmbeddings: next,
        profile: { ...state.profile, faceRegistered: allReady },
      };
    }),
  resetFaceEmbeddings: () =>
    set((state) => ({
      faceEmbeddings: { front: null, left: null, right: null },
      profile: { ...state.profile, faceRegistered: false },
    })),
  setCameraConsent: (granted) =>
    set((state) => ({
      profile: { ...state.profile, cameraConsentGranted: granted },
    })),
  updateAcademicProfile: (partial) =>
    set((state) => ({
      profile: { ...state.profile, ...partial },
    })),
  completeFaceRegistration: () =>
    set((state) => ({
      faceEmbeddings: {
        front: createNormalized192(1),
        left: createNormalized192(2),
        right: createNormalized192(3),
      },
      profile: { ...state.profile, faceRegistered: true },
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  addNotification: (n) =>
    set((state) => ({
      notifications: [
        { ...n, id: `notif_${Date.now()}`, read: false },
        ...state.notifications,
      ],
    })),
}));

