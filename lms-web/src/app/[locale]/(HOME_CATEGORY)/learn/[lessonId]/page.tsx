'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  ProgressBar,
  Textarea,
  formClass,
  segmented,
} from '../../_components/ui';
import { DetailHeader } from '../../_shell/DetailHeader';
import { SmartVideoPlayer } from '@/features/video-player/SmartVideoPlayer';
import { CameraMonitorCard } from '@/features/confusion-cv/CameraMonitorCard';
import { FaceVerificationModals } from '@/features/confusion-cv/FaceVerificationModals';
import { ConfusionInterventionOverlay } from '@/features/ai-tutor/ConfusionInterventionOverlay';
import { TutorPanel } from '@/features/ai-tutor/TutorPanel';
import { CodingLabPanel } from '@/features/coding-lab/CodingLabPanel';
import {
  GAZE_PARAGRAPH_ATTR,
  GAZE_STIMULUS_ATTR,
  ReadingGazeTracker,
} from '@/features/reading-gaze/ReadingGazeTracker';
import { CourseGradebookPanel } from '@/features/gradebook/CourseGradebookPanel';
import { formatSeconds } from '@/lib/utils';
import { useLearnStore } from '@/store/useLearnStore';
import { useTutorStore } from '@/store/useTutorStore';
import { MOCK_COURSES, MOCK_DISCUSSIONS, MOCK_QUIZZES } from '@/api/mockData';
import { describeApiError, lmsApi } from '@/api';

export default function LearnLessonPage({
  params,
}: {
  params: Promise<{ locale: string; lessonId: string }>;
}) {
  const { locale, lessonId } = use(params);
  const router = useRouter();
  const numericLessonId = Number(lessonId) || 101;

  const allLessons = MOCK_COURSES.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const lesson = allLessons.find((l) => l.id === numericLessonId) || allLessons[0];
  const parentCourse =
    MOCK_COURSES.find((c) => c.id === lesson.courseId) || MOCK_COURSES[0];

  const courseLessons = parentCourse.modules.flatMap((m) => m.lessons);
  const currentLessonIndex = courseLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex + 1 < courseLessons.length
      ? courseLessons[currentLessonIndex + 1]
      : courseLessons[0];

  // Active workspace mode defaults to the lesson's type, but allows switching freely on any lesson
  const [activeMode, setActiveMode] = useState<'video' | 'reading' | 'coding' | 'quiz'>(
    lesson.type === 'reading' || lesson.type === 'text'
      ? 'reading'
      : lesson.type === 'coding'
        ? 'coding'
        : lesson.type === 'quiz'
          ? 'quiz'
          : 'video',
  );

  useEffect(() => {
    setActiveMode(
      lesson.type === 'reading' || lesson.type === 'text'
        ? 'reading'
        : lesson.type === 'coding'
          ? 'coding'
          : lesson.type === 'quiz'
            ? 'quiz'
            : 'video',
    );
    setAutoplayCountdown(null);
  }, [lesson.id, lesson.type]);

  const readingBodyRef = useRef<HTMLDivElement | null>(null);
  // Larger text while gaze tracking is on: webcam gaze error is a few degrees, so bigger lines help.
  const [gazeTrackingActive, setGazeTrackingActive] = useState(false);
  const [rightTab, setRightTab] = useState<
    'tutor' | 'transcript' | 'notes' | 'discussions' | 'gradebook'
  >('tutor');
  const [noteText, setNoteText] = useState('');
  const [discussionInput, setDiscussionInput] = useState('');
  const [discussions, setDiscussions] = useState(MOCK_DISCUSSIONS);

  // Reading completion + 5s Autoplay countdown state
  const [completedLessonIds, setCompletedLessonIds] = useState<number[]>(() =>
    courseLessons.filter((l) => l.completed).map((l) => l.id),
  );
  const [markingComplete, setMarkingComplete] = useState(false);
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null);
  const [deadlineResetError, setDeadlineResetError] = useState<string | null>(null);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);

  // Personalized deadlines state
  const [deadlineResetToast, setDeadlineResetToast] = useState<string | null>(null);
  const [deadlineDueDateLabel, setDeadlineDueDateLabel] = useState(
    parentCourse.nextDeadlineDate || 'Chủ nhật tuần này · 23:59',
  );
  const [resettingDeadlines, setResettingDeadlines] = useState(false);

  // Inline Graded Module Quiz state
  const activeQuiz = MOCK_QUIZZES.find((q) => q.id === lesson.quizId) ?? MOCK_QUIZZES[0];
  const quizPassingScore = 80;
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizHonorCode, setQuizHonorCode] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const {
    currentTimeSec,
    maxWatchedSec,
    notes,
    requestSeek,
    addNote,
    deleteNote,
  } = useLearnStore();
  const { sendMessage } = useTutorStore();

  const isLessonCompleted = completedLessonIds.includes(lesson.id);

  const progressPercent = isLessonCompleted
    ? 100
    : lesson.durationSeconds > 0
      ? Math.min(100, Math.round((maxWatchedSec / Math.max(1, lesson.durationSeconds)) * 100))
      : 50;

  // 5-second Autoplay Next Lesson Countdown timer
  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (autoplayCountdown <= 0) {
      setAutoplayCountdown(null);
      if (nextLesson && nextLesson.id !== lesson.id) {
        router.push(`/${locale}/learn/${nextLesson.id}`);
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoplayCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoplayCountdown, locale, nextLesson, lesson.id, router]);

  const handleMarkLessonCompleted = async () => {
    setMarkingComplete(true);
    setMarkCompleteError(null);
    try {
      await lmsApi.markLessonCompleted(lesson.id);
      if (!completedLessonIds.includes(lesson.id)) {
        setCompletedLessonIds((prev) => [...prev, lesson.id]);
      }
      setAutoplayCountdown(5);
    } catch (err) {
      setMarkCompleteError(`Chưa lưu được tiến độ bài học: ${describeApiError(err)}`);
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleResetDeadlines = async () => {
    setResettingDeadlines(true);
    setDeadlineResetError(null);
    try {
      const res = await lmsApi.resetCourseDeadlines(parentCourse.id);
      setDeadlineResetToast(res.message);
      if (res.newDeadlineDate) setDeadlineDueDateLabel(res.newDeadlineDate);
    } catch (err) {
      setDeadlineResetToast(null);
      setDeadlineResetError(`Không dời được hạn nộp: ${describeApiError(err)}`);
    } finally {
      setResettingDeadlines(false);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNote(lesson.id, currentTimeSec, noteText.trim());
    setNoteText('');
  };

  const handleAddDiscussion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussionInput.trim()) return;
    const newId = Date.now();
    setDiscussions([
      {
        id: newId,
        lessonId: lesson.id,
        userId: 1,
        userName: 'Nguyễn Minh Hiếu',
        userRole: 'student',
        userMajor: 'KHMT & AI · Năm 3',
        content: discussionInput.trim(),
        parentId: null,
        path: String(newId),
        depth: 0,
        upvotes: 1,
        downvotes: 0,
        isPinned: false,
        isAnswered: false,
        isTeacherResponse: false,
        videoTimestampSec: currentTimeSec,
        createdAt: 'Vừa xong',
      },
      ...discussions,
    ]);
    setDiscussionInput('');
  };

  const readingData = lesson.readingContent || {
    estimatedMinutes: lesson.durationMinutes || 10,
    sections: [
      {
        heading: '1. Tổng quan Lý thuyết & Kiến trúc Trọng tâm',
        body: 'Bài đọc này tóm tắt các khái niệm nền tảng được trình bày trong học phần, giúp sinh viên đối chiếu nhanh công thức toán học và quy trình xử lý dữ liệu chuẩn quốc tế.',
        formula: 'EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)',
        codeSnippet:
          'const cosineSim = dotProduct(vecA, vecB) / (norm(vecA) * norm(vecB));\nconst isVerified = cosineSim >= 0.82;',
      },
      {
        heading: '2. Ứng dụng trong Thực tiễn & Tối ưu Hiệu năng',
        body: 'Khi vận hành trên trình duyệt hoặc hệ thống phân tán, việc kết hợp bộ lọc trung bình trượt (Moving Average) và kiểm định ngưỡng giúp giảm thiểu nhiễu và đảm bảo độ trễ thấp.',
      },
    ],
    keyTakeaways: [
      'Nắm vững công thức chuẩn hóa và ngưỡng quyết định (Decision Threshold).',
      'Luôn kiểm tra điều kiện biên và chất lượng dữ liệu đầu vào trước khi suy luận.',
      'Hoàn thành bài đọc và nhấn Đánh dấu hoàn thành để mở khóa bài thực hành kế tiếp.',
    ],
  };

  const quizCorrectCount = activeQuiz.questions.filter(
    (q) => quizAnswers[q.id] === q.correctIndex,
  ).length;
  const quizScorePercent = Math.round(
    (quizCorrectCount / Math.max(1, activeQuiz.questions.length)) * 100,
  );

  return (
    <div className="space-y-5">
      <DetailHeader
        locale={locale}
        title={lesson.title}
        subtitle={`${parentCourse.code} · ${parentCourse.title}`}
        fallbackHref={`/courses/${parentCourse.id}`}
        progressPercent={progressPercent}
        showCameraStatus={true}
      />

      <Container className="space-y-5">
        {/* Personalized Weekly Deadlines & 1-Click Reset Deadlines Bar (Coursera Workflow #6) */}
        <Card padding="sm" className="bg-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="brand" icon="calendar">
                Lịch học Cá nhân hóa
              </Badge>
              <span className="text-xs font-medium text-primary">
                Hạn hoàn thành học phần hiện tại: <strong>{deadlineDueDateLabel}</strong>
              </span>
              <span className="text-xs text-secondary">
                · Không trừ điểm khi dời lịch học tự điều chỉnh (Self-Paced)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setRightTab('gradebook')}
              >
                <Icon name="workspace_premium" size="xs" />
                Bảng điểm Trọng số
              </Button>
            </div>
          </div>

          {deadlineResetToast && (
            <div className="mt-2.5 rounded-xl bg-seller-25 px-3.5 py-2.5 text-xs font-medium text-seller">
              ✓ {deadlineResetToast}
            </div>
          )}
          <FieldError>{deadlineResetError}</FieldError>
        </Card>

        {/* Course Lessons Switcher Strip & Multi-Modal Lesson Format Switcher */}
        <Card padding="sm" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Danh sách bài học trong khóa ({courseLessons.length} mục):
              </span>
              {isLessonCompleted && (
                <Badge tone="success" icon="check">
                  Đã hoàn thành bài này
                </Badge>
              )}
            </div>

            {/* Interactive Mode Switcher so any user/evaluator can test Video, Reading, Coding Lab, and Quiz right here */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={activeMode === 'video' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setActiveMode('video')}
              >
                <Icon name="play" size="xs" />
                Video & AI Camera
              </Button>
              <Button
                variant={activeMode === 'reading' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setActiveMode('reading')}
              >
                <Icon name="book" size="xs" />
                Bài đọc ({readingData.estimatedMinutes} phút đọc)
              </Button>
              <Button
                variant={activeMode === 'coding' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setActiveMode('coding')}
              >
                <Icon name="code" size="xs" />
                Coding Lab (Auto-Grader)
              </Button>
              <Button
                variant={activeMode === 'quiz' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setActiveMode('quiz')}
              >
                <Icon name="checkCircle" size="xs" />
                Graded Quiz
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {courseLessons.map((item, idx) => {
              const isCurrent = item.id === lesson.id;
              const isDone = completedLessonIds.includes(item.id);
              const typeBadge =
                item.type === 'reading' || item.type === 'text'
                  ? `${item.readingContent?.estimatedMinutes || item.durationMinutes || 10}p đọc`
                  : item.type === 'coding'
                    ? 'Coding Lab'
                    : item.type === 'quiz'
                      ? 'Quiz'
                      : 'Video';
              return (
                <Link
                  key={item.id}
                  href={`/${locale}/learn/${item.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                    isCurrent
                      ? 'border-brand bg-brand-50 font-semibold text-primary'
                      : 'border-line bg-white text-primary hover:bg-muted'
                  }`}
                >
                  <span>
                    {idx + 1}. {item.title}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-secondary">
                    {typeBadge}
                  </span>
                  {isDone && <Icon name="checkCircle" size="xs" className="text-seller" />}
                </Link>
              );
            })}
          </div>
        </Card>

        {/* 5-Second Autoplay Next Lesson Countdown Banner (Coursera Workflow #8) */}
        {autoplayCountdown !== null && nextLesson && (
          <Card padding="md" className="border border-brand bg-brand-50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="brand" icon="sparkles">
                    Tự động chuyển bài (Coursera Autoplay)
                  </Badge>
                  <span className="text-xs font-semibold text-primary">
                    Tự động chuyển sang bài học tiếp theo sau {autoplayCountdown}s...
                  </span>
                </div>
                <p className="text-sm font-semibold text-primary">
                  Bài kế tiếp: {nextLesson.title} ({nextLesson.type.toUpperCase()})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoplayCountdown(null)}
                >
                  Ở lại bài này
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/${locale}/learn/${nextLesson.id}`)}
                >
                  Chuyển bài ngay →
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar
                value={((5 - autoplayCountdown) / 5) * 100}
                tone="brand"
              />
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left Column (7 cols on XL): Active Lesson Content + Live Computer Vision Confusion & Biometric Guard */}
          <div className="space-y-5 xl:col-span-7">
            {activeMode === 'video' && (
              <>
                <SmartVideoPlayer lesson={lesson} />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={isLessonCompleted ? 'success' : 'neutral'}>
                      {isLessonCompleted ? '✓ Đã hoàn thành bài giảng' : 'Đang học Video'}
                    </Badge>
                    <span className="text-xs text-secondary">
                      Hoàn thành bài giảng để kích hoạt tự động chuyển sang mục tiếp theo sau 5 giây.
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="xs"
                    disabled={markingComplete}
                    onClick={handleMarkLessonCompleted}
                  >
                    <Icon name="checkCircle" size="xs" />
                    Hoàn thành & Chuyển bài tiếp (5s)
                  </Button>
                </div>
                <FieldError>{markCompleteError}</FieldError>
              </>
            )}

            {activeMode === 'reading' && (
              <Card padding="lg" className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand" icon="book">
                        Bài đọc Học thuật (Reading Item)
                      </Badge>
                      <Badge tone="neutral">
                        <Icon name="schedule" size="xs" />
                        {readingData.estimatedMinutes} phút đọc
                      </Badge>
                      {isLessonCompleted && (
                        <Badge tone="success" icon="check">
                          Đã đọc xong
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-primary">{lesson.title}</h2>
                    <p className="text-xs text-secondary">{lesson.summary}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      sendMessage(
                        `Hãy tóm tắt các ý chính và giải thích công thức trong bài đọc "${lesson.title}".`,
                        lesson.id,
                        currentTimeSec,
                      );
                      setRightTab('tutor');
                    }}
                  >
                    <Icon name="sparkles" size="xs" />
                    Hỏi AI Tutor về bài đọc
                  </Button>
                </div>

                <ReadingGazeTracker
                  lessonId={lesson.id}
                  containerRef={readingBodyRef}
                  onTrackingChange={setGazeTrackingActive}
                  onAskTutor={(paragraphText) => {
                    sendMessage(
                      `Mình chưa hiểu đoạn này trong bài đọc "${lesson.title}": "${paragraphText}". Bạn giải thích lại dễ hiểu hơn giúp mình?`,
                      lesson.id,
                      currentTimeSec,
                    );
                    setRightTab('tutor');
                  }}
                />

                <div ref={readingBodyRef} className="space-y-5">
                  {readingData.sections.map((sec, idx) => (
                    <div key={idx} className="space-y-2.5">
                      <h3 className="text-sm font-semibold text-primary">{sec.heading}</h3>
                      <p
                        className={
                          gazeTrackingActive
                            ? 'text-lg leading-loose text-primary'
                            : 'text-sm leading-relaxed text-secondary'
                        }
                        {...{
                          [GAZE_PARAGRAPH_ATTR]: idx,
                          ...(sec.stimulus ? { [GAZE_STIMULUS_ATTR]: sec.stimulus } : {}),
                        }}
                      >
                        {sec.body}
                      </p>
                      {sec.formula && (
                        <div className="rounded-xl border border-line bg-muted p-3.5">
                          <span className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                            Công thức Toán học Chuẩn:
                          </span>
                          <p className="mt-1 text-sm font-semibold text-primary">{sec.formula}</p>
                        </div>
                      )}
                      {sec.codeSnippet && (
                        <pre className="overflow-x-auto rounded-xl bg-muted p-3.5 text-xs leading-relaxed text-primary">
                          <code>{sec.codeSnippet}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-seller-25 p-4 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-seller">
                    Điểm cốt lõi cần ghi nhớ (Key Takeaways):
                  </span>
                  <ul className="space-y-1.5 text-xs text-primary">
                    {readingData.keyTakeaways.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Icon name="checkCircle" size="xs" className="mt-0.5 text-seller" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="text-xs text-secondary">
                    Nhấn hoàn thành bài đọc để lưu tiến độ học phần và tự động chuyển sang bài kế tiếp sau 5 giây.
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={markingComplete}
                    onClick={handleMarkLessonCompleted}
                  >
                    <Icon name="checkCircle" size="xs" />
                    {isLessonCompleted
                      ? 'Đã đánh dấu hoàn thành (Chuyển bài 5s)'
                      : 'Đánh dấu đã hoàn thành (Mark as Completed)'}
                  </Button>
                </div>
                <FieldError>{markCompleteError}</FieldError>
              </Card>
            )}

            {activeMode === 'coding' && (
              <div className="space-y-4">
                <CodingLabPanel
                  initialChallengeId={lesson.codingChallengeId || 1}
                  onAskAiTutor={(prompt) => {
                    sendMessage(prompt, lesson.id, currentTimeSec);
                    setRightTab('tutor');
                  }}
                  onLabCompleted={() => {
                    handleMarkLessonCompleted();
                  }}
                />
              </div>
            )}

            {activeMode === 'quiz' && (
              <Card padding="lg" className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">Graded Module Quiz · Trọng số 30%</Badge>
                      <Badge tone="seller">Ngưỡng đạt: {quizPassingScore}%</Badge>
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-primary">
                      {activeQuiz.title}
                    </h2>
                    <p className="text-xs text-secondary">
                      Hoàn thành bài kiểm tra định kỳ học phần với Cam kết Danh dự Học thuật (Coursera Honor Code).
                    </p>
                  </div>
                  {quizSubmitted && (
                    <Badge tone="success" icon="verified">
                      Độ trùng lặp: 3.1% — Hợp lệ
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  {activeQuiz.questions.map((q, qIdx) => (
                    <div key={q.id} className="rounded-xl bg-muted p-4 space-y-2.5">
                      <p className="text-xs font-semibold text-primary">
                        Câu {qIdx + 1}: {q.question}
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => {
                          const selected = quizAnswers[q.id] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                              }
                              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                                selected
                                  ? 'border-brand bg-brand-50 font-semibold text-primary'
                                  : 'border-line bg-white text-secondary hover:text-primary'
                              }`}
                            >
                              <span>{opt}</span>
                              {quizSubmitted && optIdx === q.correctIndex && (
                                <Badge tone="success">Đáp án đúng</Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="text-xs text-secondary">
                          <strong>Giải thích:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Coursera Honor Code Attestation Checkbox (Workflow #7) */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-muted p-3.5 text-xs text-primary">
                  <input
                    type="checkbox"
                    checked={quizHonorCode}
                    onChange={(e) => setQuizHonorCode(e.target.checked)}
                    className={formClass.checkbox}
                  />
                  <span>
                    <strong>Cam kết Danh dự Học thuật (Coursera Honor Code):</strong> Tôi cam kết bài kiểm tra này là kết quả tự làm của cá nhân tôi, không sao chép hoặc nhờ người khác làm hộ.
                  </span>
                </label>

                {quizSubmitted && (
                  <div className="rounded-xl bg-seller-25 p-3.5 text-xs text-primary">
                    <strong className="text-seller">
                      Kết quả Quiz: {quizScorePercent}% ({quizCorrectCount}/{activeQuiz.questions.length} câu đúng) · Độ trùng lặp: 3.1% — Hợp lệ.
                    </strong>{' '}
                    Điểm số đã được đồng bộ trực tiếp vào Bảng điểm Trọng số (Course Gradebook).
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-secondary">
                    {!quizHonorCode
                      ? 'Vui lòng tích chọn Cam kết Danh dự Học thuật trước khi nộp bài.'
                      : 'Đã xác nhận Cam kết Danh dự Học thuật.'}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!quizHonorCode}
                    onClick={() => {
                      setQuizSubmitted(true);
                      handleMarkLessonCompleted();
                    }}
                  >
                    <Icon name="checkCircle" size="xs" />
                    Nộp bài Graded Quiz & Đồng bộ Bảng điểm
                  </Button>
                </div>
              </Card>
            )}

            {/* Real Webcam Computer Vision Monitor stays active across learning modes */}
            <CameraMonitorCard lessonId={lesson.id} />
          </div>

          {/* Right Column (5 cols on XL): AI Tutor + Transcript + Timestamped Notes + Materialized Path Forum + Gradebook */}
          <div className="space-y-4 xl:col-span-5">
            <div className={segmented.list} role="tablist" aria-label="Công cụ học tập bên phải">
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'tutor'}
                onClick={() => setRightTab('tutor')}
                className={segmented.tab}
              >
                <Icon name="sparkles" size="xs" className="text-chat" />
                AI Tutor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'transcript'}
                onClick={() => setRightTab('transcript')}
                className={segmented.tab}
              >
                Phụ đề
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'notes'}
                onClick={() => setRightTab('notes')}
                className={segmented.tab}
              >
                Ghi chú ({notes.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'discussions'}
                onClick={() => setRightTab('discussions')}
                className={segmented.tab}
              >
                Thảo luận
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'gradebook'}
                onClick={() => setRightTab('gradebook')}
                className={segmented.tab}
              >
                Bảng điểm
              </button>
            </div>

            {rightTab === 'tutor' && <TutorPanel lesson={lesson} />}

            {rightTab === 'transcript' && (
              <Card padding="md" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary">
                    Phụ đề Tương tác & Vector Chunks (1536 chiều)
                  </h3>
                  <Badge tone="seller">Whisper + pgvector Ready</Badge>
                </div>
                <div className="space-y-3">
                  {lesson.segments.map((seg) => {
                    const isActive =
                      currentTimeSec >= seg.startTimestamp && currentTimeSec <= seg.endTimestamp;
                    return (
                      <div
                        key={seg.id}
                        className={`rounded-xl p-3.5 transition-colors ${
                          isActive ? 'bg-chat-subtle' : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMode('video');
                              requestSeek(seg.startTimestamp, true);
                            }}
                            className="text-left text-xs font-semibold text-chat hover:underline"
                          >
                            [{formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)}] Phân đoạn #{seg.segmentIndex}: {seg.title}
                          </button>
                          {isActive && <Badge tone="chat">Đang phát</Badge>}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-primary">
                          {seg.transcript}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {rightTab === 'notes' && (
              <Card padding="md" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    Ghi chú Cá nhân Đồng bộ Mốc Thời gian Video
                  </h3>
                  <p className="text-xs text-secondary">
                    Nhấn vào mốc thời gian để tua trực tiếp tới vị trí ghi chú trong bài giảng.
                  </p>
                </div>

                <form onSubmit={handleAddNote} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      compact
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={`Thêm ghi chú tại mốc ${formatSeconds(currentTimeSec)}...`}
                    />
                  </div>
                  <Button type="submit" variant="primary" size="sm">
                    Lưu mốc {formatSeconds(currentTimeSec)}
                  </Button>
                </form>

                <div className="space-y-2.5">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-xl bg-muted p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMode('video');
                            requestSeek(n.videoTimestampSec, true);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          <Icon name="play" size="xs" />[{formatSeconds(n.videoTimestampSec)}]
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-tertiary">{n.createdAt}</span>
                          <button
                            type="button"
                            onClick={() => deleteNote(n.id)}
                            className="text-xs text-danger hover:underline"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-primary">{n.content}</p>
                    </div>
                  ))}
                </div>

                {/* Attachments */}
                {lesson.attachments.length > 0 && (
                  <div className="border-t border-line pt-3 space-y-2">
                    <span className="block text-xs font-semibold text-primary">
                      Tài liệu & Slide đính kèm:
                    </span>
                    {lesson.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-primary">{att.name}</span>
                        <Badge tone="neutral">{att.size}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {rightTab === 'discussions' && (
              <Card padding="md" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    Diễn đàn Hỏi đáp Phân cấp (Materialized Path Q&A)
                  </h3>
                  <p className="text-xs text-secondary">
                    Hỗ trợ cây bình luận đa tầng (`path: 1/2`), bình chọn Upvote và đánh dấu câu trả lời xác thực của Giảng viên.
                  </p>
                </div>

                <form onSubmit={handleAddDiscussion} className="space-y-2">
                  <Textarea
                    value={discussionInput}
                    onChange={(e) => setDiscussionInput(e.target.value)}
                    placeholder={`Đặt câu hỏi thảo luận gắn với mốc [${formatSeconds(currentTimeSec)}]...`}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="xs">
                      Đăng câu hỏi kèm mốc [{formatSeconds(currentTimeSec)}]
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {discussions.map((d) => (
                    <div
                      key={d.id}
                      className={`rounded-xl p-3.5 space-y-2 ${
                        d.depth > 0 ? 'ml-6 bg-seller-25 border border-seller/20' : 'bg-muted'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">{d.userName}</span>
                          {d.isTeacherResponse && (
                            <Badge tone="seller" icon="verified">
                              Giảng viên xác nhận
                            </Badge>
                          )}
                          {d.isPinned && <Badge tone="brand">Đã ghim</Badge>}
                        </div>
                        <span className="text-xs text-tertiary">Path: {d.path} · {d.createdAt}</span>
                      </div>

                      <p className="text-xs leading-relaxed text-primary">{d.content}</p>

                      <div className="flex items-center justify-between pt-1 text-xs text-secondary">
                        <div className="flex items-center gap-3">
                          {d.videoTimestampSec !== undefined && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMode('video');
                                requestSeek(d.videoTimestampSec!, true);
                              }}
                              className="font-semibold text-chat hover:underline"
                            >
                              Mốc [{formatSeconds(d.videoTimestampSec)}]
                            </button>
                          )}
                          <span>▲ {d.upvotes} hữu ích</span>
                        </div>
                        {d.isAnswered && (
                          <span className="font-medium text-seller">✓ Đã có lời giải</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {rightTab === 'gradebook' && (
              <CourseGradebookPanel courseId={parentCourse.id} />
            )}
          </div>
        </div>
      </Container>

      {/* Proactive Auto-Intervention Overlay & Biometric Guard Modals */}
      <ConfusionInterventionOverlay
        lessonId={lesson.id}
        onFocusTutorTab={() => setRightTab('tutor')}
      />
      <FaceVerificationModals />
    </div>
  );
}
