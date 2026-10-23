'use client';

import React from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  gridLayout,
} from '../../_components/ui';

const BADGES_LIST = [
  {
    id: 1,
    title: 'Bậc thầy Vượt Bối rối (Confusion Resolver)',
    desc: 'Giải tỏa thành công 20+ điểm nóng bối rối cùng Trợ lý AI RAG 3 tầng.',
    unlocked: true,
    xp: 500,
  },
  {
    id: 2,
    title: 'Chuyên gia Điểm danh Sinh trắc 100%',
    desc: 'Đạt chuẩn xem thực tế ≥ 70% và xác thực khuôn mặt 192 chiều liên tục 14 ngày.',
    unlocked: true,
    xp: 450,
  },
  {
    id: 3,
    title: 'Quán quân Đấu trường Quiz Multiplayer',
    desc: 'Chiến thắng 5 trận đấu trắc nghiệm trực tuyến với chuỗi đúng liên tiếp ≥ 5.',
    unlocked: true,
    xp: 600,
  },
  {
    id: 4,
    title: 'Nhà Nghiên cứu Thị giác Máy tính',
    desc: 'Hoàn thành xuất sắc đồ án xây dựng mô hình nhận diện AU4/AU7 & BiLSTM.',
    unlocked: false,
    xp: 1000,
  },
];

export default function StudentAchievementsPage() {
  return (
    <Container className="space-y-6">
      <PageHeader
        title="Thành tích Học tập, Huy hiệu & Chuỗi Ngày Học (Streaks)"
        description="Hệ thống Gamification khuyến khích tự học chủ động và tương tác sâu với Trợ lý AI."
      />

      <div className={gridLayout.stats}>
        <StatCard
          label="Chuỗi Ngày Học (Streak)"
          value="12 ngày"
          hint="Kỷ lục cá nhân: 19 ngày"
          icon="fire"
          tone="brand"
        />
        <StatCard
          label="Tổng Điểm Kinh nghiệm"
          value="4,850 XP"
          hint="Hạng #2 toàn khóa KHMT-K66"
          icon="trophy"
          tone="seller"
        />
        <StatCard
          label="Huy hiệu Đã Mở khóa"
          value="14 / 18"
          hint="3 huy hiệu hiếm cấp Khoa"
          icon="workspace_premium"
          tone="chat"
        />
        <StatCard
          label="Mục tiêu Hôm nay"
          value="85%"
          hint="Đã học 52 / 60 phút mục tiêu"
          icon="check_circle"
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {BADGES_LIST.map((b) => (
          <Card key={b.id} padding="md" className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  b.unlocked ? 'bg-brand-50 text-brand' : 'bg-muted text-secondary'
                }`}
              >
                <Icon name="trophy" size="md" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">{b.title}</h3>
                  <Badge tone={b.unlocked ? 'success' : 'neutral'}>
                    {b.unlocked ? 'Đã đạt' : 'Đang phấn đấu'}
                  </Badge>
                </div>
                <p className="text-xs text-secondary">{b.desc}</p>
                <div className="pt-1">
                  <ProgressBar value={b.unlocked ? 100 : 65} tone={b.unlocked ? 'seller' : 'brand'} />
                </div>
              </div>
            </div>
            <Badge tone="chat">+{b.xp} XP</Badge>
          </Card>
        ))}
      </div>
    </Container>
  );
}
