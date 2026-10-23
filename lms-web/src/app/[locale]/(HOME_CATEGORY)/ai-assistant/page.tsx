'use client';

import React from 'react';
import { Container } from '../_components/Container';
import { Badge, Card, PageHeader } from '../_components/ui';
import { TutorPanel } from '@/features/ai-tutor/TutorPanel';
import { MOCK_COURSES } from '@/api/mockData';

export default function StandaloneAiAssistantPage() {
  const defaultLesson = MOCK_COURSES[0].modules[0].lessons[0];

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Trợ lý Ảo AI Giải thích Học thuật Đa phương thức"
        description="Kết nối trực tiếp với kho Vector ngữ nghĩa pgvector (1536 chiều), Hồ sơ Học vụ Sinh viên và GPT-4o Vision."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="chat" icon="sparkles">
              3-Tier RAG + Vision
            </Badge>
            <Badge tone="seller" icon="verified_user">
              Sentence-Chunked Voice TTS
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TutorPanel lesson={defaultLesson} />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card padding="md" className="space-y-3">
            <h3 className="text-base font-semibold text-primary">
              Kiến trúc Truy hồi Ngữ cảnh 3 Tầng (3-Tier RAG)
            </h3>
            <div className="space-y-2.5 text-xs text-secondary">
              <div className="rounded-xl bg-muted p-3 space-y-1">
                <p className="font-semibold text-primary">Tầng 1: pgvector Cosine Semantic Search</p>
                <p>
                  Nhúng câu hỏi và tín hiệu bối rối thành vector 1536 chiều (`text-embedding-3-small`) để tìm phân đoạn
                  bài giảng có độ tương đồng ngữ nghĩa cao nhất.
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3 space-y-1">
                <p className="font-semibold text-primary">Tầng 2: VideoSegments Timestamp Match</p>
                <p>
                  Khớp trực tiếp với phân đoạn 5–7 phút tại mốc thời gian sinh viên đang dừng hoặc tua lại nhiều lần.
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3 space-y-1">
                <p className="font-semibold text-primary">Tầng 3: Transcript Window Slicing (±45s)</p>
                <p>
                  Cắt cửa sổ phụ đề lân cận kết hợp ảnh chụp khung hình Slide hiện tại qua GPT-4o Vision.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}
