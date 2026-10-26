import { describe, expect, it, beforeEach } from 'vitest';
import parityVectors from './parity_vectors.json';
import videoFeaturesGolden from './video_features_golden.json';
import {
  PersonalBaselineCalibrator,
  SP_BEF_PARAMS,
  aggregateClipWindow,
  computeFrameReliability,
  predictLinearCalibratedBranch,
  spBefStep,
  subsampleFaceWindow,
  FACE_WINDOW_SAMPLE_MS,
  type AggregatedClipWindow,
} from '../spBefCore';
import {
  RealFaceTrackerSession,
  extract192dBiometricDescriptor,
  type Point3D,
} from '../realFaceTracker';
import { nudgeOnIntervene, useConfusionStore } from '../useConfusionStore';
import { lmsApi } from '@/api';

describe('SP-BEF V2 Core & Multimodal Confusion Engine (P7-Web Verification)', () => {
  beforeEach(() => {
    useConfusionStore.getState().resetAll();
  });

  describe('1. Golden Parity (<= 1e-5) across all 20 vectors in parity_vectors.json', () => {
    it('matches Python predict_linear_calibrated_branch, compute_frame_reliability, and sp_bef_step within 1e-5 on all 20 golden cases', () => {
      expect(parityVectors.length).toBe(20);

      for (const vec of parityVectors) {
        const inp = vec.inputs;
        const exp = vec.expected;

        const faceOut = predictLinearCalibratedBranch(
          inp.face_features,
          SP_BEF_PARAMS.branches.face,
        );
        const behOut = predictLinearCalibratedBranch(
          inp.behavior_features,
          SP_BEF_PARAMS.branches.behavior,
        );
        const quizOut = predictLinearCalibratedBranch(
          inp.quiz_features,
          SP_BEF_PARAMS.branches.quiz,
        );

        expect(Math.abs(faceOut.rawProb - exp.face_raw_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(faceOut.calProb - exp.face_cal_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(faceOut.llr - exp.face_llr)).toBeLessThanOrEqual(1e-5);

        expect(Math.abs(behOut.rawProb - exp.beh_raw_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(behOut.calProb - exp.beh_cal_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(behOut.llr - exp.beh_llr)).toBeLessThanOrEqual(1e-5);

        expect(Math.abs(quizOut.rawProb - exp.quiz_raw_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(quizOut.calProb - exp.quiz_cal_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(quizOut.llr - exp.quiz_llr)).toBeLessThanOrEqual(1e-5);

        const rFace = computeFrameReliability(
          inp.face_present_ratio,
          inp.avg_luminance,
          inp.head_yaw_abs_deg,
          inp.head_pitch_abs_deg,
          1.0,
        );
        const rBeh = 1.0;
        const rQuiz = inp.has_quiz ? 1.0 : 0.0;

        expect(Math.abs(rFace - exp.r_face)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(rBeh - exp.r_beh)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(rQuiz - exp.r_quiz)).toBeLessThanOrEqual(1e-5);

        const stepOut = spBefStep(
          inp.prev_posterior,
          inp.segment_prior,
          faceOut.llr,
          rFace,
          behOut.llr,
          rBeh,
          quizOut.llr,
          rQuiz,
          SP_BEF_PARAMS.fusion,
          inp.prev_high_sec,
          inp.prev_intervening,
          inp.cooldown_remaining_sec,
          inp.dt_sec,
        );

        expect(Math.abs(stepOut.prior_prob - exp.step.prior_prob)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.posterior_prob - exp.step.posterior_prob)).toBeLessThanOrEqual(
          1e-5,
        );
        expect(Math.abs(stepOut.llr_face - exp.step.llr_face)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.llr_beh - exp.step.llr_beh)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.llr_quiz - exp.step.llr_quiz)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.contrib_face - exp.step.contrib_face)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.contrib_beh - exp.step.contrib_beh)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.contrib_quiz - exp.step.contrib_quiz)).toBeLessThanOrEqual(1e-5);
        expect(Math.abs(stepOut.high_duration_sec - exp.step.high_duration_sec)).toBeLessThanOrEqual(
          1e-5,
        );
        expect(
          Math.abs(stepOut.cooldown_remaining_sec - exp.step.cooldown_remaining_sec),
        ).toBeLessThanOrEqual(1e-5);
        expect(stepOut.is_confused).toBe(exp.step.is_confused);
        expect(stepOut.should_intervene).toBe(exp.step.should_intervene);
        expect(stepOut.level).toBe(exp.step.level);
      }
    });
  });

  describe('2. Golden Video Feature Parity (<= 1e-3) on video_features_golden.json', () => {
    it('matches Python aggregate_clip_window expected_window within 1e-3 across all 18 telemetry keys', () => {
      const actual = aggregateClipWindow(videoFeaturesGolden.frames);
      const expected = videoFeaturesGolden.expected_window as AggregatedClipWindow;

      for (const key of Object.keys(expected) as (keyof AggregatedClipWindow)[]) {
        const diff = Math.abs(actual[key] - expected[key]);
        expect(diff).toBeLessThanOrEqual(1e-3);
      }
    });
  });

  describe('3. Sliding Window Eviction (300s behavior / 10s face) & Streak Reset', () => {
    it('evicts behavioral events older than 300,000 ms (5m) and face frames older than 10,000 ms (10s)', () => {
      const store = useConfusionStore.getState();

      // Record pauses & rewinds at t = 1,000 ms
      store.recordVideoPause(12.0, 1_000);
      store.recordVideoPause(8.0, 2_000);
      store.recordVideoRewind(60, 45, 3_000);
      store.recordSpeedChange(0.75, 4_000);

      let s = useConfusionStore.getState();
      expect(s.features12.pause_count).toBe(2);
      expect(s.features12.long_pause_count).toBe(1);
      expect(s.features12.rewind_count).toBe(1);
      expect(s.features12.speed_decrease).toBe(1);

      // Record a new pause at t = 305,000 ms (> 300s after t = 1,000..4,000 ms)
      store.recordVideoPause(4.0, 305_000);

      s = useConfusionStore.getState();
      expect(s.features12.pause_count).toBe(1);
      expect(s.features12.avg_pause_duration).toBe(4.0);
      expect(s.features12.long_pause_count).toBe(0);
      expect(s.features12.rewind_count).toBe(0);
      expect(s.features12.speed_decrease).toBe(0);
    });

    it('evicts face frames older than 10s and resets neg_emotion_streak to 0 when focused or happy is observed', () => {
      const store = useConfusionStore.getState();

      store.updateCvFrameMetrics(
        {
          videoTimestampSec: 10,
          emotion: 'confused',
          confidence: 0.85,
          earAvg: 0.25,
          earVariance: 0.001,
          noseDriftPx: 1.5,
          gazeStill: true,
          eyeLocked: true,
          avgLuminance: 120,
          browFurrowScore: 0.65,
          eyeSquintScore: 0.45,
          headYawDeg: 2.0,
          headPitchDeg: 1.5,
        },
        1_000,
      );
      store.updateCvFrameMetrics(
        {
          videoTimestampSec: 12,
          emotion: 'frustrated',
          confidence: 0.88,
          earAvg: 0.24,
          earVariance: 0.0012,
          noseDriftPx: 1.8,
          gazeStill: true,
          eyeLocked: true,
          avgLuminance: 120,
          browFurrowScore: 0.72,
          eyeSquintScore: 0.52,
          headYawDeg: 1.5,
          headPitchDeg: 1.0,
        },
        3_000,
      );

      expect(useConfusionStore.getState().features12.neg_emotion_streak).toBe(2);
      expect(useConfusionStore.getState().frameWindow.length).toBe(2);

      // Observe 'focused' at t = 15,000 ms (> 10s after t = 1,000 and 3,000 ms)
      store.updateCvFrameMetrics(
        {
          videoTimestampSec: 25,
          emotion: 'focused',
          confidence: 0.9,
          earAvg: 0.28,
          earVariance: 0.003,
          noseDriftPx: 3.0,
          gazeStill: false,
          eyeLocked: false,
          avgLuminance: 125,
          browFurrowScore: 0.12,
          eyeSquintScore: 0.1,
          headYawDeg: 0.5,
          headPitchDeg: 0.5,
        },
        15_000,
      );

      const afterFocus = useConfusionStore.getState();
      expect(afterFocus.features12.neg_emotion_streak).toBe(0);
      expect(afterFocus.frameWindow.length).toBe(1);
      expect(afterFocus.features12.confused_ratio).toBe(0);
      expect(afterFocus.features12.frustrated_ratio).toBe(0);
    });
  });

  describe('4. Personal Baseline (C2) & Frame Reliability (C4) + Clean RealFaceTracker (P1.1)', () => {
    it('yields rFace === 0 and 0 contribution when face is missing or room is dark (avgLuminance < 35)', () => {
      const rMissing = computeFrameReliability(0.0, 130.0, 4.0, 3.0, 1.0);
      expect(rMissing).toBe(0.0);

      const rDark = computeFrameReliability(1.0, 25.0, 4.0, 3.0, 1.0);
      expect(rDark).toBe(0.0);

      const stepDark = spBefStep(
        0.2,
        0.25,
        2.5, // strong LLR that should be zeroed out by rFace === 0
        rDark,
        0.5,
        1.0,
        0.0,
        0.0,
        SP_BEF_PARAMS.fusion,
      );
      expect(stepDark.r_face).toBe(0.0);
      expect(stepDark.llr_face).toBe(0.0);
      expect(stepDark.contrib_face).toBe(0.0);
    });

    it('builds the face vector in the order of sp_bef_params feature_names and rejects unknown names', () => {
      const window = aggregateClipWindow(videoFeaturesGolden.frames) as AggregatedClipWindow;
      const calibrator = new PersonalBaselineCalibrator(3, 60);
      const names = SP_BEF_PARAMS.branches.face.feature_names ?? [];
      const vec = calibrator.buildFaceModelVector(window);

      expect(names.length).toBe(SP_BEF_PARAMS.branches.face.coefficients.length);
      expect(vec).toHaveLength(names.length);
      names.forEach((name, i) => {
        if (name in window) {
          expect(vec[i]).toBe(window[name as keyof AggregatedClipWindow]);
        }
      });
      expect(() => calibrator.buildFaceModelVector(window, 1.0, ['boredom'])).toThrow(/Unknown face feature/);
    });

    it('computes C2 personal baseline z-scores from initial neutral frames and detects elevated brow furrow', () => {
      const calibrator = new PersonalBaselineCalibrator(3, 60);
      const neutralSample = {
        brow_furrow_mean: 0.18,
        eye_squint_mean: 0.14,
        ear_mean: 0.28,
        mouth_tension_mean: 0.08,
        affect_frustration: 0.15,
      };

      calibrator.observe(neutralSample, 1.0, 1_000);
      calibrator.observe({ ...neutralSample, brow_furrow_mean: 0.2 }, 1.0, 5_000);
      expect(calibrator.isReady()).toBe(false);

      calibrator.observe({ ...neutralSample, brow_furrow_mean: 0.19 }, 1.0, 10_000);
      expect(calibrator.isReady()).toBe(true);

      const zElevated = calibrator.transform(
        {
          brow_furrow_mean: 0.54,
          eye_squint_mean: 0.44,
          ear_mean: 0.22,
          mouth_tension_mean: 0.33,
          affect_frustration: 0.55,
        },
        1.0,
      );
      expect(zElevated.brow_furrow_z).toBeGreaterThan(5.0);
      expect(zElevated.eye_squint_z).toBeGreaterThan(4.0);
      expect(zElevated.ear_z).toBeLessThan(-1.5);
    });

    it('never fabricates landmarks or faceDetected:true when no live video is present', async () => {
      const session = new RealFaceTrackerSession();
      const res = await session.processFrame(null, null, 320, 200, {
        front: null,
        left: null,
        right: null,
      });

      expect(res.faceDetected).toBe(false);
      expect(res.landmarks).toEqual([]);
      expect(res.rFace).toBe(0.0);
      expect(res.emotion).toBe('no_face');
      expect(res.embedding192).toEqual([]);
    });

    it('subsamples a face window to ~10 fps (first frame kept, jitter tolerated)', () => {
      const frames = Array.from({ length: 61 }, (_, i) => ({ timestampMs: i * (1000 / 60) }));
      const sampled = subsampleFaceWindow(frames);
      expect(sampled[0].timestampMs).toBe(0);
      expect(sampled).toHaveLength(11);
      for (let i = 1; i < sampled.length; i++) {
        expect(sampled[i].timestampMs - sampled[i - 1].timestampMs).toBeGreaterThanOrEqual(FACE_WINDOW_SAMPLE_MS);
      }
    });

    it('samples the 10 s face window at ~10 fps like the DAiSEE training data, whatever the frame rate', async () => {
      const session = new RealFaceTrackerSession();
      const emb: { front: number[] | null; left: number[] | null; right: number[] | null } = {
        front: null,
        left: null,
        right: null,
      };
      // 12 s of a 60 fps render loop.
      for (let i = 0; i < 720; i++) {
        await session.processFrame(null, null, 320, 200, emb, 1_000_000 + i * (1000 / 60));
      }
      expect(session.getWindowFrameCount()).toBeGreaterThanOrEqual(95);
      expect(session.getWindowFrameCount()).toBeLessThanOrEqual(101);
    });

    it('computes 192-d L2-normalized biometric descriptor purely from nose-centered, IOD-normalized 3D landmarks', () => {
      expect(extract192dBiometricDescriptor([])).toEqual([]);

      const landmarks: Point3D[] = Array.from({ length: 478 }, (_, idx) => ({
        x: 0.5 + ((idx % 17) - 8) * 0.012,
        y: 0.5 + ((idx % 13) - 6) * 0.015,
        z: ((idx % 7) - 3) * 0.008,
      }));
      landmarks[1] = { x: 0.5, y: 0.5, z: 0.0 };
      landmarks[33] = { x: 0.42, y: 0.45, z: -0.01 };
      landmarks[263] = { x: 0.58, y: 0.45, z: -0.01 };

      const desc = extract192dBiometricDescriptor(landmarks);
      expect(desc.length).toBe(192);
      const l2Norm = Math.sqrt(desc.reduce((s, v) => s + v * v, 0));
      expect(Math.abs(l2Norm - 1.0)).toBeLessThanOrEqual(1e-3);
    });
  });

  describe('5. Indeterminate Fallback when API fails or no modalities are active', () => {
    it('returns level === "unknown" when all modality reliabilities are 0', () => {
      const step = spBefStep(0.15, 0.25, 1.2, 0.0, 0.8, 0.0, -0.5, 0.0);
      expect(step.level).toBe('unknown');
      expect(step.contrib_face).toBe(0.0);
      expect(step.contrib_beh).toBe(0.0);
      expect(step.contrib_quiz).toBe(0.0);
    });

    it('raises the soft nudge only when SP-BEF intervenes and nothing is already open', () => {
      expect(nudgeOnIntervene({ interventionOpen: false, nudgeOpen: false }, { should_intervene: true })).toEqual({ nudgeOpen: true });
      expect(nudgeOnIntervene({ interventionOpen: true, nudgeOpen: false }, { should_intervene: true })).toEqual({});
      expect(nudgeOnIntervene({ interventionOpen: false, nudgeOpen: true }, { should_intervene: true })).toEqual({});
      expect(nudgeOnIntervene({ interventionOpen: false, nudgeOpen: false }, { should_intervene: false })).toEqual({});
    });

    it('opens the nudge from repeated wrong, slow quiz answers and keeps the cooldown so it does not re-open', () => {
      const t0 = 1_000_000;
      for (let i = 0; i < 4; i++) {
        useConfusionStore.getState().recordQuizOutcome(0, 150, 5, t0 + i * 5_000);
      }
      const s = useConfusionStore.getState();
      expect(s.nudgeOpen).toBe(true);
      expect(s.cooldownRemainingSec).toBeGreaterThan(0);

      useConfusionStore.setState({ nudgeOpen: false });
      useConfusionStore.getState().recordQuizOutcome(0, 150, 5, t0 + 20_000);
      expect(useConfusionStore.getState().nudgeOpen).toBe(false);
    });

    it('records the nudge answer as a self-report and opens the tutor only when help is requested', async () => {
      useConfusionStore.setState({ nudgeOpen: true });
      await useConfusionStore.getState().respondToConfusionNudge(101, 42, false);
      let s = useConfusionStore.getState();
      expect(s.nudgeOpen).toBe(false);
      expect(s.selfReports[0].level).toBe(1);
      expect(s.interventionOpen).toBe(false);

      useConfusionStore.setState({ nudgeOpen: true });
      await useConfusionStore.getState().respondToConfusionNudge(101, 42, true);
      s = useConfusionStore.getState();
      expect(s.selfReports[0].level).toBe(3);
      expect(s.interventionOpen).toBe(true);
    });

    it('returns status: "indeterminate" and probability: null without fabricating probabilities when backend API is offline', async () => {
      const store = useConfusionStore.getState();
      const pred = await lmsApi.predictConfusion(store.features12);

      expect(pred.status).toBe('indeterminate');
      expect(pred.level).toBe('unknown');
      expect(pred.triggerSource).toBe('indeterminate');
      expect(pred.isConfused).toBe(false);
      expect(pred.shouldIntervene).toBe(false);
      expect(pred.probability).toBeNull();

      await store.syncPredictConfusionWithApi();
      const updated = useConfusionStore.getState();
      expect(updated.apiStatus).toBe('indeterminate');
      expect(updated.mlLevel).toBe('unknown');
    });
  });
});
