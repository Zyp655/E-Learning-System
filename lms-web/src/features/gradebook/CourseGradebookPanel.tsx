'use client';

import React, { useEffect, useState } from 'react';
import { LocaleLink } from '@/app/[locale]/(HOME_CATEGORY)/_components/LocaleLink';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  FieldError,
  LoadError,
  ProgressBar,
} from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import { describeApiError, lmsApi } from '@/api';
import { MOCK_COURSE_GRADEBOOKS } from '@/api/mockData';
import type { CourseGradebook, GradebookItem } from '@/api/types';

interface CourseGradebookPanelProps {
  courseId: number;
  courseTitle?: string;
  onDeadlineReset?: (newDeadlineDate: string) => void;
}

const STATUS_BADGE: Record<
  GradebookItem['status'],
  { label: string; tone: 'success' | 'info' | 'danger' }
> = {
  passed: { label: 'Passed (Đã đạt)', tone: 'success' },
  in_progress: { label: 'In Progress (Đang làm)', tone: 'info' },
  overdue: { label: 'Overdue (Quá hạn)', tone: 'danger' },
};

export function CourseGradebookPanel({
  courseId,
  courseTitle,
  onDeadlineReset,
}: CourseGradebookPanelProps) {
  const [gradebook, setGradebook] = useState<CourseGradebook>(
    MOCK_COURSE_GRADEBOOKS[courseId] || MOCK_COURSE_GRADEBOOKS[1],
  );
  const [resettingDeadlines, setResettingDeadlines] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGradebook(MOCK_COURSE_GRADEBOOKS[courseId] || MOCK_COURSE_GRADEBOOKS[1]);
    setLoadError(null);
    lmsApi
      .getCourseGradebook(courseId)
      .then((res) => {
        if (!cancelled && res && res.items) setGradebook(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(`Không tải được bảng điểm từ máy chủ, đang hiển thị dữ liệu mẫu: ${describeApiError(err)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleResetMyDeadlines = async () => {
    setResettingDeadlines(true);
    setResetError(null);
    try {
      const res = await lmsApi.resetCourseDeadlines(courseId);
      const newDueDate = res.newDeadlineDate;
      const shiftedItems: GradebookItem[] = gradebook.items.map((item) => ({
        ...item,
        dueDate: newDueDate || item.dueDate,
        status: item.status === 'overdue' ? 'in_progress' : item.status,
      }));
      setGradebook({
        ...gradebook,
        items: shiftedItems,
      });
      setToastMessage(res.message);
      if (onDeadlineReset && newDueDate) {
        onDeadlineReset(newDueDate);
      }
    } catch (err) {
      setResetError(`Không dời được hạn nộp: ${describeApiError(err)}`);
    } finally {
      setResettingDeadlines(false);
    }
  };

  const isPassing = gradebook.overallWeightedScore >= gradebook.passingThreshold;
  const hasOverdueOrApproaching = gradebook.items.some(
    (i) => i.status === 'overdue' || i.status === 'in_progress',
  );

  return (
    <div className="space-y-4">
      {loadError && <LoadError message={loadError} />}
      <FieldError>{resetError}</FieldError>
      {/* Toast Notification after 1-Click Reset Deadlines */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 px-4 py-3 text-xs text-green-900">
          <div className="flex items-center gap-2">
            <Icon name="checkCircle" size="sm" className="text-success" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="font-semibold underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Coursera #6: Personalized Deadlines Banner & 1-Click Reset My Deadlines */}
      {hasOverdueOrApproaching && (
        <Card padding="sm" className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-amber-700">
                <Icon name="clock" size="sm" />
              </span>
              <div>
                <p className="text-xs font-semibold text-primary">
                  Lịch trình Cá nhân hóa (Personalized Weekly Deadlines): Có hạng mục sắp đến hạn hoặc trễ hạn
                </p>
                <p className="text-xs text-secondary">
                  Bạn có thể tự động dời lịch hạn nộp các chương và bài tập sang 2 tuần tới mà không bị trừ điểm chuyên cần.
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="primary"
              disabled={resettingDeadlines}
              onClick={handleResetMyDeadlines}
            >
              <Icon name="arrowPath" size="xs" />
              {resettingDeadlines
                ? 'Đang dời lịch nộp...'
                : 'Đặt lại hạn nộp của tôi (Reset Deadlines)'}
            </Button>
          </div>
        </Card>
      )}

      {/* Coursera #2: Overall Weighted Course Grade Card */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="brand" icon="academicCap">
                Bảng điểm Trọng số (Course Gradebook)
              </Badge>
              <Badge tone={isPassing ? 'success' : 'warning'}>
                {isPassing
                  ? `Đạt chuẩn Qua môn (≥ ${gradebook.passingThreshold}%)`
                  : `Đang tích lũy (Ngưỡng qua môn ≥ ${gradebook.passingThreshold}%)`}
              </Badge>
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-primary">
              {courseTitle || `Tổng kết Điểm Trọng số Học phần #${courseId}`}
            </h3>
          </div>

          <div className="text-right">
            <span className="block text-xs text-secondary">Điểm Tổng kết Trọng số:</span>
            <span className="text-2xl font-semibold text-primary">
              {gradebook.overallWeightedScore.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary">
              Tiến độ điểm tổng kết hướng tới ngưỡng đạt chuẩn <strong>{gradebook.passingThreshold}%</strong>:
            </span>
            <span className="font-semibold text-primary">
              {gradebook.overallWeightedScore.toFixed(1)}% / 100%
            </span>
          </div>
          <ProgressBar
            value={gradebook.overallWeightedScore}
            tone={isPassing ? 'success' : 'warning'}
          />
        </div>

        {/* 4 Category Weights Breakdown Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
            <span className="text-secondary">1. In-Video Segment Quizzes</span>
            <p className="text-sm font-semibold text-primary">
              Trọng số {gradebook.categoryWeights.segment_quiz}%
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
            <span className="text-secondary">2. Adaptive Module Quizzes</span>
            <p className="text-sm font-semibold text-primary">
              Trọng số {gradebook.categoryWeights.module_quiz}%
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
            <span className="text-secondary">3. Coding Labs (Auto-Test)</span>
            <p className="text-sm font-semibold text-primary">
              Trọng số {gradebook.categoryWeights.coding_lab}%
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
            <span className="text-secondary">4. Final Rubric Assignment</span>
            <p className="text-sm font-semibold text-primary">
              Trọng số {gradebook.categoryWeights.final_assignment}%
            </p>
          </div>
        </div>

        {/* Graded Items List */}
        <div className="space-y-2.5 pt-1">
          {gradebook.items.map((item) => {
            const st = STATUS_BADGE[item.status];
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{item.categoryLabel}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {item.similarityScore !== undefined && (
                      <Badge tone={item.similarityScore <= 25 ? 'seller' : 'danger'} icon="shield">
                        Độ trùng lặp: {item.similarityScore}% —{' '}
                        {item.similarityScore <= 25 ? 'Hợp lệ' : 'Cảnh báo'}
                      </Badge>
                    )}
                    {item.honorCodeAccepted && (
                      <Badge tone="chat" icon="verified">
                        Honor Code Attested
                      </Badge>
                    )}
                  </div>
                  {item.lessonId ? (
                    <LocaleLink
                      href={`/learn/${item.lessonId}`}
                      className="block text-sm font-semibold text-primary hover:text-brand"
                    >
                      {item.title}
                    </LocaleLink>
                  ) : (
                    <p className="text-sm font-semibold text-primary">{item.title}</p>
                  )}
                  <p className="text-xs text-secondary">
                    Hạn nộp cá nhân hóa: <strong className="font-medium text-primary">{item.dueDate}</strong> · Trọng số:{' '}
                    {item.weightPercent}%
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-xs text-secondary">Điểm đạt được</span>
                    <span className="text-base font-semibold text-primary">
                      {item.score !== null ? `${item.score}/${item.maxScore}` : `--/${item.maxScore}`}
                    </span>
                  </div>
                  {item.lessonId && (
                    <ButtonLink href={`/learn/${item.lessonId}`} variant="outline" size="xs">
                      Mở bài →
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
