'use client';

import React, { use, useState } from 'react';
import { Container } from '../../_components/Container';
import { LocaleLink } from '../../_components/LocaleLink';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  FieldError,
  ProgressBar,
  SellerInfo,
  Textarea,
  segmented,
} from '../../_components/ui';
import { DetailHeader } from '../../_shell/DetailHeader';
import { CourseGradebookPanel } from '@/features/gradebook/CourseGradebookPanel';
import { formatSeconds } from '@/lib/utils';
import {
  MOCK_COURSES,
  MOCK_ROADMAP_NODES,
  MOCK_SPECIALIZATIONS,
} from '@/api/mockData';
import { describeApiError, lmsApi } from '@/api';

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const courseId = Number(id) || 1;
  const course = MOCK_COURSES.find((c) => c.id === courseId) || MOCK_COURSES[0];
  const specialization = MOCK_SPECIALIZATIONS[0];
  const specCourses = specialization.courseIds
    .map((cid) => MOCK_COURSES.find((c) => c.id === cid))
    .filter(Boolean);

  const [activeTab, setActiveTab] = useState<
    'syllabus' | 'gradebook' | 'specialization' | 'segments' | 'roadmap' | 'reviews'
  >('syllabus');
  const [newReviewText, setNewReviewText] = useState('');
  const [reviewsList, setReviewsList] = useState(course.reviews);
  const [resettingDeadlines, setResettingDeadlines] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState<string | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [deadlineLabel, setDeadlineLabel] = useState(
    course.nextDeadlineDate || 'Chủ nhật tuần này · 23:59',
  );

  const handleResetDeadlines = async () => {
    setResettingDeadlines(true);
    setDeadlineError(null);
    try {
      const res = await lmsApi.resetCourseDeadlines(course.id);
      setDeadlineMessage(res.message);
      if (res.newDeadlineDate) setDeadlineLabel(res.newDeadlineDate);
    } catch (err) {
      setDeadlineMessage(null);
      setDeadlineError(`Không dời được hạn nộp: ${describeApiError(err)}`);
    } finally {
      setResettingDeadlines(false);
    }
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    setReviewsList([
      {
        id: Date.now(),
        courseId: course.id,
        userName: 'Nguyễn Minh Hiếu',
        studentMajor: 'KHMT & Trí tuệ Nhân tạo',
        rating: 5,
        comment: newReviewText.trim(),
        createdAt: 'Vừa xong',
        helpfulCount: 1,
      },
      ...reviewsList,
    ]);
    setNewReviewText('');
  };

  return (
    <div className="space-y-6">
      <DetailHeader
        locale={locale}
        title={`${course.code} · ${course.title}`}
        subtitle={`${course.department} · ${course.credits} tín chỉ`}
        fallbackHref="/"
        progressPercent={course.progressPercent}
      />

      <Container className="space-y-6">
        {/* Course Overview Card */}
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{course.code}</Badge>
              <Badge tone="info">{course.credits} tín chỉ</Badge>
              <Badge tone="chat" icon="sparkles">
                Tích hợp AI Giải thích 3 tầng RAG + Vision
              </Badge>
              <Badge tone="seller" icon="verified_user">
                Bắt buộc Điểm danh Khuôn mặt 192-d
              </Badge>
            </div>
            <span className="text-xs text-secondary">
              {course.studentsCount} sinh viên đăng ký · Đánh giá {course.rating}/5.0 ({course.reviewsCount})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <h1 className="text-2xl font-semibold text-primary md:text-3xl">{course.title}</h1>
              <p className="text-sm leading-relaxed text-secondary md:text-base">{course.description}</p>

              <SellerInfo
                size="md"
                seller={{
                  name: course.instructor.name,
                  department: course.instructor.department,
                  profession: course.instructor.title,
                  verified: course.instructor.verified,
                }}
              />

              {/* Personalized Deadlines Banner (Coursera Workflow #6) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-muted p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand" icon="calendar">
                      Hạn nộp Cá nhân hóa (Self-Paced)
                    </Badge>
                    <span className="text-xs font-semibold text-primary">
                      Hạn tuần hiện tại: {deadlineLabel}
                    </span>
                  </div>
                  <p className="text-xs text-secondary">
                    Dời toàn bộ lịch bài đọc, Coding Lab và Quiz sang tuần kế tiếp mà không bị phạt điểm.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={resettingDeadlines}
                  onClick={handleResetDeadlines}
                >
                  <Icon name="schedule" size="xs" />
                  {resettingDeadlines
                    ? 'Đang cập nhật...'
                    : 'Đặt lại hạn nộp của tôi (Reset Deadlines)'}
                </Button>
              </div>

              {deadlineMessage && (
                <div className="rounded-xl bg-seller-25 px-3.5 py-2.5 text-xs font-medium text-seller">
                  ✓ {deadlineMessage}
                </div>
              )}
              <FieldError>{deadlineError}</FieldError>
            </div>

            <div className="rounded-xl bg-muted p-4 space-y-3 lg:col-span-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-secondary">Tiến độ học phần của bạn</span>
                <span className="font-semibold text-primary">{course.progressPercent ?? 68}%</span>
              </div>
              <ProgressBar value={course.progressPercent ?? 68} tone="brand" />
              <p className="text-xs text-secondary">
                Bao gồm Video phân đoạn 5–7 phút, Bài đọc Học thuật (Reading), Phòng Lab Lập trình (Coding Lab) và Bài kiểm tra Trọng số.
              </p>
              <div className="space-y-2 pt-1">
                <ButtonLink
                  href={`/learn/${course.lastLessonId || course.modules[0]?.lessons[0]?.id || 101}`}
                  variant="primary"
                  size="md"
                  block
                >
                  <Icon name="play" size="sm" />
                  Tiếp tục bài giảng đang học
                </ButtonLink>
                <Button
                  variant="outline"
                  size="sm"
                  block
                  onClick={() => setActiveTab('gradebook')}
                >
                  <Icon name="workspace_premium" size="xs" />
                  Xem Bảng điểm Trọng số (Gradebook)
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Segmented Tab Navigation */}
        <div className={segmented.list} role="tablist" aria-label="Chi tiết học phần">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'syllabus'}
            onClick={() => setActiveTab('syllabus')}
            className={segmented.tab}
          >
            Đề cương ({course.modules.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gradebook'}
            onClick={() => setActiveTab('gradebook')}
            className={segmented.tab}
          >
            Bảng điểm Trọng số (Gradebook)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'specialization'}
            onClick={() => setActiveTab('specialization')}
            className={segmented.tab}
          >
            Lộ trình Chuyên ngành (3 Khóa)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'segments'}
            onClick={() => setActiveTab('segments')}
            className={segmented.tab}
          >
            Phân đoạn Video 5–7p
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'roadmap'}
            onClick={() => setActiveTab('roadmap')}
            className={segmented.tab}
          >
            Cây Lộ trình DAG
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            className={segmented.tab}
          >
            Đánh giá ({reviewsList.length})
          </button>
        </div>

        {/* Tab 1: Syllabus & Modules */}
        {activeTab === 'syllabus' && (
          <div className="space-y-4">
            {course.modules.map((mod) => (
              <Card key={mod.id} padding="md" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-primary">{mod.title}</h3>
                    <p className="text-sm text-secondary">{mod.description}</p>
                  </div>
                  <Badge tone="neutral">{mod.lessons.length} mục học tập</Badge>
                </div>

                <div className="space-y-2">
                  {mod.lessons.map((les) => {
                    const isReading = les.type === 'reading' || les.type === 'text';
                    const isCoding = les.type === 'coding';
                    const isQuiz = les.type === 'quiz';
                    return (
                      <div
                        key={les.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-xl bg-white text-brand">
                            <Icon
                              name={
                                isReading
                                  ? 'book'
                                  : isCoding
                                    ? 'code'
                                    : isQuiz
                                      ? 'checkCircle'
                                      : 'videocam'
                              }
                              size="sm"
                            />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <LocaleLink
                                href={`/learn/${les.id}`}
                                className="text-sm font-semibold text-primary hover:text-brand"
                              >
                                {les.title}
                              </LocaleLink>
                              {isReading && (
                                <Badge tone="brand">
                                  Reading · {les.readingContent?.estimatedMinutes || les.durationMinutes || 10} phút đọc
                                </Badge>
                              )}
                              {isCoding && (
                                <Badge tone="info">Coding Lab · Auto-Grader</Badge>
                              )}
                              {isQuiz && (
                                <Badge tone="warning">Graded Quiz · Trọng số 30%</Badge>
                              )}
                              {!isReading && !isCoding && !isQuiz && (
                                <Badge tone="neutral">Video AI CV</Badge>
                              )}
                              {les.completed && (
                                <Badge tone="success" icon="check">
                                  Đã hoàn thành
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-secondary">
                              <span>Thời lượng: {les.durationMinutes} phút</span>
                              <span>·</span>
                              <span>{les.segments.length} phân đoạn Quiz</span>
                              <span>·</span>
                              <span className="text-seller font-medium">
                                Transcript RAG: {les.transcriptStatus === 'ready' ? 'Sẵn sàng (1536-d)' : 'Đang xử lý'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <ButtonLink href={`/learn/${les.id}`} variant="primary" size="xs">
                          {isReading
                            ? 'Đọc tài liệu →'
                            : isCoding
                              ? 'Mở Coding Lab →'
                              : isQuiz
                                ? 'Làm Graded Quiz →'
                                : 'Vào học AI CV →'}
                        </ButtonLink>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab 2: Course Gradebook & Weighted Grades (Coursera Workflow #2) */}
        {activeTab === 'gradebook' && <CourseGradebookPanel courseId={course.id} />}

        {/* Tab 3: Specialization & Capstone Project Sequence (Coursera Workflow #4) */}
        {activeTab === 'specialization' && (
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge tone="brand" icon="workspace_premium">
                    Coursera Specialization · {specCourses.length} Học phần Liên thông
                  </Badge>
                  <Badge tone="seller">{specialization.level.toUpperCase()}</Badge>
                </div>
                <h3 className="text-lg font-semibold text-primary">
                  {specialization.title}
                </h3>
                <p className="text-sm text-secondary">{specialization.subtitle}</p>
              </div>
              <Badge tone="success" icon="check">
                Tiến độ toàn lộ trình: {specialization.overallProgressPercent}%
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {specCourses.map((courseItem, idx) => {
                if (!courseItem) return null;
                const isThisCourse = courseItem.id === course.id;
                const isCapstone = idx === specCourses.length - 1;
                const pct = courseItem.progressPercent ?? 60;
                return (
                  <div
                    key={courseItem.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      isThisCourse
                        ? 'border-brand bg-brand-50'
                        : 'border-line bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge tone={isCapstone ? 'chat' : 'brand'}>
                        {isCapstone
                          ? `Khóa ${idx + 1} · Capstone Project`
                          : `Khóa ${idx + 1}`}
                      </Badge>
                      {isThisCourse && <Badge tone="seller">Học phần hiện tại</Badge>}
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
                    <div className="flex items-center justify-between text-xs text-secondary">
                      <span>Tiến độ: {pct}%</span>
                      <LocaleLink
                        href={`/courses/${courseItem.id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        Mở khóa học →
                      </LocaleLink>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-muted p-4 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-chat">
                Đồ án Tổng hợp Cuối Lộ trình (Capstone Project):
              </span>
              <p className="text-sm font-semibold text-primary">
                {specialization.capstoneProject.title}
              </p>
              <p className="text-xs text-secondary">{specialization.capstoneProject.description}</p>
            </div>
          </Card>
        )}

        {/* Tab 4: 5-7m VideoSegments & RAG Chunks */}
        {activeTab === 'segments' && (
          <Card padding="md" className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-primary">
                Cấu trúc Phân đoạn Video 5–7 Phút & Điểm nóng Bối rối
              </h3>
              <p className="text-sm text-secondary">
                Mỗi phân đoạn được nhúng vector ngữ nghĩa 1536 chiều (`pgvector`) và gắn câu hỏi trắc nghiệm kiểm tra mức độ hiểu bài.
              </p>
            </div>
            <div className="space-y-3">
              {course.modules.flatMap((m) => m.lessons).flatMap((l) => l.segments).map((seg) => (
                <div key={seg.id} className="rounded-xl bg-muted p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-primary">
                      Phân đoạn #{seg.segmentIndex}: {seg.title} (
                      {formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)})
                    </span>
                    <div className="flex items-center gap-2">
                      {seg.confusionHotspotRate !== undefined && (
                        <Badge tone={seg.confusionHotspotRate >= 30 ? 'danger' : 'warning'}>
                          Tỷ lệ bối rối: {seg.confusionHotspotRate}%
                        </Badge>
                      )}
                      <ButtonLink href={`/learn/${seg.lessonId}`} variant="chat" size="xs">
                        Xem tại mốc {formatSeconds(seg.startTimestamp)}
                      </ButtonLink>
                    </div>
                  </div>
                  <p className="text-xs text-secondary">{seg.summary}</p>
                  <div className="rounded-lg bg-white p-2.5 text-xs text-primary">
                    <span className="font-semibold text-chat">Câu hỏi kiểm tra cuối phân đoạn: </span>
                    {seg.quizQuestion.question}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tab 5: DAG Learning Roadmap */}
        {activeTab === 'roadmap' && (
          <Card padding="md" className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-primary">
                Đồ thị Tiên quyết Học phần (Directed Acyclic Graph)
              </h3>
              <p className="text-sm text-secondary">
                Lộ trình chuẩn đầu ra chuyên ngành và các nút kiến thức tiên quyết.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {MOCK_ROADMAP_NODES.slice(0, 6).map((node) => (
                <div key={node.id} className="rounded-xl bg-muted p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      tone={
                        node.status === 'completed'
                          ? 'success'
                          : node.status === 'in_progress'
                            ? 'brand'
                            : 'neutral'
                      }
                    >
                      {node.status === 'completed'
                        ? 'Đã hoàn thành'
                        : node.status === 'in_progress'
                          ? 'Đang học'
                          : 'Chưa mở khóa'}
                    </Badge>
                    {node.aiRecommended && <Badge tone="chat">AI Đề xuất</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-primary">{node.title}</p>
                  <p className="text-xs text-secondary">{node.description}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tab 6: Course Reviews & Verified Instructor Responses */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <Card padding="md">
              <form onSubmit={handleAddReview} className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">
                  Gửi đánh giá của bạn về học phần & chất lượng giải thích của AI Tutor
                </h3>
                <Textarea
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm học tập với tính năng Nhận diện Bối rối và Trợ lý AI..."
                />
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm">
                    Gửi đánh giá
                  </Button>
                </div>
              </form>
            </Card>

            {reviewsList.map((rev) => (
              <Card key={rev.id} padding="md" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-primary">{rev.userName}</span>
                    <span className="ml-2 text-xs text-secondary">({rev.studentMajor})</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <Badge tone="warning">★ {rev.rating}.0 / 5.0</Badge>
                    <span>{rev.createdAt}</span>
                  </div>
                </div>
                <p className="text-sm text-primary">{rev.comment}</p>
                {rev.teacherResponse && (
                  <div className="rounded-xl bg-muted p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-seller">
                      <Icon name="verified" fill size={14} />
                      <span>Phản hồi từ Giảng viên ({course.instructor.name}):</span>
                    </div>
                    <p className="text-primary">{rev.teacherResponse}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
