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
  buildAnchored478Landmarks,
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
  const [cvEngineBadge, setCvEngineBadge] = useState<'MediaPipe 478 Live' | 'Pixel CV Live' | 'CV Edge Sim'>('CV Edge Sim');

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
    gazeStill,
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
    mlProb,
    mlLevel,
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

  // Start or stop real webcam and run real-time MediaPipe 478 / Pixel CV loop on <canvas>
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
        }
      } catch {
        if (isMounted) {
          setCameraStreaming(false);
          setCameraError(
            'Không tìm thấy Webcam vật lý — Đang chạy chế độ Mô phỏng Thị giác Máy tính (MediaPipe 478 Landmarks) trên trình duyệt',
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
        // 1. Draw raw frame first to read true pixel RGB luminance via ctx.getImageData
        ctx.filter = 'none';
        ctx.drawImage(video, 0, 0, w, h);

        // 2. Run RealFaceTrackerSession on live video + canvas
        if (trackerRef.current && !inSimOverride) {
          const cvRes = await trackerRef.current.processFrame(
            video,
            ctx,
            w,
            h,
            accountState.faceEmbeddings,
          );
          latestLandmarksRef.current = cvRes.landmarks;
          setCvEngineBadge(
            cvRes.engineMode === 'mediapipe_wasm' ? 'MediaPipe 478 Live' : 'Pixel CV Live',
          );

          // Apply Low-Light Boost filter when room luminance < 95
          if (cvRes.lowLightBoostActive) {
            ctx.filter = 'brightness(1.38) contrast(1.22)';
            ctx.drawImage(video, 0, 0, w, h);
            ctx.filter = 'none';
          }

          // Throttle store telemetry updates to every 900ms for smooth React rendering
          if (now - lastTelemetrySyncMsRef.current >= 900) {
            lastTelemetrySyncMsRef.current = now;
            state.updateCvFrameMetrics({
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
              headYawDeg: cvRes.headYawDeg,
              headPitchDeg: cvRes.headPitchDeg,
            });
          }

          // Every 5 seconds: run real Biometric & Face Absence Guard check
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
        // Synthetic dark slate studio feed when no webcam is active
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        if (state.currentEmotion === 'no_face') {
          latestLandmarksRef.current = [];
        } else {
          latestLandmarksRef.current = buildAnchored478Landmarks(
            0.5,
            0.52,
            0.16,
            0.28,
            state.headYawDeg,
            state.headPitchDeg,
            state.earAvg || 0.25,
            state.browFurrowScore,
          );
        }
      }

      // Draw actual 478 3D Landmarks, Face Oval, Eyebrows, Eye Contours & Nose Tip at real (x, y)
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

  // Interactive Demo Simulation Handlers (Locks simulation override for 12s so examiners can inspect)
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
        avgLuminance: 82, // Triggers Low-Light Adaptive Preprocessor (<95)
        browFurrowScore: 0.84, // Strong AU4 brow furrow
        eyeSquintScore: 0.76, // Strong AU7 eye squint
        headYawDeg: -0.6,
        headPitchDeg: 0.8,
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
      headYawDeg: 1.2,
      headPitchDeg: -1.4,
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
      confidence: 0.99,
      earAvg: 0,
      earVariance: 0,
      noseDriftPx: 0,
      gazeStill: false,
      eyeLocked: false,
      avgLuminance,
      browFurrowScore: 0,
      eyeSquintScore: 0,
      headYawDeg: 0,
      headPitchDeg: 0,
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

  const emotionBadge = EMOTION_META[currentEmotion] || EMOTION_META.neutral;
  const mlpPercent = Math.round(mlProb * 100);

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
                  Giám sát Nhận diện Bối rối & Xác thực Khuôn mặt (478 Landmarks)
                </h3>
                <Badge variant={cameraEnabled ? 'success' : 'default'}>
                  {cameraEnabled ? (cameraStreaming ? cvEngineBadge : 'CV Edge Sim') : 'Đã tắt'}
                </Badge>
              </div>
              <p className="text-xs text-secondary">
                100% suy luận trực tiếp trên trình duyệt (0 byte video gửi lên máy chủ) · Kiểm tra sinh trắc 192-d mỗi 5 giây
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

        {/* Live Feed + Real-time Biometric & Gaze Metrics */}
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
                  Lum: {avgLuminance}/255
                </span>
                {lowLightBoostActive && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                    Low-Light Boost ON
                  </span>
                )}
              </div>
            </div>
            {cameraError && <p className="mt-1.5 text-xs text-secondary">{cameraError}</p>}
          </div>

          {/* Right: Real-time Confusion Engine Scores */}
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

              {/* Dual Progress Bars: Hybrid Rule Score & Multimodal MLP Probability */}
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
                    <span className="font-medium text-secondary">Multimodal MLP (12 đặc trưng)</span>
                    <span className="font-semibold text-primary">
                      {mlpPercent}% ({mlLevel.toUpperCase()})
                    </span>
                  </div>
                  <ProgressBar
                    value={mlpPercent}
                    tone={mlpPercent >= 60 ? 'danger' : mlpPercent >= 40 ? 'warning' : 'chat'}
                  />
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
                  <span className="block text-tertiary">Cửa sổ trượt (3)</span>
                  <span className="font-semibold text-primary">
                    {slidingWindowEmotions.map((e) => e.slice(0, 4)).join(' → ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Simulation Demo Toolbar for Examiners / Defense Committee */}
            <div className="rounded-xl bg-muted p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Icon name="sparkles" size="xs" className="text-chat" />
                  Bảng Điều khiển Demo Bảo vệ Khóa luận (Test trực tiếp luồng AI):
                </span>
                <button
                  type="button"
                  onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
                  className="text-xs font-medium text-chat hover:underline"
                >
                  {showTelemetryDetails ? 'Ẩn 12 đặc trưng' : 'Xem 12 đặc trưng MLP'}
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
                  Test Vắng mặt 30s (Khóa Video)
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
                  Reset Cooldown ({cooldownRemainingSec > 0 ? 'Đang chờ 5p' : 'Sẵn sàng'})
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 12-Feature Multimodal Vector Inspection Grid */}
        {showTelemetryDetails && (
          <div className="rounded-xl bg-muted p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Vector 12 Đặc trưng Đa phương thức (6 Hành vi Video + 4 Cảm xúc Khuôn mặt + 2 Kết quả Quiz):
              </span>
              <Badge variant="chat">StandardScaler → MLP Classifier</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">1. pause_count</span>
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
                <span className="block text-tertiary">4. rewind_count</span>
                <span className="font-semibold text-primary">{features12.rewind_count} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">5. rewind_same_spot</span>
                <span className="font-semibold text-primary">{features12.rewind_same_spot} lần</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">6. speed_decrease</span>
                <span className="font-semibold text-primary">{features12.speed_decrease ? 'Có (<1x)' : 'Không'}</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">7. confused_ratio</span>
                <span className="font-semibold text-primary">{Math.round(features12.confused_ratio * 100)}%</span>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <span className="block text-tertiary">8. frustrated_ratio</span>
                <span className="font-semibold text-primary">{Math.round(features12.frustrated_ratio * 100)}%</span>
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
          Hệ thống Nhận diện Bối rối tuân thủ nghiêm ngặt kiến trúc Bảo mật tại Biên (Edge Privacy-First).
        </DialogDescription>
        <DialogBody className="space-y-3 text-sm text-secondary">
          <div className="rounded-xl bg-muted p-3.5 space-y-2">
            <p className="font-semibold text-primary">1. Không gửi ảnh hoặc video webcam lên máy chủ</p>
            <p>
              Toàn bộ mô hình MediaPipe Face Landmarker (478 điểm mốc 3D), tính toán độ mở mắt EAR, độ đứng yên ánh nhìn
              (Gaze Stillness) và MobileFaceNet (vector 192 chiều) đều chạy trực tiếp trên trình duyệt thông qua WebGL /
              WASM.
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3.5 space-y-2">
            <p className="font-semibold text-primary">2. Chỉ lưu trữ nhãn cảm xúc ẩn danh & vector sinh trắc 1 chiều</p>
            <p>
              Máy chủ chỉ nhận nhãn cảm xúc tổng hợp (`focused`, `confused`, `frustrated`) để kích hoạt Trợ lý AI giải
              thích bài giảng và tạo biểu đồ Điểm nóng Bối rối cho giảng viên cải thiện chất lượng slide.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted p-3.5">
            <div>
              <p className="font-semibold text-primary">Trạng thái đồng ý cấp quyền Camera</p>
              <p className="text-xs text-secondary">
                Bạn có thể bật/tắt bất kỳ lúc nào (tuy nhiên các lớp yêu cầu Điểm danh AI cần bật xác thực khuôn mặt).
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
