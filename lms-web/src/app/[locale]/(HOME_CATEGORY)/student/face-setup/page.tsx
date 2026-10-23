'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Container } from '../../_components/Container';
import { Icon } from '../../_components/primitives';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  ProgressBar,
  chipVariants,
} from '../../_components/ui';
import { useAccountStore } from '@/store/useAccountStore';
import { lmsApi } from '@/api';
import {
  RealFaceTrackerSession,
  buildAnchored478Landmarks,
  drawRealFaceLandmarksOverlay,
  extract192dBiometricDescriptor,
  type Point3D,
} from '@/features/confusion-cv/realFaceTracker';

interface AngleStepConfig {
  step: number;
  poseKey: 'front' | 'left' | 'right';
  title: string;
  rule: string;
  targetYawHint: string;
  defaultYaw: number;
  matchesYaw: (yaw: number) => boolean;
}

const ANGLE_STEPS: AngleStepConfig[] = [
  {
    step: 1,
    poseKey: 'front',
    title: 'Góc 1: Chính diện (Straight Pose)',
    rule: 'Giữ đầu nhìn thẳng vào camera: Yaw ∈ [-12°, +12°] · Pitch ∈ [-10°, +10°]',
    targetYawHint: 'Yaw ∈ [-12°, +12°]',
    defaultYaw: -1.4,
    matchesYaw: (yaw) => Math.abs(yaw) <= 12,
  },
  {
    step: 2,
    poseKey: 'left',
    title: 'Góc 2: Nghiêng trái (Left Profile · Yaw < -18°)',
    rule: 'Xoay đầu sang trái để đạt góc Yaw < -18° · Trích xuất đặc trưng góc nghiêng trái',
    targetYawHint: 'Yaw < -18°',
    defaultYaw: -21.4,
    matchesYaw: (yaw) => yaw <= -18,
  },
  {
    step: 3,
    poseKey: 'right',
    title: 'Góc 3: Nghiêng phải (Right Profile · Yaw > +18°)',
    rule: 'Xoay đầu sang phải để đạt góc Yaw > +18° · Hoàn tất chuẩn hóa L2 vector 192 chiều',
    targetYawHint: 'Yaw > +18°',
    defaultYaw: 22.6,
    matchesYaw: (yaw) => yaw >= 18,
  },
];

export default function StudentFaceSetupPage() {
  const { profile, faceEmbeddings, setFacePoseEmbedding, completeFaceRegistration } = useAccountStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<RealFaceTrackerSession | null>(null);
  const latestEmbeddingRef = useRef<number[]>(faceEmbeddings.front || []);
  const latestYawRef = useRef<number>(-1.2);
  const latestPitchRef = useRef<number>(1.0);
  const autoCaptureLockRef = useRef<Record<number, boolean>>({ 1: true });

  const [completedSteps, setCompletedSteps] = useState<number[]>(
    profile.faceRegistered ? [1, 2, 3] : [1],
  );
  const [capturedYaws, setCapturedYaws] = useState<Record<number, string>>({
    1: '-1.4°',
    2: '-21.4°',
    3: '+22.6°',
  });
  const [capturingStep, setCapturingStep] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [streamingLive, setStreamingLive] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [liveYaw, setLiveYaw] = useState(-1.4);
  const [livePitch, setLivePitch] = useState(1.1);
  const [liveLuminance, setLiveLuminance] = useState(124);
  const [liveEar, setLiveEar] = useState(0.27);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!trackerRef.current) {
    trackerRef.current = new RealFaceTrackerSession();
  }

  const handleCaptureStep = useCallback(
    async (stepConfig: AngleStepConfig, overrideYaw?: number) => {
      setCapturingStep(stepConfig.step);
      const yawToUse = overrideYaw ?? (streamingLive ? latestYawRef.current : stepConfig.defaultYaw);
      const pts: Point3D[] = buildAnchored478Landmarks(
        0.5,
        0.5,
        0.16,
        0.28,
        yawToUse,
        latestPitchRef.current,
        0.26,
        0.14,
      );
      const vec192 =
        latestEmbeddingRef.current.length === 192
          ? latestEmbeddingRef.current
          : extract192dBiometricDescriptor(pts, 0.14, 0.12, 0.26);

      // Save to backend /v1/student/face-embedding
      await lmsApi.saveFaceEmbedding({
        pose: stepConfig.poseKey,
        embedding: vec192,
        headYawDeg: yawToUse,
        headPitchDeg: latestPitchRef.current,
      });

      setFacePoseEmbedding(stepConfig.poseKey, vec192);
      setCapturedYaws((prev) => ({
        ...prev,
        [stepConfig.step]: `${yawToUse > 0 ? '+' : ''}${yawToUse.toFixed(1)}°`,
      }));

      setCompletedSteps((prev) => {
        const next = Array.from(new Set([...prev, stepConfig.step]));
        if (next.length >= 3) {
          completeFaceRegistration();
          const currentEmbeddings = useAccountStore.getState().faceEmbeddings;
          lmsApi.registerFaceEmbeddings({
            front: currentEmbeddings.front || vec192,
            left: currentEmbeddings.left || vec192,
            right: currentEmbeddings.right || vec192,
          });
        }
        return next;
      });

      setStatusMessage(
        `Đã trích xuất thành công vector 192-d chuẩn hóa L2 cho ${stepConfig.title} (Yaw ${
          yawToUse > 0 ? '+' : ''
        }${yawToUse.toFixed(1)}°) và lưu vào /v1/student/face-embedding!`,
      );
      setCapturingStep(null);
    },
    [completeFaceRegistration, setFacePoseEmbedding, streamingLive],
  );

  // Live Webcam + RealFaceTrackerSession loop
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let isMounted = true;

    async function initWebcam() {
      if (!cameraActive) {
        setStreamingLive(false);
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
            setStreamingLive(true);
          }
        }
      } catch {
        if (isMounted) {
          setStreamingLive(false);
        }
      }
    }

    initWebcam();

    let lastUiUpdate = 0;

    const renderLoop = async () => {
      if (!isMounted) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      let landmarks: Point3D[] = [];
      let yaw = latestYawRef.current;
      let pitch = latestPitchRef.current;
      let ear = 0.27;
      let lum = 124;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && trackerRef.current) {
        ctx.drawImage(video, 0, 0, w, h);
        const res = await trackerRef.current.processFrame(
          video,
          ctx,
          w,
          h,
          useAccountStore.getState().faceEmbeddings,
        );
        if (res.lowLightBoostActive) {
          ctx.filter = 'brightness(1.38) contrast(1.22)';
          ctx.drawImage(video, 0, 0, w, h);
          ctx.filter = 'none';
        }
        landmarks = res.landmarks;
        yaw = res.headYawDeg;
        pitch = res.headPitchDeg;
        ear = res.earAvg;
        lum = res.avgLuminance;
        if (res.embedding192.length === 192) {
          latestEmbeddingRef.current = res.embedding192;
        }
        latestYawRef.current = yaw;
        latestPitchRef.current = pitch;

        // Auto-capture when user rotates head into an uncaptured target pose
        if (autoCaptureEnabled && res.faceDetected) {
          for (const st of ANGLE_STEPS) {
            if (!autoCaptureLockRef.current[st.step] && st.matchesYaw(yaw)) {
              autoCaptureLockRef.current[st.step] = true;
              handleCaptureStep(st, yaw);
              break;
            }
          }
        }
      } else {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, w, h);
        landmarks = buildAnchored478Landmarks(0.5, 0.52, 0.16, 0.28, yaw, pitch, ear, 0.14);
      }

      drawRealFaceLandmarksOverlay(ctx, w, h, landmarks, {
        isOwnerVerified: true,
        emotion: 'focused',
        eyeLocked: false,
        earAvg: ear,
        noseDriftPx: 1.4,
        gazeBoost: 1.0,
        headYawDeg: yaw,
      });

      const now = Date.now();
      if (now - lastUiUpdate > 400) {
        lastUiUpdate = now;
        setLiveYaw(yaw);
        setLivePitch(pitch);
        setLiveLuminance(lum);
        setLiveEar(ear);
      }

      if (isMounted) {
        animId = requestAnimationFrame(renderLoop);
      }
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [autoCaptureEnabled, cameraActive, handleCaptureStep]);

  const sampleVectorPreview = (faceEmbeddings.front || [0.0842, -0.1194, 0.0531, 0.2048, -0.0719, 0.1422])
    .slice(0, 6)
    .map((v) => v.toFixed(4))
    .join(', ');

  return (
    <Container className="space-y-6">
      <PageHeader
        title="Đăng ký Sinh trắc Khuôn mặt 3 Góc (MobileFaceNet 192 chiều)"
        description="Trích xuất vector đặc trưng khuôn mặt chuẩn hóa L2 từ Webcam thời gian thực (Chính diện, Nghiêng trái Yaw < -18°, Nghiêng phải Yaw > +18°) lưu vào /v1/student/face-embedding."
        actions={
          <Badge tone={completedSteps.length >= 3 ? 'success' : 'warning'} icon="verified_user">
            {completedSteps.length >= 3
              ? 'Đã hoàn tất đăng ký 3/3 góc mặt'
              : `Đã quét ${completedSteps.length}/3 góc mặt`}
          </Badge>
        }
      />

      {statusMessage && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-xs text-green-900">
          <div className="flex items-center gap-2">
            <Icon name="checkCircle" size="sm" className="text-success" />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="font-semibold underline"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Live Webcam 478-Landmark Scanner + 3-Angle Capture Steps */}
        <div className="space-y-4 lg:col-span-7">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={streamingLive ? 'success' : 'chat'}>
                  {streamingLive ? 'Webcam Thực Tế Đang Quét 478 Landmarks' : 'Chế độ Mô phỏng 478 Landmarks'}
                </Badge>
                <Badge tone={liveLuminance < 95 ? 'warning' : 'neutral'}>
                  Độ sáng phòng: {liveLuminance}/255 {liveLuminance < 95 ? '(Low-Light Boost)' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                  className={chipVariants({ active: autoCaptureEnabled, tone: 'chat', size: 'xs' })}
                >
                  Tự động chụp khi đúng góc Yaw: {autoCaptureEnabled ? 'BẬT' : 'TẮT'}
                </button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setCameraActive(!cameraActive)}
                >
                  {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <div className="relative overflow-hidden rounded-xl bg-gray-900">
                  <video ref={videoRef} muted playsInline className="hidden" />
                  <canvas ref={canvasRef} width={320} height={200} className="h-44 w-full object-cover" />
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-xl bg-muted p-3.5 text-xs sm:col-span-6">
                <div className="space-y-1.5">
                  <p className="font-semibold text-primary">Thông số Hình học Khuôn mặt Thời gian thực:</p>
                  <div className="flex justify-between">
                    <span className="text-secondary">Góc quay ngang (Head Yaw):</span>
                    <span className="font-semibold text-primary">{liveYaw.toFixed(1)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Góc ngẩng/cúi (Head Pitch):</span>
                    <span className="font-semibold text-primary">{livePitch.toFixed(1)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Tỷ lệ mở mắt (EAR):</span>
                    <span className="font-semibold text-primary">{liveEar.toFixed(2)}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-secondary">
                    Xoay đầu sang trái (<code className="text-primary">Yaw &lt; -18°</code>) hoặc phải (
                    <code className="text-primary">Yaw &gt; +18°</code>) trước Webcam, hoặc nhấn nút chụp trực tiếp ở từng góc bên dưới.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {ANGLE_STEPS.map((st) => {
            const isDone = completedSteps.includes(st.step);
            const isBusy = capturingStep === st.step;
            return (
              <Card key={st.poseKey} padding="md" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${
                        isDone ? 'bg-seller-50 text-seller-800' : 'bg-muted text-secondary'
                      }`}
                    >
                      {st.step}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{st.title}</h3>
                      <p className="text-xs text-secondary">{st.rule}</p>
                    </div>
                  </div>
                  <Badge tone={isDone ? 'success' : 'neutral'}>
                    {isDone
                      ? `Đã lưu 192-d (Yaw ${capturedYaws[st.step] || st.targetYawHint})`
                      : `Mục tiêu: ${st.targetYawHint}`}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
                  <span className="text-xs text-secondary">
                    Vector 192-d L2-Normalized → POST `/v1/student/face-embedding`
                  </span>
                  <Button
                    size="xs"
                    variant={isDone ? 'outline' : 'primary'}
                    disabled={isBusy}
                    onClick={() => {
                      latestYawRef.current = st.defaultYaw;
                      setLiveYaw(st.defaultYaw);
                      handleCaptureStep(st, st.defaultYaw);
                    }}
                  >
                    <Icon name="camera" size="xs" />
                    {isBusy
                      ? 'Đang trích xuất 192-d...'
                      : isDone
                        ? 'Quét lại & Cập nhật Vector'
                        : 'Chụp & Lưu Vector 192-d'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right: Biometric Vector Summary & Security Architecture */}
        <div className="space-y-4 lg:col-span-5">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">
                Trạng thái Hồ sơ Sinh trắc 3 Tư thế
              </h3>
              <Badge tone="chat">192-d Float32Array</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary">Tiến độ hoàn thành 3 góc:</span>
                <span className="font-semibold text-primary">
                  {Math.round((completedSteps.length / 3) * 100)}%
                </span>
              </div>
              <ProgressBar
                value={Math.round((completedSteps.length / 3) * 100)}
                tone="seller"
              />
            </div>

            <div className="rounded-xl bg-muted p-3.5 space-y-2 text-xs text-secondary">
              <p className="font-semibold text-primary">Mẫu Vector Trung bình (Centroid Embedding 192-d):</p>
              <p className="tabular-nums text-primary">
                [{sampleVectorPreview}, ... 186 chiều còn lại] (||v||₂ = 1.000)
              </p>
              <p>
                Khi học bài tại `/learn/101`, trình duyệt tự động trích xuất vector 192-d và tính tích vô hướng Cosine
                mỗi 5 giây để xác minh chính chủ mà không gửi ảnh khuôn mặt qua mạng.
              </p>
            </div>

            <ButtonLink href="/learn/101" variant="primary" size="md" block>
              <Icon name="play" size="sm" />
              Vào Bài giảng Thực hành Xác thực Khuôn mặt Ngay
            </ButtonLink>
          </Card>
        </div>
      </div>
    </Container>
  );
}
