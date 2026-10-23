'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import {
  Badge,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  segmented,
} from '../../_components/ui';
import { MOCK_DAILY_ATTENDANCE, MOCK_SCHEDULE } from '@/api/mockData';

const DAYS_MAP: Record<number, string> = {
  2: 'Thứ Hai',
  3: 'Thứ Ba',
  4: 'Thứ Tư',
  5: 'Thứ Năm',
  6: 'Thứ Sáu',
  7: 'Thứ Bảy',
};

export default function StudentSchedulePage() {
  const [activeTab, setActiveTab] = useState<'timetable' | 'grades' | 'attendance'>('timetable');
  const [schedules, setSchedules] = useState(MOCK_SCHEDULE);

  const handleMidtermChange = (id: number, val: string) => {
    const num = Number(val);
    if (Number.isNaN(num)) return;
    setSchedules(
      schedules.map((s) => (s.id === id ? { ...s, midtermScore: Math.min(10, Math.max(0, num)) } : s)),
    );
  };

  const handleTargetChange = (id: number, val: string) => {
    const num = Number(val);
    if (Number.isNaN(num)) return;
    setSchedules(
      schedules.map((s) => (s.id === id ? { ...s, targetScore: Math.min(10, Math.max(4, num)) } : s)),
    );
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Thời khóa biểu, Điểm danh AI & Máy tính Điểm Mục tiêu"
        description="Quản lý lịch học tuần (Thứ 2 – Thứ 7), hạn mức vắng mặt tối đa 20% và tính điểm thi cuối kỳ cần đạt theo công thức 0.4 × Giữa kỳ + 0.6 × Cuối kỳ."
      />

      <div className={segmented.list} role="tablist" aria-label="Chế độ xem lịch học">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timetable'}
          onClick={() => setActiveTab('timetable')}
          className={segmented.tab}
        >
          Lịch học Tuần & Hạn mức Vắng
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'grades'}
          onClick={() => setActiveTab('grades')}
          className={segmented.tab}
        >
          Máy tính Điểm Mục tiêu (0.4 GK + 0.6 CK)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'attendance'}
          onClick={() => setActiveTab('attendance')}
          className={segmented.tab}
        >
          Nhật ký Điểm danh AI Tự động
        </button>
      </div>

      {activeTab === 'timetable' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {schedules.map((item) => {
            const absenceRatio = Math.round((item.currentAbsences / Math.max(1, item.maxAbsences)) * 100);
            return (
              <Card key={item.id} padding="md" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="brand">
                    {DAYS_MAP[item.dayOfWeek]} · {item.startTime} – {item.endTime}
                  </Badge>
                  <Badge tone={item.format === 'online' ? 'chat' : 'seller'}>
                    {item.format === 'online' ? 'Trực tuyến (AI CV)' : `Phòng ${item.room}`}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-primary">
                    {item.subjectCode} · {item.subjectName}
                  </h3>
                  <p className="text-xs text-secondary">
                    Lớp {item.classCode} · {item.credits} tín chỉ · GV: {item.instructorName}
                  </p>
                </div>

                <div className="rounded-xl bg-muted p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary">Số buổi vắng mặt / Hạn mức tối đa (20%):</span>
                    <span className="font-semibold text-primary">
                      {item.currentAbsences} / {item.maxAbsences} buổi
                    </span>
                  </div>
                  <ProgressBar
                    value={absenceRatio}
                    tone={absenceRatio >= 66 ? 'danger' : absenceRatio >= 33 ? 'warning' : 'success'}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'grades' && (
        <Card padding="md" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-primary">
              Máy tính Điểm Thi Cuối kỳ Cần đạt (Công thức Chuẩn Học vụ: Tổng kết = 0.4 × GK + 0.6 × CK)
            </h2>
            <p className="text-xs text-secondary">
              Thay đổi Điểm Giữa kỳ hoặc Điểm Mục tiêu để xem ngay điểm thi cuối kỳ tối thiểu bạn cần đạt.
            </p>
          </div>

          <div className="space-y-3">
            {schedules.map((s) => {
              const mid = s.midtermScore ?? 8.0;
              const requiredExam = Number(((s.targetScore - 0.4 * mid) / 0.6).toFixed(2));
              const achievable = requiredExam <= 10;

              return (
                <div key={s.id} className="rounded-xl bg-muted p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-5">
                      <p className="text-sm font-semibold text-primary">
                        {s.subjectCode} · {s.subjectName}
                      </p>
                      <p className="text-xs text-secondary">{s.credits} tín chỉ · GV: {s.instructorName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:col-span-4">
                      <div>
                        <label className="mb-1 block text-xs text-secondary">Điểm Giữa kỳ (40%)</label>
                        <Input
                          compact
                          type="number"
                          step="0.1"
                          value={String(mid)}
                          onChange={(e) => handleMidtermChange(s.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-secondary">Điểm Mục tiêu</label>
                        <Input
                          compact
                          type="number"
                          step="0.1"
                          value={String(s.targetScore)}
                          onChange={(e) => handleTargetChange(s.id, e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-white p-3 text-right md:col-span-3">
                      <span className="block text-xs text-secondary">Điểm Cuối kỳ cần đạt (60%):</span>
                      <span className="text-lg font-semibold text-primary">
                        {Math.max(0, requiredExam)} / 10.0
                      </span>
                      <div className="mt-1">
                        <Badge tone={achievable ? 'success' : 'danger'}>
                          {achievable ? 'Khả thi' : 'Vượt quá 10.0'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'attendance' && (
        <Card padding="md" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-primary">
              Nhật ký Điểm danh Tự động qua Thị giác Máy tính (AttendanceEngine)
            </h2>
            <p className="text-xs text-secondary">
              Hệ thống tự động tổng hợp mỗi đêm lúc 23:59 dựa trên 3 tiêu chí: Thời lượng xem thực tế ≥ 70%, Hoàn thành Quiz phân đoạn và Xác thực khuôn mặt 192 chiều.
            </p>
          </div>
          <div className="space-y-3">
            {MOCK_DAILY_ATTENDANCE.map((att) => (
              <div key={att.scheduleId} className="rounded-xl bg-muted p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {att.date} · {att.subjectName} ({att.classCode})
                  </span>
                  <Badge tone={att.status === 'present' ? 'success' : 'warning'}>
                    {att.status === 'present' ? 'Có mặt (Hợp lệ 100%)' : 'Đang học'}
                  </Badge>
                </div>
                <p className="text-xs text-secondary">
                  Đã xem {att.watchPercentage}% thời lượng · Điểm Quiz: {att.quizScore}% · Khuôn mặt chính chủ:{' '}
                  {att.faceVerified ? 'Đã xác minh' : 'Chưa xác minh'} · Chốt lúc {att.finalizedAt}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Container>
  );
}
