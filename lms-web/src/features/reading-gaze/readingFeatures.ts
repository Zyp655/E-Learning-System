import { GAZE_FEATURES } from '@/features/confusion-cv/spBefCore';

/** One paragraph of the Reading View in page coordinates (client rect + scroll offset). */
export interface ParagraphLayout {
  index: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  lineHeight: number;
  wordCount: number;
}

/** A gaze sample in page coordinates, mapped to the paragraph it falls on (null = off text). */
export interface MappedGazeSample {
  t: number;
  x: number;
  y: number;
  faceDetected: boolean;
  paragraph: number | null;
}

export interface Fixation {
  start: number;
  end: number;
  duration: number;
  x: number;
  y: number;
  paragraph: number | null;
}

export type GazeFeatureVector = Record<(typeof GAZE_FEATURES)[number], number>;

export const DEFAULT_READING_WPM = 220;
// I-DT dispersion (px). Webcam gaze noise after filtering is ~2-3 deg (~100 px at 60 cm), so finer
// thresholds only split one fixation into noise fragments. Forward saccades within a line may merge; return
// sweeps (most of a line width) never do.
export const FIXATION_DISPERSION_PX = 100;
// A leftward jump over this share of the paragraph width is a return sweep to the next (or same) line.
export const RETURN_SWEEP_WIDTH_SHARE = 0.4;
const ENTROPY_BINS = 5;

export function lineCount(p: ParagraphLayout): number {
  return Math.max(1, Math.round((p.bottom - p.top) / Math.max(p.lineHeight, 1)));
}

export function medianParagraphHeight(layouts: readonly ParagraphLayout[]): number {
  if (layouts.length === 0) return 0;
  const h = layouts.map((p) => p.bottom - p.top).sort((a, b) => a - b);
  return h[Math.floor(h.length / 2)];
}

/**
 * Maps a gaze point to a paragraph. Each box is padded by most of a line; overlaps go to the paragraph whose
 * vertical center is nearest. Lines are not resolved: webcam vertical error spans several lines.
 */
export function mapGazeToParagraph(point: { x: number; y: number }, layouts: readonly ParagraphLayout[]): number | null {
  let best: ParagraphLayout | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of layouts) {
    const padY = p.lineHeight * 0.75;
    const padX = 40;
    if (point.x < p.left - padX || point.x > p.right + padX || point.y < p.top - padY || point.y > p.bottom + padY) {
      continue;
    }
    const d = Math.abs(point.y - (p.top + p.bottom) / 2);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best ? best.index : null;
}

function mode(values: (number | null)[]): number | null {
  const counts = new Map<number | null, number>();
  let best: number | null = null;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/** Dispersion-threshold fixation detection (I-DT, Salvucci & Goldberg 2000) on face-detected samples. */
export function detectFixations(
  samples: readonly MappedGazeSample[],
  dispersionPx = FIXATION_DISPERSION_PX,
  minDurationMs = 100,
): Fixation[] {
  const pts = samples.filter((s) => s.faceDetected);
  const out: Fixation[] = [];
  let i = 0;
  while (i < pts.length) {
    let j = i;
    let minX = pts[i].x;
    let maxX = pts[i].x;
    let minY = pts[i].y;
    let maxY = pts[i].y;
    while (j + 1 < pts.length) {
      const n = pts[j + 1];
      const nMinX = Math.min(minX, n.x);
      const nMaxX = Math.max(maxX, n.x);
      const nMinY = Math.min(minY, n.y);
      const nMaxY = Math.max(maxY, n.y);
      if (nMaxX - nMinX + (nMaxY - nMinY) > dispersionPx) break;
      [minX, maxX, minY, maxY] = [nMinX, nMaxX, nMinY, nMaxY];
      j++;
    }
    const duration = pts[j].t - pts[i].t;
    if (duration >= minDurationMs) {
      const group = pts.slice(i, j + 1);
      out.push({
        start: pts[i].t,
        end: pts[j].t,
        duration,
        x: group.reduce((a, s) => a + s.x, 0) / group.length,
        y: group.reduce((a, s) => a + s.y, 0) / group.length,
        paragraph: mode(group.map((s) => s.paragraph)),
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}

/** Consecutive on-text fixations in the paragraph, split into visits (re-entries after leaving it). */
export function paragraphVisits(fixations: readonly Fixation[], paragraph: number): Fixation[][] {
  const visits: Fixation[][] = [];
  let current: Fixation[] | null = null;
  for (const f of fixations) {
    if (f.paragraph === null) continue;
    if (f.paragraph === paragraph) {
      if (!current) {
        current = [];
        visits.push(current);
      }
      current.push(f);
    } else {
      current = null;
    }
  }
  return visits;
}

export function isReturnSweep(a: Fixation, b: Fixation, paragraph: ParagraphLayout): boolean {
  return b.x - a.x <= -RETURN_SWEEP_WIDTH_SHARE * (paragraph.right - paragraph.left);
}

/**
 * Normalized gaze transition entropy (Krejtz et al. 2015) over horizontal bins of the paragraph:
 * H = -sum_i pi_i sum_j p(j|i) log p(j|i) / log(bins). Steady left-to-right reading is predictable (low);
 * scanning back and forth while confused is not (high). Uses x only, which webcams resolve far better than lines.
 */
function horizontalTransitionEntropy(visits: readonly Fixation[][], paragraph: ParagraphLayout): number {
  const width = Math.max(paragraph.right - paragraph.left, 1);
  const bin = (x: number) =>
    Math.min(ENTROPY_BINS - 1, Math.max(0, Math.floor(((x - paragraph.left) / width) * ENTROPY_BINS)));
  const counts = Array.from({ length: ENTROPY_BINS }, () => new Array<number>(ENTROPY_BINS).fill(0));
  let total = 0;
  for (const visit of visits) {
    for (let k = 1; k < visit.length; k++) {
      counts[bin(visit[k - 1].x)][bin(visit[k].x)]++;
      total++;
    }
  }
  if (total < 2) return 0;
  let h = 0;
  for (const row of counts) {
    const rowTotal = row.reduce((a, b) => a + b, 0);
    if (rowTotal === 0) continue;
    for (const c of row) {
      if (c > 0) h -= (rowTotal / total) * (c / rowTotal) * Math.log(c / rowTotal);
    }
  }
  return h / Math.log(ENTROPY_BINS);
}

/** Per-paragraph reading features in GAZE_FEATURES order. */
export function computeParagraphGazeFeatures(
  fixations: readonly Fixation[],
  paragraph: ParagraphLayout,
  wpm = DEFAULT_READING_WPM,
): GazeFeatureVector {
  const visits = paragraphVisits(fixations, paragraph.index);
  const inPara = visits.flat();
  const dwellMs = inPara.reduce((a, f) => a + f.duration, 0);
  const expectedMs = (Math.max(paragraph.wordCount, 1) / Math.max(wpm, 1)) * 60_000;

  const onText = fixations.filter((f) => f.paragraph !== null);
  let paraRegressions = 0;
  for (let k = 1; k < onText.length; k++) {
    const a = onText[k - 1].paragraph as number;
    const b = onText[k].paragraph as number;
    if (b < a && (a === paragraph.index || b === paragraph.index)) paraRegressions++;
  }

  let sweeps = 0;
  let moves = 0;
  for (const visit of visits) {
    for (let k = 1; k < visit.length; k++) {
      moves++;
      if (isReturnSweep(visit[k - 1], visit[k], paragraph)) sweeps++;
    }
  }

  return {
    dwell_ratio: dwellMs / expectedMs,
    reread_count: Math.max(visits.length - 1, 0),
    para_regression_rate: (paraRegressions / Math.max(paragraph.wordCount, 1)) * 100,
    sweep_ratio: sweeps / Math.max(lineCount(paragraph) - 1, 1),
    gaze_transition_entropy: horizontalTransitionEntropy(visits, paragraph),
    saccade_rate: dwellMs > 0 ? moves / (dwellMs / 1000) : 0,
  };
}

export function gazeFeatureArray(f: GazeFeatureVector): number[] {
  return GAZE_FEATURES.map((name) => (Number.isFinite(f[name]) ? f[name] : 0));
}

/** Inputs of computeGazeReliability that come from the sample stream itself. */
export function sampleQuality(samples: readonly MappedGazeSample[]): {
  facePresentRatio: number;
  onTextRatio: number;
} {
  if (samples.length === 0) return { facePresentRatio: 0, onTextRatio: 0 };
  const face = samples.filter((s) => s.faceDetected);
  return {
    facePresentRatio: face.length / samples.length,
    onTextRatio: face.length > 0 ? face.filter((s) => s.paragraph !== null).length / face.length : 0,
  };
}

/** Words per minute on a paragraph's first visit, for the personal reading-speed baseline. */
export function observedWpm(fixations: readonly Fixation[], paragraph: ParagraphLayout): number | null {
  const first = paragraphVisits(fixations, paragraph.index)[0] ?? [];
  const dwellMs = first.reduce((a, f) => a + f.duration, 0);
  if (dwellMs < 1500 || paragraph.wordCount < 10) return null;
  return paragraph.wordCount / (dwellMs / 60_000);
}

/** Whitespace word count; Vietnamese syllables are space-separated, so this counts syllables there. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Text-difficulty score in [0, 1] for a paragraph: long sentences, formula/code symbols, digits and Latin
 * technical terms or acronyms inside Vietnamese prose. A heuristic, logged with every sample so a learned
 * per-paragraph prior can replace it once labelled reading data exists.
 */
export function textDifficultyScore(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?;:]+/).filter((s) => s.trim().length > 0);
  const avgSentence = words.length / Math.max(sentences.length, 1);
  const symbolRatio = (text.match(/[=+*/^_|<>()[\]{}∑√≥≤]/g)?.length ?? 0) / Math.max(text.length, 1);
  const digitRatio = words.filter((w) => /\d/.test(w)).length / words.length;
  const technicalRatio =
    words.filter((w) => /^[A-Z]{2,}|[a-z][A-Z]|^[A-Za-z]+\(|_/.test(w) || /^[A-Za-z]{9,}$/.test(w)).length /
    words.length;

  const score =
    0.35 * Math.min(avgSentence / 35, 1) +
    0.25 * Math.min(symbolRatio / 0.05, 1) +
    0.15 * Math.min(digitRatio / 0.15, 1) +
    0.25 * Math.min(technicalRatio / 0.25, 1);
  return Math.round(Math.min(Math.max(score, 0), 1) * 1e4) / 1e4;
}
