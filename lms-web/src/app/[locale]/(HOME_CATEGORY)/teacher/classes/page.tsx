'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import {
  Badge,
  Card,
  PageHeader,
  segmented,
} from '../../_components/ui';
import { MOCK_DAILY_ATTENDANCE } from '@/api/mockData';

const BIOMETRIC_VIOLATIONS = [
  {
    id: 1,
    studentName: 'Lê Hoàng Nam',
    studentCode: '20215412',
    classCode: 'CS401-01',
    violationType: 'face_absent_30s',
    timestampLabel: '08:15',
    similarity: 0,
    note: 'Vắng mặt khỏi khung hình liên tiếp 6 chu kỳ (30 giây) — Đã tự động tạm dừng video.',
  },
  {
    id: 2,
    studentName: 'Đặng Quốc Khánh',
    studentCode: '20215465',
    classCode: 'CS401-01',
    violationType: 'identity_mismatch',
    timestampLabel: '11:40',
    similarity: 0.34,
    note: 'Độ tương đồng Cosine MobileFaceNet (34%) < ngưỡng 60% trong 3 chu kỳ (15 giây).',
  },
];

export default function TeacherClassesAndAttendancePage() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'violations'>('attendance');

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Quản lý Lớp Học phần & Bảng Điểm danh Sinh trắc AI"
        description="Giám sát kết quả chốt điểm danh tự động lúc 23:59 (Xem ≥ 70% + Đạt Quiz + Xác thực Khuôn mặt 192-d) và nhật ký cảnh báo gian lận."
      />

      <div className={segmented.list} role="tablist" aria-label="Chọn bảng điểm danh hoặc vi phạm">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'attendance'}
          onClick={() => setActiveTab('attendance')}
          className={segmented.tab}
        >
          Bảng Điểm danh Tự động (AttendanceEngine)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'violations'}
          onClick={() => setActiveTab('violations')}
          className={segmented.tab}
        >
          Nhật ký Cảnh báo Khuôn mặt ({BIOMETRIC_VIOLATIONS.length})
        </button>
      </div>

      {activeTab === 'attendance' && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary">
              Danh sách Điểm danh Tự động Lớp CS401-01 & CS402-02
            </h2>
            <Badge tone="seller" icon="verified_user">
              Tự động chốt lúc 23:59
            </Badge>
          </div>

          <div className="space-y-3">
            {MOCK_DAILY_ATTENDANCE.map((att) => (
              <div
                key={att.scheduleId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="seller">{att.classCode}</Badge>
                    <span className="text-sm font-semibold text-primary">{att.subjectName}</span>
                  </div>
                  <p className="text-xs text-secondary">
                    Sinh viên: Nguyễn Minh Hiếu (2021604123) · Ngày {att.date}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-primary">
                    Xem video: {att.watchPercentage}%
                  </span>
                  <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-primary">
                    Quiz: {att.quizScore}%
                  </span>
                  <Badge tone={att.status === 'present' ? 'success' : 'warning'}>
                    {att.status === 'present' ? 'Có mặt (Hợp lệ)' : 'Đang học'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'violations' && (
        <Card padding="md" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-primary">
              Nhật ký Sự kiện Sinh trắc Học (`face_verification_logs`)
            </h2>
            <p className="text-xs text-secondary">
              Ghi nhận tự động khi sinh viên vắng mặt quá 30 giây (6 lần kiểm tra) hoặc xuất hiện người lạ quá 15 giây (3 lần kiểm tra).
            </p>
          </div>

          <div className="space-y-3">
            {BIOMETRIC_VIOLATIONS.map((v) => (
              <div key={v.id} className="rounded-xl bg-muted p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {v.studentName} ({v.studentCode}) · Lớp {v.classCode}
                  </span>
                  <Badge tone="danger">
                    {v.violationType} tại mốc [{v.timestampLabel}]
                  </Badge>
                </div>
                <p className="text-xs text-secondary">{v.note}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Container>
  );
}
