'use client';

import React from 'react';
import { Container } from '../../_components/Container';
import { LocaleLink } from '../../_components/LocaleLink';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  gridLayout,
} from '../../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';
import { useConfusionStore } from '@/store/useConfusionStore';
import {
  MOCK_COURSES,
  MOCK_DAILY_ATTENDANCE,
  MOCK_TOPIC_SKILLS,
} from '@/api/mockData';

export default function StudentDashboardPage() {
  const { profile } = useAccountStore();
  const { resolvedEpisodesCount, mlProb, ruleScore } = useConfusionStore();

  return (
    <Container className="space-y-6">
      <PageHeader
        title={`Xin chào, ${profile.fullName}`}
        description={`MSSV: ${profile.studentCode} · Lớp ${profile.studentClass} · Chuyên ngành ${profile.major} (Năm ${profile.academicYear})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/student/face-setup" variant="outline" size="sm">
              <Icon name="verified_user" size="sm" className="text-seller" />
              {profile.faceRegistered ? 'Đã xác thực 3 góc mặt' : 'Đăng ký khuôn mặt'}
            </ButtonLink>
            <ButtonLink href="/learn/101" variant="primary" size="sm">
              <Icon name="play" size="sm" />
              Tiếp tục bài giảng đang học
            </ButtonLink>
          </div>
        }
      />

      {/* KPI Row */}
      <div className={gridLayout.stats}>
        <StatCard
          label="Tiến độ Học kỳ"
          value="74%"
          hint="4 học phần đang theo học"
          icon="academic_cap"
          tone="brand"
        />
        <StatCard
          label="Phiên Bối rối Đã Giải tỏa"
          value={`${resolvedEpisodesCount + 20} phiên`}
          hint="Trợ lý AI RAG 3 tầng hỗ trợ tức thì"
          icon="sparkles"
          tone="chat"
        />
        <StatCard
          label="Điểm danh AI Hôm nay"
          value="Đạt 2/2 ca"
          hint="Xem ≥ 70% + Đạt Quiz + Khuôn mặt 192-d"
          icon="verified_user"
          tone="seller"
        />
        <StatCard
          label="Điểm Trung bình Quiz"
          value="88.5%"
          hint="Thích ứng độ khó theo TopicSkill"
          icon="trophy"
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Active Courses & AI Attendance Engine Today */}
        <div className="space-y-6 lg:col-span-7">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  Học phần Đang Học & Mốc Video Gần nhất
                </h2>
                <p className="text-xs text-secondary">
                  Tự động khôi phục đúng giây đang xem và trạng thái Quiz phân đoạn 5–7 phút.
                </p>
              </div>
              <ButtonLink href="/student/my-courses" variant="outline" size="xs">
                Xem tất cả
              </ButtonLink>
            </div>

            <div className="space-y-3">
              {MOCK_COURSES.map((course) => (
                <div key={course.id} className="rounded-xl bg-muted p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Badge tone="brand">{course.code}</Badge>
                      <LocaleLink
                        href={`/courses/${course.id}`}
                        className="mt-1 block text-sm font-semibold text-primary hover:text-brand"
                      >
                        {course.title}
                      </LocaleLink>
                    </div>
                    <ButtonLink
                      href={`/learn/${course.lastLessonId || 101}`}
                      variant="primary"
                      size="xs"
                    >
                      Học tiếp ({course.progressPercent ?? 68}%)
                    </ButtonLink>
                  </div>
                  <ProgressBar value={course.progressPercent ?? 68} tone="brand" />
                </div>
              ))}
            </div>
          </Card>

          {/* Daily Automated AI Attendance Engine */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  Trạng thái Điểm danh AI Tự động Hôm nay (Chốt lúc 23:59)
                </h2>
                <p className="text-xs text-secondary">
                  Điều kiện Có mặt (`present`): Xem thực tế ≥ 70% + Hoàn thành Quiz phân đoạn + Xác thực khuôn mặt chính chủ.
                </p>
              </div>
              <Badge tone="seller" icon="verified_user">
                AttendanceEngine Active
              </Badge>
            </div>

            <div className="space-y-3">
              {MOCK_DAILY_ATTENDANCE.map((att) => (
                <div key={att.scheduleId} className="rounded-xl bg-muted p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-primary">
                      {att.subjectName} ({att.classCode})
                    </span>
                    <Badge
                      tone={
                        att.status === 'present'
                          ? 'success'
                          : att.status === 'pending'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {att.status === 'present'
                        ? 'Đã ghi nhận Có mặt'
                        : att.status === 'pending'
                          ? 'Đang tích lũy thời lượng'
                          : 'Vắng mặt'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-secondary">
                    <div className="rounded-lg bg-white px-2.5 py-1.5">
                      <span className="block text-tertiary">Thời lượng xem</span>
                      <span className="font-semibold text-primary">{att.watchPercentage}% (Yêu cầu ≥ 70%)</span>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-1.5">
                      <span className="block text-tertiary">Quiz Phân đoạn</span>
                      <span className="font-semibold text-primary">
                        {att.quizCompleted ? `Đạt (${att.quizScore}%)` : 'Chưa hoàn thành'}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-1.5">
                      <span className="block text-tertiary">Sinh trắc 192-d</span>
                      <span className="font-semibold text-primary">
                        {att.faceVerified ? 'Chính chủ (OK)' : 'Chưa quét'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right 5 cols: Confusion Telemetry Summary & TopicSkill Adaptive Progress */}
        <div className="space-y-6 lg:col-span-5">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary">
                Chỉ số Nhận diện Bối rối Cá nhân
              </h2>
              <Badge tone="chat">MLP + Hybrid Rule</Badge>
            </div>
            <div className="rounded-xl bg-muted p-4 space-y-3 text-xs text-secondary">
              <div className="flex items-center justify-between">
                <span>Xác suất bối rối phiên gần nhất (MLP):</span>
                <span className="font-semibold text-primary">{Math.round(mlProb * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Điểm Luật kết hợp (Hybrid Rule Score):</span>
                <span className="font-semibold text-primary">{ruleScore} / 100</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tỷ lệ hiểu bài sau khi AI giải thích:</span>
                <span className="font-semibold text-seller">92.3%</span>
              </div>
            </div>
            <ButtonLink href="/student/analytics" variant="chat" size="sm" block>
              Xem Phân tích Cảm xúc & Biểu đồ Eye-Lock Chi tiết
            </ButtonLink>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary">
                Năng lực Chủ đề Thích ứng (TopicSkill)
              </h2>
              <ButtonLink href="/student/quizzes" variant="outline" size="xs">
                Luyện Quiz
              </ButtonLink>
            </div>
            <div className="space-y-3">
              {MOCK_TOPIC_SKILLS.map((sk) => (
                <div key={sk.topic} className="rounded-xl bg-muted p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">{sk.topic}</span>
                    <Badge
                      tone={
                        sk.recommendedDifficulty === 'hard'
                          ? 'seller'
                          : sk.recommendedDifficulty === 'medium'
                            ? 'info'
                            : 'warning'
                      }
                    >
                      Đề xuất: {sk.recommendedDifficulty.toUpperCase()}
                    </Badge>
                  </div>
                  <ProgressBar value={Math.round(sk.skillLevel * 100)} tone="chat" />
                  <div className="flex justify-between text-xs text-secondary">
                    <span>Điểm TB: {sk.averageScore}%</span>
                    <span>Skill Level: {Math.round(sk.skillLevel * 100)}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}
