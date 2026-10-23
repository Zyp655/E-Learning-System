'use client';

import { create } from 'zustand';
import { lmsApi, evaluateMultimodalMlpLocal } from '@/api';
import type {
  ConfusionExplanationResult,
  EmotionLabel,
  MultimodalFeatures12,
} from '@/api/types';

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
  level: 1 | 2 | 3 | 4; // 1: Hiểu rõ, 2: Hơi mơ hồ, 3: Đang bối rối, 4: Rất khó hiểu
  label: string;
  createdAt: string;
}

interface ConfusionState {
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
  browFurrowScore: number; // AU4
  eyeSquintScore: number; // AU7
  headYawDeg: number;
  headPitchDeg: number;

  // Biometric Face Verification Guard (every 5s)
  faceSimilarity: number;
  isOwnerVerified: boolean;
  consecutiveNoFaceChecks: number; // 6 checks (30s) -> FaceAbsenceOverlay
  consecutiveMismatchChecks: number; // 3 checks (15s) -> IdentityMismatchOverlay
  faceAbsentOverlayOpen: boolean;
  identityMismatchOverlayOpen: boolean;

  // 12-Feature Multimodal Vector + Hybrid Sliding Window (3) + Cooldown (5m)
  features12: MultimodalFeatures12;
  slidingWindowEmotions: EmotionLabel[];
  ruleScore: number;
  mlProb: number;
  mlLevel: 'none' | 'mild' | 'moderate' | 'high';
  lastTriggerTimestampMs: number | null;
  cooldownRemainingSec: number;

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
  updateCvFrameMetrics: (metrics: {
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
    headYawDeg: number;
    headPitchDeg: number;
  }) => void;
  recordVideoPause: (durationSec: number) => void;
  recordVideoRewind: (fromSec: number, toSec: number) => void;
  recordSpeedChange: (newSpeed: number) => void;
  recordQuizOutcome: (scorePercent: number, timeSec: number) => void;
  recordBiometricCheck: (result: 'owner' | 'no_face' | 'mismatch', similarity: number, videoTimestampSec: number) => void;
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

const INITIAL_FEATURES_12: MultimodalFeatures12 = {
  pause_count: 1,
  avg_pause_duration: 4.2,
  long_pause_count: 0,
  rewind_count: 1,
  rewind_same_spot: 0,
  speed_decrease: 0,
  confused_ratio: 0.12,
  frustrated_ratio: 0.04,
  emotion_transitions: 2,
  neg_emotion_streak: 1,
  quiz_score: 85,
  quiz_time: 18,
};

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

export const useConfusionStore = create<ConfusionState>((set, get) => ({
  cameraEnabled: true,
  cameraStreaming: false,
  currentEmotion: 'focused',
  emotionConfidence: 0.88,
  earAvg: 0.27,
  earVariance: 0.0042,
  noseDriftPx: 5.8,
  gazeStill: false,
  eyeLocked: false,
  gazeBoost: 1.0,
  avgLuminance: 124,
  lowLightBoostActive: false,
  browFurrowScore: 0.14,
  eyeSquintScore: 0.11,
  headYawDeg: -2.4,
  headPitchDeg: 1.8,

  faceSimilarity: 0.84,
  isOwnerVerified: true,
  consecutiveNoFaceChecks: 0,
  consecutiveMismatchChecks: 0,
  faceAbsentOverlayOpen: false,
  identityMismatchOverlayOpen: false,

  features12: INITIAL_FEATURES_12,
  slidingWindowEmotions: ['focused', 'focused', 'focused'],
  ruleScore: 12,
  mlProb: 0.18,
  mlLevel: 'none',
  lastTriggerTimestampMs: null,
  cooldownRemainingSec: 0,

  emotionTimeline: [
    { t: 30, emotion: 'focused', confidence: 0.89, ear: 0.28, gazeStill: false, eyeLocked: false },
    { t: 120, emotion: 'focused', confidence: 0.85, ear: 0.27, gazeStill: true, eyeLocked: false },
    { t: 225, emotion: 'confused', confidence: 0.74, ear: 0.24, gazeStill: true, eyeLocked: true },
    { t: 310, emotion: 'focused', confidence: 0.86, ear: 0.27, gazeStill: false, eyeLocked: false },
    { t: 480, emotion: 'confused', confidence: 0.81, ear: 0.25, gazeStill: true, eyeLocked: true },
    { t: 550, emotion: 'frustrated', confidence: 0.78, ear: 0.23, gazeStill: true, eyeLocked: true },
    { t: 620, emotion: 'happy', confidence: 0.84, ear: 0.29, gazeStill: false, eyeLocked: false },
  ],
  selfReports: [],
  activeIntervention: null,
  interventionOpen: false,
  interventionLoading: false,
  resolvedEpisodesCount: 4,

  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
  setCameraStreaming: (streaming) => set({ cameraStreaming: streaming }),

  updateCvFrameMetrics: (m) => {
    const state = get();
    const nextWindow = [...state.slidingWindowEmotions, m.confidence >= 0.3 ? m.emotion : 'neutral'].slice(-3);
    const prevEmotion = state.currentEmotion;
    const f = { ...state.features12 };

    const totalSamples = state.emotionTimeline.length + 1;
    const confusedSamples =
      state.emotionTimeline.filter((p) => p.emotion === 'confused').length + (m.emotion === 'confused' ? 1 : 0);
    const frustratedSamples =
      state.emotionTimeline.filter((p) => p.emotion === 'frustrated').length + (m.emotion === 'frustrated' ? 1 : 0);

    f.confused_ratio = Number((confusedSamples / Math.max(1, totalSamples)).toFixed(2));
    f.frustrated_ratio = Number((frustratedSamples / Math.max(1, totalSamples)).toFixed(2));
    if (m.emotion !== prevEmotion) f.emotion_transitions += 1;
    if (m.emotion === 'confused' || m.emotion === 'frustrated' || m.emotion === 'bored') {
      f.neg_emotion_streak += 1;
    }

    const gazeBoost = m.gazeStill && m.eyeLocked ? 1.6 : m.gazeStill ? 1.3 : m.eyeLocked ? 1.15 : 1.0;
    const ruleScore = calculateHybridRuleScore(f, nextWindow, m.emotion, m.confidence, m.gazeStill, m.eyeLocked);
    const localMlp = evaluateMultimodalMlpLocal(f);

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
      lowLightBoostActive: m.avgLuminance < 95,
      browFurrowScore: m.browFurrowScore,
      eyeSquintScore: m.eyeSquintScore,
      headYawDeg: m.headYawDeg,
      headPitchDeg: m.headPitchDeg,
      features12: f,
      slidingWindowEmotions: nextWindow,
      ruleScore,
      mlProb: localMlp.probability,
      mlLevel: localMlp.level,
      emotionTimeline: nextTimeline,
    });
  },

  recordVideoPause: (durationSec) => {
    const state = get();
    const f = { ...state.features12 };
    const newCount = f.pause_count + 1;
    f.avg_pause_duration = Number(
      ((f.avg_pause_duration * f.pause_count + durationSec) / newCount).toFixed(1),
    );
    f.pause_count = newCount;
    if (durationSec > 10) f.long_pause_count += 1;

    const ruleScore = calculateHybridRuleScore(
      f,
      state.slidingWindowEmotions,
      state.currentEmotion,
      state.emotionConfidence,
      state.gazeStill,
      state.eyeLocked,
    );
    const mlp = evaluateMultimodalMlpLocal(f);
    set({ features12: f, ruleScore, mlProb: mlp.probability, mlLevel: mlp.level });
  },

  recordVideoRewind: (_fromSec, _toSec) => {
    const state = get();
    const f = { ...state.features12 };
    f.rewind_count += 1;
    f.rewind_same_spot += 1;

    const ruleScore = calculateHybridRuleScore(
      f,
      state.slidingWindowEmotions,
      state.currentEmotion,
      state.emotionConfidence,
      state.gazeStill,
      state.eyeLocked,
    );
    const mlp = evaluateMultimodalMlpLocal(f);
    set({ features12: f, ruleScore, mlProb: mlp.probability, mlLevel: mlp.level });
  },

  recordSpeedChange: (newSpeed) => {
    const state = get();
    const f = { ...state.features12, speed_decrease: newSpeed < 1.0 ? 1 : 0 };
    const mlp = evaluateMultimodalMlpLocal(f);
    set({ features12: f, mlProb: mlp.probability, mlLevel: mlp.level });
  },

  recordQuizOutcome: (scorePercent, timeSec) => {
    const state = get();
    const f = { ...state.features12, quiz_score: scorePercent, quiz_time: timeSec };
    const mlp = evaluateMultimodalMlpLocal(f);
    set({ features12: f, mlProb: mlp.probability, mlLevel: mlp.level });
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
      const shouldAlert = nextNoFace >= 6; // 6 x 5s = 30s
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
      const shouldAlert = nextMismatch >= 3; // 3 x 5s = 15s
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

  triggerProactiveIntervention: async (lessonId, videoTimestampSec, _source, bypassCooldown = false) => {
    const state = get();
    const now = Date.now();
    if (!bypassCooldown && state.lastTriggerTimestampMs) {
      const elapsedSec = (now - state.lastTriggerTimestampMs) / 1000;
      if (elapsedSec < 300) {
        return;
      }
    }

    set({
      interventionLoading: true,
      interventionOpen: true,
      lastTriggerTimestampMs: now,
      cooldownRemainingSec: 300,
    });

    const explanation = await lmsApi.explainConfusion({
      lessonId,
      timestamp: videoTimestampSec,
      totalDuration: 1080,
      confusionSignals: {
        pauseCount: state.features12.pause_count,
        rewindCount: state.features12.rewind_count,
        emotion: state.currentEmotion,
        mlProb: state.mlProb,
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
      resolvedEpisodesCount: feedback === 'helpful' ? s.resolvedEpisodesCount + 1 : s.resolvedEpisodesCount,
    })),

  resetCooldown: () => set({ lastTriggerTimestampMs: null, cooldownRemainingSec: 0 }),

  resetAll: () =>
    set({
      features12: INITIAL_FEATURES_12,
      slidingWindowEmotions: ['focused', 'focused', 'focused'],
      ruleScore: 12,
      mlProb: 0.18,
      mlLevel: 'none',
      lastTriggerTimestampMs: null,
      cooldownRemainingSec: 0,
    }),
}));
