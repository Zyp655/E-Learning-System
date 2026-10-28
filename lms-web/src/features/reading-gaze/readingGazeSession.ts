import {
  SP_BEF_PARAMS,
  computeGazeReliability,
  predictLinearCalibratedBranch,
} from '@/features/confusion-cv/spBefCore';
import type { GazeFrame } from './gazeFeed';
import { GazeCalibrator, GazeFilter, extractEyeGazeFeatures, type CalibrationPoint } from './irisGaze';
import {
  DEFAULT_READING_WPM,
  computeParagraphGazeFeatures,
  detectFixations,
  gazeFeatureArray,
  isReturnSweep,
  mapGazeToParagraph,
  medianParagraphHeight,
  observedWpm,
  sampleQuality,
  type Fixation,
  type GazeFeatureVector,
  type MappedGazeSample,
  type ParagraphLayout,
} from './readingFeatures';

// ~10 minutes at 30 fps; older samples cannot change the current paragraph's features much.
const MAX_SAMPLES = 18_000;
// A paragraph counts as read (and can be labelled) after this much fixation time.
const MIN_COMPLETED_DWELL_MS = 1500;
// Fixations older than this do not decide which paragraph is being read now.
const CURRENT_PARAGRAPH_WINDOW_MS = 3000;
// Webcam calibrations drift as the reader shifts in the chair; suggest a quick re-check after this long,
// or as soon as most recent gaze falls outside the text.
const REVALIDATE_AFTER_MS = 8 * 60_000;
const DRIFT_WINDOW_SAMPLES = 900; // ~30 s
const DRIFT_MIN_ON_TEXT = 0.4;
// Return sweeps land near the start of a line; their landing x estimates horizontal drift.
const SWEEP_LANDING_SHARE = 0.05;
const DRIFT_ALPHA = 0.2;
const MAX_DRIFT_SHARE = 0.3;

export interface GazeEvidence {
  paragraph: number;
  features: GazeFeatureVector;
  llrGaze: number;
  rGaze: number;
  facePresentRatio: number;
  onTextRatio: number;
}

export interface GazeTick {
  currentParagraph: number | null;
  /** Paragraph the reader just moved forward from, once per paragraph. */
  completedParagraph: number | null;
  evidence: GazeEvidence | null;
}

/**
 * Webcam reading-gaze pipeline for the Reading View: iris + head pose -> calibrated screen point -> One Euro
 * filter -> paragraph -> fixations -> per-paragraph SP-BEF gaze evidence. Pure logic, driven by GazeFrames
 * and explicit ticks.
 */
export class ReadingGazeSession {
  readonly calibrator = new GazeCalibrator();
  private readonly filter = new GazeFilter();
  private samples: MappedGazeSample[] = [];
  private layouts: ParagraphLayout[] = [];
  private fitPoints: CalibrationPoint[] = [];
  private validationPoints: CalibrationPoint[] = [];
  private calibrationTarget: { x: number; y: number; phase: 'fit' | 'validate' } | null = null;
  private lastParagraph: number | null = null;
  private completed = new Set<number>();
  private wpmObservations: number[] = [];
  private seenSweepEnds = new Set<number>();
  private headYawDeg = 0;
  /** Horizontal drift (px) estimated from return-sweep landings and subtracted from new samples. */
  driftX = 0;
  calibratedAtMs = 0;
  /** Vertical validation error / median paragraph height; 0 = uncalibrated. */
  calibrationErrorNorm = 0;

  setLayouts(layouts: ParagraphLayout[]): void {
    this.layouts = layouts;
  }

  getLayout(index: number): ParagraphLayout | undefined {
    return this.layouts.find((p) => p.index === index);
  }

  isCalibrated(): boolean {
    return this.calibrator.isReady() && this.calibrationErrorNorm > 0;
  }

  /** True when the calibration is old or most recent gaze misses the text (likely drift). */
  needsRevalidation(nowMs: number): boolean {
    if (!this.isCalibrated()) return false;
    if (nowMs - this.calibratedAtMs >= REVALIDATE_AFTER_MS) return true;
    const recent = this.samples.slice(-DRIFT_WINDOW_SAMPLES);
    return recent.length >= DRIFT_WINDOW_SAMPLES / 2 && sampleQuality(recent).onTextRatio < DRIFT_MIN_ON_TEXT;
  }

  /** Personal reading speed: median of first-visit speeds on completed paragraphs, clamped to a sane range. */
  readingWpm(): number {
    if (this.wpmObservations.length < 2) return DEFAULT_READING_WPM;
    const sorted = [...this.wpmObservations].sort((a, b) => a - b);
    return Math.min(Math.max(sorted[Math.floor(sorted.length / 2)], 100), 450);
  }

  /** Full calibration: fit dots then validation dots. */
  startCalibration(): void {
    this.fitPoints = [];
    this.validationPoints = [];
    this.calibrationTarget = null;
    this.calibrator.reset();
    this.filter.reset();
    this.calibrationErrorNorm = 0;
    this.driftX = 0;
  }

  /** Quick re-check of an existing calibration: validation dots only, the gaze map is kept. */
  startValidation(): void {
    this.validationPoints = [];
    this.calibrationTarget = null;
  }

  /** Viewport coordinates of the dot the reader is looking at; null between dots. */
  setCalibrationTarget(target: { x: number; y: number; phase: 'fit' | 'validate' } | null): void {
    this.calibrationTarget = target;
  }

  /**
   * Fits the gaze map (unless `validateOnly`) and scores it on the validation dots. The error is normalized by
   * the median paragraph height, since paragraph assignment is what the features need. Returns 0 on failure.
   */
  finishCalibration(referenceHeightPx: number, validateOnly = false, nowMs = Date.now()): number {
    this.calibrationTarget = null;
    const ok = validateOnly ? this.calibrator.isReady() : this.calibrator.fit(this.fitPoints);
    const errPx = ok ? this.calibrator.validationErrorPx(this.validationPoints) : Number.POSITIVE_INFINITY;
    this.calibrationErrorNorm = Number.isFinite(errPx) ? Math.max(errPx / Math.max(referenceHeightPx, 1), 1e-3) : 0;
    this.calibratedAtMs = nowMs;
    this.driftX = 0;
    this.filter.reset();
    if (!validateOnly) this.samples = [];
    return this.calibrationErrorNorm;
  }

  referenceHeightPx(): number {
    return medianParagraphHeight(this.layouts);
  }

  /** Feeds one face mesh. `scroll` converts the viewport gaze point to page coordinates. */
  onFrame(frame: GazeFrame, scroll: { x: number; y: number }): void {
    const features = frame.faceDetected
      ? extractEyeGazeFeatures(frame.landmarks, frame.headYawDeg, frame.headPitchDeg)
      : null;

    if (this.calibrationTarget) {
      if (features) {
        const point = { features, x: this.calibrationTarget.x, y: this.calibrationTarget.y };
        (this.calibrationTarget.phase === 'fit' ? this.fitPoints : this.validationPoints).push(point);
      }
      return;
    }
    if (!this.calibrator.isReady()) return;

    this.headYawDeg = frame.headYawDeg;
    const gaze = features ? this.calibrator.predict(features) : null;
    if (!gaze) {
      this.pushSample({ t: frame.t, x: 0, y: 0, faceDetected: false, paragraph: null });
      return;
    }
    const filtered = this.filter.next(gaze, frame.t);
    const page = { x: filtered.x + scroll.x - this.driftX, y: filtered.y + scroll.y };
    this.pushSample({ t: frame.t, ...page, faceDetected: true, paragraph: mapGazeToParagraph(page, this.layouts) });
  }

  private pushSample(s: MappedGazeSample): void {
    this.samples.push(s);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
  }

  /** Updates the horizontal drift estimate from return sweeps not seen before. */
  private updateDrift(fixations: readonly Fixation[]): void {
    for (let k = 1; k < fixations.length; k++) {
      const a = fixations[k - 1];
      const b = fixations[k];
      if (a.paragraph === null || a.paragraph !== b.paragraph || this.seenSweepEnds.has(b.start)) continue;
      const layout = this.getLayout(a.paragraph);
      if (!layout || !isReturnSweep(a, b, layout)) continue;
      this.seenSweepEnds.add(b.start);
      const width = layout.right - layout.left;
      // b.x already has the current drift removed, so the residual is added on top of it.
      const residual = b.x - (layout.left + SWEEP_LANDING_SHARE * width);
      const next = this.driftX + DRIFT_ALPHA * residual;
      this.driftX = Math.min(Math.max(next, -MAX_DRIFT_SHARE * width), MAX_DRIFT_SHARE * width);
    }
  }

  evaluateParagraph(index: number, fixations: Fixation[] = detectFixations(this.samples)): GazeEvidence | null {
    const layout = this.getLayout(index);
    if (!layout) return null;
    const features = computeParagraphGazeFeatures(fixations, layout, this.readingWpm());
    const { facePresentRatio, onTextRatio } = sampleQuality(this.samples.slice(-300));
    const rGaze = computeGazeReliability(
      this.calibrationErrorNorm,
      facePresentRatio,
      onTextRatio,
      Math.abs(this.headYawDeg),
    );
    const branch = SP_BEF_PARAMS.branches.gaze;
    const llrGaze = branch && rGaze > 0 ? predictLinearCalibratedBranch(gazeFeatureArray(features), branch).llr : 0;
    return { paragraph: index, features, llrGaze, rGaze, facePresentRatio, onTextRatio };
  }

  private markCompleted(paragraph: number, fixations: Fixation[]): boolean {
    const layout = this.getLayout(paragraph);
    const dwell = fixations.filter((f) => f.paragraph === paragraph).reduce((a, f) => a + f.duration, 0);
    if (!layout || dwell < MIN_COMPLETED_DWELL_MS || this.completed.has(paragraph)) return false;
    this.completed.add(paragraph);
    const wpm = observedWpm(fixations, layout);
    if (wpm !== null) this.wpmObservations.push(wpm);
    return true;
  }

  tick(now: number): GazeTick {
    const fixations = detectFixations(this.samples);
    this.updateDrift(fixations);
    const recent = fixations.filter((f) => f.paragraph !== null && now - f.end <= CURRENT_PARAGRAPH_WINDOW_MS);
    const current = recent.length > 0 ? recent[recent.length - 1].paragraph : null;

    let completedParagraph: number | null = null;
    if (current !== null && this.lastParagraph !== null && current > this.lastParagraph) {
      if (this.markCompleted(this.lastParagraph, fixations)) completedParagraph = this.lastParagraph;
    }
    if (current !== null) this.lastParagraph = current;

    return {
      currentParagraph: current,
      completedParagraph,
      evidence: current !== null ? this.evaluateParagraph(current, fixations) : null,
    };
  }

  /** On leaving the page: the paragraph being read has no "next" paragraph to complete it, so close it here. */
  finishReading(): GazeEvidence | null {
    if (this.lastParagraph === null) return null;
    const fixations = detectFixations(this.samples);
    return this.markCompleted(this.lastParagraph, fixations) ? this.evaluateParagraph(this.lastParagraph, fixations) : null;
  }
}
