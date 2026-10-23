'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  PageHeader,
} from '../../_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { formatSeconds } from '@/lib/utils';
import { MOCK_COURSES } from '@/api/mockData';

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState(MOCK_COURSES);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('CS405');

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCourses([
      {
        ...MOCK_COURSES[0],
        id: Date.now(),
        title: newTitle.trim(),
        code: newCode.trim() || 'CS405',
        studentsCount: 45,
      },
      ...courses,
    ]);
    setNewTitle('');
    setCreateDialogOpen(false);
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Quản lý Học phần, Phụ đề Whisper & Phân đoạn Video 5–7 Phút"
        description="Tự động trích xuất phụ đề từ video bài giảng, băm thành các phân đoạn 5–7 phút kèm vector ngữ nghĩa 1536 chiều (`pgvector`) và câu hỏi Quiz kiểm tra."
        actions={
          <Button variant="seller" size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Icon name="add" size="sm" />
            Tạo Học phần Mới
          </Button>
        }
      />

      <div className="space-y-4">
        {courses.map((course) => (
          <Card key={course.id} padding="md" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="seller">{course.code}</Badge>
                <Badge tone="info">{course.credits} tín chỉ</Badge>
                <Badge tone="chat" icon="sparkles">
                  pgvector 1536-d Ready
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">{course.studentsCount} sinh viên</span>
                <ButtonLink href={`/courses/${course.id}`} variant="outline" size="xs">
                  Xem trang Học phần
                </ButtonLink>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-primary">{course.title}</h2>
              <p className="mt-1 text-sm text-secondary">{course.description}</p>
            </div>

            {/* Modules & 5-7m VideoSegments Pipeline Status */}
            <div className="space-y-3">
              {course.modules.map((mod) => (
                <div key={mod.id} className="rounded-xl bg-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{mod.title}</span>
                    <Badge tone="success">{mod.lessons.length} bài giảng đã nhúng Vector</Badge>
                  </div>

                  <div className="space-y-2">
                    {mod.lessons.map((les) => (
                      <div
                        key={les.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-primary">{les.title}</p>
                          <p className="mt-0.5 text-secondary">
                            {les.segments.length} phân đoạn 5–7p:{' '}
                            {les.segments
                              .map(
                                (s) =>
                                  `#${s.segmentIndex} (${formatSeconds(s.startTimestamp)}-${formatSeconds(
                                    s.endTimestamp,
                                  )})`,
                              )
                              .join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="seller">Transcript: {les.transcriptStatus.toUpperCase()}</Badge>
                          <ButtonLink href={`/learn/${les.id}`} variant="soft-seller" size="xs">
                            Mở Player
                          </ButtonLink>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} size="md">
        <DialogTitle>Khởi tạo Học phần Mới (Tự động Phân đoạn & Nhúng RAG)</DialogTitle>
        <DialogDescription>
          Video tải lên sẽ được tự động nhận dạng giọng nói Whisper, chia thành các chặng 5–7 phút và sinh câu hỏi Quiz.
        </DialogDescription>
        <form onSubmit={handleCreateCourse}>
          <DialogBody className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-primary">Mã học phần</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-primary">Tên học phần</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Học sâu cho Nhận diện Cảm xúc Đa phương thức"
                required
              />
            </div>
          </DialogBody>
          <DialogActions>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="seller">
              Tạo Học phần
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}
