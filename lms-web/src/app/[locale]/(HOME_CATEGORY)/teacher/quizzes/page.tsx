'use client';

import React, { useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  Card,
  PageHeader,
} from '../../_components/ui';
import { MOCK_QUIZZES } from '@/api/mockData';

export default function TeacherQuizzesPage() {
  const [hostedPin, setHostedPin] = useState('AI2026');

  const handleRegeneratePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setHostedPin(pin);
  };

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Ngân hàng Câu hỏi Thích ứng & Điều phối Phòng Đấu Multiplayer"
        description="Quản lý câu hỏi trắc nghiệm gắn với từng phân đoạn video 5–7 phút và mở phòng thi đấu trực tuyến trên lớp qua mã PIN 6 ký tự."
        actions={
          <Button variant="seller" size="sm" onClick={handleRegeneratePin}>
            <Icon name="bolt" size="sm" />
            Tạo Mã Phòng Đấu Mới (PIN: {hostedPin})
          </Button>
        }
      />

      <Card padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Badge tone="chat">WebSocket GameManager Host</Badge>
            <h2 className="mt-1 text-base font-semibold text-primary">
              Mã PIN Phòng Đấu Trực tuyến Hiện tại: <span className="text-seller">{hostedPin}</span>
            </h2>
          </div>
          <span className="text-xs text-secondary">
            4 sinh viên đang kết nối trực tuyến · Hỗ trợ trợ giúp 50:50 và x2 Điểm
          </span>
        </div>
      </Card>

      <div className="space-y-4">
        {MOCK_QUIZZES.map((qz) => (
          <Card key={qz.id} padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="seller">Độ khó: {qz.difficulty.toUpperCase()}</Badge>
                <span className="text-xs text-secondary">{qz.subjectContext}</span>
              </div>
              <Badge tone="info">{qz.questions.length} câu hỏi chuẩn hóa</Badge>
            </div>
            <h3 className="text-base font-semibold text-primary">{qz.title}</h3>
            <div className="space-y-2">
              {qz.questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl bg-muted p-3.5 text-xs space-y-1">
                  <p className="font-semibold text-primary">
                    Câu {idx + 1}: {q.question}
                  </p>
                  <p className="text-seller font-medium">
                    Đáp án đúng: {q.options[q.correctIndex]}
                  </p>
                  <p className="text-secondary">Giải thích AI: {q.explanation}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
