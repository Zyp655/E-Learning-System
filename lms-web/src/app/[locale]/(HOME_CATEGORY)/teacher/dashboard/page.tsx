'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  gridLayout,
} from '../../_components/ui';
import { formatSeconds } from '@/lib/utils';
import {
  MOCK_ASSIGNMENTS,
  MOCK_AT_RISK_STUDENTS,
  MOCK_COURSES,
} from '@/api/mockData';

export default function TeacherDashboardPage() {
  const [atRiskList, setAtRiskList] = useState(MOCK_AT_RISK_STUDENTS);
  const allSegments = MOCK_COURSES.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.flatMap((l) => l.segments)),
  );

  const handleSendNudge = (studentId: number) => {
    setAtRiskList(
      atRiskList.map((st) =>
        st.studentId === studentId ? { ...st, lastNudgedAt: 'Vừa gửi nhắc nhở qua AI' } : st,
      ),
    );
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Teacher Studio · Trung tâm Điều hành Giảng dạy & Phân tích Bối rối"
        description="PGS.TS. Trần Quang Minh · Khoa Khoa học Máy tính · Giám sát điểm nóng bối rối trên từng phân đoạn video 5–7 phút và duyệt điểm AI Rubric."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/teacher/analytics" variant="seller" size="sm">
              <Icon name="analytics" size="sm" />
              Bản đồ Điểm nóng Bối rối (Heatmap)
            </ButtonLink>
            <ButtonLink href="/teacher/assignments" variant="outline" size="sm">
              Duyệt điểm AI Rubric
            </ButtonLink>
          </div>
        }
      />

      {/* Teacher KPI Row */}
      <div className={gridLayout.stats}>
        <StatCard
          label="Tổng Sinh viên Theo học"
          value="795 SV"
          hint="Trên 3 học phần chuyên ngành"
          icon="groups"
          tone="seller"
        />
        <StatCard
          label="Tỷ lệ Giải tỏa Bối rối"
          value="91.8%"
          hint="Trợ lý AI RAG xử lý tự động 24/7"
          icon="sparkles"
          tone="chat"
        />
        <StatCard
          label="Điểm nóng Cần Cải thiện Slide"
          value="2 phân đoạn"
          hint="Tỷ lệ bối rối > 30% tại bài BiLSTM"
          icon="warning"
          tone="warning"
        />
        <StatCard
          label="Sinh viên Nguy cơ Cao"
          value={`${atRiskList.length} SV`}
          hint="Hệ thống Cảnh báo Sớm (Early Warning)"
          icon="shield_warning"
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Top Confusion Hotspot Video Segments */}
        <div className="space-y-4 lg:col-span-7">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  Điểm nóng Bối rối theo Phân đoạn Video 5–7 Phút
                </h2>
                <p className="text-xs text-secondary">
                  Tổng hợp từ tín hiệu AU4/AU7, Eye-Lock x1.6 và tần suất dừng/tua lại của toàn lớp.
                </p>
              </div>
              <ButtonLink href="/teacher/analytics" variant="soft-seller" size="xs">
                Phân tích sâu →
              </ButtonLink>
            </div>

            <div className="space-y-3">
              {allSegments.map((seg) => {
                const rate = seg.confusionHotspotRate ?? 28;
                return (
                  <div key={seg.id} className="rounded-xl bg-muted p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-primary">
                        Phân đoạn #{seg.segmentIndex}: {seg.title} (
                        {formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)})
                      </span>
                      <Badge tone={rate >= 35 ? 'danger' : rate >= 25 ? 'warning' : 'success'}>
                        Bối rối: {rate}%
                      </Badge>
                    </div>

                    <ProgressBar
                      value={rate}
                      tone={rate >= 35 ? 'danger' : rate >= 25 ? 'warning' : 'seller'}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                      <span>
                        Lượt tua lại: <strong className="text-primary">{seg.rewindCount ?? 42}</strong> · Lượt dừng
                        lâu: <strong className="text-primary">{seg.pauseCount ?? 31}</strong>
                      </span>
                      {seg.topStudentQuestions?.[0] && (
                        <span className="text-chat font-medium">
                          Câu hỏi phổ biến: &ldquo;{seg.topStudentQuestions[0]}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right 5 cols: Early Warning At-Risk Students & Pending AI Rubric Submissions */}
        <div className="space-y-6 lg:col-span-5">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary">
                Cảnh báo Sớm Sinh viên Nguy cơ (At-Risk)
              </h2>
              <Badge tone="danger">{atRiskList.length} sinh viên</Badge>
            </div>

            <div className="space-y-3">
              {atRiskList.map((st) => (
                <div key={st.studentId} className="rounded-xl bg-muted p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {st.fullName} ({st.studentCode})
                      </p>
                      <p className="text-xs text-secondary">
                        Lớp {st.studentClass} · Tiến độ {st.progressPercent}% · Quiz TB {st.avgQuizScore}%
                      </p>
                    </div>
                    <Badge tone={st.riskLevel === 'high' ? 'danger' : 'warning'}>
                      {st.riskLevel === 'high' ? 'Nguy cơ Cao' : 'Cần chú ý'}
                    </Badge>
                  </div>
                  <p className="text-xs text-secondary">{st.riskReason}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-seller font-medium">
                      {st.lastNudgedAt || `Bối rối chưa giải quyết: ${st.unresolvedConfusionCount} lần`}
                    </span>
                    <Button
                      size="xs"
                      variant="seller"
                      onClick={() => handleSendNudge(st.studentId)}
                    >
                      <Icon name="send" size="xs" />
                      Gửi Nhắc nhở & Gợi ý AI
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary">
                Bài nộp Chờ Duyệt Điểm AI Rubric
              </h2>
              <Badge tone="seller">{MOCK_ASSIGNMENTS.length} bài tập</Badge>
            </div>
            <p className="text-xs text-secondary">
              Hệ thống AI Auto-Grader đã chấm sẵn điểm nháp và độ tin cậy theo từng tiêu chí Rubric.
            </p>
            <ButtonLink href="/teacher/assignments" variant="seller" size="sm" block>
              Mở Trình Duyệt Điểm AI Auto-Grader →
            </ButtonLink>
          </Card>
        </div>
      </div>
    </Container>
  );
}
