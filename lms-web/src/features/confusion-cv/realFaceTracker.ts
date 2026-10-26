'use client';

import type { EmotionLabel } from '@/api/types';
import {
  PersonalBaselineCalibrator,
  FACE_WINDOW_SAMPLE_MS,
  SP_BEF_PARAMS,
  aggregateClipWindow,
  clipVal,
  computeFrameReliability,
  predictLinearCalibratedBranch,
  type FrameTelemetryStat,
} from './spBefCore';

export interface Point3D {
  x: number; // normalized [0..1]
  y: number; // normalized [0..1]
  z: number; // normalized depth
}

export interface RealCvFrameResult {
  engineMode: 'mediapipe_wasm' | 'no_stream';
  faceDetected: boolean;
  landmarks: Point3D[]; // 478 normalized 3D landmarks (or empty when 0 faces / no live video)
  avgLuminance: number; // 0..255 computed from ctx.getImageData
  lowLightBoostActive: boolean; // avgLuminance < 95
  earLeft: number;
  earRight: number;
  earAvg: number;
  earVariance: number;
  noseDriftPx: number;
  gazeStill: boolean;
  eyeLocked: boolean;
  gazeBoost: number;
  browFurrowScore: number; // AU4: browDownLeft, browDownRight, browInnerUp + geometric compression
  eyeSquintScore: number; // AU7: eyeSquintLeft, eyeSquintRight
  mouthTensionScore: number; // mouthPressLeft/Right, mouthFrownLeft/Right
  headYawDeg: number;
  headPitchDeg: number;
  emotion: EmotionLabel;
  confidence: number;
  embedding192: number[]; // L2-normalized 192-d pure 3D geometric descriptor
  cosineSimilarity: number;
  // SP-BEF Face Branch outputs (C1, C2, C4)
  rFace: number;
  llrFace: number;
  faceCalProb: number;
  faceRawProb: number;
  personalBaselineReady: boolean;
}

// MediaPipe canonical eye indices for Eye Aspect Ratio (EAR)
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144] as const;
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380] as const;
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;
export const LEFT_EYEBROW_INDICES = [70, 63, 105, 66, 107] as const;
export const RIGHT_EYEBROW_INDICES = [336, 296, 334, 293, 300] as const;
export const LIPS_OUTER_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
] as const;

interface MediaPipeBlendshapeCategory {
  categoryName: string;
  score: number;
}

interface MediaPipeDetectionResult {
  faceLandmarks?: Point3D[][];
  faceBlendshapes?: { categories: MediaPipeBlendshapeCategory[] }[];
  facialTransformationMatrixes?: { data: number[] }[];
}

interface MediaPipeFaceLandmarker {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MediaPipeDetectionResult;
}

let mediaPipeLandmarker: MediaPipeFaceLandmarker | null = null;
let mediaPipeLoading = false;
let mediaPipeFailed = false;

/**
 * Dynamically loads @mediapipe/tasks-vision (0.10.14) and initializes FaceLandmarker
 * from local `/models/face_landmarker.task` first, with official Google Storage CDN fallback.
 */
export async function ensureMediaPipeFaceLandmarker(): Promise<MediaPipeFaceLandmarker | null> {
  if (mediaPipeLandmarker) return mediaPipeLandmarker;
  if (mediaPipeLoading || mediaPipeFailed || typeof window === 'undefined') return null;

  mediaPipeLoading = true;
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const visionModule = await dynamicImport(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    );
    const { FilesetResolver, FaceLandmarker } = visionModule;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    );
    try {
      mediaPipeLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    } catch {
      mediaPipeLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    }
    mediaPipeLoading = false;
    return mediaPipeLandmarker;
  } catch {
    mediaPipeLoading = false;
    mediaPipeFailed = true;
    return null;
  }
}

function dist2D(a: Point3D, b: Point3D, widthPx = 1, heightPx = 1): number {
  const dx = (a.x - b.x) * widthPx;
  const dy = (a.y - b.y) * heightPx;
  return Math.hypot(dx, dy);
}

/**
 * Computes real Eye Aspect Ratio (EAR) from 6 canonical eye landmarks:
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 */
export function computeEyeAspectRatio(
  landmarks: Point3D[],
  indices: readonly [number, number, number, number, number, number],
  widthPx = 1,
  heightPx = 1,
): number {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0;

  const v1 = dist2D(p2, p6, widthPx, heightPx);
  const v2 = dist2D(p3, p5, widthPx, heightPx);
  const h = Math.max(dist2D(p1, p4, widthPx, heightPx), 1e-5);
  return Number(Math.max(0.08, Math.min(0.45, (v1 + v2) / (2.0 * h))).toFixed(4));
}

/**
 * Computes real average luminance (0..255) from canvas pixel RGB values via ctx.getImageData.
 */
export function computeCanvasLuminance(
  ctx: CanvasRenderingContext2D | null,
  width: number,
  height: number,
): { avgLuminance: number } {
  if (!ctx || width <= 0 || height <= 0) {
    return { avgLuminance: 0 };
  }
  try {
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    let totalLuma = 0;
    let sampleCount = 0;

    const step = 4;
    for (let y = 8; y < height - 8; y += step) {
      for (let x = 8; x < width - 8; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuma += luma;
        sampleCount++;
      }
    }

    const avgLuminance = sampleCount > 0 ? Math.round(totalLuma / sampleCount) : 0;
    return { avgLuminance };
  } catch {
    return { avgLuminance: 0 };
  }
}

/**
 * Extracts a 192-d L2-normalized pure geometric biometric descriptor
 * from the 478 3D landmarks (Nose-Centered + Inter-Ocular Distance normalized).
 * Strictly computed from real 3D landmark geometry: ((pt.x - nose.x)/iod, (pt.y - nose.y)/iod, (pt.z - nose.z)/iod).
 */
export function extract192dBiometricDescriptor(landmarks: Point3D[]): number[] {
  if (!landmarks || landmarks.length < 468) {
    return [];
  }
  const nose = landmarks[1] || { x: 0.5, y: 0.5, z: 0 };
  const leftOuter = landmarks[33] || { x: 0.4, y: 0.45, z: 0 };
  const rightOuter = landmarks[263] || { x: 0.6, y: 0.45, z: 0 };
  const iod = Math.max(Math.hypot(leftOuter.x - rightOuter.x, leftOuter.y - rightOuter.y), 1e-4);

  const raw: number[] = new Array(192);
  // 64 canonical landmarks * 3 coordinates (dx, dy, dz) relative to Nose Tip (#1) normalized by IOD = 192 dimensions
  for (let i = 0; i < 64; i++) {
    const lmIdx = (i * 7 + 1) % landmarks.length;
    const pt = landmarks[lmIdx] || nose;
    const baseIdx = i * 3;
    raw[baseIdx] = (pt.x - nose.x) / iod;
    raw[baseIdx + 1] = (pt.y - nose.y) / iod;
    raw[baseIdx + 2] = ((pt.z ?? 0) - (nose.z ?? 0)) / iod;
  }

  const norm = Math.sqrt(raw.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 1e-9) {
    return [];
  }
  return raw.map((v) => Number((v / norm).toFixed(5)));
}

/**
 * Computes Cosine similarity between a live 192-d L2-normalized descriptor
 * and the registered 3-pose embeddings (front, left, right).
 */
export function computeMaxCosineSimilarity(
  liveVec: number[],
  registered: { front: number[] | null; left: number[] | null; right: number[] | null },
): number {
  if (!liveVec || liveVec.length !== 192) return 0;
  const candidates = [registered.front, registered.left, registered.right].filter(
    (v): v is number[] => Array.isArray(v) && v.length === 192,
  );
  if (candidates.length === 0) return 0;

  let maxSim = -1;
  for (const reg of candidates) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < 192; i++) {
      dot += liveVec[i] * reg[i];
      normA += liveVec[i] * liveVec[i];
      normB += reg[i] * reg[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const sim = denom > 1e-9 ? dot / denom : 0;
    if (sim > maxSim) maxSim = sim;
  }
  return Number(Math.max(0, Math.min(0.99, maxSim)).toFixed(3));
}

/**
 * Stateful tracker that maintains:
 * - 10-second sliding frame buffer (`frameWindow`) for `aggregateClipWindow`
 * - On-device `PersonalBaselineCalibrator` (C2)
 * - Dynamic Frame Reliability `rFace` (C4)
 * - Calibrated Face Branch LLR `llrFace` (C1)
 */
export class RealFaceTrackerSession {
  private earHistory: number[] = [];
  private noseHistory: { x: number; y: number }[] = [];
  private frameWindow: { timestampMs: number; stat: FrameTelemetryStat }[] = [];
  private readonly baselineCalibrator: PersonalBaselineCalibrator;

  constructor(minBaselineSamples = 5, baselineDurationSec = 60) {
    this.baselineCalibrator = new PersonalBaselineCalibrator(
      minBaselineSamples,
      baselineDurationSec,
    );
  }

  public getBaselineCalibrator(): PersonalBaselineCalibrator {
    return this.baselineCalibrator;
  }

  public getWindowFrameCount(): number {
    return this.frameWindow.length;
  }

  public reset(): void {
    this.earHistory = [];
    this.noseHistory = [];
    this.frameWindow = [];
    this.baselineCalibrator.reset();
  }

  private pushAndAggregateWindow(
    stat: FrameTelemetryStat,
    nowMs: number,
  ): {
    rFace: number;
    llrFace: number;
    faceCalProb: number;
    faceRawProb: number;
    personalBaselineReady: boolean;
  } {
    // ~10 fps like the DAiSEE training data (see FACE_WINDOW_SAMPLE_MS).
    const last = this.frameWindow[this.frameWindow.length - 1];
    if (!last || nowMs - last.timestampMs >= FACE_WINDOW_SAMPLE_MS) {
      this.frameWindow.push({ timestampMs: nowMs, stat });
    }
    this.frameWindow = this.frameWindow.filter((w) => nowMs - w.timestampMs <= 10_000);

    if (!stat.detected) {
      return {
        rFace: 0.0,
        llrFace: 0.0,
        faceCalProb: 0.0,
        faceRawProb: 0.0,
        personalBaselineReady: this.baselineCalibrator.isReady(),
      };
    }

    const agg = aggregateClipWindow(this.frameWindow.map((w) => w.stat));
    const frameR = computeFrameReliability(
      agg.face_present_ratio,
      stat.luminance,
      Math.abs(stat.head_yaw_deg ?? 0),
      Math.abs(stat.head_pitch_deg ?? 0),
      1.0,
    );

    if (frameR <= 0.0) {
      return {
        rFace: 0.0,
        llrFace: 0.0,
        faceCalProb: 0.0,
        faceRawProb: 0.0,
        personalBaselineReady: this.baselineCalibrator.isReady(),
      };
    }

    this.baselineCalibrator.observe(agg, frameR, nowMs);
    const faceVec = this.baselineCalibrator.buildFaceModelVector(agg, frameR);
    const { rawProb, calProb, llr } = predictLinearCalibratedBranch(
      faceVec,
      SP_BEF_PARAMS.branches.face,
    );

    return {
      rFace: frameR,
      llrFace: llr,
      faceCalProb: calProb,
      faceRawProb: rawProb,
      personalBaselineReady: this.baselineCalibrator.isReady(),
    };
  }

  public async processFrame(
    video: HTMLVideoElement | null,
    ctx: CanvasRenderingContext2D | null,
    canvasWidth: number,
    canvasHeight: number,
    registeredEmbeddings: { front: number[] | null; left: number[] | null; right: number[] | null },
    nowMs: number = Date.now(),
  ): Promise<RealCvFrameResult> {
    const hasLiveVideo = Boolean(
      video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused && !video.ended,
    );

    const pixelStats = computeCanvasLuminance(ctx, canvasWidth, canvasHeight);
    const avgLuminance = pixelStats.avgLuminance;
    const lowLightBoostActive = hasLiveVideo && avgLuminance > 0 && avgLuminance < 95;

    let engineMode: RealCvFrameResult['engineMode'] = 'no_stream';
    let faceDetected = false;
    let landmarks: Point3D[] = [];
    let browFurrowScore = 0;
    let eyeSquintScore = 0;
    let mouthTensionScore = 0;
    let smileScore = 0;
    let headYawDeg = 0;
    let headPitchDeg = 0;
    let iod = 0.145;

    if (hasLiveVideo && video) {
      const mp = await ensureMediaPipeFaceLandmarker();
      if (mp) {
        try {
          const res = mp.detectForVideo(video, performance.now());
          engineMode = 'mediapipe_wasm';
          if (
            res.faceLandmarks &&
            res.faceLandmarks.length > 0 &&
            res.faceLandmarks[0].length >= 468
          ) {
            faceDetected = true;
            landmarks = res.faceLandmarks[0];

            const cats = res.faceBlendshapes?.[0]?.categories || [];
            const getBs = (name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;

            const leftOuter = landmarks[33];
            const rightOuter = landmarks[263];
            iod = Math.max(
              Math.hypot(leftOuter.x - rightOuter.x, leftOuter.y - rightOuter.y),
              1e-4,
            );
            const browDistNorm =
              Math.hypot(
                landmarks[107].x - landmarks[336].x,
                landmarks[107].y - landmarks[336].y,
              ) / iod;
            const browEyeV =
              (landmarks[159].y - landmarks[65].y + (landmarks[386].y - landmarks[295].y)) /
              (2.0 * iod);
            const geomFurrow = clipVal(
              (0.36 - browEyeV) * 2.5 + (0.28 - browDistNorm) * 2.0,
              0.0,
              1.0,
            );

            const browDownL = getBs('browDownLeft');
            const browDownR = getBs('browDownRight');
            const browInnerUp = getBs('browInnerUp');
            browFurrowScore = Number(
              Math.min(
                1.0,
                (browDownL + browDownR) * 0.55 + browInnerUp * 0.4 + geomFurrow * 0.35,
              ).toFixed(4),
            );

            eyeSquintScore = Number(
              Math.min(
                1.0,
                (getBs('eyeSquintLeft') + getBs('eyeSquintRight')) * 0.55 +
                  (getBs('cheekSquintLeft') + getBs('cheekSquintRight')) * 0.25,
              ).toFixed(4),
            );

            const mouthPress = (getBs('mouthPressLeft') + getBs('mouthPressRight')) * 0.5;
            const mouthFrown = (getBs('mouthFrownLeft') + getBs('mouthFrownRight')) * 0.5;
            const jawOpen = getBs('jawOpen');
            mouthTensionScore = Number(
              Math.min(1.0, mouthPress * 0.55 + mouthFrown * 0.55 + jawOpen * 0.15).toFixed(4),
            );
            smileScore = Number(
              ((getBs('mouthSmileLeft') + getBs('mouthSmileRight')) * 0.5).toFixed(4),
            );

            const nose = landmarks[1];
            if (nose && leftOuter && rightOuter) {
              const eyeMidX = 0.5 * (leftOuter.x + rightOuter.x);
              const eyeMidY = 0.5 * (leftOuter.y + rightOuter.y);
              headYawDeg = Number((((nose.x - eyeMidX) / iod) * 55.0).toFixed(2));
              headPitchDeg = Number((((nose.y - eyeMidY) / iod - 0.35) * 45.0).toFixed(2));
            }
          } else {
            faceDetected = false;
            landmarks = [];
          }
        } catch {
          faceDetected = false;
          landmarks = [];
        }
      }
    }

    // Strict P1.1 guard: when no live video or 0 faces detected, never fabricate landmarks or face presence
    if (!hasLiveVideo || !faceDetected || landmarks.length < 468) {
      const noFaceSpBef = this.pushAndAggregateWindow(
        { detected: false, luminance: avgLuminance },
        nowMs,
      );
      return {
        engineMode,
        faceDetected: false,
        landmarks: [],
        avgLuminance,
        lowLightBoostActive: false,
        earLeft: 0,
        earRight: 0,
        earAvg: 0,
        earVariance: 0,
        noseDriftPx: 0,
        gazeStill: false,
        eyeLocked: false,
        gazeBoost: 1.0,
        browFurrowScore: 0,
        eyeSquintScore: 0,
        mouthTensionScore: 0,
        headYawDeg: 0,
        headPitchDeg: 0,
        emotion: 'no_face',
        confidence: 0,
        embedding192: [],
        cosineSimilarity: 0,
        rFace: 0.0,
        llrFace: 0.0,
        faceCalProb: 0.0,
        faceRawProb: 0.0,
        personalBaselineReady: noFaceSpBef.personalBaselineReady,
      };
    }

    // Compute real Left & Right EAR from MediaPipe indices (normalized coordinates matching Python _compute_ear)
    const earLeft = computeEyeAspectRatio(landmarks, LEFT_EYE_INDICES, 1, 1);
    const earRight = computeEyeAspectRatio(landmarks, RIGHT_EYE_INDICES, 1, 1);
    const earAvg = Number(((earLeft + earRight) / 2).toFixed(4));

    this.earHistory.push(earAvg);
    if (this.earHistory.length > 10) this.earHistory.shift();
    const earMean =
      this.earHistory.reduce((acc, v) => acc + v, 0) / Math.max(1, this.earHistory.length);
    const earVariance = Number(
      (
        this.earHistory.reduce((acc, v) => acc + (v - earMean) * (v - earMean), 0) /
        Math.max(1, this.earHistory.length)
      ).toFixed(5),
    );

    const nosePt = landmarks[1] || { x: 0.5, y: 0.5, z: 0 };
    const nosePx = { x: nosePt.x * canvasWidth, y: nosePt.y * canvasHeight };
    this.noseHistory.push(nosePx);
    if (this.noseHistory.length > 5) this.noseHistory.shift();
    let maxDrift = 0;
    for (let i = 1; i < this.noseHistory.length; i++) {
      const d = Math.hypot(
        this.noseHistory[i].x - this.noseHistory[0].x,
        this.noseHistory[i].y - this.noseHistory[0].y,
      );
      if (d > maxDrift) maxDrift = d;
    }
    const noseDriftPx = Number(maxDrift.toFixed(2));

    const gazeStill = noseDriftPx < 3.5;
    const eyeLocked = gazeStill && earAvg > 0.22 && earVariance < 0.002;
    const gazeBoost = eyeLocked ? 1.6 : gazeStill ? 1.3 : 1.0;

    const spBefOut = this.pushAndAggregateWindow(
      {
        detected: true,
        luminance: avgLuminance,
        brow_furrow: browFurrowScore,
        eye_squint: eyeSquintScore,
        mouth_tension: mouthTensionScore,
        ear: earAvg,
        head_yaw_deg: headYawDeg,
        head_pitch_deg: headPitchDeg,
        nose_x: nosePt.x,
        nose_y: nosePt.y,
        iod,
      },
      nowMs,
    );

    let emotion: EmotionLabel = 'focused';
    let confidence = spBefOut.rFace;

    if (spBefOut.rFace <= 0.0) {
      emotion = 'neutral';
      confidence = 0;
    } else if (earAvg < 0.17 || Math.abs(headYawDeg) > 28 || Math.abs(headPitchDeg) > 22) {
      emotion = 'bored';
      confidence = Number((0.75 * spBefOut.rFace).toFixed(2));
    } else if (browFurrowScore >= 0.48 && mouthTensionScore >= 0.35) {
      emotion = 'frustrated';
      confidence = Number(Math.min(0.96, (0.72 + browFurrowScore * 0.25) * spBefOut.rFace).toFixed(2));
    } else if (
      spBefOut.faceCalProb >= 0.55 ||
      browFurrowScore >= 0.38 ||
      (eyeSquintScore >= 0.35 && gazeStill) ||
      (eyeLocked && browFurrowScore >= 0.24)
    ) {
      emotion = 'confused';
      confidence = Number(Math.min(0.95, Math.max(spBefOut.faceCalProb, 0.7) * spBefOut.rFace).toFixed(2));
    } else if (smileScore >= 0.42) {
      emotion = 'happy';
      confidence = Number(Math.min(0.95, (0.75 + smileScore * 0.2) * spBefOut.rFace).toFixed(2));
    } else {
      emotion = 'focused';
      confidence = Number((0.88 * spBefOut.rFace).toFixed(2));
    }

    const embedding192 = extract192dBiometricDescriptor(landmarks);
    const cosineSimilarity = computeMaxCosineSimilarity(embedding192, registeredEmbeddings);

    return {
      engineMode,
      faceDetected: true,
      landmarks,
      avgLuminance,
      lowLightBoostActive,
      earLeft,
      earRight,
      earAvg,
      earVariance,
      noseDriftPx,
      gazeStill,
      eyeLocked,
      gazeBoost,
      browFurrowScore,
      eyeSquintScore,
      mouthTensionScore,
      headYawDeg,
      headPitchDeg,
      emotion,
      confidence,
      embedding192,
      cosineSimilarity,
      rFace: spBefOut.rFace,
      llrFace: spBefOut.llrFace,
      faceCalProb: spBefOut.faceCalProb,
      faceRawProb: spBefOut.faceRawProb,
      personalBaselineReady: spBefOut.personalBaselineReady,
    };
  }
}

/**
 * Draws the detected 478 3D landmarks, face oval, eyebrow vectors, eye contours,
 * and nose tip anchor at the real detected (x, y) coordinates on the canvas.
 */
export function drawRealFaceLandmarksOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Point3D[],
  options: {
    isOwnerVerified: boolean;
    emotion: EmotionLabel;
    eyeLocked: boolean;
    earAvg: number;
    noseDriftPx: number;
    gazeBoost: number;
    headYawDeg: number;
  },
) {
  if (landmarks.length === 0) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.fillStyle = 'rgba(17,24,39,0.85)';
    ctx.fillRect(28, height / 2 - 22, width - 56, 44);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '600 12px sans-serif';
    ctx.fillText('KHÔNG PHÁT HIỆN KHUÔN MẶT TRÊN WEBCAM (0 FACES)', 40, height / 2 - 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 11px sans-serif';
    ctx.fillText('Nhánh khuôn mặt r_face = 0.0 (Không bịa điểm mốc)', 40, height / 2 + 14);
    return;
  }

  const isConfused = options.emotion === 'confused' || options.emotion === 'frustrated';
  const strokeColor = !options.isOwnerVerified
    ? '#ef4444'
    : isConfused
      ? '#f59e0b'
      : options.eyeLocked
        ? '#0866ff'
        : '#10b981';

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < landmarks.length; i += 3) {
    const pt = landmarks[i];
    if (!pt) continue;
    ctx.fillRect(pt.x * width - 0.75, pt.y * height - 0.75, 1.5, 1.5);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  FACE_OVAL_INDICES.forEach((idx, i) => {
    const pt = landmarks[idx];
    if (!pt) return;
    if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
    else ctx.lineTo(pt.x * width, pt.y * height);
  });
  ctx.closePath();
  ctx.stroke();

  const drawPolyline = (indices: readonly number[], close = false) => {
    ctx.beginPath();
    indices.forEach((idx, i) => {
      const pt = landmarks[idx];
      if (!pt) return;
      if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
      else ctx.lineTo(pt.x * width, pt.y * height);
    });
    if (close) ctx.closePath();
    ctx.stroke();
  };

  ctx.lineWidth = 2;
  drawPolyline(LEFT_EYEBROW_INDICES, false);
  drawPolyline(RIGHT_EYEBROW_INDICES, false);

  ctx.lineWidth = 1.6;
  drawPolyline(LEFT_EYE_INDICES, true);
  drawPolyline(RIGHT_EYE_INDICES, true);

  ctx.lineWidth = 1.4;
  drawPolyline(LIPS_OUTER_INDICES, true);

  const nose = landmarks[1];
  if (nose) {
    ctx.fillStyle = options.eyeLocked ? '#0866ff' : '#10b981';
    ctx.beginPath();
    ctx.arc(nose.x * width, nose.y * height, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(17,24,39,0.82)';
  ctx.fillRect(8, 8, width - 16, 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 11px sans-serif';
  ctx.fillText(
    `EAR: ${options.earAvg.toFixed(2)} | Drift: ${options.noseDriftPx.toFixed(1)}px | Yaw: ${options.headYawDeg.toFixed(1)}° | x${options.gazeBoost.toFixed(2)}`,
    14,
    24,
  );
}
