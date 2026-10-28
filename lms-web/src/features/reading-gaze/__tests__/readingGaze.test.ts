import { beforeEach, describe, expect, it } from 'vitest';
import gazeGolden from '../../confusion-cv/__tests__/gaze_parity_vectors.json';
import {
  SP_BEF_PARAMS,
  computeGazeReliability,
  getSegmentPriorForParagraph,
  predictLinearCalibratedBranch,
  spBefStep,
  type BranchConfig,
  type FusionConfig,
} from '@/features/confusion-cv/spBefCore';
import type { Point3D } from '@/features/confusion-cv/realFaceTracker';
import { useConfusionStore } from '@/features/confusion-cv/useConfusionStore';
import { GazeCalibrator, OneEuroFilter, extractEyeGazeFeatures, type EyeGazeFeatures } from '../irisGaze';
import {
  computeParagraphGazeFeatures,
  mapGazeToParagraph,
  textDifficultyScore,
  type Fixation,
  type ParagraphLayout,
} from '../readingFeatures';
import { ReadingGazeSession } from '../readingGazeSession';

/** 478-point mesh with both eyes 0.06 wide / 0.02 tall and the irises at (h, v) inside them. */
function syntheticMesh(h: number, v: number, nose = { x: 0.5, y: 0.55 }, eyeHeight = 0.02): Point3D[] {
  const pts: Point3D[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const eyes = [
    { left: 33, right: 133, top: 159, bottom: 145, iris: 468, x0: 0.38 },
    { left: 362, right: 263, top: 386, bottom: 374, iris: 473, x0: 0.56 },
  ];
  for (const e of eyes) {
    pts[e.left] = { x: e.x0, y: 0.45, z: 0 };
    pts[e.right] = { x: e.x0 + 0.06, y: 0.45, z: 0 };
    pts[e.top] = { x: e.x0 + 0.03, y: 0.45 - eyeHeight / 2, z: 0 };
    pts[e.bottom] = { x: e.x0 + 0.03, y: 0.45 + eyeHeight / 2, z: 0 };
    pts[e.iris] = { x: e.x0 + 0.06 * h, y: 0.45 - eyeHeight / 2 + eyeHeight * v, z: 0 };
  }
  pts[1] = { x: nose.x, y: nose.y, z: 0 };
  return pts;
}

/** Ground-truth gaze model of the synthetic reader: screen point from iris position and head yaw. */
const YAW_PX_PER_DEG = 12;
const irisFor = (x: number, y: number, yaw = 0) => ({ h: (x - 100 - YAW_PX_PER_DEG * yaw) / 1200, v: (y - 50) / 700 });

function calibrationPoint(x: number, y: number, yaw = 0) {
  const { h, v } = irisFor(x, y, yaw);
  return { features: extractEyeGazeFeatures(syntheticMesh(h, v), yaw, 0) as EyeGazeFeatures, x, y };
}

describe('Reading-gaze branch: Python / TypeScript parity', () => {
  it('matches ml/golden/gaze_parity_vectors.json within 1e-5', () => {
    const branch = gazeGolden.branch as BranchConfig;
    const fusion = gazeGolden.fusion as FusionConfig;
    expect(gazeGolden.vectors.length).toBeGreaterThanOrEqual(12);
    for (const vec of gazeGolden.vectors) {
      const inp = vec.inputs;
      const exp = vec.expected;
      const out = predictLinearCalibratedBranch(inp.gaze_features, branch);
      expect(Math.abs(out.rawProb - exp.gaze_raw_prob)).toBeLessThanOrEqual(1e-5);
      expect(Math.abs(out.calProb - exp.gaze_cal_prob)).toBeLessThanOrEqual(1e-5);
      expect(Math.abs(out.llr - exp.gaze_llr)).toBeLessThanOrEqual(1e-5);

      const rGaze = computeGazeReliability(
        inp.calibration_error_norm,
        inp.face_present_ratio,
        inp.on_text_ratio,
        inp.head_yaw_abs_deg,
      );
      expect(Math.abs(rGaze - exp.r_gaze)).toBeLessThanOrEqual(1e-5);

      const step = spBefStep({
        prevPosterior: inp.prev_posterior,
        segmentPrior: inp.segment_prior,
        llrFace: inp.llr_face,
        rFace: inp.r_face,
        llrQuiz: inp.llr_quiz,
        rQuiz: inp.r_quiz,
        fusionCfg: fusion,
        prevHighSec: inp.prev_high_sec,
        prevIntervening: inp.prev_intervening,
        cooldownRemainingSec: inp.cooldown_remaining_sec,
        dtSec: inp.dt_sec,
        llrGaze: out.llr,
        rGaze,
      });
      for (const key of ['prior_prob', 'posterior_prob', 'llr_gaze', 'r_gaze', 'contrib_gaze', 'contrib_face',
        'high_duration_sec', 'cooldown_remaining_sec'] as const) {
        expect(Math.abs(step[key] - exp.step[key])).toBeLessThanOrEqual(1e-5);
      }
      expect(step.is_confused).toBe(exp.step.is_confused);
      expect(step.should_intervene).toBe(exp.step.should_intervene);
      expect(step.level).toBe(exp.step.level);
    }
  });

  it('ships the gaze branch switched off until it is trained on reading logs', () => {
    const gaze = SP_BEF_PARAMS.branches.gaze;
    expect(gaze?.feature_names).toEqual([
      'dwell_ratio',
      'reread_count',
      'para_regression_rate',
      'sweep_ratio',
      'gaze_transition_entropy',
      'saccade_rate',
    ]);
    if (!gaze?.enabled) expect(SP_BEF_PARAMS.fusion.w_gaze).toBe(0);
    if (!gaze?.trained) {
      expect(predictLinearCalibratedBranch([2.5, 3, 6, 2, 0.9, 4], gaze as BranchConfig).llr).toBe(0);
    }
    expect(getSegmentPriorForParagraph(0.9)).toBe(SP_BEF_PARAMS.segment_prior.cold_start_prior);
  });

  it('scores reliability on paragraph-scale calibration error', () => {
    expect(computeGazeReliability(0, 1, 1, 0)).toBe(0);
    expect(computeGazeReliability(0.4, 1, 1, 0)).toBe(1);
    expect(computeGazeReliability(1.0, 1, 1, 0)).toBe(0.5);
    expect(computeGazeReliability(1.5, 1, 1, 0)).toBe(0);
  });
});

describe('Iris features, calibration and filtering', () => {
  it('locates the iris between the eye corners and lids, and skips blinks', () => {
    const f = extractEyeGazeFeatures(syntheticMesh(0.25, 0.7), 4, -2) as EyeGazeFeatures;
    expect(f.h).toBeCloseTo(0.25, 6);
    expect(f.v).toBeCloseTo(0.7, 6);
    expect(f.yawDeg).toBe(4);
    expect(f.pitchDeg).toBe(-2);
    expect(extractEyeGazeFeatures(syntheticMesh(0.5, 0.5, undefined, 0.002))).toBeNull();
    expect(extractEyeGazeFeatures(syntheticMesh(0.5, 0.5).slice(0, 468))).toBeNull();
  });

  it('recovers the screen mapping, including head rotation, from a 9-point calibration', () => {
    const cal = new GazeCalibrator();
    const grid = [0.1, 0.5, 0.9].flatMap((fy) => [0.1, 0.5, 0.9].map((fx) => ({ x: 1400 * fx, y: 800 * fy })));
    // The reader turns the head a little between dots, as people do.
    const fit = grid.flatMap((p, i) => [-6, 0, 6].map((yaw) => calibrationPoint(p.x, p.y, yaw + (i % 3))));
    expect(cal.fit(fit)).toBe(true);
    const held = [calibrationPoint(420, 240, 8), calibrationPoint(980, 560, -7)];
    expect(cal.validationErrorPx(held)).toBeLessThan(3);
  });

  it('One Euro filter is steady on a still gaze and follows a return sweep within a few frames', () => {
    const f = new OneEuroFilter();
    let t = 0;
    for (let k = 0; k < 30; k++) f.next(1000 + (k % 2 ? 40 : -40), (t += 33));
    const still = f.next(1000, (t += 33));
    expect(Math.abs(still - 1000)).toBeLessThan(30);
    let x = still;
    for (let k = 0; k < 4; k++) x = f.next(200, (t += 33));
    expect(x).toBeLessThan(200 + 0.25 * 800);
  });
});

describe('Reading features', () => {
  const para: ParagraphLayout = { index: 0, top: 100, bottom: 100 + 4 * 32, left: 100, right: 900, lineHeight: 32, wordCount: 60 };
  const next: ParagraphLayout = { index: 1, top: 300, bottom: 300 + 3 * 32, left: 100, right: 900, lineHeight: 32, wordCount: 45 };

  /** Fixations every 250 ms; `xs` are the horizontal positions, `p` the paragraph of each. */
  function fixations(path: { p: number | null; x: number }[]): Fixation[] {
    return path.map((s, k) => ({ start: k * 300, end: k * 300 + 250, duration: 250, x: s.x, y: 0, paragraph: s.p }));
  }
  const readLine = (p: number) => [150, 330, 510, 690, 870].map((x) => ({ p, x }));

  it('maps gaze to paragraphs only, with off-text points as null', () => {
    expect(mapGazeToParagraph({ x: 400, y: 150 }, [para, next])).toBe(0);
    expect(mapGazeToParagraph({ x: 400, y: 260 }, [para, next])).toBeNull();
    expect(mapGazeToParagraph({ x: 1500, y: 150 }, [para, next])).toBeNull();
  });

  it('counts return sweeps, re-reading and paragraph regressions; linear reading has low entropy', () => {
    // 4 lines read in order (3 sweeps), then the next paragraph, then back to re-read one line.
    const linear = fixations([...readLine(0), ...readLine(0), ...readLine(0), ...readLine(0), ...readLine(1), ...readLine(0)]);
    const f = computeParagraphGazeFeatures(linear, para, 200);
    expect(f.reread_count).toBe(1);
    expect(f.sweep_ratio).toBeCloseTo(3 / 3, 6);
    expect(f.para_regression_rate).toBeCloseTo((1 / 60) * 100, 6);
    // 25 fixations x 250 ms in the paragraph vs 60 words at 200 wpm (18 s).
    expect(f.dwell_ratio).toBeCloseTo((25 * 250) / 18_000, 6);
    expect(f.saccade_rate).toBeCloseTo((25 - 2) / ((25 * 250) / 1000), 6);

    // Same time in the paragraph but jumping around the line: higher transition entropy, no orderly sweeps.
    const xs = [870, 150, 690, 330, 870, 510, 150, 690, 330, 870, 150, 510, 690, 150, 870, 330, 510, 870, 150, 690];
    const scattered = computeParagraphGazeFeatures(fixations(xs.map((x) => ({ p: 0, x }))), para, 200);
    expect(scattered.gaze_transition_entropy).toBeGreaterThan(f.gaze_transition_entropy + 0.2);
    expect(scattered.sweep_ratio).toBeGreaterThan(f.sweep_ratio);
  });

  it('scores formula-heavy technical text as harder than plain prose', () => {
    const plain = 'Bài đọc này giới thiệu ý tưởng chính của học phần một cách ngắn gọn và dễ theo dõi.';
    const technical = 'EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||) với cosineSim >= 0.82 trong FaceLandmarker.';
    expect(textDifficultyScore(technical)).toBeGreaterThan(textDifficultyScore(plain));
  });
});

describe('ReadingGazeSession end to end', () => {
  const layouts: ParagraphLayout[] = [
    { index: 0, top: 100, bottom: 100 + 6 * 32, left: 150, right: 1250, lineHeight: 32, wordCount: 70 },
    { index: 1, top: 400, bottom: 400 + 3 * 32, left: 150, right: 1250, lineHeight: 32, wordCount: 35 },
  ];

  function calibrate(s: ReadingGazeSession, frameAt: (x: number, y: number) => Parameters<ReadingGazeSession['onFrame']>[0]) {
    s.setLayouts(layouts);
    s.startCalibration();
    const dots = [0.1, 0.5, 0.9].flatMap((fy) => [0.1, 0.5, 0.9].map((fx) => ({ x: 1400 * fx, y: 800 * fy })));
    for (const d of dots) {
      s.setCalibrationTarget({ ...d, phase: 'fit' });
      for (let k = 0; k < 5; k++) s.onFrame(frameAt(d.x, d.y), { x: 0, y: 0 });
    }
    for (const d of [{ x: 420, y: 240 }, { x: 980, y: 560 }]) {
      s.setCalibrationTarget({ ...d, phase: 'validate' });
      for (let k = 0; k < 5; k++) s.onFrame(frameAt(d.x, d.y), { x: 0, y: 0 });
    }
    return s.finishCalibration(s.referenceHeightPx(), false, 0);
  }

  /** Reads `lines` of a paragraph left to right: 5 fixations of ~260 ms per line, then a return sweep. */
  function readParagraph(
    s: ReadingGazeSession,
    frameAt: (x: number, y: number) => Parameters<ReadingGazeSession['onFrame']>[0],
    p: ParagraphLayout,
    lines: number,
    offsetX = 0,
  ) {
    for (let line = 0; line < lines; line++) {
      for (const share of [0.05, 0.27, 0.49, 0.71, 0.93]) {
        const x = p.left + share * (p.right - p.left) + offsetX;
        for (let k = 0; k < 8; k++) s.onFrame(frameAt(x, p.top + line * p.lineHeight + 16), { x: 0, y: 0 });
      }
    }
  }

  it('calibrates, follows the reader across paragraphs, closes the last one and yields gaze evidence', () => {
    const s = new ReadingGazeSession();
    let t = 0;
    const frameAt = (x: number, y: number) => {
      const { h, v } = irisFor(x, y);
      return { t: (t += 33), faceDetected: true, landmarks: syntheticMesh(h, v), headYawDeg: 0, headPitchDeg: 0 };
    };
    const err = calibrate(s, frameAt);
    expect(err).toBeGreaterThan(0);
    expect(err).toBeLessThan(0.05);
    expect(s.isCalibrated()).toBe(true);

    readParagraph(s, frameAt, layouts[0], 6);
    expect(s.tick(t).currentParagraph).toBe(0);
    readParagraph(s, frameAt, layouts[1], 3);
    const tick = s.tick(t);
    expect(tick.currentParagraph).toBe(1);
    expect(tick.completedParagraph).toBe(0);

    const ev = s.evaluateParagraph(0) as NonNullable<ReturnType<ReadingGazeSession['evaluateParagraph']>>;
    expect(ev.rGaze).toBeGreaterThan(0.9);
    expect(ev.features.sweep_ratio).toBeCloseTo(1, 6);
    expect(ev.features.reread_count).toBe(0);
    if (!SP_BEF_PARAMS.branches.gaze?.trained) expect(ev.llrGaze).toBe(0);

    // The reader leaves the page while on paragraph 1: it is closed exactly once.
    expect(s.finishReading()?.paragraph).toBe(1);
    expect(s.finishReading()).toBeNull();
    expect(s.needsRevalidation(t)).toBe(false);
    expect(s.needsRevalidation(t + 9 * 60_000)).toBe(true);
  });

  it('estimates horizontal drift from return-sweep landings', () => {
    const s = new ReadingGazeSession();
    let t = 0;
    let driftPx = 0;
    const frameAt = (x: number, y: number) => {
      const { h, v } = irisFor(x + driftPx, y);
      return { t: (t += 33), faceDetected: true, landmarks: syntheticMesh(h, v), headYawDeg: 0, headPitchDeg: 0 };
    };
    calibrate(s, frameAt);
    // After calibration the gaze estimate slides 80 px to the right (the reader shifted in the chair).
    driftPx = 80;
    for (let pass = 0; pass < 2; pass++) {
      readParagraph(s, frameAt, layouts[0], 6);
      s.tick(t);
    }
    expect(s.driftX).toBeGreaterThan(40);
    expect(s.driftX).toBeLessThan(100);
  });
});

describe('Confusion store gaze evidence', () => {
  beforeEach(() => {
    useConfusionStore.getState().resetAll();
  });

  it('holds gaze evidence for later steps and clears it when reading ends', () => {
    const store = useConfusionStore.getState();
    store.updateReadingGazeEvidence({ llrGaze: 2.0, rGaze: 0.8, segmentPrior: 0.2 }, 1_000);
    let st = useConfusionStore.getState();
    expect(st.rGaze).toBeCloseTo(0.8, 6);
    expect(st.llrGaze).toBeCloseTo(2.0, 6);
    expect(st.segmentPrior).toBeCloseTo(0.2, 6);
    expect(st.contribGaze).toBeCloseTo(0.8 * (SP_BEF_PARAMS.fusion.w_gaze ?? 0) * 2.0, 6);
    expect(st.mlLevel).not.toBe('unknown');

    st.recordQuizOutcome(40, 30, 1, 2_000);
    st = useConfusionStore.getState();
    expect(st.rGaze).toBeCloseTo(0.8, 6);
    expect(st.segmentPrior).toBeCloseTo(0.2, 6);

    st.clearReadingGazeEvidence();
    st = useConfusionStore.getState();
    expect(st.rGaze).toBe(0);
    expect(st.readingSegmentPrior).toBeNull();
  });
});
