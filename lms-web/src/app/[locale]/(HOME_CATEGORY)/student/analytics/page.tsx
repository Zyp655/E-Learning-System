'use client';

import React from 'react';
import { Container } from '../../_components/Container';
import {
  Badge,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  gridLayout,
} from '../../_components/ui';
import { useConfusionStore } from '@/store/useConfusionStore';
import { formatSeconds } from '@/lib/utils';

export default function StudentAnalyticsPage() {
  const { emotionTimeline, features12, resolvedEpisodesCount } = useConfusionStore();

  const emotionDistribution = [
    { label: 'Focused (Tập trung)', pct: 64, tone: 'success' as const },
    { label: 'Confused (Bối rối — AU4/AU7)', pct: 18, tone: 'warning' as const },
    { label: 'Happy / Engaged (Hào hứng)', pct: 10, tone: 'info' as const },
    { label: 'Frustrated (Căng thẳng)', pct: 5, tone: 'danger' as const },
    { label: 'Bored (Mệt mỏi / Ngáp)', pct: 3, tone: 'brand' as const },
  ];

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Phân tích Hành vi Học tập & Nhận diện Cảm xúc Cá nhân"
        description="Thống kê chi tiết tỷ lệ cảm xúc khuôn mặt, tần suất Eye-Lock x1.6 và hiệu quả giải tỏa bối rối qua Trợ lý AI."
      />

      <div className={gridLayout.stats}>
        <StatCard
          label="Tỷ lệ Tập trung (Focused)"
          value="64%"
          hint="Cao hơn 12% so với trung bình lớp"
          icon="visibility"
          tone="success"
        />
        <StatCard
          label="Phiên Eye-Lock Ghi nhận"
          value="7 lần"
          hint="EAR > 0.22 & Var(EAR) < 0.002"
          icon="videocam"
          tone="chat"
        />
        <StatCard
          label="Giải tỏa Bối rối Thành công"
          value={`${resolvedEpisodesCount + 20}/26`}
          hint="Đạt 92.3% sau can thiệp RAG 3 tầng"
          icon="sparkles"
          tone="seller"
        />
        <StatCard
          label="Thời lượng Học Tuần này"
          value="16.4 giờ"
          hint="Chuỗi học liên tiếp 12 ngày"
          icon="fire"
          tone="brand"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Emotion Distribution */}
        <Card padding="md" className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary">
              Phân bố Cảm xúc Khuôn mặt (MediaPipe 478 Landmarks)
            </h2>
            <Badge tone="seller">0 ảnh lưu trên server</Badge>
          </div>
          <div className="space-y-3">
            {emotionDistribution.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">{item.label}</span>
                  <span className="font-semibold text-secondary">{item.pct}%</span>
                </div>
                <ProgressBar value={item.pct} tone={item.tone} />
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Confusion & Eye-Lock Timeline */}
        <Card padding="md" className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary">
              Nhật ký Tín hiệu Ánh nhìn (Gaze Stillness & Eye-Lock)
            </h2>
            <Badge tone="chat">Cửa sổ trượt 3 mẫu</Badge>
          </div>
          <div className="space-y-2.5">
            {emotionTimeline.slice(-6).map((pt, idx) => (
              <div
                key={`${pt.t}_${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">Mốc [{formatSeconds(pt.t)}]</span>
                  <Badge
                    tone={
                      pt.emotion === 'confused' || pt.emotion === 'frustrated'
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {pt.emotion} ({Math.round(pt.confidence * 100)}%)
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-secondary">
                  <span>EAR: {pt.ear.toFixed(2)}</span>
                  {pt.eyeLocked && <Badge tone="chat">Eye-Lock x1.6</Badge>}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-muted p-3 text-xs text-secondary">
            Tổng số lần dừng video: <strong className="text-primary">{features12.pause_count}</strong> · Tổng số lần
            tua lại: <strong className="text-primary">{features12.rewind_count}</strong>
          </div>
        </Card>
      </div>
    </Container>
  );
}
