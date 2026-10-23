'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
} from '../../_components/ui';
import { MOCK_ASSIGNMENTS } from '@/api/mockData';

export default function TeacherAssignmentsGradingPage() {
  const [assignments, setAssignments] = useState(MOCK_ASSIGNMENTS);
  const [approvedSubIds, setApprovedSubIds] = useState<number[]>([]);

  const handleOverrideGrade = (
    assignmentId: number,
    submissionId: number,
    newScore: string,
  ) => {
    const num = Number(newScore);
    if (Number.isNaN(num)) return;
    setAssignments(
      assignments.map((a) => {
        if (a.id !== assignmentId) return a;
        return {
          ...a,
          submissions: a.submissions.map((sub) =>
            sub.id === submissionId
              ? { ...sub, grade: Math.min(100, Math.max(0, num)) }
              : sub,
          ),
        };
      }),
    );
  };

  const handleApproveAndPublish = (submissionId: number) => {
    setApprovedSubIds(Array.from(new Set([...approvedSubIds, submissionId])));
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Duyệt Điểm Tự động AI Auto-Grader & Kiểm tra Độ Trùng lặp (Originality Score)"
        description="Hệ thống AI tự động phân tích mã nguồn theo tiêu chí Rubric, kiểm tra tỷ lệ đạo văn/trùng lặp AST (cảnh báo khi > 25%) và xác nhận Cam kết Danh dự Học thuật."
      />

      <div className="space-y-6">
        {assignments.map((asg) => (
          <Card key={asg.id} padding="md" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="seller">{asg.classCode}</Badge>
                <h2 className="text-base font-semibold text-primary">{asg.title}</h2>
              </div>
              <Badge tone="neutral">
                {asg.submissions.length} bài nộp từ sinh viên
              </Badge>
            </div>

            <div className="space-y-4">
              {asg.submissions.map((sub) => {
                const isPublished = approvedSubIds.includes(sub.id);
                const simScore = sub.similarityScore ?? 4.2;
                const isHighSimilarity = simScore > 25;

                return (
                  <div
                    key={sub.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      isHighSimilarity
                        ? 'border-danger/40 bg-danger-subtle'
                        : 'border-line bg-muted'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary">
                          Bài nộp: {sub.studentName} ({sub.studentCode}) · Phiên bản v{sub.version}
                        </span>
                        <Badge
                          tone={isHighSimilarity ? 'danger' : 'success'}
                          icon="verified"
                        >
                          Độ trùng lặp: {simScore}% —{' '}
                          {isHighSimilarity ? 'Cảnh báo (>25%)' : 'Hợp lệ'}
                        </Badge>
                        {sub.honorCodeAccepted !== false && (
                          <Badge tone="neutral">Honor Code ✓</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="chat" icon="sparkles">
                          AI Auto-Grade: {sub.autoGrade ?? sub.grade}/{sub.maxGrade} (Tin cậy{' '}
                          {Math.round((sub.autoGradeConfidence ?? 0.92) * 100)}%)
                        </Badge>
                        {isPublished && <Badge tone="success">Đã công bố điểm</Badge>}
                        <span className="text-secondary">Nộp: {sub.submittedAt}</span>
                      </div>
                    </div>

                    <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs text-primary border border-line">
                      {sub.codeContent}
                    </pre>

                    {/* Rubric Breakdown */}
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                      {sub.rubricEvaluation?.map((ev) => (
                        <div key={ev.criterionId} className="rounded-lg bg-white p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary">{ev.criterionName}</span>
                            <Badge tone="seller">
                              {ev.score}/{ev.maxPoints}đ
                            </Badge>
                          </div>
                          <p className="text-secondary">{ev.comment}</p>
                        </div>
                      ))}
                    </div>

                    {/* Instructor Approval & Override Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">Điểm chính thức:</span>
                        <Input
                          compact
                          type="number"
                          value={String(sub.grade ?? sub.autoGrade ?? 95)}
                          onChange={(e) =>
                            handleOverrideGrade(asg.id, sub.id, e.target.value)
                          }
                          className="w-24"
                        />
                        <span className="text-xs text-secondary">/ {sub.maxGrade}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="seller"
                        onClick={() => handleApproveAndPublish(sub.id)}
                      >
                        <Icon name="checkCircle" size="sm" />
                        {isPublished
                          ? 'Đã duyệt & Gửi thông báo cho Sinh viên'
                          : 'Duyệt điểm AI & Công bố'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
