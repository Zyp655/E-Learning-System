'use client';

import React, { useMemo, useState } from 'react';
import { Container } from './_components/Container';
import { LocaleLink } from './_components/LocaleLink';
import { Icon, SectionHeading } from './_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ProgressBar,
  SearchInput,
  SellerInfo,
  StatCard,
  cardText,
  chipVariants,
  gridLayout,
} from './_components/ui';
import {
  MOCK_COURSES,
  MOCK_SPECIALIZATIONS,
  MOCK_STUDENT_PROFILE,
} from '@/api/mockData';
import { lmsApi } from '@/api';

const CATEGORIES = [
  'Tất cả học phần',
  'Trí tuệ Nhân tạo & Thị giác Máy tính',
  'Học sâu & Xử lý Ngôn ngữ Tự nhiên',
  'Khoa học Dữ liệu & Kỹ thuật Phần mềm',
];

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả học phần');
  const [searchTerm, setSearchTerm] = useState('');
  const [specializations, setSpecializations] = useState(MOCK_SPECIALIZATIONS);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [enrollToast, setEnrollToast] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    return MOCK_COURSES.filter((c) => {
      const matchCategory =
        selectedCategory === 'Tất cả học phần' || c.category === selectedCategory;
      const q = searchTerm.trim().toLowerCase();
      const matchQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });
  }, [selectedCategory, searchTerm]);

  const handleEnrollSpecialization = async (specId: number) => {
    setEnrollingId(specId);
    try {
      await lmsApi.enrollSpecialization(specId);
      setSpecializations((prev) =>
        prev.map((s) => (s.id === specId ? { ...s, isEnrolled: true } : s)),
      );
      setEnrollToast(
        'Đã ghi danh thành công vào toàn bộ Lộ trình Chuyên ngành (3 học phần + Đồ án Capstone)!',
      );
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <Container className="space-y-8">
      {/* Hero Banner: Computer Vision Confusion Detection & Smart AI Tutor */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" icon="videocam">
              MediaPipe 478 3D Landmarks + Eye-Lock
            </Badge>
            <Badge tone="chat" icon="sparkles">
              3-Tier pgvector RAG + GPT-4o Vision
            </Badge>
            <Badge tone="seller" icon="verified_user">
              MobileFaceNet 192-d Attendance Guard
            </Badge>
          </div>
          <span className="text-xs font-medium text-secondary">
            Hồ sơ: {MOCK_STUDENT_PROFILE.fullName} · {MOCK_STUDENT_PROFILE.major} (Năm {MOCK_STUDENT_PROFILE.academicYear})
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-8">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-primary md:text-3xl">
              Hệ thống Quản lý Học tập Thông minh nhận diện Bối rối qua Thị giác Máy tính & Trợ lý AI Giải thích Đa phương thức
            </h1>
            <p className="text-sm leading-relaxed text-secondary md:text-base">
              Phát hiện tức thời trạng thái bối rối của người học từ <strong>12 đặc trưng đa phương thức</strong> (AU4
              nhíu mày, AU7 nheo mắt, độ đứng yên ánh nhìn <strong>Eye-Lock x1.6</strong>, tần suất dừng/tua lại video và
              điểm Quiz phân đoạn) để chủ động bật lời giải thích cá nhân hóa ngay tại mốc giây gặp khó khăn.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink href="/learn/101" variant="primary" size="md">
                <Icon name="play" size="sm" />
                Trải nghiệm Trình phát Học tập AI CV
              </ButtonLink>
              <ButtonLink href="/student/dashboard" variant="outline" size="md">
                <Icon name="dashboard" size="sm" />
                Dashboard Học viên
              </ButtonLink>
              <ButtonLink href="/teacher/analytics" variant="soft-seller" size="md">
                <Icon name="analytics" size="sm" />
                Bản đồ Điểm nóng Bối rối (Giảng viên)
              </ButtonLink>
            </div>
          </div>

          {/* Right Quick Architecture Summary Box */}
          <div className="rounded-xl bg-muted p-4 space-y-3 lg:col-span-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Trạng thái Hệ thống AI
              </span>
              <Badge tone="success">100% Edge Privacy</Badge>
            </div>
            <div className="space-y-2 text-xs text-secondary">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Suy luận khuôn mặt trên trình duyệt</span>
                <span className="font-semibold text-primary">0 byte ảnh gửi đi</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Mô hình Phân loại Đa phương thức</span>
                <span className="font-semibold text-primary">SP-BEF (mặt + hành vi + quiz)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Truy hồi Ngữ cảnh Bài giảng</span>
                <span className="font-semibold text-primary">pgvector 1536 chiều</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Phân đoạn Video & Quiz kiểm tra</span>
                <span className="font-semibold text-primary">5–7 phút / chặng</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Top KPI Row */}
      <div className={gridLayout.stats}>
        <StatCard
          label="Học phần Đang theo học"
          value="4 học phần"
          hint="14 tín chỉ học kỳ hiện tại"
          icon="book"
          tone="brand"
        />
        <StatCard
          label="Phiên Bối rối Đã giải tỏa"
          value="92%"
          hint="24/26 phiên hiểu bài sau can thiệp AI"
          icon="sparkles"
          tone="chat"
        />
        <StatCard
          label="Điểm danh AI Sinh trắc"
          value="100%"
          hint="Đạt chuẩn ≥ 70% xem + Quiz + Khuôn mặt"
          icon="verified_user"
          tone="seller"
        />
        <StatCard
          label="Độ chính xác Mô hình MLP"
          value="F1 0.89"
          hint="Kết hợp Hybrid Rule Engine & Eye-Lock"
          icon="analytics"
          tone="info"
        />
      </div>

      {/* Coursera Specialization & Capstone Project Section (Nhóm 4 #4) */}
      <div className="space-y-4">
        <SectionHeading
          title="Lộ trình Chuyên ngành (Coursera Specialization & Capstone Project)"
          desc="Chuỗi 3 học phần liên thông từ nền tảng Thị giác Máy tính, Cấu trúc Dữ liệu DAG đến Đồ án Tổng hợp Đa phương thức."
        />

        {enrollToast && (
          <div className="rounded-xl bg-seller-25 px-4 py-3 text-xs font-medium text-seller">
            ✓ {enrollToast}
          </div>
        )}

        {specializations.map((spec) => {
          const specCourses = spec.courseIds
            .map((cid) => MOCK_COURSES.find((c) => c.id === cid))
            .filter(Boolean);
          return (
            <Card key={spec.id} padding="lg" className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand" icon="workspace_premium">
                      Coursera Specialization · {spec.courseIds.length} Học phần Liên thông
                    </Badge>
                    <Badge tone="seller">{spec.level.toUpperCase()}</Badge>
                    <Badge tone="neutral">
                      {spec.totalCredits} tín chỉ · {spec.estimatedMonths} tháng
                    </Badge>
                    {spec.isEnrolled && (
                      <Badge tone="success" icon="check">
                        Đã ghi danh toàn lộ trình
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold text-primary">{spec.title}</h2>
                  <p className="text-sm leading-relaxed text-secondary">{spec.subtitle}</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={spec.isEnrolled ? 'outline' : 'primary'}
                      size="sm"
                      disabled={enrollingId === spec.id}
                      onClick={() => handleEnrollSpecialization(spec.id)}
                    >
                      <Icon name="workspace_premium" size="xs" />
                      {spec.isEnrolled
                        ? 'Cập nhật Ghi danh Lộ trình'
                        : 'Đăng ký Trọn bộ Chuyên ngành (1-Click)'}
                    </Button>
                    <ButtonLink href="/learn/101" variant="primary" size="sm">
                      <Icon name="play" size="xs" />
                      Học tiếp Lộ trình
                    </ButtonLink>
                  </div>
                  <span className="text-xs text-secondary">
                    Tiến độ toàn lộ trình: <strong>{spec.overallProgressPercent}%</strong>
                  </span>
                </div>
              </div>

              <ProgressBar value={spec.overallProgressPercent} tone="brand" />

              {/* 3-Course Sequence Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {specCourses.map((courseItem, idx) => {
                  if (!courseItem) return null;
                  const isCapstone = idx === specCourses.length - 1;
                  const pct = courseItem.progressPercent ?? 60;
                  return (
                    <div
                      key={courseItem.id}
                      className="flex flex-col justify-between rounded-xl border border-line bg-muted p-4 space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone={isCapstone ? 'chat' : 'brand'}>
                            {isCapstone
                              ? `Khóa ${idx + 1} · Capstone Project`
                              : `Khóa ${idx + 1} · Học phần Cốt lõi`}
                          </Badge>
                          <Badge tone={pct >= 80 ? 'success' : 'info'}>
                            Tiến độ {pct}%
                          </Badge>
                        </div>
                        <LocaleLink
                          href={`/courses/${courseItem.id}`}
                          className="block text-sm font-semibold text-primary hover:text-brand"
                        >
                          {courseItem.code}: {courseItem.title}
                        </LocaleLink>
                      </div>

                      <div className="space-y-2 pt-2">
                        <ProgressBar
                          value={pct}
                          tone={pct >= 80 ? 'success' : 'brand'}
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-secondary">Khóa {idx + 1} / {specCourses.length}</span>
                          <LocaleLink
                            href={`/courses/${courseItem.id}`}
                            className="font-semibold text-brand hover:underline"
                          >
                            Xem học phần →
                          </LocaleLink>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Capstone Project Highlight Box */}
              <div className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="chat" icon="sparkles">
                        Đồ án Tổng hợp (Capstone Project)
                      </Badge>
                      <span className="text-sm font-semibold text-primary">
                        {spec.capstoneProject.title}
                      </span>
                    </div>
                    <p className="text-xs text-secondary">{spec.capstoneProject.description}</p>
                  </div>
                  <ButtonLink href="/courses/3" variant="outline" size="xs">
                    Khám phá Capstone Project →
                  </ButtonLink>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Category Filter Chips + Instant Search */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            title="Danh mục Học phần & Gợi ý Hybrid AI"
            desc="Được xếp hạng tự động theo chuyên ngành, lịch sử bối rối và tiến độ học tập của bạn."
          />
          <div className="w-full sm:w-80">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Lọc theo tên môn, mã học phần, thẻ..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={chipVariants({ active: selectedCategory === cat, tone: 'brand' })}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Course Cards Grid */}
        <div className={gridLayout.cards}>
          {filteredCourses.map((course) => (
            <Card key={course.id} padding="md" interactive className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="brand">
                    {course.code} · {course.credits} tín chỉ
                  </Badge>
                  {course.aiMatchScore && (
                    <Badge tone="chat" icon="sparkles">
                      AI Match {course.aiMatchScore}%
                    </Badge>
                  )}
                </div>

                <div>
                  <LocaleLink href={`/courses/${course.id}`} className="hover:text-brand">
                    <h3 className={cardText.title}>{course.title}</h3>
                  </LocaleLink>
                  <p className="mt-1.5 line-clamp-2 text-sm text-secondary">{course.description}</p>
                </div>

                {course.aiMatchReason && (
                  <div className="rounded-xl bg-muted p-3 text-xs text-secondary">
                    <span className="font-semibold text-chat">Lý do AI đề xuất: </span>
                    {course.aiMatchReason}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {course.tags.map((tag) => (
                    <span key={tag} className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-line-subtle pt-3">
                <SellerInfo
                  size="sm"
                  seller={{
                    name: course.instructor.name,
                    department: course.instructor.department,
                    verified: course.instructor.verified,
                  }}
                />

                {typeof course.progressPercent === 'number' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Tiến độ hoàn thành</span>
                      <span className="font-semibold text-primary">{course.progressPercent}%</span>
                    </div>
                    <ProgressBar value={course.progressPercent} tone="brand" />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-3 text-xs text-secondary">
                    <span className="flex items-center gap-1">
                      <Icon name="star" fill size={14} className="text-amber-500" />
                      <strong className="font-semibold text-primary">{course.rating}</strong> ({course.reviewsCount})
                    </span>
                    <span>{course.lessonsCount} bài giảng</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ButtonLink href={`/courses/${course.id}`} variant="outline" size="xs">
                      Chi tiết
                    </ButtonLink>
                    <ButtonLink
                      href={`/learn/${course.lastLessonId || 101}`}
                      variant="primary"
                      size="xs"
                    >
                      Học ngay
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}
