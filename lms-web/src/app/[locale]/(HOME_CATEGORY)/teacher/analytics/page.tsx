'use client';

import React from 'react';
import { Container } from '../../_components/Container';
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  gridLayout,
} from '../../_components/ui';
import { formatSeconds } from '@/lib/utils';
import { MOCK_COURSES } from '@/api/mockData';

export default function TeacherAnalyticsHeatmapPage() {
  const allSegments = MOCK_COURSES.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.flatMap((l) =>
        l.segments.map((seg) => ({
          ...seg,
          courseCode: c.code,
          lessonTitle: l.title,
        })),
      ),
    ),
  );

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Bản đồ Nhiệt Điểm nóng Bối rối (Confusion Hotspot Heatmap)"
        description="Phân tích chuyên sâu từng phân đoạn bài giảng 5–7 phút dựa trên dữ liệu đa phương thức: AU4/AU7 nhíu mày, Eye-Lock x1.6, lượt dừng/tua lại và câu hỏi gửi tới AI Tutor."
      />

      <div className={gridLayout.stats}>
        <StatCard
          label="Phân đoạn Bối rối Cao nhất"
          value="42%"
          hint="Phân đoạn #3 · Temporal Attention (09:00–13:30)"
          icon="warning"
          tone="danger"
        />
        <StatCard
          label="Tỷ lệ Giải tỏa Qua AI RAG"
          value="91.8%"
          hint="Sinh viên hiểu bài ngay sau 1 lượt giải thích"
          icon="sparkles"
          tone="chat"
        />
        <StatCard
          label="Tổng Lượt Tua lại (Rewind)"
          value="168 lượt"
          hint="Tập trung tại công thức Softmax alpha_t"
          icon="rewind"
          tone="warning"
        />
        <StatCard
          label="Điểm Quiz Phân đoạn TB"
          value="86.4%"
          hint="Tăng 14% sau khi bổ sung ví dụ PyTorch"
          icon="analytics"
          tone="seller"
        />
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-primary">
              Ma trận Điểm nóng Bối rối & Hành vi Xem Video theo Phân đoạn
            </h2>
            <p className="text-xs text-secondary">
              Giúp giảng viên nhận biết chính xác slide hoặc công thức nào đang gây khó khăn cho sinh viên để bổ sung ví dụ minh họa.
            </p>
          </div>
          <Badge tone="seller">Cập nhật thời gian thực</Badge>
        </div>

        <div className="space-y-4">
          {allSegments.map((seg) => {
            const rate = seg.confusionHotspotRate ?? 28;
            return (
              <div key={seg.id} className="rounded-xl bg-muted p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="seller">{seg.courseCode}</Badge>
                      <span className="text-sm font-semibold text-primary">
                        Phân đoạn #{seg.segmentIndex}: {seg.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-secondary">
                      {seg.lessonTitle} · Mốc [{formatSeconds(seg.startTimestamp)} –{' '}
                      {formatSeconds(seg.endTimestamp)}]
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={rate >= 35 ? 'danger' : rate >= 25 ? 'warning' : 'success'}>
                      Chỉ số Bối rối: {rate}%
                    </Badge>
                    <ButtonLink href={`/learn/${seg.lessonId}`} variant="outline" size="xs">
                      Kiểm tra Slide
                    </ButtonLink>
                  </div>
                </div>

                <ProgressBar
                  value={rate}
                  tone={rate >= 35 ? 'danger' : rate >= 25 ? 'warning' : 'seller'}
                />

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-2.5">
                    <span className="block text-tertiary">Lượt tua lại (Rewind)</span>
                    <span className="font-semibold text-primary">{seg.rewindCount ?? 45} lượt</span>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <span className="block text-tertiary">Lượt dừng lâu (&gt;10s)</span>
                    <span className="font-semibold text-primary">{seg.pauseCount ?? 32} lượt</span>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <span className="block text-tertiary">Câu hỏi AI Tutor phổ biến nhất</span>
                    <span className="font-semibold text-chat">
                      {seg.topStudentQuestions?.[0] || 'Giải thích công thức trên slide'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Container>
  );
}
