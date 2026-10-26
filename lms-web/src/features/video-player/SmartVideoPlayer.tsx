'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  chipVariants,
} from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog';
import { formatSeconds } from '@/lib/utils';
import { useLearnStore } from '@/store/useLearnStore';
import { useConfusionStore } from '@/store/useConfusionStore';
import { useTutorStore } from '@/store/useTutorStore';
import type { LessonItem, VideoSegment } from '@/api/types';

interface SmartVideoPlayerProps {
  lesson: LessonItem;
}

const SELF_REPORT_LEVELS: {
  level: 1 | 2 | 3 | 4;
  label: string;
  desc: string;
  tone: 'default' | 'subtle' | 'primary';
}[] = [
  { level: 1, label: '1. Hiểu rõ', desc: 'Nắm vững nội dung', tone: 'default' },
  { level: 2, label: '2. Hơi mơ hồ', desc: 'Cần xem kỹ thêm', tone: 'default' },
  { level: 3, label: '3. Đang bối rối', desc: 'Mở AI giải thích ngay', tone: 'subtle' },
  { level: 4, label: '4. Rất khó hiểu', desc: 'Cần ví dụ & công thức', tone: 'primary' },
];

export function SmartVideoPlayer({ lesson }: SmartVideoPlayerProps) {
  const slideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pauseStartRef = useRef<number | null>(null);

  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{
    correct: boolean;
    message: string;
    mustRewind?: boolean;
  } | null>(null);
  const [rewindAlertMessage, setRewindAlertMessage] = useState<string | null>(null);
  const [frameCaptureSuccess, setFrameCaptureSuccess] = useState(false);

  const {
    currentTimeSec,
    maxWatchedSec,
    isPlaying,
    playbackSpeed,
    antiSkipNotice,
    activeSegmentQuizId,
    segmentAttempts,
    passedSegments,
    verifyWatchingModalOpen,
    setCurrentTimeSec,
    setIsPlaying,
    setPlaybackSpeed,
    requestSeek,
    clearAntiSkipNotice,
    openSegmentQuiz,
    closeSegmentQuiz,
    recordSegmentQuizAttempt,
    setVerifyWatchingModalOpen,
  } = useLearnStore();

  const {
    emotionTimeline,
    recordVideoPause,
    recordVideoRewind,
    recordSpeedChange,
    recordQuizOutcome,
    submitSelfReport,
    triggerProactiveIntervention,
    nudgeOpen,
    respondToConfusionNudge,
  } = useConfusionStore();

  const { attachVideoFrame } = useTutorStore();

  // Determine current active 5-7 min VideoSegment
  const activeSegment: VideoSegment =
    lesson.segments.find(
      (seg) => currentTimeSec >= seg.startTimestamp && currentTimeSec <= seg.endTimestamp,
    ) ||
    lesson.segments[0];

  const activeQuizSegment = lesson.segments.find((s) => s.id === activeSegmentQuizId) || null;

  // Quiz branch inputs must match training (ASSISTments): correctness 0/100, seconds on the question, attempts.
  const quizShownAtRef = useRef<number>(Date.now());
  const quizAttemptsRef = useRef<number>(0);
  useEffect(() => {
    quizShownAtRef.current = Date.now();
    quizAttemptsRef.current = 0;
  }, [activeSegmentQuizId]);

  // Render high-DPI interactive lecture slide onto canvas so frame capture (GPT-4o Vision RAG) works 100% reliably
  const renderLectureSlide = useCallback(() => {
    const canvas = slideCanvasRef.current;
    if (!canvas || !activeSegment) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark academic slide background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Top accent bar
    ctx.fillStyle = '#0866ff';
    ctx.fillRect(0, 0, w, 6);

    // Header metadata
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px sans-serif';
    ctx.fillText(
      `BÀI GIẢNG AI & THỊ GIÁC MÁY TÍNH · PHÂN ĐOẠN #${activeSegment.segmentIndex} (${formatSeconds(
        activeSegment.startTimestamp,
      )} - ${formatSeconds(activeSegment.endTimestamp)})`,
      32,
      38,
    );

    // Slide Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(activeSegment.title, 32, 74);

    // Key Formula Box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(32, 96, w - 64, 96);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32, 96, w - 64, 96);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 13px sans-serif';
    ctx.fillText('CÔNG THỨC TRỌNG TÂM TRÊN SLIDE (DÙNG CHO MULTI-MODAL VISION RAG):', 48, 122);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 17px monospace';
    const formulas = activeSegment.keyFormulas || [
      'EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)',
      'alpha_t = softmax(v^T * tanh(W_h * h_t))',
    ];
    formulas.slice(0, 2).forEach((f, idx) => {
      ctx.fillText(f, 48, 150 + idx * 26);
    });

    // Code Snippet / Summary Box
    ctx.fillStyle = '#090d16';
    ctx.fillRect(32, 208, w - 64, 134);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(32, 208, w - 64, 134);

    ctx.fillStyle = '#10b981';
    ctx.font = '600 12px monospace';
    ctx.fillText('// PyTorch / MediaPipe Implementation Snippet', 48, 232);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '400 13px monospace';
    const codeLines = (
      activeSegment.codeSnippet ||
      `def compute_gaze_boost(ear_avg, ear_var, nose_drift_px):\n    eye_locked = (ear_avg > 0.22) and (ear_var < 0.002)\n    gaze_still = nose_drift_px < 3.5\n    return 1.6 if (eye_locked and gaze_still) else 1.0`
    ).split('\n');
    codeLines.slice(0, 4).forEach((line, idx) => {
      ctx.fillText(line, 48, 256 + idx * 20);
    });

    // Bottom status bar inside slide
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h - 42, w, 42);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 13px sans-serif';
    ctx.fillText(
      `Mốc thời gian: ${formatSeconds(currentTimeSec)} / ${formatSeconds(lesson.durationSeconds)} · Tốc độ: ${playbackSpeed}x`,
      32,
      h - 16,
    );
    ctx.fillStyle = passedSegments[activeSegment.id] ? '#10b981' : '#f59e0b';
    ctx.fillText(
      passedSegments[activeSegment.id]
        ? '✓ Đã vượt qua Quiz phân đoạn'
        : '● Có Quiz kiểm tra cuối phân đoạn',
      w - 280,
      h - 16,
    );
  }, [activeSegment, currentTimeSec, lesson.durationSeconds, playbackSpeed, passedSegments]);

  useEffect(() => {
    renderLectureSlide();
  }, [renderLectureSlide]);

  // Playback timer tick
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const nextSec = Math.min(lesson.durationSeconds, currentTimeSec + 1);
      setCurrentTimeSec(nextSec);

      // Automatically open Segment Quiz when hitting the exact endTimestamp of an unpassed segment
      const finishedSeg = lesson.segments.find(
        (s) => nextSec === s.endTimestamp && !passedSegments[s.id],
      );
      if (finishedSeg) {
        setSelectedQuizOption(null);
        setQuizFeedback(null);
        openSegmentQuiz(finishedSeg.id);
      }
    }, Math.round(1000 / playbackSpeed));

    return () => clearInterval(interval);
  }, [
    isPlaying,
    currentTimeSec,
    lesson.durationSeconds,
    lesson.segments,
    passedSegments,
    playbackSpeed,
    setCurrentTimeSec,
    openSegmentQuiz,
  ]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      pauseStartRef.current = Date.now();
      setIsPlaying(false);
    } else {
      if (pauseStartRef.current) {
        const durSec = Number(((Date.now() - pauseStartRef.current) / 1000).toFixed(1));
        recordVideoPause(durSec);
        pauseStartRef.current = null;
      }
      setIsPlaying(true);
    }
  };

  const handleRewind15s = () => {
    const target = Math.max(0, currentTimeSec - 15);
    recordVideoRewind(currentTimeSec, target);
    requestSeek(target, true);
  };

  const handleForward15s = () => {
    const target = Math.min(lesson.durationSeconds, currentTimeSec + 15);
    requestSeek(target, false);
  };

  const handleSpeedSelect = (speed: number) => {
    setPlaybackSpeed(speed);
    recordSpeedChange(speed);
  };

  const handleCaptureFrameForTutor = () => {
    const canvas = slideCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    attachVideoFrame(dataUrl, currentTimeSec);
    setFrameCaptureSuccess(true);
    setTimeout(() => setFrameCaptureSuccess(false), 3000);
  };

  const handleSubmitSegmentQuiz = () => {
    if (selectedQuizOption === null || !activeQuizSegment) return;
    const isCorrect = selectedQuizOption === activeQuizSegment.quizQuestion.correctIndex;
    const now = Date.now();
    const answerTimeSec = Math.max(1, (now - quizShownAtRef.current) / 1000);
    quizAttemptsRef.current += 1;
    quizShownAtRef.current = now;

    if (isCorrect) {
      recordQuizOutcome(100, answerTimeSec, quizAttemptsRef.current);
      setQuizFeedback({
        correct: true,
        message: `Chính xác! ${activeQuizSegment.quizQuestion.explanation}`,
      });
      setTimeout(() => {
        recordSegmentQuizAttempt(activeQuizSegment.id, true, activeQuizSegment.startTimestamp);
        setQuizFeedback(null);
        setSelectedQuizOption(null);
      }, 1400);
    } else {
      recordQuizOutcome(0, answerTimeSec, quizAttemptsRef.current);
      const outcome = recordSegmentQuizAttempt(
        activeQuizSegment.id,
        false,
        activeQuizSegment.startTimestamp,
      );
      if (outcome.mustRewind) {
        setQuizFeedback(null);
        setSelectedQuizOption(null);
        setRewindAlertMessage(
          `Bạn đã trả lời sai 3 lần liên tiếp ở phân đoạn "${activeQuizSegment.title}". Hệ thống tự động tua lại về mốc ${formatSeconds(
            activeQuizSegment.startTimestamp,
          )} và mở Trợ lý AI hỗ trợ!`,
        );
        triggerProactiveIntervention(lesson.id, activeQuizSegment.startTimestamp + 10, 'hybrid_rule', true);
      } else {
        setQuizFeedback({
          correct: false,
          message: `Chưa chính xác (Lần thử ${outcome.attemptCount}/3). Nếu sai đủ 3 lần liên tiếp, hệ thống sẽ tự động tua lại đầu phân đoạn (${formatSeconds(
            activeQuizSegment.startTimestamp,
          )}).`,
        });
      }
    }
  };

  const progressPercent = Math.round((currentTimeSec / Math.max(1, lesson.durationSeconds)) * 100);
  const maxWatchedPercent = Math.round((maxWatchedSec / Math.max(1, lesson.durationSeconds)) * 100);

  return (
    <div className="space-y-4">
      <Card padding="none" className="overflow-hidden">
        {/* Interactive Lecture Canvas Surface */}
        <div className="relative bg-gray-950">
          <canvas
            ref={slideCanvasRef}
            width={880}
            height={400}
            onClick={handleTogglePlay}
            className="w-full cursor-pointer object-contain"
          />

          {/* Top-right floating Vision Capture & Anti-AFK trigger badges */}
          <div className="absolute right-3 top-3 flex flex-wrap items-center gap-2">
            <Button size="xs" variant="chat" onClick={handleCaptureFrameForTutor}>
              <Icon name="camera" size="xs" />
              {frameCaptureSuccess
                ? 'Đã đính kèm khung hình vào AI Tutor!'
                : 'Chụp Khung hình Slide hỏi AI Vision'}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setVerifyWatchingModalOpen(true)}
            >
              <Icon name="clock" size="xs" />
              Test Điểm danh 10p
            </Button>
          </div>
        </div>

        {/* Video Controls & Segmented Timeline */}
        <div className="space-y-3 p-4">
          {/* Anti-Skip Guard Banner */}
          {antiSkipNotice && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Icon name="lock" size="sm" className="text-warning" />
                <span className="font-medium">{antiSkipNotice}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => requestSeek(Math.min(lesson.durationSeconds, currentTimeSec + 180), true)}
                  className="font-semibold underline"
                >
                  Bypass (Chế độ Demo Giảng viên)
                </button>
                <button type="button" onClick={clearAntiSkipNotice} className="text-secondary">
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Mandatory 3-Strike Rewind Alert Banner */}
          {rewindAlertMessage && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
              <div className="flex items-center gap-2">
                <Icon name="backward" size="sm" className="text-danger" />
                <span className="font-medium">{rewindAlertMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setRewindAlertMessage(null)}
                className="font-semibold underline"
              >
                Đã hiểu
              </button>
            </div>
          )}

          {/* Soft SP-BEF prompt: asks the learner instead of opening the tutor automatically */}
          {nudgeOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-chat-50 px-3.5 py-2.5 text-xs text-chat-700">
              <div className="flex items-center gap-2">
                <Icon name="lightBulb" size="sm" className="text-chat" />
                <span className="font-medium">Đoạn này có khó hiểu không? Trợ lý AI có thể giải thích lại.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="xs" variant="chat" onClick={() => respondToConfusionNudge(lesson.id, currentTimeSec, true)}>
                  Giải thích giúp tôi
                </Button>
                <Button size="xs" variant="outline" onClick={() => respondToConfusionNudge(lesson.id, currentTimeSec, false)}>
                  Tôi ổn
                </Button>
              </div>
            </div>
          )}

          {/* Interactive Progress Scrubber + Personal Confusion Timeline Dots */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-secondary">
              <span className="font-medium text-primary">
                {formatSeconds(currentTimeSec)} / {formatSeconds(lesson.durationSeconds)}
              </span>
              <span>
                Đã xem tối đa: <strong className="font-semibold text-primary">{formatSeconds(maxWatchedSec)}</strong> (
                {maxWatchedPercent}%) · Chuẩn Điểm danh AI ≥ 70%
              </span>
            </div>

            <div className="relative">
              <ProgressBar value={progressPercent} tone="brand" />
              {/* Confusion timeline markers strip */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-tertiary">Điểm cảm xúc trên dòng thời gian:</span>
                {emotionTimeline.slice(-8).map((pt, idx) => {
                  const isNeg = pt.emotion === 'confused' || pt.emotion === 'frustrated';
                  return (
                    <button
                      key={`${pt.t}_${idx}`}
                      type="button"
                      onClick={() => requestSeek(pt.t, true)}
                      className={chipVariants({
                        variant: isNeg ? 'primary' : 'subtle',
                        size: 'xs',
                      })}
                    >
                      {formatSeconds(pt.t)} · {pt.emotion}
                      {pt.eyeLocked ? ' (Eye-Lock)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Primary Transport Buttons & Speed Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onClick={handleTogglePlay}>
                <Icon name={isPlaying ? 'pause' : 'play'} size="sm" />
                {isPlaying ? 'Tạm dừng' : 'Phát bài giảng'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleRewind15s}>
                <Icon name="backward" size="sm" />
                Lùi 15s (Ghi nhận Rewind)
              </Button>
              <Button size="sm" variant="outline" onClick={handleForward15s}>
                <Icon name="forward" size="sm" />
                Tới 15s
              </Button>
              {activeSegment && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedQuizOption(null);
                    setQuizFeedback(null);
                    openSegmentQuiz(activeSegment.id);
                  }}
                >
                  <Icon name="academicCap" size="sm" />
                  Làm Quiz Phân đoạn #{activeSegment.segmentIndex}
                  {segmentAttempts[activeSegment.id]
                    ? ` (Sai ${segmentAttempts[activeSegment.id]}/3)`
                    : ''}
                </Button>
              )}
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-secondary">Tốc độ:</span>
              {[0.75, 1.0, 1.25, 1.5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => handleSpeedSelect(spd)}
                  className={chipVariants({
                    variant: playbackSpeed === spd ? 'active' : 'default',
                    size: 'xs',
                  })}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* 5-7 Minute VideoSegments Interactive Strip */}
          <div className="rounded-xl bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Phân đoạn Bài giảng Thông minh (5–7 phút / phân đoạn · Kèm Quiz bắt buộc):
              </span>
              <Badge variant="info">{lesson.segments.length} phân đoạn</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {lesson.segments.map((seg) => {
                const isCurrent = activeSegment?.id === seg.id;
                const isPassed = Boolean(passedSegments[seg.id]);
                const strikes = segmentAttempts[seg.id] || 0;
                return (
                  <div
                    key={seg.id}
                    className={`rounded-xl p-2.5 transition-colors ${
                      isCurrent ? 'bg-white border border-line' : 'bg-white/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => requestSeek(seg.startTimestamp, true)}
                        className="text-left text-xs font-semibold text-primary hover:text-brand"
                      >
                        #{seg.segmentIndex}. {seg.title}
                      </button>
                      <Badge variant={isPassed ? 'success' : strikes > 0 ? 'danger' : 'warning'}>
                        {isPassed ? 'Đã đạt' : strikes > 0 ? `Sai ${strikes}/3` : 'Chưa làm Quiz'}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-secondary">
                      <span>
                        {formatSeconds(seg.startTimestamp)} – {formatSeconds(seg.endTimestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuizOption(null);
                          setQuizFeedback(null);
                          openSegmentQuiz(seg.id);
                        }}
                        className="font-medium text-chat hover:underline"
                      >
                        Mở Quiz →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4-Level Self-Report Confusion Bar */}
          <div className="rounded-xl bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="lightBulb" size="sm" className="text-chat" />
                <div>
                  <span className="text-xs font-semibold text-primary">
                    Tự đánh giá mức độ hiểu bài tại mốc {formatSeconds(currentTimeSec)}:
                  </span>
                  <span className="ml-2 text-xs text-secondary">
                    (Chọn mức 3 hoặc 4 sẽ kích hoạt ngay Trợ lý AI giải thích 3 tầng RAG)
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SELF_REPORT_LEVELS.map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => submitSelfReport(lesson.id, currentTimeSec, item.level)}
                    className={chipVariants({ variant: item.tone, size: 'xs' })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* In-Video Segment Quiz Modal (3 wrong attempts -> mandatory rewind to segment.startTimestamp) */}
      <Dialog open={Boolean(activeQuizSegment)} onClose={closeSegmentQuiz} size="md">
        {activeQuizSegment && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge variant="chat">
                Quiz Kiểm tra Phân đoạn #{activeQuizSegment.segmentIndex} (
                {formatSeconds(activeQuizSegment.startTimestamp)} –{' '}
                {formatSeconds(activeQuizSegment.endTimestamp)})
              </Badge>
              <Badge
                variant={(segmentAttempts[activeQuizSegment.id] || 0) > 0 ? 'danger' : 'info'}
              >
                Số lần sai liên tiếp: {segmentAttempts[activeQuizSegment.id] || 0} / 3
              </Badge>
            </div>

            <DialogTitle className="mt-2">{activeQuizSegment.title}</DialogTitle>
            <DialogDescription>
              Trả lời đúng câu hỏi dưới đây để mở khóa phân đoạn tiếp theo. Nếu trả lời sai 3 lần liên tiếp, hệ thống sẽ
              tự động tua lại về đầu phân đoạn ({formatSeconds(activeQuizSegment.startTimestamp)}).
            </DialogDescription>

            <DialogBody className="space-y-3">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm font-semibold text-primary">
                  {activeQuizSegment.quizQuestion.question}
                </p>
              </div>

              <div className="space-y-2">
                {activeQuizSegment.quizQuestion.options.map((opt, idx) => {
                  const isSelected = selectedQuizOption === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedQuizOption(idx)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-chat bg-chat-subtle font-semibold text-primary'
                          : 'border-line bg-white text-secondary hover:bg-muted'
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && <Icon name="checkCircle" size="sm" className="text-chat" />}
                    </button>
                  );
                })}
              </div>

              {quizFeedback && (
                <div
                  className={`rounded-xl p-3 text-xs font-medium ${
                    quizFeedback.correct
                      ? 'bg-green-50 text-green-900'
                      : 'bg-red-50 text-red-900'
                  }`}
                >
                  {quizFeedback.message}
                </div>
              )}
            </DialogBody>

            <DialogActions>
              <Button variant="outline" onClick={closeSegmentQuiz}>
                Xem lại bài giảng
              </Button>
              <Button
                variant="chat"
                disabled={selectedQuizOption === null}
                onClick={handleSubmitSegmentQuiz}
              >
                Nộp đáp án
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 10-Minute Anti-AFK VerifyWatchingModal */}
      <Dialog
        open={verifyWatchingModalOpen}
        onClose={() => setVerifyWatchingModalOpen(false)}
        size="sm"
      >
        <DialogTitle>Xác nhận Đang theo dõi Bài giảng (Chu kỳ 10 phút)</DialogTitle>
        <DialogDescription>
          Hệ thống Điểm danh Tự động kiểm tra định kỳ mỗi 10 phút để đảm bảo bạn đang thực sự tương tác với bài học.
        </DialogDescription>
        <DialogBody>
          <div className="rounded-xl bg-muted p-3.5 text-xs text-secondary">
            Thời lượng xem hợp lệ hiện tại: <strong className="font-semibold text-primary">{formatSeconds(maxWatchedSec)}</strong>. Nhấn xác nhận bên dưới để tiếp tục tích lũy thời lượng điểm danh.
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            variant="primary"
            onClick={() => {
              setVerifyWatchingModalOpen(false);
              setIsPlaying(true);
            }}
          >
            <Icon name="checkCircle" size="sm" />
            Tôi vẫn đang học — Tiếp tục phát
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
