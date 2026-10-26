'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { useConfusionStore } from '@/store/useConfusionStore';
import { useLearnStore } from '@/store/useLearnStore';
import { useAccountStore } from '@/store/useAccountStore';
import {
  RealFaceTrackerSession,
  drawRealFaceLandmarksOverlay,
  type Point3D,
} from './realFaceTracker';
import type { EmotionLabel } from '@/api/types';

const EMOTION_META: Record<
  EmotionLabel,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'chat' }
> = {
  focused: { label: 'Tập trung (Focused)', variant: 'success' },
  confused: { label: 'Bối rối (Confused)', variant: 'warning' },
  frustrated: { label: 'Căng thẳng (Frustrated)', variant: 'danger' },
  bored: { label: 'Chán / Mất tập trung', variant: 'default' },
  happy: { label: 'Hào hứng (Happy)', variant: 'info' },
  neutral: { label: 'Bình thường (Neutral)', variant: 'default' },
  no_face: { label: 'Không thấy khuôn mặt (0 Faces)', variant: 'danger' },
};

interface CameraMonitorCardProps {
  lessonId: number;
}

export function CameraMonitorCard({ lessonId }: CameraMonitorCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<RealFaceTrackerSession | null>(null);
  const latestLandmarksRef = useRef<Point3D[]>([]);
  const simOverrideUntilRef = useRef<number>(0);
  const lastTelemetrySyncMsRef = useRef<number>(0);
  const lastBiometricSyncMsRef = useRef<number>(0);

  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(true);
  const [cvEngineBadge, setCvEngineBadge] = useState<'MediaPipe 478 Live' | 'Chờ Camera'>('Chờ Camera');

  const { profile, faceEmbeddings, setCameraConsent } = useAccountStore();
  const { currentTimeSec, setIsPlaying } = useLearnStore();

  const {
    cameraEnabled,
    cameraStreaming,
    currentEmotion,
    emotionConfidence,
    earAvg,
    earVariance,
    noseDriftPx,
    eyeLocked,
    gazeBoost,
    avgLuminance,
    lowLightBoostActive,
    browFurrowScore,
    eyeSquintScore,
    headYawDeg,
    faceSimilarity,
    isOwnerVerified,
    consecutiveNoFaceChecks,
    features12,
    slidingWindowEmotions,
    ruleScore,
    mlLevel,
    posteriorProb,
    priorProb,
    llrFace,
    llrBeh,
    llrQuiz,
    rFace,
    rBeh,
    rQuiz,
    contribFace,
    contribBeh,
    contribQuiz,
    segmentPrior,
    apiStatus,
    personalBaselineReady,
    cooldownRemainingSec,
    setCameraEnabled,
    setCameraStreaming,
    updateCvFrameMetrics,
    recordVideoPause,
    recordVideoRewind,
    recordBiometricCheck,
    triggerProactiveIntervention,
    resetCooldown,
    resetAll,
  } = useConfusionStore();

  if (!trackerRef.current) {
    trackerRef.current = new RealFaceTrackerSession();
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let isMounted = true;

    async function startStream() {
      if (!cameraEnabled) {
        setCameraStreaming(false);
        return;
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
            audio: false,
          });
          if (videoRef.current && isMounted) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
            setCameraStreaming(true);
            setCameraError(null);
          }
        } else if (isMounted) {
          setCameraStreaming(false);
          setCameraError(
            'Không xác định (Mất kết nối API / Thiếu tín hiệu) — Trình duyệt không hỗ trợ hoặc từ chối quyền Camera',
          );
        }
      } catch {
        if (isMounted) {
          setCameraStreaming(false);
          setCameraError(
            'Không xác định (Mất kết nối API / Thiếu tín hiệu) — Quyền truy cập Camera bị từ chối hoặc không có Webcam vật lý',
          );
        }
      }
    }

    startStream();

    const renderFrameLoop = async () => {
      if (!isMounted) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const state = useConfusionStore.getState();
      const learnState = useLearnStore.getState();
      const accountState = useAccountStore.getState();
      const now = Date.now();
      const inSimOverride = now < simOverrideUntilRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        ctx.filter = 'none';
        ctx.drawImage(video, 0, 0, w, h);

        if (trackerRef.current && !inSimOverride) {
          const cvRes = await trackerRef.current.processFrame(
            video,
            ctx,
            w,
            h,
            accountState.faceEmbeddings,
            now,
          );
          latestLandmarksRef.current = cvRes.landmarks;
          setCvEngineBadge(
            cvRes.engineMode === 'mediapipe_wasm' ? 'MediaPipe 478 Live' : 'Chờ Camera',
          );

          if (cvRes.lowLightBoostActive) {
            ctx.filter = 'brightness(1.38) contrast(1.22)';
            ctx.drawImage(video, 0, 0, w, h);
            ctx.filter = 'none';
          }

          if (now - lastTelemetrySyncMsRef.current >= 900) {
            lastTelemetrySyncMsRef.current = now;
            state.updateCvFrameMetrics(
              {
                videoTimestampSec: learnState.currentTimeSec,
                emotion: cvRes.emotion,
                confidence: cvRes.confidence,
                earAvg: cvRes.earAvg,
                earVariance: cvRes.earVariance,
                noseDriftPx: cvRes.noseDriftPx,
                gazeStill: cvRes.gazeStill,
                eyeLocked: cvRes.eyeLocked,
                avgLuminance: cvRes.avgLuminance,
                browFurrowScore: cvRes.browFurrowScore,
                eyeSquintScore: cvRes.eyeSquintScore,
                mouthTensionScore: cvRes.mouthTensionScore,
                headYawDeg: cvRes.headYawDeg,
                headPitchDeg: cvRes.headPitchDeg,
                faceDetected: cvRes.faceDetected,
                rFace: cvRes.rFace,
                llrFace: cvRes.llrFace,
                personalBaselineReady: cvRes.personalBaselineReady,
              },
              now,
            );
          }

          if (now - lastBiometricSyncMsRef.current >= 5000) {
            lastBiometricSyncMsRef.current = now;
            if (!cvRes.faceDetected || cvRes.landmarks.length === 0) {
              const nextNoFaceCount = state.consecutiveNoFaceChecks + 1;
              state.recordBiometricCheck('no_face', 0, learnState.currentTimeSec);
              if (nextNoFaceCount >= 6) {
                learnState.setIsPlaying(false);
              }
            } else if (cvRes.cosineSimilarity >= 0.58) {
              state.recordBiometricCheck('owner', cvRes.cosineSimilarity, learnState.currentTimeSec);
            } else {
              state.recordBiometricCheck('mismatch', cvRes.cosineSimilarity, learnState.currentTimeSec);
            }
          }
        } else if (state.lowLightBoostActive) {
          ctx.filter = 'brightness(1.38) contrast(1.22)';
          ctx.drawImage(video, 0, 0, w, h);
          ctx.filter = 'none';
        }
      } else {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, w, h);
        latestLandmarksRef.current = [];
      }

      const latestState = useConfusionStore.getState();
      drawRealFaceLandmarksOverlay(ctx, w, h, latestLandmarksRef.current, {
        isOwnerVerified: latestState.isOwnerVerified,
        emotion: latestState.currentEmotion,
        eyeLocked: latestState.eyeLocked,
        earAvg: latestState.earAvg,
        noseDriftPx: latestState.noseDriftPx,
        gazeBoost: latestState.gazeBoost,
        headYawDeg: latestState.headYawDeg,
      });

      if (isMounted) {
        animId = requestAnimationFrame(renderFrameLoop);
      }
    };

    animId = requestAnimationFrame(renderFrameLoop);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraEnabled, faceEmbeddings, setCameraStreaming]);

  const handleSimulateConfusedEyeLock = async () => {
    simOverrideUntilRef.current = Date.now() + 12000;
    for (let i = 0; i < 3; i++) {
      updateCvFrameMetrics({
        videoTimestampSec: currentTimeSec,
        emotion: 'confused',
        confidence: 0.89,
        earAvg: 0.25,
        earVariance: 0.0012,
        noseDriftPx: 1.9,
        gazeStill: true,
        eyeLocked: true,
        avgLuminance: 82,
        browFurrowScore: 0.84,
        eyeSquintScore: 0.76,
        mouthTensionScore: 0.42,
        headYawDeg: -0.6,
        headPitchDeg: 0.8,
        faceDetected: true,
        rFace: 0.78,
        llrFace: 1.45,
      });
    }
    setIsPlaying(false);
    await triggerProactiveIntervention(lessonId, currentTimeSec, 'ml_model', true);
  };

  const handleSimulateRewindAndPause = async () => {
    simOverrideUntilRef.current = Date.now() + 12000;
    recordVideoRewind(currentTimeSec + 35, currentTimeSec);
    recordVideoRewind(currentTimeSec + 30, currentTimeSec);
    recordVideoPause(14.5);
    recordVideoPause(12.0);
    updateCvFrameMetrics({
      videoTimestampSec: currentTimeSec,
      emotion: 'frustrated',
      confidence: 0.82,
      earAvg: 0.24,
      earVariance: 0.0016,
      noseDriftPx: 2.4,
      gazeStill: true,
      eyeLocked: true,
      avgLuminance: 118,
      browFurrowScore: 0.78,
      eyeSquintScore: 0.71,
      mouthTensionScore: 0.48,
      headYawDeg: 1.2,
      headPitchDeg: -1.4,
      faceDetected: true,
      rFace: 0.95,
      llrFace: 1.62,
    });
    setIsPlaying(false);
    await triggerProactiveIntervention(lessonId, currentTimeSec, 'hybrid_rule', true);
  };

  const handleSimulateFaceAbsence30s = () => {
    simOverrideUntilRef.current = Date.now() + 15000;
    latestLandmarksRef.current = [];
    updateCvFrameMetrics({
      videoTimestampSec: currentTimeSec,
      emotion: 'no_face',
      confidence: 0,
      earAvg: 0,
      earVariance: 0,
      noseDriftPx: 0,
      gazeStill: false,
      eyeLocked: false,
      avgLuminance,
      browFurrowScore: 0,
      eyeSquintScore: 0,
      mouthTensionScore: 0,
      headYawDeg: 0,
      headPitchDeg: 0,
      faceDetected: false,
      rFace: 0,
      llrFace: 0,
    });
    for (let i = 0; i < 6; i++) {
      recordBiometricCheck('no_face', 0, currentTimeSec);
    }
    setIsPlaying(false);
  };

  const handleSimulateIdentityMismatch = () => {
    simOverrideUntilRef.current = Date.now() + 15000;
    for (let i = 0; i < 3; i++) {
      recordBiometricCheck('mismatch', 0.31, currentTimeSec);
    }
    setIsPlaying(false);
  };

  const isIndeterminate =
    mlLevel === 'unknown' || apiStatus === 'indeterminate' || Boolean(cameraError && !cameraStreaming && rBeh === 0 && rQuiz === 0);
  const emotionBadge = EMOTION_META[currentEmotion] || EMOTION_META.neutral;
  const posteriorPercent = Math.round(posteriorProb * 100);

  return (
    <>
      <Card padding="md" className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-chat-subtle text-chat">
              <Icon name="video" size="sm" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-primary">
                  Hợp nhất Bằng chứng Bayes SP-BEF & Xác thực Khuôn mặt (478 Landmarks)
                </h3>
                <Badge variant={cameraEnabled && cameraStreaming ? 'success' : 'default'}>
                  {cameraEnabled ? (cameraStreaming ? cvEngineBadge : 'Không có tín hiệu Camera') : 'Đã tắt'}
                </Badge>
                <Badge variant={personalBaselineReady ? 'info' : 'default'}>
                  {personalBaselineReady ? 'Baseline C2: Đã khóa' : 'Baseline C2: Đang học 60s'}
                </Badge>
              </div>
              <p className="text-xs text-secondary">
                Suy luận trên trình duyệt (MediaPipe 0.10.14 + hồi quy logistic từ `sp_bef_params.json`) · Khử Base-Rate LLR · Bộ lọc HMM 2 trạng thái
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConsentDialogOpen(true)}
              className={chipVariants({ variant: 'subtle', size: 'xs' })}
            >
              <Icon name="shield" size="xs" />
              Quyền riêng tư
            </button>
            <Button
              size="xs"
              variant={cameraEnabled ? 'outline' : 'chat'}
              onClick={() => setCameraEnabled(!cameraEnabled)}
            >
              <Icon name={cameraEnabled ? 'eyeSlash' : 'camera'} size="xs" />
              {cameraEnabled ? 'Tắt Camera' : 'Bật Camera'}
            </Button>
          </div>
        </div>

        {/* Indeterminate / Offline Banner */}
        {(isIndeterminate || cameraError) && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Icon name="shield" size="sm" className="text-warning" />
              <span className="font-semibold">
                Không xác định (Mất kết nối API / Thiếu tín hiệu)
              </span>
              {cameraError && <span className="text-secondary">· {cameraError}</span>}
            </div>
            <Badge variant="warning">r_face = {rFace.toFixed(2)}</Badge>
          </div>
        )}

        {/* Live Feed + Real-time SP-BEF Scores */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Left: Video / Canvas Feed */}
          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-xl bg-gray-900">
              <video ref={videoRef} muted playsInline className="hidden" />
              <canvas ref={canvasRef} width={320} height={200} className="h-48 w-full object-cover" />
              <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-1.5 rounded-lg bg-gray-900/85 px-2.5 py-1.5 text-xs text-white">
                <span className="font-medium">
                  {currentEmotion === 'no_face'
                    ? `Vắng mặt (${consecutiveNoFaceChecks * 5}s / 30s)`
                    : `${isOwnerVerified ? 'Chính chủ (Cosine ' : 'Cảnh báo ('}${Math.round(
                        faceSimilarity * 100,
                      )}%)`}
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">
                  Lum: {avgLuminance}/255 · r_face: {rFace.toFixed(2)}
                </span>
                {lowLightBoostActive && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                    Low-Light Boost ON
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Real-time SP-BEF Posterior & LLR Breakdown */}
          <div className="flex flex-col justify-between space-y-3 md:col-span-7">
            <div className="rounded-xl bg-muted p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-secondary">Cảm xúc hiện tại:</span>
                  <Badge variant={emotionBadge.variant}>{emotionBadge.label}</Badge>
                  <span className="text-xs font-medium text-secondary">
                    ({Math.round(emotionConfidence * 100)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={eyeLocked ? 'chat' : 'default'}>
                    {eyeLocked ? `Eye-Lock x${gazeBoost.toFixed(1)}` : `Yaw ${headYawDeg.toFixed(1)}°`}
                  </Badge>
                </div>
              </div>

              {/* Dual Progress Bars: Hybrid Rule Score & SP-BEF HMM Posterior P(t) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-secondary">Hybrid Rule Score (Ngưỡng ≥ 35)</span>
                    <span className="font-semibold text-primary">{ruleScore}/100</span>
                  </div>
                  <ProgressBar
                    value={ruleScore}
                    tone={ruleScore >= 60 ? 'danger' : ruleScore >= 35 ? 'warning' : 'success'}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-secondary">HMM Posterior P(t) (θ_on = 62%)</span>
                    <span className="font-semibold text-primary">
                      {isIndeterminate
                        ? 'Không xác định (Mất kết nối API / Thiếu tín hiệu)'
                        : `${posteriorPercent}% (${mlLevel.toUpperCase()})`}
                    </span>
                  </div>
                  <ProgressBar
                    value={isIndeterminate ? 0 : posteriorPercent}
                    tone={posteriorPercent >= 62 ? 'danger' : posteriorPercent >= 42 ? 'warning' : 'chat'}
                  />
                </div>
              </div>

              {/* SP-BEF LLR Breakdown Strip */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-5">
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">LLR_face × r_face</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {llrFace.toFixed(2)} × {rFace.toFixed(2)} ({contribFace >= 0 ? '+' : ''}
                    {contribFace.toFixed(2)})
                  </span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">LLR_beh × r_beh</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {llrBeh.toFixed(2)} × {rBeh.toFixed(2)} ({contribBeh >= 0 ? '+' : ''}
                    {contribBeh.toFixed(2)})
                  </span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">LLR_quiz × r_quiz</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {llrQuiz.toFixed(2)} × {rQuiz.toFixed(2)} ({contribQuiz >= 0 ? '+' : ''}
                    {contribQuiz.toFixed(2)})
                  </span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">Prior π_s</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {(segmentPrior * 100).toFixed(1)}% (P⁻={(priorProb * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">HMM Posterior P(t)</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {isIndeterminate ? 'Unknown' : `${(posteriorProb * 100).toFixed(1)}%`}
                  </span>
                </div>
              </div>

              {/* Micro-metrics strip */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">AU4 Nhíu mày</span>
                  <span className="font-semibold text-primary">{Math.round(browFurrowScore * 100)}%</span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">AU7 Nheo mắt</span>
                  <span className="font-semibold text-primary">{Math.round(eyeSquintScore * 100)}%</span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">Độ mở mắt EAR</span>
                  <span className="font-semibold text-primary">
                    {earAvg.toFixed(2)} (σ²={earVariance.toFixed(4)})
                  </span>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-1.5">
                  <span className="block text-tertiary">Cửa sổ trượt (10s)</span>
                  <span className="font-semibold text-primary">
                    {slidingWindowEmotions.length > 0
                      ? slidingWindowEmotions.map((e) => e.slice(0, 4)).join(' → ')
                      : 'Chưa có mẫu'}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Simulation Demo Toolbar */}
            <div className="rounded-xl bg-muted p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Icon name="sparkles" size="xs" className="text-chat" />
                  Bảng Điều khiển Kiểm thử SP-BEF (Mô phỏng Tín hiệu Thực nghiệm):
                </span>
                <button
                  type="button"
                  onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
                  className="text-xs font-medium text-chat hover:underline"
                >
                  {showTelemetryDetails ? 'Ẩn đặc trưng cửa sổ trượt' : 'Xem đặc trưng cửa sổ trượt'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="xs" variant="chat" onClick={handleSimulateConfusedEyeLock}>
                  <Icon name="bolt" size="xs" />
                  Mô phỏng Bối rối + Eye-Lock (Bật AI Giải thích)
                </Button>
                <Button size="xs" variant="secondary" onClick={handleSimulateRewindAndPause}>
                  <Icon name="backward" size="xs" />
                  Mô phỏng Tua lại 2 lần + Dừng lâu
                </Button>
                <Button size="xs" variant="outline" onClick={handleSimulateFaceAbsence30s}>
                  <Icon name="userGroup" size="xs" />
                  Test Vắng mặt 30s (r_face = 0)
                </Button>
                <Button size="xs" variant="outline" onClick={handleSimulateIdentityMismatch}>
                  <Icon name="shield" size="xs" />
                  Test Sai khuôn mặt 15s
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    simOverrideUntilRef.current = 0;
                    resetCooldown();
                    resetAll();
                  }}
                >
                  <Icon name="arrowPath" size="xs" />
                  Reset Phiên ({cooldownRemainingSec > 0 ? 'Đang Cooldown' : 'Sẵn sàng'})
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 12-Feature Sliding Window Inspection Grid */}
        {showTelemetryDetails && (
          <div className="rounded-xl bg-muted p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Đặc trưng Cửa sổ Trượt Thời gian thực (5 phút Hành vi + 10 giây Khuôn mặt + Quiz):
              </span>
              <Badge variant="chat">SP-BEF Calibrated LLR + 2-State HMM</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">1. pause_count (5m)</span>
                <span className="font-semibold text-primary">{features12.pause_count} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">2. avg_pause_dur</span>
                <span className="font-semibold text-primary">{features12.avg_pause_duration}s</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">3. long_pause (&gt;10s)</span>
                <span className="font-semibold text-primary">{features12.long_pause_count} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">4. rewind_count (5m)</span>
                <span className="font-semibold text-primary">{features12.rewind_count} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">5. rewind_same_spot</span>
                <span className="font-semibold text-primary">{features12.rewind_same_spot} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">6. speed_decrease</span>
                <span className="font-semibold text-primary">
                  {features12.speed_decrease ? 'Có (<1x)' : 'Không'}
                </span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">7. confused_ratio (10s)</span>
                <span className="font-semibold text-primary">
                  {Math.round(features12.confused_ratio * 100)}%
                </span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">8. frustrated_ratio</span>
                <span className="font-semibold text-primary">
                  {Math.round(features12.frustrated_ratio * 100)}%
                </span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">9. emo_transitions</span>
                <span className="font-semibold text-primary">{features12.emotion_transitions}</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">10. neg_emo_streak</span>
                <span className="font-semibold text-primary">{features12.neg_emotion_streak}</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">11. quiz_score</span>
                <span className="font-semibold text-primary">{features12.quiz_score}%</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">12. quiz_time</span>
                <span className="font-semibold text-primary">{features12.quiz_time}s</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Privacy & Zero-Server-Image Consent Modal */}
      <Dialog open={consentDialogOpen} onClose={() => setConsentDialogOpen(false)} size="md">
        <DialogTitle>Cam kết Bảo mật Hình ảnh & Quyền Riêng tư Sinh viên</DialogTitle>
        <DialogDescription>
          Hệ thống Nhận diện Bối rối SP-BEF tuân thủ nghiêm ngặt kiến trúc Bảo mật tại Biên (Edge Privacy-First).
        </DialogDescription>
        <DialogBody className="space-y-3 text-sm text-secondary">
          <div className="rounded-xl bg-muted p-3.5 space-y-2">
            <p className="font-semibold text-primary">1. Không gửi ảnh hoặc điểm mốc khuôn mặt lên máy chủ</p>
            <p>
              Toàn bộ MediaPipe Face Landmarker (478 điểm mốc 3D), trọng số tin cậy động r_face(t) (C4) và mô hình
              khuôn mặt (hồi quy logistic, tham số trong sp_bef_params.json) đều chạy trực tiếp trên trình duyệt.
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3.5 space-y-2">
            <p className="font-semibold text-primary">2. Chỉ đồng bộ tỷ số hợp lý LLR_face & trọng số tin cậy r_face</p>
            <p>
              Khi mất tín hiệu khuôn mặt hoặc phòng quá tối, hệ thống tự động đặt r_face = 0.0 mà không bịa điểm mốc hay
              xác suất giả.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted p-3.5">
            <div>
              <p className="font-semibold text-primary">Trạng thái đồng ý cấp quyền Camera</p>
              <p className="text-xs text-secondary">
                Bạn có thể bật/tắt bất kỳ lúc nào (khi tắt camera, hệ thống chỉ sử dụng nhánh hành vi xem video và quiz).
              </p>
            </div>
            <Badge variant={profile.cameraConsentGranted ? 'success' : 'warning'}>
              {profile.cameraConsentGranted ? 'Đã đồng ý' : 'Chưa cấp quyền'}
            </Badge>
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            variant="outline"
            onClick={() => {
              setCameraConsent(false);
              setCameraEnabled(false);
              setConsentDialogOpen(false);
            }}
          >
            Chỉ dùng chế độ Hành vi Video
          </Button>
          <Button
            variant="chat"
            onClick={() => {
              setCameraConsent(true);
              setCameraEnabled(true);
              setConsentDialogOpen(false);
            }}
          >
            Đồng ý & Bật Giám sát Thông minh
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
