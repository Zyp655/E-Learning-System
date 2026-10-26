'use client';

import { create } from 'zustand';
import { lmsApi, type ConfusionPredictResult } from '@/api';
import type {
  ConfusionExplanationResult,
  EmotionLabel,
  MultimodalFeatures12,
} from '@/api/types';
import {
  PersonalBaselineCalibrator,
  SP_BEF_PARAMS,
  aggregateClipWindow,
  computeFrameReliability,
  getSegmentPriorForTimestamp,
  predictLinearCalibratedBranch,
  spBefStep,
  type FrameTelemetryStat,
  type SpBefLevel,
} from './spBefCore';

export const BEHAVIOR_WINDOW_MS = 300_000; // 5 minutes (300s)
export const FACE_WINDOW_MS = 10_000; // 10 seconds (10s)
export const COLD_START_POSTERIOR = 0.15;

export interface PauseEventItem {
  timestampMs: number;
  durationSec: number;
}

export interface RewindEventItem {
  timestampMs: number;
  videoSec: number;
}

export interface SpeedEventItem {
  timestampMs: number;
  speed: number;
}

export interface QuizEventItem {
  timestampMs: number;
  scorePercent: number;
  timeSec: number;
  attemptCount: number;
}

export interface FrameTelemetry {
  timestampMs: number;
  videoTimestampSec: number;
  detected: boolean;
  emotion: EmotionLabel;
  confidence: number;
  earAvg: number;
  earVariance: number;
  noseDriftPx: number;
  gazeStill: boolean;
  eyeLocked: boolean;
  avgLuminance: number;
  browFurrowScore: number;
  eyeSquintScore: number;
  mouthTensionScore: number;
  headYawDeg: number;
  headPitchDeg: number;
  rFace: number;
  llrFace: number;
}

export interface EmotionTimelinePoint {
  t: number;
  emotion: EmotionLabel;
  confidence: number;
  ear: number;
  gazeStill: boolean;
  eyeLocked: boolean;
}

export interface SelfReportItem {
  timestampSeconds: number;
  level: 1 | 2 | 3 | 4;
  label: string;
  createdAt: string;
}

export interface ConfusionState {
  cameraEnabled: boolean;
  cameraStreaming: boolean;
  currentEmotion: EmotionLabel;
  emotionConfidence: number;
  earAvg: number;
  earVariance: number;
  noseDriftPx: number;
  gazeStill: boolean;
  eyeLocked: boolean;
  gazeBoost: number;
  avgLuminance: number;
  lowLightBoostActive: boolean;
  browFurrowScore: number;
  eyeSquintScore: number;
  mouthTensionScore: number;
  headYawDeg: number;
  headPitchDeg: number;

  // Biometric Face Verification Guard (every 5s)
  faceSimilarity: number;
  isOwnerVerified: boolean;
  consecutiveNoFaceChecks: number;
  consecutiveMismatchChecks: number;
  faceAbsentOverlayOpen: boolean;
  identityMismatchOverlayOpen: boolean;

  // Time-based Sliding Window Buffers (5m behavior / 10s face)
  pauseEvents: PauseEventItem[];
  rewindEvents: RewindEventItem[];
  speedEvents: SpeedEventItem[];
  quizEvents: QuizEventItem[];
  frameWindow: FrameTelemetry[];

  // 12-Feature Multimodal Vector + Hybrid Sliding Window (3) + Cooldown
  features12: MultimodalFeatures12;
  slidingWindowEmotions: EmotionLabel[];
  ruleScore: number;
  mlProb: number;
  mlLevel: SpBefLevel;
  lastTriggerTimestampMs: number | null;
  cooldownRemainingSec: number;

  // SP-BEF State (C1..C5)
  posteriorProb: number;
  priorProb: number;
  llrFace: number;
  llrBeh: number;
  llrQuiz: number;
  rFace: number;
  rBeh: number;
  rQuiz: number;
  contribFace: number;
  contribBeh: number;
  contribQuiz: number;
  segmentPrior: number;
  highDurationSec: number;
  apiStatus: 'ok' | 'indeterminate';
  personalBaselineReady: boolean;

  // Timeline & Self-report
  emotionTimeline: EmotionTimelinePoint[];
  selfReports: SelfReportItem[];

  // Proactive Auto-Intervention Overlay
  activeIntervention: ConfusionExplanationResult | null;
  interventionOpen: boolean;
  interventionLoading: boolean;
  resolvedEpisodesCount: number;

  // Actions
  setCameraEnabled: (enabled: boolean) => void;
  setCameraStreaming: (streaming: boolean) => void;
  updateCvFrameMetrics: (
    metrics: {
      videoTimestampSec: number;
      emotion: EmotionLabel;
      confidence: number;
      earAvg: number;
      earVariance: number;
      noseDriftPx: number;
      gazeStill: boolean;
      eyeLocked: boolean;
      avgLuminance: number;
      browFurrowScore: number;
      eyeSquintScore: number;
      mouthTensionScore?: number;
      headYawDeg: number;
      headPitchDeg: number;
      faceDetected?: boolean;
      rFace?: number;
      llrFace?: number;
      personalBaselineReady?: boolean;
    },
    nowMs?: number,
  ) => void;
  recordVideoPause: (durationSec: number, nowMs?: number) => void;
  recordVideoRewind: (fromSec: number, toSec: number, nowMs?: number) => void;
  recordSpeedChange: (newSpeed: number, nowMs?: number) => void;
  recordQuizOutcome: (
    scorePercent: number,
    timeSec: number,
    attemptCount?: number,
    nowMs?: number,
  ) => void;
  evictExpiredWindows: (nowMs?: number) => void;
  syncPredictConfusionWithApi: () => Promise<ConfusionPredictResult>;
  setApiStatus: (status: 'ok' | 'indeterminate') => void;
  recordBiometricCheck: (
    result: 'owner' | 'no_face' | 'mismatch',
    similarity: number,
    videoTimestampSec: number,
  ) => void;
  resolveBiometricAlert: () => void;
  submitSelfReport: (lessonId: number, videoTimestampSec: number, level: 1 | 2 | 3 | 4) => Promise<void>;
  triggerProactiveIntervention: (
    lessonId: number,
    videoTimestampSec: number,
    source: 'ml_model' | 'hybrid_rule' | 'self_report',
    bypassCooldown?: boolean,
  ) => Promise<void>;
  closeIntervention: (feedback?: 'helpful' | 'not_helpful' | 'dismissed') => void;
  resetCooldown: () => void;
  resetAll: () => void;
}

export const INITIAL_FEATURES_12: MultimodalFeatures12 = {
  pause_count: 0,
  avg_pause_duration: 0,
  long_pause_count: 0,
  rewind_count: 0,
  rewind_same_spot: 0,
  speed_decrease: 0,
  confused_ratio: 0,
  frustrated_ratio: 0,
  emotion_transitions: 0,
  neg_emotion_streak: 0,
  quiz_score: 0,
  quiz_time: 0,
};

const storeBaselineCalibrator = new PersonalBaselineCalibrator(5, 60);

function calculateHybridRuleScore(
  f: MultimodalFeatures12,
  window3: EmotionLabel[],
  lastEmotion: EmotionLabel,
  confidence: number,
  gazeStill: boolean,
  eyeLocked: boolean,
): number {
  let score = 0;
  if (f.pause_count >= 3) score += 30;
  if (f.rewind_count >= 2) score += 40;
  if (f.rewind_count >= 1 && f.pause_count >= 2) score += 10;
  if (f.pause_count >= 2) score += 10;

  const negCount = window3.filter((e) => e === 'confused' || e === 'frustrated').length;
  if (negCount === 3) score += 40;
  else if (negCount === 2) score += 15;
  else if (negCount === 1) score += 5;

  if (confidence >= 0.3) {
    if (lastEmotion === 'bored') score += 20;
    else if (lastEmotion === 'focused') score -= 20;
    else if (lastEmotion === 'happy') score -= 10;
  }

  if (gazeStill && eyeLocked && (lastEmotion === 'confused' || lastEmotion === 'frustrated')) {
    score += 15;
  } else if (gazeStill && (lastEmotion === 'confused' || lastEmotion === 'frustrated')) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
}

function computeWindowedFeaturesAndSpBef(params: {
  pauseEvents: PauseEventItem[];
  rewindEvents: RewindEventItem[];
  speedEvents: SpeedEventItem[];
  quizEvents: QuizEventItem[];
  frameWindow: FrameTelemetry[];
  negEmotionStreak: number;
  prevPosterior: number;
  prevHighSec: number;
  prevIntervening: boolean;
  cooldownRemainingSec: number;
  videoTimestampSec: number;
  nowMs: number;
}) {
  const validPauses = params.pauseEvents.filter(
    (e) => params.nowMs - e.timestampMs <= BEHAVIOR_WINDOW_MS,
  );
  const validRewinds = params.rewindEvents.filter(
    (e) => params.nowMs - e.timestampMs <= BEHAVIOR_WINDOW_MS,
  );
  const validSpeeds = params.speedEvents.filter(
    (e) => params.nowMs - e.timestampMs <= BEHAVIOR_WINDOW_MS,
  );
  const validQuizzes = params.quizEvents.filter(
    (e) => params.nowMs - e.timestampMs <= BEHAVIOR_WINDOW_MS,
  );
  const validFrames = params.frameWindow.filter(
    (f) => params.nowMs - f.timestampMs <= FACE_WINDOW_MS,
  );

  const pauseCount = validPauses.length;
  const avgPauseDuration =
    pauseCount > 0
      ? Number(
          (validPauses.reduce((acc, e) => acc + e.durationSec, 0) / pauseCount).toFixed(2),
        )
      : 0;
  const longPauseCount = validPauses.filter((e) => e.durationSec > 10).length;

  const rewindCount = validRewinds.length;
  let rewindSameSpot = 0;
  for (let i = 1; i < validRewinds.length; i++) {
    const isNearPrevious = validRewinds
      .slice(0, i)
      .some((prev) => Math.abs(validRewinds[i].videoSec - prev.videoSec) <= 30);
    if (isNearPrevious) rewindSameSpot++;
  }

  const speedDecrease = validSpeeds.some((e) => e.speed < 1.0) ? 1 : 0;

  let confusedRatio = 0;
  let frustratedRatio = 0;
  let emotionTransitions = 0;
  if (validFrames.length > 0) {
    confusedRatio = Number(
      (
        validFrames.filter((f) => f.emotion === 'confused').length / validFrames.length
      ).toFixed(2),
    );
    frustratedRatio = Number(
      (
        validFrames.filter((f) => f.emotion === 'frustrated').length / validFrames.length
      ).toFixed(2),
    );
    for (let i = 1; i < validFrames.length; i++) {
      if (validFrames[i].emotion !== validFrames[i - 1].emotion) {
        emotionTransitions++;
      }
    }
  }

  const negStreak = validFrames.length === 0 ? 0 : params.negEmotionStreak;
  const latestQuiz = validQuizzes.length > 0 ? validQuizzes[validQuizzes.length - 1] : null;

  const features12: MultimodalFeatures12 = {
    pause_count: pauseCount,
    avg_pause_duration: avgPauseDuration,
    long_pause_count: longPauseCount,
    rewind_count: rewindCount,
    rewind_same_spot: rewindSameSpot,
    speed_decrease: speedDecrease,
    confused_ratio: confusedRatio,
    frustrated_ratio: frustratedRatio,
    emotion_transitions: emotionTransitions,
    neg_emotion_streak: negStreak,
    quiz_score: latestQuiz ? latestQuiz.scorePercent : 0,
    quiz_time: latestQuiz ? latestQuiz.timeSec : 0,
  };

  // Evaluate SP-BEF Face Branch on 10s frameWindow
  let rFace = 0.0;
  let llrFace = 0.0;
  if (validFrames.length > 0) {
    const lastFrame = validFrames[validFrames.length - 1];
    const stats: FrameTelemetryStat[] = validFrames.map((fw) => ({
      detected: fw.detected && fw.emotion !== 'no_face',
      luminance: fw.avgLuminance,
      brow_furrow: fw.browFurrowScore,
      eye_squint: fw.eyeSquintScore,
      mouth_tension: fw.mouthTensionScore,
      ear: fw.earAvg,
      head_yaw_deg: fw.headYawDeg,
      head_pitch_deg: fw.headPitchDeg,
      nose_x: 0.5 + fw.noseDriftPx / 640,
      nose_y: 0.5,
      iod: 0.145,
    }));
    const agg = aggregateClipWindow(stats);
    rFace =
      !lastFrame.detected || lastFrame.emotion === 'no_face'
        ? 0.0
        : computeFrameReliability(
            agg.face_present_ratio,
            lastFrame.avgLuminance,
            Math.abs(lastFrame.headYawDeg),
            Math.abs(lastFrame.headPitchDeg),
            lastFrame.confidence > 0 ? lastFrame.confidence : 1.0,
          );

    if (rFace > 0) {
      storeBaselineCalibrator.observe(agg, rFace, params.nowMs);
      const faceVec20 = storeBaselineCalibrator.build20FaceModelVector(agg, rFace);
      const faceBranch = predictLinearCalibratedBranch(faceVec20, SP_BEF_PARAMS.branches.face);
      llrFace = lastFrame.llrFace !== 0 ? lastFrame.llrFace : faceBranch.llr;
    } else {
      llrFace = 0.0;
    }
  }

  // Evaluate SP-BEF Behavior Branch on 5m sliding window
  const hasBehActivity =
    validPauses.length > 0 || validRewinds.length > 0 || validSpeeds.length > 0;
  let rBeh = 0.0;
  let llrBeh = 0.0;
  if (hasBehActivity) {
    rBeh = 1.0;
    const behVec = [
      pauseCount,
      avgPauseDuration,
      longPauseCount,
      rewindCount,
      rewindSameSpot > 0 ? 1.0 : 0.0,
      speedDecrease,
    ];
    llrBeh = predictLinearCalibratedBranch(behVec, SP_BEF_PARAMS.branches.behavior).llr;
  }

  // Evaluate SP-BEF Quiz Branch
  let rQuiz = 0.0;
  let llrQuiz = 0.0;
  if (latestQuiz) {
    rQuiz = 1.0;
    const quizVec = [
      latestQuiz.scorePercent,
      latestQuiz.timeSec,
      latestQuiz.attemptCount,
    ];
    llrQuiz = predictLinearCalibratedBranch(quizVec, SP_BEF_PARAMS.branches.quiz).llr;
  }

  const segmentPrior = getSegmentPriorForTimestamp(params.videoTimestampSec);
  const step = spBefStep(
    params.prevPosterior,
    segmentPrior,
    llrFace,
    rFace,
    llrBeh,
    rBeh,
    llrQuiz,
    rQuiz,
    SP_BEF_PARAMS.fusion,
    params.prevHighSec,
    params.prevIntervening,
    params.cooldownRemainingSec,
    5.0,
  );

  return {
    validPauses,
    validRewinds,
    validSpeeds,
    validQuizzes,
    validFrames,
    features12,
    step,
    personalBaselineReady: storeBaselineCalibrator.isReady(),
  };
}

export const useConfusionStore = create<ConfusionState>((set, get) => ({
  cameraEnabled: true,
  cameraStreaming: false,
  currentEmotion: 'neutral',
  emotionConfidence: 0,
  earAvg: 0,
  earVariance: 0,
  noseDriftPx: 0,
  gazeStill: false,
  eyeLocked: false,
  gazeBoost: 1.0,
  avgLuminance: 0,
  lowLightBoostActive: false,
  browFurrowScore: 0,
  eyeSquintScore: 0,
  mouthTensionScore: 0,
  headYawDeg: 0,
  headPitchDeg: 0,

  faceSimilarity: 0,
  isOwnerVerified: true,
  consecutiveNoFaceChecks: 0,
  consecutiveMismatchChecks: 0,
  faceAbsentOverlayOpen: false,
  identityMismatchOverlayOpen: false,

  pauseEvents: [],
  rewindEvents: [],
  speedEvents: [],
  quizEvents: [],
  frameWindow: [],

  features12: { ...INITIAL_FEATURES_12 },
  slidingWindowEmotions: [],
  ruleScore: 0,
  mlProb: COLD_START_POSTERIOR,
  mlLevel: 'none',
  lastTriggerTimestampMs: null,
  cooldownRemainingSec: 0,

  posteriorProb: COLD_START_POSTERIOR,
  priorProb: COLD_START_POSTERIOR,
  llrFace: 0,
  llrBeh: 0,
  llrQuiz: 0,
  rFace: 0,
  rBeh: 0,
  rQuiz: 0,
  contribFace: 0,
  contribBeh: 0,
  contribQuiz: 0,
  segmentPrior: COLD_START_POSTERIOR,
  highDurationSec: 0,
  apiStatus: 'ok',
  personalBaselineReady: false,

  emotionTimeline: [],
  selfReports: [],
  activeIntervention: null,
  interventionOpen: false,
  interventionLoading: false,
  resolvedEpisodesCount: 0,

  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
  setCameraStreaming: (streaming) => set({ cameraStreaming: streaming }),
  setApiStatus: (status) =>
    set((s) => ({
      apiStatus: status,
      mlLevel: status === 'indeterminate' ? 'unknown' : s.mlLevel,
    })),

  updateCvFrameMetrics: (m, nowMs = Date.now()) => {
    const state = get();
    const detected =
      m.faceDetected !== undefined ? m.faceDetected : m.emotion !== 'no_face';

    // Reset negative emotion streak properly when focused or happy (or neutral/no_face) is observed
    let nextNegStreak = state.features12.neg_emotion_streak;
    if (m.emotion === 'focused' || m.emotion === 'happy' || m.emotion === 'neutral' || m.emotion === 'no_face') {
      nextNegStreak = 0;
    } else if (m.emotion === 'confused' || m.emotion === 'frustrated' || m.emotion === 'bored') {
      nextNegStreak = state.features12.neg_emotion_streak + 1;
    }

    const frameItem: FrameTelemetry = {
      timestampMs: nowMs,
      videoTimestampSec: m.videoTimestampSec,
      detected,
      emotion: m.emotion,
      confidence: m.confidence,
      earAvg: m.earAvg,
      earVariance: m.earVariance,
      noseDriftPx: m.noseDriftPx,
      gazeStill: m.gazeStill,
      eyeLocked: m.eyeLocked,
      avgLuminance: m.avgLuminance,
      browFurrowScore: m.browFurrowScore,
      eyeSquintScore: m.eyeSquintScore,
      mouthTensionScore: m.mouthTensionScore ?? 0,
      headYawDeg: m.headYawDeg,
      headPitchDeg: m.headPitchDeg,
      rFace: m.rFace ?? (detected ? 1.0 : 0.0),
      llrFace: m.llrFace ?? 0.0,
    };

    const updatedFrames = [...state.frameWindow, frameItem];
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: state.pauseEvents,
      rewindEvents: state.rewindEvents,
      speedEvents: state.speedEvents,
      quizEvents: state.quizEvents,
      frameWindow: updatedFrames,
      negEmotionStreak: nextNegStreak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: m.videoTimestampSec,
      nowMs,
    });

    const nextWindow3 = [
      ...state.slidingWindowEmotions,
      m.confidence >= 0.3 ? m.emotion : 'neutral',
    ].slice(-3);

    const gazeBoost =
      m.gazeStill && m.eyeLocked ? 1.6 : m.gazeStill ? 1.3 : m.eyeLocked ? 1.15 : 1.0;
    const ruleScore = calculateHybridRuleScore(
      computed.features12,
      nextWindow3,
      m.emotion,
      m.confidence,
      m.gazeStill,
      m.eyeLocked,
    );

    const nextTimeline: EmotionTimelinePoint[] = [
      ...state.emotionTimeline.slice(-40),
      {
        t: m.videoTimestampSec,
        emotion: m.emotion,
        confidence: m.confidence,
        ear: m.earAvg,
        gazeStill: m.gazeStill,
        eyeLocked: m.eyeLocked,
      },
    ];

    set({
      currentEmotion: m.emotion,
      emotionConfidence: m.confidence,
      earAvg: m.earAvg,
      earVariance: m.earVariance,
      noseDriftPx: m.noseDriftPx,
      gazeStill: m.gazeStill,
      eyeLocked: m.eyeLocked,
      gazeBoost,
      avgLuminance: m.avgLuminance,
      lowLightBoostActive: detected && m.avgLuminance > 0 && m.avgLuminance < 95,
      browFurrowScore: m.browFurrowScore,
      eyeSquintScore: m.eyeSquintScore,
      mouthTensionScore: m.mouthTensionScore ?? 0,
      headYawDeg: m.headYawDeg,
      headPitchDeg: m.headPitchDeg,
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      slidingWindowEmotions: nextWindow3,
      ruleScore,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
      cooldownRemainingSec: computed.step.cooldown_remaining_sec,
      personalBaselineReady: m.personalBaselineReady ?? computed.personalBaselineReady,
      emotionTimeline: nextTimeline,
    });
  },

  recordVideoPause: (durationSec, nowMs = Date.now()) => {
    const state = get();
    const updatedPauses = [...state.pauseEvents, { timestampMs: nowMs, durationSec }];
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: updatedPauses,
      rewindEvents: state.rewindEvents,
      speedEvents: state.speedEvents,
      quizEvents: state.quizEvents,
      frameWindow: state.frameWindow,
      negEmotionStreak: state.features12.neg_emotion_streak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: 0,
      nowMs,
    });

    const ruleScore = calculateHybridRuleScore(
      computed.features12,
      state.slidingWindowEmotions,
      state.currentEmotion,
      state.emotionConfidence,
      state.gazeStill,
      state.eyeLocked,
    );

    set({
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      ruleScore,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
    });
  },

  recordVideoRewind: (_fromSec, toSec, nowMs = Date.now()) => {
    const state = get();
    const updatedRewinds = [...state.rewindEvents, { timestampMs: nowMs, videoSec: toSec }];
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: state.pauseEvents,
      rewindEvents: updatedRewinds,
      speedEvents: state.speedEvents,
      quizEvents: state.quizEvents,
      frameWindow: state.frameWindow,
      negEmotionStreak: state.features12.neg_emotion_streak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: toSec,
      nowMs,
    });

    const ruleScore = calculateHybridRuleScore(
      computed.features12,
      state.slidingWindowEmotions,
      state.currentEmotion,
      state.emotionConfidence,
      state.gazeStill,
      state.eyeLocked,
    );

    set({
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      ruleScore,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
    });
  },

  recordSpeedChange: (newSpeed, nowMs = Date.now()) => {
    const state = get();
    const updatedSpeeds = [...state.speedEvents, { timestampMs: nowMs, speed: newSpeed }];
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: state.pauseEvents,
      rewindEvents: state.rewindEvents,
      speedEvents: updatedSpeeds,
      quizEvents: state.quizEvents,
      frameWindow: state.frameWindow,
      negEmotionStreak: state.features12.neg_emotion_streak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: 0,
      nowMs,
    });

    set({
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
    });
  },

  recordQuizOutcome: (scorePercent, timeSec, attemptCount = 1, nowMs = Date.now()) => {
    const state = get();
    const updatedQuizzes = [
      ...state.quizEvents,
      { timestampMs: nowMs, scorePercent, timeSec, attemptCount },
    ];
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: state.pauseEvents,
      rewindEvents: state.rewindEvents,
      speedEvents: state.speedEvents,
      quizEvents: updatedQuizzes,
      frameWindow: state.frameWindow,
      negEmotionStreak: state.features12.neg_emotion_streak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: 0,
      nowMs,
    });

    set({
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
    });
  },

  evictExpiredWindows: (nowMs = Date.now()) => {
    const state = get();
    const computed = computeWindowedFeaturesAndSpBef({
      pauseEvents: state.pauseEvents,
      rewindEvents: state.rewindEvents,
      speedEvents: state.speedEvents,
      quizEvents: state.quizEvents,
      frameWindow: state.frameWindow,
      negEmotionStreak: state.features12.neg_emotion_streak,
      prevPosterior: state.posteriorProb,
      prevHighSec: state.highDurationSec,
      prevIntervening: state.interventionOpen,
      cooldownRemainingSec: state.cooldownRemainingSec,
      videoTimestampSec: 0,
      nowMs,
    });

    set({
      pauseEvents: computed.validPauses,
      rewindEvents: computed.validRewinds,
      speedEvents: computed.validSpeeds,
      quizEvents: computed.validQuizzes,
      frameWindow: computed.validFrames,
      features12: computed.features12,
      mlProb: computed.step.posterior_prob,
      mlLevel: state.apiStatus === 'indeterminate' ? 'unknown' : computed.step.level,
      posteriorProb: computed.step.posterior_prob,
      priorProb: computed.step.prior_prob,
      llrFace: computed.step.llr_face,
      llrBeh: computed.step.llr_beh,
      llrQuiz: computed.step.llr_quiz,
      rFace: computed.step.r_face,
      rBeh: computed.step.r_beh,
      rQuiz: computed.step.r_quiz,
      contribFace: computed.step.contrib_face,
      contribBeh: computed.step.contrib_beh,
      contribQuiz: computed.step.contrib_quiz,
      segmentPrior: computed.step.segment_prior,
      highDurationSec: computed.step.high_duration_sec,
    });
  },

  syncPredictConfusionWithApi: async () => {
    const state = get();
    const res = await lmsApi.predictConfusion(state.features12);
    if (res.status === 'indeterminate' || res.level === 'unknown' || res.probability === null) {
      set({
        apiStatus: 'indeterminate',
        mlLevel: 'unknown',
      });
      return res;
    }
    set({
      apiStatus: 'ok',
      posteriorProb: res.posteriorProb ?? res.probability,
      mlProb: res.posteriorProb ?? res.probability,
      mlLevel: res.level,
    });
    return res;
  },

  recordBiometricCheck: (result, similarity, videoTimestampSec) => {
    const state = get();
    if (result === 'owner') {
      set({
        faceSimilarity: similarity,
        isOwnerVerified: true,
        consecutiveNoFaceChecks: 0,
        consecutiveMismatchChecks: 0,
      });
      return;
    }
    if (result === 'no_face') {
      const nextNoFace = state.consecutiveNoFaceChecks + 1;
      const shouldAlert = nextNoFace >= 6;
      if (shouldAlert) {
        lmsApi.logFaceViolation({
          lessonId: 101,
          violationType: 'face_absent_30s',
          videoTimestampSec,
          similarityScore: 0,
        });
      }
      set({
        faceSimilarity: 0,
        consecutiveNoFaceChecks: nextNoFace,
        faceAbsentOverlayOpen: shouldAlert ? true : state.faceAbsentOverlayOpen,
      });
      return;
    }
    if (result === 'mismatch') {
      const nextMismatch = state.consecutiveMismatchChecks + 1;
      const shouldAlert = nextMismatch >= 3;
      if (shouldAlert) {
        lmsApi.logFaceViolation({
          lessonId: 101,
          violationType: 'identity_mismatch',
          videoTimestampSec,
          similarityScore: similarity,
        });
      }
      set({
        faceSimilarity: similarity,
        isOwnerVerified: false,
        consecutiveMismatchChecks: nextMismatch,
        identityMismatchOverlayOpen: shouldAlert ? true : state.identityMismatchOverlayOpen,
      });
    }
  },

  resolveBiometricAlert: () =>
    set({
      consecutiveNoFaceChecks: 0,
      consecutiveMismatchChecks: 0,
      faceAbsentOverlayOpen: false,
      identityMismatchOverlayOpen: false,
      isOwnerVerified: true,
      faceSimilarity: 0.86,
    }),

  submitSelfReport: async (lessonId, videoTimestampSec, level) => {
    const labels: Record<1 | 2 | 3 | 4, string> = {
      1: 'Hiểu rõ',
      2: 'Hơi mơ hồ',
      3: 'Đang bối rối',
      4: 'Rất khó hiểu',
    };
    const item: SelfReportItem = {
      timestampSeconds: videoTimestampSec,
      level,
      label: labels[level],
      createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    set((s) => ({ selfReports: [item, ...s.selfReports] }));

    if (level >= 3) {
      await get().triggerProactiveIntervention(lessonId, videoTimestampSec, 'self_report', true);
    }
  },

  triggerProactiveIntervention: async (
    lessonId,
    videoTimestampSec,
    _source,
    bypassCooldown = false,
  ) => {
    const state = get();
    const now = Date.now();
    if (!bypassCooldown && state.lastTriggerTimestampMs) {
      const elapsedSec = (now - state.lastTriggerTimestampMs) / 1000;
      if (elapsedSec < 180) {
        return;
      }
    }

    set({
      interventionLoading: true,
      interventionOpen: true,
      lastTriggerTimestampMs: now,
      cooldownRemainingSec: 180,
    });

    const explanation = await lmsApi.explainConfusion({
      lessonId,
      timestamp: videoTimestampSec,
      totalDuration: 1080,
      confusionSignals: {
        pauseCount: state.features12.pause_count,
        rewindCount: state.features12.rewind_count,
        emotion: state.currentEmotion,
        mlProb: state.posteriorProb,
        ruleScore: state.ruleScore,
      },
    });

    set({
      activeIntervention: explanation,
      interventionLoading: false,
    });
  },

  closeIntervention: (feedback) =>
    set((s) => ({
      interventionOpen: false,
      resolvedEpisodesCount:
        feedback === 'helpful' ? s.resolvedEpisodesCount + 1 : s.resolvedEpisodesCount,
    })),

  resetCooldown: () => set({ lastTriggerTimestampMs: null, cooldownRemainingSec: 0 }),

  resetAll: () => {
    storeBaselineCalibrator.reset();
    set({
      currentEmotion: 'neutral',
      emotionConfidence: 0,
      earAvg: 0,
      earVariance: 0,
      noseDriftPx: 0,
      gazeStill: false,
      eyeLocked: false,
      gazeBoost: 1.0,
      avgLuminance: 0,
      lowLightBoostActive: false,
      browFurrowScore: 0,
      eyeSquintScore: 0,
      mouthTensionScore: 0,
      headYawDeg: 0,
      headPitchDeg: 0,
      pauseEvents: [],
      rewindEvents: [],
      speedEvents: [],
      quizEvents: [],
      frameWindow: [],
      features12: { ...INITIAL_FEATURES_12 },
      slidingWindowEmotions: [],
      ruleScore: 0,
      mlProb: COLD_START_POSTERIOR,
      mlLevel: 'none',
      lastTriggerTimestampMs: null,
      cooldownRemainingSec: 0,
      posteriorProb: COLD_START_POSTERIOR,
      priorProb: COLD_START_POSTERIOR,
      llrFace: 0,
      llrBeh: 0,
      llrQuiz: 0,
      rFace: 0,
      rBeh: 0,
      rQuiz: 0,
      contribFace: 0,
      contribBeh: 0,
      contribQuiz: 0,
      segmentPrior: COLD_START_POSTERIOR,
      highDurationSec: 0,
      apiStatus: 'ok',
      personalBaselineReady: false,
      emotionTimeline: [],
    });
  },
}));
