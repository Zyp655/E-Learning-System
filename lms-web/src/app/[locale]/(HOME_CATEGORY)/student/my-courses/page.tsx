'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { LocaleLink } from '../../_components/LocaleLink';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  ProgressBar,
  SellerInfo,
  segmented,
} from '../../_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { CourseGradebookPanel } from '@/features/gradebook/CourseGradebookPanel';
import { MOCK_COURSES, MOCK_SPECIALIZATIONS } from '@/api/mockData';
import { lmsApi } from '@/api';

export default function StudentMyCoursesPage() {
  const [filterTab, setFilterTab] = useState<'all' | 'gradebook' | 'specialization'>('all');
  const [gradebookModalCourseId, setGradebookModalCourseId] = useState<number | null>(null);
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [selectedGradebookCourseId, setSelectedGradebookCourseId] = useState<number>(1);

  const handleResetDeadlines = async (courseId: number) => {
    setResettingId(courseId);
    try {
      const res = await lmsApi.resetCourseDeadlines(courseId);
      setResetToast(res.message);
    } finally {
      setResettingId(null);
    }
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Học phần Của Tôi · Bảng điểm Trọng số & Lịch học Cá nhân hóa"
        description="Theo dõi tiến độ phân đoạn Video 5–7 phút, Bài đọc, Coding Lab, Bảng điểm Trọng số (Course Gradebook) và tự động điều chỉnh hạn nộp."
      />

      {resetToast && (
        <div className="rounded-xl bg-seller-25 px-4 py-3 text-xs font-medium text-seller">
          ✓ {resetToast}
        </div>
      )}

      <div className={segmented.list} role="tablist" aria-label="Chế độ xem học phần">
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'all'}
          onClick={() => setFilterTab('all')}
          className={segmented.tab}
        >
          Danh sách Học phần ({MOCK_COURSES.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'gradebook'}
          onClick={() => setFilterTab('gradebook')}
          className={segmented.tab}
        >
          Bảng điểm Trọng số (Course Gradebook)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'specialization'}
          onClick={() => setFilterTab('specialization')}
          className={segmented.tab}
        >
          Lộ trình Chuyên ngành (3 Khóa & Capstone)
        </button>
      </div>

      {filterTab === 'all' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MOCK_COURSES.map((course) => {
            const pct = course.progressPercent ?? 68;
            return (
              <Card key={course.id} padding="md" className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="brand">
                      {course.code} · {course.credits} tín chỉ
                    </Badge>
                    <Badge tone={pct >= 80 ? 'success' : 'info'}>Tiến độ {pct}%</Badge>
                  </div>

                  <LocaleLink
                    href={`/courses/${course.id}`}
                    className="block text-base font-semibold text-primary hover:text-brand"
                  >
                    {course.title}
                  </LocaleLink>

                  <SellerInfo
                    size="sm"
                    seller={{
                      name: course.instructor.name,
                      department: course.instructor.department,
                      verified: course.instructor.verified,
                    }}
                  />

                  <div className="space-y-1.5 pt-1">
                    <ProgressBar value={pct} tone="brand" />
                    <p className="text-xs text-secondary">
                      Bao gồm {course.lessonsCount} bài giảng (Video, Reading, Coding Lab, Graded Quiz) · Giám sát Bối rối CV & AI Tutor
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setGradebookModalCourseId(course.id)}
                    >
                      <Icon name="workspace_premium" size="xs" />
                      Bảng điểm Trọng số
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={resettingId === course.id}
                      onClick={() => handleResetDeadlines(course.id)}
                    >
                      <Icon name="schedule" size="xs" />
                      {resettingId === course.id ? 'Đang dời hạn...' : 'Đặt lại hạn nộp'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <ButtonLink href={`/courses/${course.id}`} variant="outline" size="xs">
                      Đề cương
                    </ButtonLink>
                    <ButtonLink
                      href={`/learn/${course.lastLessonId || 101}`}
                      variant="primary"
                      size="xs"
                    >
                      Vào học ngay →
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filterTab === 'gradebook' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Chọn học phần xem bảng điểm:</span>
            {MOCK_COURSES.map((c) => (
              <Button
                key={c.id}
                size="xs"
                variant={selectedGradebookCourseId === c.id ? 'primary' : 'outline'}
                onClick={() => setSelectedGradebookCourseId(c.id)}
              >
                {c.code} · {c.title}
              </Button>
            ))}
          </div>

          <CourseGradebookPanel courseId={selectedGradebookCourseId} />
        </div>
      )}

      {filterTab === 'specialization' && (
        <div className="space-y-4">
          {MOCK_SPECIALIZATIONS.map((spec) => {
            const specCourses = spec.courseIds
              .map((cid) => MOCK_COURSES.find((c) => c.id === cid))
              .filter(Boolean);
            return (
              <Card key={spec.id} padding="lg" className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge tone="brand" icon="workspace_premium">
                        Coursera Specialization · {specCourses.length} Học phần Liên thông
                      </Badge>
                      <Badge tone="success" icon="check">
                        Tiến độ toàn lộ trình: {spec.overallProgressPercent}%
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-primary">{spec.title}</h3>
                    <p className="text-sm text-secondary">{spec.subtitle}</p>
                  </div>
                  <ButtonLink href="/learn/101" variant="primary" size="sm">
                    <Icon name="play" size="xs" />
                    Tiếp tục Lộ trình Chuyên ngành
                  </ButtonLink>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {specCourses.map((courseItem, idx) => {
                    if (!courseItem) return null;
                    const isCapstone = idx === specCourses.length - 1;
                    const pct = courseItem.progressPercent ?? 60;
                    return (
                      <div
                        key={courseItem.id}
                        className="rounded-xl border border-line bg-muted p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Badge tone={isCapstone ? 'chat' : 'brand'}>
                            {isCapstone
                              ? `Khóa ${idx + 1} · Capstone Project`
                              : `Khóa ${idx + 1}`}
                          </Badge>
                          <Badge tone={pct >= 80 ? 'success' : 'info'}>
                            {pct}%
                          </Badge>
                        </div>
                        <LocaleLink
                          href={`/courses/${courseItem.id}`}
                          className="block text-sm font-semibold text-primary hover:text-brand"
                        >
                          {courseItem.code}: {courseItem.title}
                        </LocaleLink>
                        <ProgressBar
                          value={pct}
                          tone={pct >= 80 ? 'success' : 'brand'}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={gradebookModalCourseId !== null}
        onClose={() => setGradebookModalCourseId(null)}
        size="xl"
      >
        <DialogTitle>Bảng điểm Trọng số Học phần (Course Gradebook)</DialogTitle>
        <DialogDescription>
          Tổng hợp điểm Quiz phân đoạn (20%), Quiz học phần (30%), Coding Lab (25%) và Đồ án Rubric (25%).
        </DialogDescription>
        <DialogBody>
          {gradebookModalCourseId !== null && (
            <CourseGradebookPanel courseId={gradebookModalCourseId} />
          )}
        </DialogBody>
        <DialogActions>
          <Button variant="primary" onClick={() => setGradebookModalCourseId(null)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
