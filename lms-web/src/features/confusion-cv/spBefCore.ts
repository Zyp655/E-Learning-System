import spBefParamsJson from './sp_bef_params.json';

export const EPS = 1e-6;
export const LLR_CLIP = 4.0;

export const FACE_RAW_FEATURES = [
  'brow_furrow_mean',
  'brow_furrow_std',
  'brow_furrow_max',
  'eye_squint_mean',
  'eye_squint_std',
  'ear_mean',
  'ear_std',
  'mouth_tension_mean',
  'head_yaw_abs_mean',
  'head_pitch_abs_mean',
  'nose_drift_norm',
  'eye_lock_ratio',
  'affect_boredom',
  'affect_engagement',
  'affect_frustration',
] as const;

export const FACE_Z_FEATURES = [
  'brow_furrow_z',
  'eye_squint_z',
  'ear_z',
  'mouth_tension_z',
  'affect_frustration_z',
] as const;

export const FACE_MODEL_FEATURES = [
  ...FACE_RAW_FEATURES,
  ...FACE_Z_FEATURES,
] as const;

export const BEHAVIOR_FEATURES = [
  'pause_count',
  'avg_pause_duration',
  'long_pause_count',
  'rewind_count',
  'rewind_same_spot',
  'speed_change_down',
] as const;

export const QUIZ_FEATURES = [
  'quiz_accuracy',
  'quiz_time_norm',
  'attempt_count',
] as const;

export interface BranchConfig {
  feature_names?: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  coefficients: number[];
  intercept: number;
  base_rate: number;
  isotonic_xp?: number[];
  isotonic_fp?: number[];
}

export interface FusionConfig {
  hmm_keep_confused?: number;
  hmm_beta0?: number;
  hmm_beta1?: number;
  w_face?: number;
  w_beh?: number;
  w_quiz?: number;
  theta_on?: number;
  theta_off?: number;
  min_hold_sec?: number;
  cooldown_sec?: number;
}

export interface SegmentPriorConfig {
  cold_start_prior: number;
  bin_duration_sec: number;
  mooccubex_bin_priors_20: number[];
  density_to_prior_intercept: number;
  density_to_prior_slope: number;
}

export interface SpBefParams {
  version: string;
  seed: number;
  llr_clip: number;
  fusion: Required<FusionConfig>;
  segment_prior: SegmentPriorConfig;
  branches: {
    face: BranchConfig;
    behavior: BranchConfig;
    quiz: BranchConfig;
  };
}

export const SP_BEF_PARAMS: SpBefParams = spBefParamsJson as unknown as SpBefParams;

export interface FrameTelemetryStat {
  detected: boolean;
  luminance: number;
  brow_furrow?: number;
  eye_squint?: number;
  mouth_tension?: number;
  ear?: number;
  head_yaw_deg?: number;
  head_pitch_deg?: number;
  nose_x?: number;
  nose_y?: number;
  iod?: number;
}

export interface AggregatedClipWindow {
  brow_furrow_mean: number;
  brow_furrow_std: number;
  brow_furrow_max: number;
  eye_squint_mean: number;
  eye_squint_std: number;
  ear_mean: number;
  ear_std: number;
  mouth_tension_mean: number;
  head_yaw_abs_mean: number;
  head_pitch_abs_mean: number;
  nose_drift_norm: number;
  eye_lock_ratio: number;
  affect_boredom: number;
  affect_engagement: number;
  affect_frustration: number;
  face_present_ratio: number;
  avg_luminance: number;
  r_face: number;
}

export type SpBefLevel = 'none' | 'mild' | 'moderate' | 'high' | 'unknown';

export interface SpBefStepResult {
  prior_prob: number;
  posterior_prob: number;
  llr_face: number;
  llr_beh: number;
  llr_quiz: number;
  r_face: number;
  r_beh: number;
  r_quiz: number;
  contrib_face: number;
  contrib_beh: number;
  contrib_quiz: number;
  segment_prior: number;
  high_duration_sec: number;
  is_confused: boolean;
  should_intervene: boolean;
  cooldown_remaining_sec: number;
  level: SpBefLevel;
}

export interface SpBefStepInputObject {
  prevPosterior?: number;
  prev_posterior?: number;
  segmentPrior?: number;
  segment_prior?: number;
  llrFace?: number;
  llr_face?: number;
  rFace?: number;
  r_face?: number;
  llrBeh?: number;
  llr_beh?: number;
  rBeh?: number;
  r_beh?: number;
  llrQuiz?: number;
  llr_quiz?: number;
  rQuiz?: number;
  r_quiz?: number;
  fusionCfg?: FusionConfig;
  fusion_cfg?: FusionConfig;
  prevHighSec?: number;
  prev_high_sec?: number;
  prevIntervening?: boolean;
  prev_intervening?: boolean;
  cooldownRemainingSec?: number;
  cooldown_remaining_sec?: number;
  dtSec?: number;
  dt_sec?: number;
}

function roundTo(val: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export function clipVal(x: number, lo: number, hi: number): number {
  if (typeof x !== 'number' || Number.isNaN(x) || !Number.isFinite(x)) {
    return 0.0;
  }
  return Math.max(lo, Math.min(hi, x));
}

export function sigmoid(z: number): number {
  const zC = clipVal(z, -20.0, 20.0);
  return 1.0 / (1.0 + Math.exp(-zC));
}

export function logit(p: number): number {
  const pC = clipVal(p, 1e-4, 1.0 - 1e-4);
  return Math.log(pC / (1.0 - pC));
}

/**
 * Deterministic 1D piecewise-linear interpolation identical in Python, TypeScript, and Go.
 * Used to represent monotonic Isotonic Calibration maps across all runtimes with < 1e-9 parity.
 */
export function piecewiseLinearInterp(x: number, xp: number[], fp: number[]): number {
  if (!xp || !fp || xp.length === 0 || fp.length === 0 || xp.length !== fp.length) {
    return clipVal(x, 1e-4, 1.0 - 1e-4);
  }
  if (x <= xp[0]) {
    return Number(fp[0]);
  }
  if (x >= xp[xp.length - 1]) {
    return Number(fp[fp.length - 1]);
  }
  for (let i = 0; i < xp.length - 1; i++) {
    const x0 = xp[i];
    const x1 = xp[i + 1];
    if (x0 <= x && x <= x1) {
      if (Math.abs(x1 - x0) < 1e-12) {
        return Number(fp[i]);
      }
      const t = (x - x0) / (x1 - x0);
      return Number(fp[i] + t * (fp[i + 1] - fp[i]));
    }
  }
  return Number(fp[fp.length - 1]);
}

/**
 * C4 Dynamic Frame Reliability r_face(t) in [0, 1].
 * Returns 0.0 when modality is missing (facePresentRatio <= 0) or room is too dark (avgLuminance <= 35).
 */
export function computeFrameReliability(
  facePresentRatio: number,
  avgLuminance: number,
  headYawAbsDeg: number,
  headPitchAbsDeg: number,
  landmarkConfidence = 1.0,
): number {
  if (
    Number.isNaN(facePresentRatio) ||
    facePresentRatio <= 0.0 ||
    landmarkConfidence <= 0.0
  ) {
    return 0.0;
  }
  const rPres = clipVal(facePresentRatio, 0.0, 1.0);
  const rLuma = clipVal((avgLuminance - 35.0) / 60.0, 0.0, 1.0);
  const rYaw = clipVal(1.0 - Math.max(Math.abs(headYawAbsDeg) - 15.0, 0.0) / 30.0, 0.0, 1.0);
  const rPitch = clipVal(1.0 - Math.max(Math.abs(headPitchAbsDeg) - 12.0, 0.0) / 25.0, 0.0, 1.0);
  const rConf = clipVal(landmarkConfidence, 0.0, 1.0);
  return roundTo(rPres * rLuma * rYaw * rPitch * rConf, 6);
}

/**
 * Evaluates a standardized linear/logistic branch + isotonic piecewise calibration map,
 * and returns { rawProb, calProb, llr }.
 */
export function predictLinearCalibratedBranch(
  features: number[],
  branchCfg: BranchConfig,
): { rawProb: number; calProb: number; llr: number } {
  const mean = branchCfg.scaler_mean;
  const scale = branchCfg.scaler_scale;
  const coef = branchCfg.coefficients;
  const intercept = Number(branchCfg.intercept);
  const baseRate = Number(branchCfg.base_rate);

  let z = intercept;
  const len = Math.min(features.length, mean.length, scale.length, coef.length);
  for (let i = 0; i < len; i++) {
    const x = features[i];
    const val = typeof x !== 'number' || Number.isNaN(x) || !Number.isFinite(x) ? 0.0 : Number(x);
    const s = Number(scale[i]);
    const denom = Math.abs(s) > 1e-9 ? s : 1.0;
    z += ((val - Number(mean[i])) / denom) * Number(coef[i]);
  }

  const rawP = sigmoid(z);
  const calibX = branchCfg.isotonic_xp ?? [];
  const calibY = branchCfg.isotonic_fp ?? [];
  let calP = piecewiseLinearInterp(rawP, calibX, calibY);
  calP = clipVal(calP, 1e-3, 1.0 - 1e-3);

  const llr = clipVal(logit(calP) - logit(baseRate), -LLR_CLIP, LLR_CLIP);
  return {
    rawProb: roundTo(rawP, 6),
    calProb: roundTo(calP, 6),
    llr: roundTo(llr, 6),
  };
}

/**
 * Single forward-filtering step of the SP-BEF 2-State HMM + Hysteresis + Cooldown decision rule.
 * Supports both positional arguments (matching Python `sp_bef_step`) and a single input object.
 */
export function spBefStep(
  prevPosteriorOrObj: number | SpBefStepInputObject,
  segmentPrior?: number,
  llrFace?: number,
  rFace?: number,
  llrBeh?: number,
  rBeh?: number,
  llrQuiz?: number,
  rQuiz?: number,
  fusionCfg: FusionConfig = SP_BEF_PARAMS.fusion,
  prevHighSec = 0.0,
  prevIntervening = false,
  cooldownRemainingSec = 0.0,
  dtSec = 5.0,
): SpBefStepResult {
  if (typeof prevPosteriorOrObj === 'object' && prevPosteriorOrObj !== null) {
    const o = prevPosteriorOrObj;
    return spBefStep(
      o.prevPosterior ?? o.prev_posterior ?? 0.15,
      o.segmentPrior ?? o.segment_prior ?? SP_BEF_PARAMS.segment_prior.cold_start_prior,
      o.llrFace ?? o.llr_face ?? 0.0,
      o.rFace ?? o.r_face ?? 0.0,
      o.llrBeh ?? o.llr_beh ?? 0.0,
      o.rBeh ?? o.r_beh ?? 0.0,
      o.llrQuiz ?? o.llr_quiz ?? 0.0,
      o.rQuiz ?? o.r_quiz ?? 0.0,
      o.fusionCfg ?? o.fusion_cfg ?? SP_BEF_PARAMS.fusion,
      o.prevHighSec ?? o.prev_high_sec ?? 0.0,
      o.prevIntervening ?? o.prev_intervening ?? false,
      o.cooldownRemainingSec ?? o.cooldown_remaining_sec ?? 0.0,
      o.dtSec ?? o.dt_sec ?? 5.0,
    );
  }

  const prev_posterior = Number(prevPosteriorOrObj);
  const segment_prior = segmentPrior ?? SP_BEF_PARAMS.segment_prior.cold_start_prior;
  const llr_face = llrFace ?? 0.0;
  const r_face = rFace ?? 0.0;
  const llr_beh = llrBeh ?? 0.0;
  const r_beh = rBeh ?? 0.0;
  const llr_quiz = llrQuiz ?? 0.0;
  const r_quiz = rQuiz ?? 0.0;
  const cfg = fusionCfg ?? SP_BEF_PARAMS.fusion;

  const aKeep = Number(cfg.hmm_keep_confused ?? 0.78);
  const beta0 = Number(cfg.hmm_beta0 ?? 0.04);
  const beta1 = Number(cfg.hmm_beta1 ?? 0.45);

  const wFace = Number(cfg.w_face ?? 0.65);
  const wBeh = Number(cfg.w_beh ?? 0.85);
  const wQuiz = Number(cfg.w_quiz ?? 0.90);

  const thetaOn = Number(cfg.theta_on ?? 0.62);
  const thetaOff = Number(cfg.theta_off ?? 0.42);
  const minHoldSec = Number(cfg.min_hold_sec ?? 10.0);
  const cooldownSec = Number(cfg.cooldown_sec ?? 180.0);

  const piS = clipVal(segment_prior, 0.02, 0.85);
  const pPrev = clipVal(prev_posterior, 0.01, 0.99);

  // 1. HMM 2-state prior transition modulated by segment prior pi_s (C3 + C5)
  const betaPi = clipVal(beta0 + beta1 * piS, 0.02, 0.65);
  const pPrior = clipVal(aKeep * pPrev + betaPi * (1.0 - pPrev), 0.01, 0.99);
  const priorLogit = logit(pPrior);

  // 2. Reliability-weighted calibrated LLR evidence sum (C1 + C4)
  const rf = clipVal(r_face, 0.0, 1.0);
  const rb = clipVal(r_beh, 0.0, 1.0);
  const rq = clipVal(r_quiz, 0.0, 1.0);

  const lf = rf > 0 ? clipVal(llr_face, -LLR_CLIP, LLR_CLIP) : 0.0;
  const lb = rb > 0 ? clipVal(llr_beh, -LLR_CLIP, LLR_CLIP) : 0.0;
  const lq = rq > 0 ? clipVal(llr_quiz, -LLR_CLIP, LLR_CLIP) : 0.0;

  const contribFace = roundTo(rf * wFace * lf, 6);
  const contribBeh = roundTo(rb * wBeh * lb, 6);
  const contribQuiz = roundTo(rq * wQuiz * lq, 6);

  const postLogit = priorLogit + contribFace + contribBeh + contribQuiz;
  const pPost = roundTo(sigmoid(postLogit), 6);

  // 3. Hysteresis (theta_on / theta_off) + Cooldown decision rule
  let newCooldown = Math.max(0.0, Number(cooldownRemainingSec) - Number(dtSec));
  let highSec: number;
  if (pPost >= thetaOn) {
    highSec = Number(prevHighSec) + Number(dtSec);
  } else if (pPost < thetaOff) {
    highSec = 0.0;
  } else {
    highSec = Number(prevHighSec);
  }

  let isConfusedState: boolean;
  if (prevIntervening) {
    isConfusedState = pPost >= thetaOff;
  } else {
    isConfusedState = pPost >= thetaOn && highSec >= minHoldSec;
  }

  let shouldIntervene = false;
  if (isConfusedState && newCooldown <= 0.0 && !prevIntervening) {
    shouldIntervene = true;
    newCooldown = cooldownSec;
  }

  const totalReliability = rf + rb + rq;
  let level: SpBefLevel;
  if (totalReliability <= 1e-6) {
    level = 'unknown';
  } else if (pPost >= thetaOn) {
    level = 'high';
  } else if (pPost >= thetaOff) {
    level = 'moderate';
  } else if (pPost >= 0.25) {
    level = 'mild';
  } else {
    level = 'none';
  }

  return {
    prior_prob: roundTo(pPrior, 6),
    posterior_prob: pPost,
    llr_face: roundTo(lf, 6),
    llr_beh: roundTo(lb, 6),
    llr_quiz: roundTo(lq, 6),
    r_face: roundTo(rf, 6),
    r_beh: roundTo(rb, 6),
    r_quiz: roundTo(rq, 6),
    contrib_face: contribFace,
    contrib_beh: contribBeh,
    contrib_quiz: contribQuiz,
    segment_prior: roundTo(piS, 6),
    high_duration_sec: roundTo(highSec, 2),
    is_confused: Boolean(isConfusedState),
    should_intervene: Boolean(shouldIntervene),
    cooldown_remaining_sec: roundTo(newCooldown, 2),
    level,
  };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0.0;
  let sum = 0.0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function stdPop(arr: number[]): number {
  if (arr.length === 0) return 0.0;
  const m = mean(arr);
  let sumSq = 0.0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length);
}

// The face model is trained on DAiSEE sampled at 10 fps (ml/extract_daisee_video_frames.py), so a 10 s face
// window keeps at most one frame per ~100 ms whatever the camera / requestAnimationFrame rate is (jitter allowed).
export const FACE_WINDOW_SAMPLE_MS = 95;

/** Greedy ~10 fps subsampling of a time-ordered frame list (first frame kept, then every >= FACE_WINDOW_SAMPLE_MS). */
export function subsampleFaceWindow<T extends { timestampMs: number }>(frames: readonly T[]): T[] {
  const out: T[] = [];
  for (const f of frames) {
    if (out.length === 0 || f.timestampMs - out[out.length - 1].timestampMs >= FACE_WINDOW_SAMPLE_MS) {
      out.push(f);
    }
  }
  return out;
}

/**
 * Aggregates a sequence of frame telemetry dicts into the 15 standardized 10-second Face Window features
 * + C4 Frame Reliability `r_face`. Matches `aggregate_clip_window` in `ml/run_sp_bef_pipeline.py` to <= 1e-6.
 */
export function aggregateClipWindow(frameStats: FrameTelemetryStat[]): AggregatedClipWindow {
  const nTotal = Math.max(frameStats.length, 1);
  const valid = frameStats.filter((f) => Boolean(f.detected));
  const facePresentRatio = valid.length / nTotal;
  const avgLuma =
    frameStats.length > 0 ? mean(frameStats.map((f) => Number(f.luminance ?? 0.0))) : 0.0;

  if (valid.length === 0) {
    return {
      brow_furrow_mean: 0.0,
      brow_furrow_std: 0.0,
      brow_furrow_max: 0.0,
      eye_squint_mean: 0.0,
      eye_squint_std: 0.0,
      ear_mean: 0.0,
      ear_std: 0.0,
      mouth_tension_mean: 0.0,
      head_yaw_abs_mean: 0.0,
      head_pitch_abs_mean: 0.0,
      nose_drift_norm: 0.0,
      eye_lock_ratio: 0.0,
      affect_boredom: 0.0,
      affect_engagement: 0.0,
      affect_frustration: 0.0,
      face_present_ratio: 0.0,
      avg_luminance: roundTo(avgLuma, 4),
      r_face: 0.0,
    };
  }

  const furrows = valid.map((f) => Number(f.brow_furrow ?? 0.0));
  const squints = valid.map((f) => Number(f.eye_squint ?? 0.0));
  const mouths = valid.map((f) => Number(f.mouth_tension ?? 0.0));
  const ears = valid.map((f) => Number(f.ear ?? 0.0));
  const yaws = valid.map((f) => Math.abs(Number(f.head_yaw_deg ?? 0.0)));
  const pitches = valid.map((f) => Math.abs(Number(f.head_pitch_deg ?? 0.0)));

  const noseXs = valid.map((f) => Number(f.nose_x ?? 0.5));
  const noseYs = valid.map((f) => Number(f.nose_y ?? 0.5));
  const meanIod = mean(valid.map((f) => Number(f.iod ?? 0.145)));

  let noseDriftNorm = 0.0;
  if (valid.length > 1) {
    const denomIod = Math.max(meanIod, 1e-4);
    for (let i = 0; i < valid.length; i++) {
      const drift = Math.hypot(noseXs[i] - noseXs[0], noseYs[i] - noseYs[0]) / denomIod;
      if (drift > noseDriftNorm) noseDriftNorm = drift;
    }
  }

  const earStd = stdPop(ears);
  const eyeLockFrames = valid.map((f) =>
    Number(f.ear ?? 0.0) > 0.22 && earStd < 0.045 && noseDriftNorm < 0.18 ? 1.0 : 0.0,
  );
  const eyeLockRatio = mean(eyeLockFrames);

  const yawMean = mean(yaws);
  const pitchMean = mean(pitches);
  const rFace = computeFrameReliability(facePresentRatio, avgLuma, yawMean, pitchMean, 1.0);

  const earMeanVal = mean(ears);
  const furrowMeanVal = mean(furrows);
  const squintMeanVal = mean(squints);
  const mouthMeanVal = mean(mouths);

  const affectBoredom = clipVal(
    Math.max(0.0, (0.24 - earMeanVal) * 3.2) + (yawMean / 45.0) * 0.35 + (pitchMean / 35.0) * 0.25,
    0.0,
    1.0,
  );
  const affectEngagement = clipVal(
    1.0 - affectBoredom * 0.65 + eyeLockRatio * 0.25 - noseDriftNorm * 0.3,
    0.0,
    1.0,
  );
  const affectFrustration = clipVal(
    furrowMeanVal * 0.55 + mouthMeanVal * 0.45 + squintMeanVal * 0.25,
    0.0,
    1.0,
  );

  return {
    brow_furrow_mean: roundTo(furrowMeanVal, 6),
    brow_furrow_std: roundTo(stdPop(furrows), 6),
    brow_furrow_max: roundTo(Math.max(...furrows), 6),
    eye_squint_mean: roundTo(squintMeanVal, 6),
    eye_squint_std: roundTo(stdPop(squints), 6),
    ear_mean: roundTo(earMeanVal, 6),
    ear_std: roundTo(earStd, 6),
    mouth_tension_mean: roundTo(mouthMeanVal, 6),
    head_yaw_abs_mean: roundTo(yawMean, 6),
    head_pitch_abs_mean: roundTo(pitchMean, 6),
    nose_drift_norm: roundTo(noseDriftNorm, 6),
    eye_lock_ratio: roundTo(eyeLockRatio, 6),
    affect_boredom: roundTo(affectBoredom, 6),
    affect_engagement: roundTo(affectEngagement, 6),
    affect_frustration: roundTo(affectFrustration, 6),
    face_present_ratio: roundTo(facePresentRatio, 6),
    avg_luminance: roundTo(avgLuma, 4),
    r_face: roundTo(rFace, 6),
  };
}

export interface PersonalBaselineInput {
  brow_furrow_mean: number;
  eye_squint_mean: number;
  ear_mean: number;
  mouth_tension_mean: number;
  affect_frustration: number;
}

export interface PersonalBaselineZScores {
  brow_furrow_z: number;
  eye_squint_z: number;
  ear_z: number;
  mouth_tension_z: number;
  affect_frustration_z: number;
}

const BASELINE_Z_SPECS: readonly {
  rawKey: keyof PersonalBaselineInput;
  zKey: keyof PersonalBaselineZScores;
  minStd: number;
}[] = [
  { rawKey: 'brow_furrow_mean', zKey: 'brow_furrow_z', minStd: 0.05 },
  { rawKey: 'eye_squint_mean', zKey: 'eye_squint_z', minStd: 0.05 },
  { rawKey: 'ear_mean', zKey: 'ear_z', minStd: 0.03 },
  { rawKey: 'mouth_tension_mean', zKey: 'mouth_tension_z', minStd: 0.05 },
  { rawKey: 'affect_frustration', zKey: 'affect_frustration_z', minStd: 0.08 },
] as const;

/**
 * C2 Personal Baseline Calibrator (On-Device):
 * Accumulates the student's initial 60–90s (or first N windows/frames) on-device to compute
 * personal baseline (mu_i, sigma_i) for brow_furrow_mean, eye_squint_mean, ear_mean,
 * mouth_tension_mean, affect_frustration, and outputs the 5 z-score delta features.
 */
export class PersonalBaselineCalibrator {
  private samples: PersonalBaselineInput[] = [];
  private readonly minSamples: number;
  private readonly maxBaselineSamples: number;
  private firstTimestampMs: number | null = null;
  private readonly baselineDurationMs: number;
  private lockedBaseline: Record<keyof PersonalBaselineInput, { mu: number; sigma: number }> | null =
    null;

  constructor(minSamples = 5, baselineDurationSec = 60, maxBaselineSamples = 90) {
    this.minSamples = Math.max(1, minSamples);
    this.baselineDurationMs = baselineDurationSec * 1000;
    this.maxBaselineSamples = Math.max(this.minSamples, maxBaselineSamples);
  }

  public reset(): void {
    this.samples = [];
    this.firstTimestampMs = null;
    this.lockedBaseline = null;
  }

  public getSampleCount(): number {
    return this.samples.length;
  }

  public isReady(): boolean {
    return this.lockedBaseline !== null || this.samples.length >= this.minSamples;
  }

  public observe(
    sample: PersonalBaselineInput,
    rFace = 1.0,
    timestampMs: number = Date.now(),
  ): PersonalBaselineZScores {
    if (rFace <= 0.0) {
      return {
        brow_furrow_z: 0.0,
        eye_squint_z: 0.0,
        ear_z: 0.0,
        mouth_tension_z: 0.0,
        affect_frustration_z: 0.0,
      };
    }

    if (this.firstTimestampMs === null) {
      this.firstTimestampMs = timestampMs;
    }

    const elapsedMs = timestampMs - this.firstTimestampMs;
    if (
      this.lockedBaseline === null &&
      (this.samples.length < this.minSamples ||
        (elapsedMs <= this.baselineDurationMs && this.samples.length < this.maxBaselineSamples))
    ) {
      this.samples.push({
        brow_furrow_mean: Number(sample.brow_furrow_mean ?? 0),
        eye_squint_mean: Number(sample.eye_squint_mean ?? 0),
        ear_mean: Number(sample.ear_mean ?? 0),
        mouth_tension_mean: Number(sample.mouth_tension_mean ?? 0),
        affect_frustration: Number(sample.affect_frustration ?? 0),
      });

      if (
        this.samples.length >= this.minSamples &&
        (elapsedMs >= this.baselineDurationMs || this.samples.length >= this.maxBaselineSamples)
      ) {
        this.lockedBaseline = this.computeStats();
      }
    }

    return this.transform(sample, rFace);
  }

  private computeStats(): Record<keyof PersonalBaselineInput, { mu: number; sigma: number }> {
    const stats = {} as Record<keyof PersonalBaselineInput, { mu: number; sigma: number }>;
    for (const spec of BASELINE_Z_SPECS) {
      const vals = this.samples.map((s) => s[spec.rawKey]);
      const mu = vals.length > 0 ? mean(vals) : 0.0;
      const sigma = Math.max(stdPop(vals), spec.minStd);
      stats[spec.rawKey] = { mu, sigma };
    }
    return stats;
  }

  public getBaselineStats(): Record<keyof PersonalBaselineInput, { mu: number; sigma: number }> {
    if (this.lockedBaseline) return this.lockedBaseline;
    return this.computeStats();
  }

  public transform(sample: PersonalBaselineInput, rFace = 1.0): PersonalBaselineZScores {
    if (rFace <= 0.0 || this.samples.length === 0) {
      return {
        brow_furrow_z: 0.0,
        eye_squint_z: 0.0,
        ear_z: 0.0,
        mouth_tension_z: 0.0,
        affect_frustration_z: 0.0,
      };
    }

    const stats = this.getBaselineStats();
    const out = {} as PersonalBaselineZScores;
    for (const spec of BASELINE_Z_SPECS) {
      const { mu, sigma } = stats[spec.rawKey];
      const val = Number(sample[spec.rawKey] ?? 0.0);
      out[spec.zKey] = roundTo((val - mu) / Math.max(sigma, spec.minStd), 6);
    }
    return out;
  }

  /**
   * Builds the face-branch input in the exact order of `SP_BEF_PARAMS.branches.face.feature_names`, so the
   * runtime always matches whichever feature set the training pipeline selected.
   */
  public buildFaceModelVector(
    windowFeatures: AggregatedClipWindow,
    rFace = windowFeatures.r_face,
    featureNames: readonly string[] = SP_BEF_PARAMS.branches.face.feature_names ?? FACE_MODEL_FEATURES,
  ): number[] {
    const zScores = this.transform(windowFeatures, rFace);
    const values: Record<string, number> = { ...windowFeatures, ...zScores };
    return featureNames.map((name) => {
      const v = values[name];
      if (v === undefined) {
        throw new Error(`Unknown face feature in sp_bef_params.json: ${name}`);
      }
      return Number.isFinite(v) ? v : 0.0;
    });
  }
}

/**
 * Looks up C3 Segment Prior pi_s for a video timestamp (in seconds) from 30s crowd seek-back density bins.
 */
export function getSegmentPriorForTimestamp(videoTimestampSec: number): number {
  const cfg = SP_BEF_PARAMS.segment_prior;
  const bins = cfg.mooccubex_bin_priors_20;
  if (!bins || bins.length === 0 || !Number.isFinite(videoTimestampSec) || videoTimestampSec < 0) {
    return cfg.cold_start_prior;
  }
  const binIdx = Math.min(
    bins.length - 1,
    Math.max(0, Math.floor(videoTimestampSec / Math.max(1, cfg.bin_duration_sec))),
  );
  return Number(bins[binIdx] ?? cfg.cold_start_prior);
}
