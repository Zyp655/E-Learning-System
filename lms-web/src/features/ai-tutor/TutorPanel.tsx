'use client';

import React, { useState } from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import {
  Badge,
  Button,
  Card,
  Input,
  chipVariants,
  segmented,
} from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { formatSeconds } from '@/lib/utils';
import { useTutorStore } from '@/store/useTutorStore';
import { useLearnStore } from '@/store/useLearnStore';
import { useAccountStore } from '@/store/useAccountStore';
import type { LessonItem, TutorPersona } from '@/api/types';

interface TutorPanelProps {
  lesson: LessonItem;
}

const PERSONA_OPTIONS: { id: TutorPersona; label: string; desc: string }[] = [
  { id: 'socrates', label: 'Socrates', desc: 'Đặt câu hỏi gợi mở tư duy' },
  { id: 'coach', label: 'Coach', desc: 'Hướng dẫn từng bước dễ hiểu' },
  { id: 'expert', label: 'Expert', desc: 'Phân tích toán học & mã nguồn sâu' },
];

export function TutorPanel({ lesson }: TutorPanelProps) {
  const [questionInput, setQuestionInput] = useState('');
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [conceptMapModalOpen, setConceptMapModalOpen] = useState(false);

  const { profile } = useAccountStore();
  const { currentTimeSec, requestSeek } = useLearnStore();
  const {
    persona,
    messages,
    streamingText,
    isStreaming,
    attachedFrameBase64,
    attachedFrameTimestampSec,
    voiceModeActive,
    isRecordingVoice,
    isPlayingTts,
    currentTtsSentence,
    setPersona,
    attachVideoFrame,
    sendMessage,
    setVoiceModeActive,
    simulateVoiceQuestion,
    clearHistory,
  } = useTutorStore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || isStreaming) return;
    const q = questionInput;
    setQuestionInput('');
    await sendMessage(q, lesson.id, currentTimeSec);
  };

  const quickPrompts = [
    'Giải thích công thức EAR và điều kiện Eye-Lock tại mốc [03:45]?',
    'Tại sao cần kết hợp BiLSTM với Temporal Attention cho nhận diện AU4/AU7?',
    'Cho ví dụ code PyTorch tính trọng số alpha_t trong bài giảng?',
  ];

  return (
    <>
      <Card padding="md" className="flex flex-col space-y-4">
        {/* Top Header: Student Academic Profile Context + AI Summary / Concept Map Tools */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-chat-subtle text-chat">
                <Icon name="sparkles" size="xs" />
              </span>
              <h3 className="text-sm font-semibold text-primary">
                Trợ lý AI Giải thích Đa phương thức (RAG 3 Tầng + Vision)
              </h3>
            </div>
            <p className="text-xs text-secondary">
              Ngữ cảnh cá nhân hóa: <strong className="font-semibold text-primary">{profile.major}</strong> · Năm{' '}
              {profile.academicYear} ({profile.studentClass})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSummaryModalOpen(true)}
              className={chipVariants({ variant: 'subtle', size: 'xs' })}
            >
              <Icon name="documentText" size="xs" />
              Tóm tắt AI
            </button>
            <button
              type="button"
              onClick={() => setConceptMapModalOpen(true)}
              className={chipVariants({ variant: 'subtle', size: 'xs' })}
            >
              <Icon name="map" size="xs" />
              Sơ đồ Khái niệm
            </button>
            <button
              type="button"
              onClick={clearHistory}
              className={chipVariants({ variant: 'default', size: 'xs' })}
            >
              Làm mới
            </button>
          </div>
        </div>

        {/* 3 Pedagogical Personas Switcher (StrongBody segmented control) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={segmented.list} role="tablist" aria-label="Phong cách sư phạm">
            {PERSONA_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={persona === p.id}
                onClick={() => setPersona(p.id)}
                className={segmented.tab}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-secondary">
            {PERSONA_OPTIONS.find((p) => p.id === persona)?.desc}
          </span>
        </div>

        {/* 2-Way Voice Mode Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Icon name="microphone" size="xs" className="text-chat" />
            <span className="font-medium text-primary">Đàm thoại Giọng nói 2 chiều (STT + Sentence TTS):</span>
            {isRecordingVoice && <Badge variant="danger">Đang thu âm câu hỏi...</Badge>}
            {isPlayingTts && <Badge variant="chat">Đang đọc câu trả lời...</Badge>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant={voiceModeActive ? 'chat' : 'outline'}
              onClick={() => setVoiceModeActive(!voiceModeActive)}
            >
              {voiceModeActive ? 'Tắt đọc tự động' : 'Bật Voice TTS'}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={isRecordingVoice || isStreaming}
              onClick={() => simulateVoiceQuestion(lesson.id, currentTimeSec)}
            >
              <Icon name="microphone" size="xs" />
              Hỏi bằng Giọng nói
            </Button>
          </div>
        </div>

        {currentTtsSentence && (
          <div className="rounded-xl bg-chat-subtle px-3 py-2 text-xs text-chat">
            Đang phát âm thanh: &ldquo;{currentTtsSentence}&rdquo;
          </div>
        )}

        {/* Messages Stream */}
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                role={msg.isError ? 'alert' : undefined}
                className={`rounded-xl p-3.5 text-sm ${
                  isUser ? 'bg-chat-subtle text-primary ml-6' : msg.isError ? 'bg-danger-50 text-primary mr-2' : 'bg-muted text-primary mr-2'
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                  <span className="font-semibold text-primary">
                    {isUser
                      ? `${profile.fullName} (Tại mốc ${formatSeconds(msg.videoTimestampSec ?? currentTimeSec)})`
                      : msg.isError
                        ? 'AI Tutor · Không thể trả lời'
                        : `AI Tutor · Phong cách ${(msg.persona || persona).toUpperCase()}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {msg.retrievalTier && <Badge variant="info">{msg.retrievalTier}</Badge>}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Attached video frame thumbnail if user captured slide */}
                {msg.attachedFrameBase64 && (
                  <div className="mb-2 overflow-hidden rounded-lg border border-line bg-gray-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.attachedFrameBase64}
                      alt="Captured Video Frame"
                      className="h-28 w-full object-contain"
                    />
                    <div className="bg-gray-900 px-2.5 py-1 text-xs text-white">
                      Khung hình bài giảng đính kèm tại{' '}
                      {formatSeconds(msg.videoTimestampSec ?? currentTimeSec)}
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-line leading-relaxed text-sm text-primary">
                  {msg.content}
                </div>

                {/* Clickable [mm:ss] Timestamp Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                    <span className="text-xs text-tertiary">Trích dẫn mốc thời gian:</span>
                    {msg.citations.map((cit, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => requestSeek(cit.seconds, true)}
                        className={chipVariants({ variant: 'default', size: 'xs' })}
                      >
                        <Icon name="play" size="xs" className="text-chat" />[{cit.timeLabel}]{' '}
                        {cit.snippet}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isStreaming && (
            <div className="rounded-xl bg-muted p-3.5 text-sm text-primary">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-chat">
                <Icon name="sparkles" size="xs" />
                <span>Đang truyền phát câu trả lời (SSE Token Streaming)...</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed">{streamingText || '...'}</div>
            </div>
          )}
        </div>

        {/* Attached Frame Preview before sending */}
        {attachedFrameBase64 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-chat-subtle p-2.5">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedFrameBase64}
                alt="Frame preview"
                className="h-12 w-20 rounded-lg border border-line object-cover"
              />
              <div className="text-xs">
                <span className="block font-semibold text-primary">
                  Đã đính kèm khung hình Slide tại mốc {formatSeconds(attachedFrameTimestampSec ?? currentTimeSec)}
                </span>
                <span className="text-secondary">
                  AI Vision sẽ đọc trực tiếp công thức và đoạn code trên khung hình này
                </span>
              </div>
            </div>
            <Button size="xs" variant="ghost" onClick={() => attachVideoFrame(null)}>
              Gỡ ảnh
            </Button>
          </div>
        )}

        {/* Quick Suggested Prompts */}
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isStreaming}
              onClick={() => sendMessage(qp, lesson.id, currentTimeSec)}
              className={chipVariants({ variant: 'subtle', size: 'xs' })}
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Question Input Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={`Hỏi AI theo phong cách ${persona.toUpperCase()} tại mốc ${formatSeconds(currentTimeSec)}...`}
            />
          </div>
          <Button type="submit" variant="chat" disabled={isStreaming || !questionInput.trim()}>
            <Icon name="paperAirplane" size="sm" />
            Gửi
          </Button>
        </form>
      </Card>

      {/* AI Lesson Summary Modal */}
      <Dialog open={summaryModalOpen} onClose={() => setSummaryModalOpen(false)} size="lg">
        <DialogTitle>Tóm tắt Bài giảng Tự động & Công thức Trọng tâm</DialogTitle>
        <DialogDescription>
          Tổng hợp tự động từ phụ đề và các phân đoạn 5–7 phút của bài học: {lesson.title}
        </DialogDescription>
        <DialogBody className="space-y-3">
          <div className="rounded-xl bg-muted p-4 text-sm leading-relaxed text-primary">
            {lesson.summary}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Tóm tắt theo từng phân đoạn 5–7 phút:
            </h4>
            {lesson.segments.map((seg) => (
              <div key={seg.id} className="rounded-xl bg-muted p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    Phân đoạn #{seg.segmentIndex}: {seg.title}
                  </span>
                  <Badge variant="chat">
                    {formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)}
                  </Badge>
                </div>
                <p className="text-xs text-secondary">{seg.summary}</p>
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogActions>
          <Button variant="chat" onClick={() => setSummaryModalOpen(false)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Concept Map Modal */}
      <Dialog open={conceptMapModalOpen} onClose={() => setConceptMapModalOpen(false)} size="lg">
        <DialogTitle>Sơ đồ Khái niệm Bài giảng (AI Knowledge Graph)</DialogTitle>
        <DialogDescription>
          Cấu trúc liên kết các khái niệm cốt lõi trong bài học giúp bạn hệ thống hóa kiến thức nhanh chóng.
        </DialogDescription>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-3.5 space-y-1.5">
              <Badge variant="info">Tầng 1: Tiền xử lý Thị giác</Badge>
              <p className="text-sm font-semibold text-primary">MediaPipe 478 3D Landmarks</p>
              <p className="text-xs text-secondary">
                Chuẩn hóa ánh sáng yếu (Lum &lt; 90) · Tọa độ mắt p1..p6 · Đầu mũi #1
              </p>
            </div>
            <div className="rounded-xl bg-muted p-3.5 space-y-1.5">
              <Badge variant="warning">Tầng 2: Đặc trưng Hành vi & Ánh nhìn</Badge>
              <p className="text-sm font-semibold text-primary">Eye-Lock & 12-Feature Vector</p>
              <p className="text-xs text-secondary">
                EAR &gt; 0.22 + Var(EAR) &lt; 0.002 + Nose Drift &lt; 3.5px → Khuếch đại x1.6
              </p>
            </div>
            <div className="rounded-xl bg-muted p-3.5 space-y-1.5">
              <Badge variant="chat">Tầng 3: Can thiệp Sư phạm</Badge>
              <p className="text-sm font-semibold text-primary">3-Tier pgvector RAG + Vision</p>
              <p className="text-xs text-secondary">
                Truy hồi đoạn phụ đề 1536 chiều + cá nhân hóa theo ngành học sinh viên
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button variant="chat" onClick={() => setConceptMapModalOpen(false)}>
            Hoàn tất
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
