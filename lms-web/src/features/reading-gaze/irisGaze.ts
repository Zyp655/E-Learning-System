import type { Point3D } from '@/features/confusion-cv/realFaceTracker';

// MediaPipe FaceLandmarker returns 478 points; 468..477 are the two irises (center + 4 ring points each).
export const IRIS_CENTER_INDICES = [468, 473] as const;
// Per eye: corners in image left -> right order, then upper / lower lid midpoints.
const EYE_GEOMETRY = [
  { left: 33, right: 133, top: 159, bottom: 145 },
  { left: 362, right: 263, top: 386, bottom: 374 },
] as const;
const NOSE_TIP = 1;

export interface EyeGazeFeatures {
  /** Iris position between the eye corners, 0 = image-left corner, 1 = image-right corner (both eyes averaged). */
  h: number;
  /** Iris position between the lids, 0 = upper lid, 1 = lower lid. */
  v: number;
  /** Nose tip in normalized image coordinates: head translation, which also moves the gaze point. */
  noseX: number;
  noseY: number;
  /** Head rotation from the face mesh; turning the head moves the gaze point without moving the iris. */
  yawDeg: number;
  pitchDeg: number;
}

function dist(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Extracts iris-in-eye position plus head pose from one MediaPipe 478-point face mesh.
 * Returns null when the mesh has no iris points or an eye is closed (blink), so the sample is skipped.
 */
export function extractEyeGazeFeatures(
  landmarks: readonly Point3D[],
  headYawDeg = 0,
  headPitchDeg = 0,
): EyeGazeFeatures | null {
  if (landmarks.length < 478) return null;
  const irises = IRIS_CENTER_INDICES.map((i) => landmarks[i]);
  let hSum = 0;
  let vSum = 0;
  for (const eye of EYE_GEOMETRY) {
    const left = landmarks[eye.left];
    const right = landmarks[eye.right];
    const top = landmarks[eye.top];
    const bottom = landmarks[eye.bottom];
    const width = dist(left, right);
    const height = dist(top, bottom);
    // Closed or nearly closed eye: the iris center is not observable.
    if (width < 1e-4 || height / width < 0.12) return null;

    // Pair each eye with the nearer iris instead of trusting the mesh's left/right index convention.
    const cx = (left.x + right.x) / 2;
    const cy = (left.y + right.y) / 2;
    const iris = irises.reduce((best, p) =>
      Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best,
    );

    const ux = (right.x - left.x) / width;
    const uy = (right.y - left.y) / width;
    hSum += ((iris.x - left.x) * ux + (iris.y - left.y) * uy) / width;
    vSum += (iris.y - top.y) / Math.max(bottom.y - top.y, 1e-4);
  }
  const nose = landmarks[NOSE_TIP];
  return { h: hSum / 2, v: vSum / 2, noseX: nose.x, noseY: nose.y, yawDeg: headYawDeg, pitchDeg: headPitchDeg };
}

// Head angles enter in units of 30 deg so every regressor is O(1) for the shared ridge penalty.
function designRow(f: EyeGazeFeatures): number[] {
  return [1, f.h, f.v, f.noseX, f.noseY, f.yawDeg / 30, f.pitchDeg / 30, f.h * f.h, f.v * f.v];
}

/** Solves (A + lambda*I) w = b for a small dense symmetric system by Gaussian elimination with pivoting. */
function solveRidge(ata: number[][], atb: number[], lambda: number): number[] {
  const n = atb.length;
  const m = ata.map((row, i) => [...row.map((v, j) => v + (i === j && i > 0 ? lambda : 0)), atb[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = Math.abs(m[col][col]) < 1e-12 ? 1e-12 : m[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / p;
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / (Math.abs(row[i]) < 1e-12 ? 1e-12 : row[i]));
}

export interface CalibrationPoint {
  features: EyeGazeFeatures;
  x: number;
  y: number;
}

/**
 * Maps iris features to screen coordinates with a quadratic ridge regression fitted on a 9-point calibration.
 * Webcam iris tracking is accurate to a few degrees at best, so downstream code only resolves lines/paragraphs.
 */
export class GazeCalibrator {
  private wx: number[] | null = null;
  private wy: number[] | null = null;

  constructor(private readonly lambda = 1e-3) {}

  isReady(): boolean {
    return this.wx !== null && this.wy !== null;
  }

  reset(): void {
    this.wx = null;
    this.wy = null;
  }

  fit(points: readonly CalibrationPoint[]): boolean {
    const k = designRow(points[0]?.features ?? { h: 0, v: 0, noseX: 0, noseY: 0, yawDeg: 0, pitchDeg: 0 }).length;
    if (points.length < k) return false;
    const ata = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    const atbx = new Array<number>(k).fill(0);
    const atby = new Array<number>(k).fill(0);
    for (const p of points) {
      const row = designRow(p.features);
      for (let i = 0; i < k; i++) {
        atbx[i] += row[i] * p.x;
        atby[i] += row[i] * p.y;
        for (let j = 0; j < k; j++) ata[i][j] += row[i] * row[j];
      }
    }
    this.wx = solveRidge(ata, atbx, this.lambda);
    this.wy = solveRidge(ata, atby, this.lambda);
    return true;
  }

  predict(f: EyeGazeFeatures): { x: number; y: number } | null {
    if (!this.wx || !this.wy) return null;
    const row = designRow(f);
    let x = 0;
    let y = 0;
    for (let i = 0; i < row.length; i++) {
      x += row[i] * this.wx[i];
      y += row[i] * this.wy[i];
    }
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  /** Mean vertical error in px on held-out points (lines are horizontal, so vertical error is what matters). */
  validationErrorPx(points: readonly CalibrationPoint[]): number {
    const errs = points
      .map((p) => {
        const g = this.predict(p.features);
        return g ? Math.abs(g.y - p.y) : null;
      })
      .filter((e): e is number => e !== null);
    return errs.length > 0 ? errs.reduce((a, b) => a + b, 0) / errs.length : Number.POSITIVE_INFINITY;
  }
}

function smoothingAlpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012): strong smoothing while the gaze is still, little lag
 * during saccades. Unlike a fixed exponential average it does not smear return sweeps into the next line.
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private tSec: number | null = null;

  constructor(
    private readonly minCutoffHz = 1.0,
    private readonly beta = 0.01,
    private readonly derivCutoffHz = 1.0,
  ) {}

  reset(): void {
    this.x = null;
    this.dx = 0;
    this.tSec = null;
  }

  next(value: number, tMs: number): number {
    const t = tMs / 1000;
    if (this.x === null || this.tSec === null || t <= this.tSec) {
      this.x = value;
      this.tSec = t;
      return value;
    }
    const dt = t - this.tSec;
    this.tSec = t;
    const rawDx = (value - this.x) / dt;
    this.dx += smoothingAlpha(this.derivCutoffHz, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoffHz + this.beta * Math.abs(this.dx);
    this.x += smoothingAlpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Per-axis One Euro filtering of the predicted gaze point (px). */
export class GazeFilter {
  private readonly fx = new OneEuroFilter();
  private readonly fy = new OneEuroFilter();

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }

  next(p: { x: number; y: number }, tMs: number): { x: number; y: number } {
    return { x: this.fx.next(p.x, tMs), y: this.fy.next(p.y, tMs) };
  }
}
