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
  Textarea,
  formClass,
  segmented,
} from '../../_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { CodingLabPanel } from '@/features/coding-lab/CodingLabPanel';
import {
  MOCK_ASSIGNMENTS,
  MOCK_CODING_CHALLENGES,
  MOCK_TASKS,
} from '@/api/mockData';
import type { AssignmentItem, TaskItem } from '@/api/types';

export default function StudentTasksAndAssignmentsPage() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'coding_labs' | 'kanban'>(
    'assignments',
  );
  const [tasks, setTasks] = useState<TaskItem[]>(MOCK_TASKS);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(MOCK_ASSIGNMENTS);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [honorCodeAccepted, setHonorCodeAccepted] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number>(
    MOCK_CODING_CHALLENGES[0]?.id || 1,
  );
  const [codeSubmission, setCodeSubmission] = useState(
    'def compute_ear_and_eyelock(landmarks_478):\n    # Cài đặt tính độ mở mắt EAR và phương sai Var(EAR) < 0.002\n    return {"ear": 0.25, "eye_locked": True}',
  );

  const moveTask = (id: number, nextStatus: TaskItem['status']) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTasks([
      {
        id: Date.now(),
        title: newTaskTitle.trim(),
        description: 'Nhiệm vụ học tập cá nhân',
        courseTag: 'CS401',
        dueDate: '28/10/2026',
        status: 'todo',
        priority: 'medium',
      },
      ...tasks,
    ]);
    setNewTaskTitle('');
  };

  const handleResubmitAssignment = () => {
    if (!selectedAssignment || !honorCodeAccepted) return;
    const prevSub = selectedAssignment.submissions[0];
    const nextVersion = (prevSub?.version || 1) + 1;

    const updatedSub = {
      ...prevSub,
      version: nextVersion,
      submittedAt: 'Vừa xong',
      status: 'graded' as const,
      codeContent: codeSubmission,
      autoGrade: 96,
      autoGradeConfidence: 0.94,
      similarityScore: 4.2,
      honorCodeAccepted: true,
    };

    const nextList = assignments.map((a) =>
      a.id === selectedAssignment.id ? { ...a, submissions: [updatedSub] } : a,
    );
    setAssignments(nextList);
    setSelectedAssignment(null);
    setHonorCodeAccepted(false);
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Bài tập Lớn AI Rubric · Phòng Lab Lập trình & Bảng Kanban"
        description="Nộp bài tập đa phiên bản kèm Cam kết Danh dự Học thuật (Coursera Honor Code), kiểm tra Độ trùng lặp (Originality Score) và chạy Test Cases tự động."
      />

      <div className={segmented.list} role="tablist" aria-label="Chuyển đổi Bài tập, Coding Lab và Kanban">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'assignments'}
          onClick={() => setActiveTab('assignments')}
          className={segmented.tab}
        >
          Bài tập Lớp học & AI Auto-Grader ({assignments.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'coding_labs'}
          onClick={() => setActiveTab('coding_labs')}
          className={segmented.tab}
        >
          Phòng Lab Lập trình ({MOCK_CODING_CHALLENGES.length} Coding Labs)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'kanban'}
          onClick={() => setActiveTab('kanban')}
          className={segmented.tab}
        >
          Bảng Kanban Cá nhân ({tasks.length})
        </button>
      </div>

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {assignments.map((asg) => {
            const sub = asg.submissions[0];
            const simScore = sub?.similarityScore ?? 4.2;
            const isSimWarning = simScore > 25;
            return (
              <Card key={asg.id} padding="md" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{asg.classCode}</Badge>
                    <Badge tone="info">Hạn nộp: {asg.dueDate}</Badge>
                    <Badge tone="seller">+{asg.rewardPoints} XP</Badge>
                    {sub && (
                      <Badge
                        tone={isSimWarning ? 'danger' : 'success'}
                        icon="verified"
                      >
                        Độ trùng lặp: {simScore}% — {isSimWarning ? 'Cảnh báo (>25%)' : 'Hợp lệ'}
                      </Badge>
                    )}
                  </div>
                  {sub && (
                    <Badge tone="chat" icon="sparkles">
                      Phiên bản v{sub.version} · AI Auto-Grade: {sub.autoGrade ?? sub.grade}/{sub.maxGrade} (Độ tin cậy{' '}
                      {Math.round((sub.autoGradeConfidence ?? 0.91) * 100)}%)
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-primary">{asg.title}</h3>
                  <p className="mt-1 text-sm text-secondary">{asg.description}</p>
                </div>

                {/* Rubric Criteria Grid */}
                <div className="rounded-xl bg-muted p-4 space-y-2.5">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
                    Bảng Tiêu chí Chấm điểm Tự động AI (Structured JSON Rubric):
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                    {asg.rubric.map((crit) => {
                      const evalItem = sub?.rubricEvaluation?.find((e) => e.criterionId === crit.id);
                      return (
                        <div key={crit.id} className="rounded-lg bg-white p-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary">{crit.criterion}</span>
                            <Badge tone="success">
                              {evalItem ? `${evalItem.score}/${crit.maxPoints}` : `${crit.maxPoints}đ`}
                            </Badge>
                          </div>
                          <p className="text-secondary">{evalItem?.comment || crit.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span>
                      {sub ? `Đã nộp lần cuối: ${sub.submittedAt} (${sub.fileName || 'code.py'})` : 'Chưa nộp bài'}
                    </span>
                    {sub?.honorCodeAccepted !== false && (
                      <Badge tone="neutral">Đã xác nhận Cam kết Danh dự (Honor Code)</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedAssignment(asg);
                      setHonorCodeAccepted(false);
                    }}
                  >
                    <Icon name="code" size="sm" />
                    Nộp phiên bản mới & Chấm thử bằng AI
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'coding_labs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-secondary">Chọn bài thực hành Coding Lab:</span>
            {MOCK_CODING_CHALLENGES.map((ch) => (
              <Button
                key={ch.id}
                size="xs"
                variant={selectedChallengeId === ch.id ? 'primary' : 'outline'}
                onClick={() => setSelectedChallengeId(ch.id)}
              >
                <Icon name="code" size="xs" />
                {ch.title}
              </Button>
            ))}
          </div>

          <CodingLabPanel initialChallengeId={selectedChallengeId} />
        </div>
      )}

      {activeTab === 'kanban' && (
        <div className="space-y-4">
          <Card padding="sm">
            <form onSubmit={handleAddTask} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  compact
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Thêm công việc học tập mới vào cột Cần làm..."
                />
              </div>
              <Button type="submit" variant="primary" size="sm">
                Thêm nhiệm vụ
              </Button>
            </form>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(
              [
                { key: 'todo', title: 'Cần làm (To Do)', badgeTone: 'warning' },
                { key: 'in_progress', title: 'Đang thực hiện (In Progress)', badgeTone: 'info' },
                { key: 'done', title: 'Đã hoàn thành (Done)', badgeTone: 'success' },
              ] as const
            ).map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key);
              return (
                <Card key={col.key} padding="md" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">{col.title}</h3>
                    <Badge tone={col.badgeTone}>{colTasks.length}</Badge>
                  </div>

                  <div className="space-y-2.5">
                    {colTasks.map((t) => (
                      <div key={t.id} className="rounded-xl bg-muted p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge tone="brand">{t.courseTag}</Badge>
                          <span className="text-xs text-secondary">Hạn: {t.dueDate}</span>
                        </div>
                        <p className="text-sm font-semibold text-primary">{t.title}</p>
                        <p className="text-xs text-secondary">{t.description}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {col.key !== 'todo' && (
                            <Button size="xs" variant="outline" onClick={() => moveTask(t.id, 'todo')}>
                              ← Cần làm
                            </Button>
                          )}
                          {col.key !== 'in_progress' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => moveTask(t.id, 'in_progress')}
                            >
                              Đang làm
                            </Button>
                          )}
                          {col.key !== 'done' && (
                            <Button size="xs" variant="primary" onClick={() => moveTask(t.id, 'done')}>
                              Hoàn thành ✓
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignment Resubmission & AI Rubric Grading Dialog with Coursera Honor Code */}
      <Dialog
        open={Boolean(selectedAssignment)}
        onClose={() => setSelectedAssignment(null)}
        size="lg"
      >
        {selectedAssignment && (
          <>
            <DialogTitle>Nộp Bài tập & Chấm thử Tự động bằng AI Rubric</DialogTitle>
            <DialogDescription>
              {selectedAssignment.title} · Hệ thống tự động lưu số phiên bản (`version`), kiểm tra Độ trùng lặp mã nguồn (Originality Check) và chấm từng tiêu chí Rubric.
            </DialogDescription>
            <DialogBody className="space-y-4">
              <Textarea
                value={codeSubmission}
                onChange={(e) => setCodeSubmission(e.target.value)}
                className="text-xs"
              />

              {/* Coursera Honor Code Attestation Checkbox (Workflow #7) */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-muted p-3.5 text-xs text-primary">
                <input
                  type="checkbox"
                  checked={honorCodeAccepted}
                  onChange={(e) => setHonorCodeAccepted(e.target.checked)}
                  className={formClass.checkbox}
                />
                <span>
                  <strong>Cam kết Danh dự Học thuật (Coursera Honor Code):</strong> Tôi cam kết bài nộp này là công sức tự thực hiện của cá nhân tôi, không sao chép trái phép hoặc vi phạm quy chế liêm chính học thuật.
                </span>
              </label>
            </DialogBody>
            <DialogActions>
              <Button variant="outline" onClick={() => setSelectedAssignment(null)}>
                Đóng
              </Button>
              <Button
                variant="chat"
                disabled={!honorCodeAccepted}
                onClick={handleResubmitAssignment}
              >
                <Icon name="sparkles" size="sm" />
                Nộp Phiên bản Mới & Chạy AI Auto-Grader
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}
