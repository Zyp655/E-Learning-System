'use client';

import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { Icon } from '@/app/[locale]/(HOME_CATEGORY)/_components/primitives';
import { Badge, Button } from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import { lmsApi, type ReadingGazeSamplePayload } from '@/api';
import { useConfusionStore } from '@/store/useConfusionStore';
import { getSegmentPriorForParagraph } from '@/features/confusion-cv/spBefCore';
import { subscribeGazeFrames } from './gazeFeed';
import { GazeCalibrationOverlay } from './GazeCalibrationOverlay';
import { ReadingGazeSession, type GazeEvidence } from './readingGazeSession';
import { countWords, textDifficultyScore, type ParagraphLayout } from './readingFeatures';

/** Reading View paragraphs opt in with this attribute; its value is the paragraph index. */
export const GAZE_PARAGRAPH_ATTR = 'data-gaze-paragraph';
/** Designed stimulus type of a paragraph (gaze calibration lesson), see ReadingLessonContent.stimulus. */
export const GAZE_STIMULUS_ATTR = 'data-gaze-stimulus';

type StimulusType = 'control' | 'factual' | 'contextual';

const TICK_MS = 1000;
// The SP-BEF step assumes ~5 s between evidence updates (dt_sec = 5).
const EVIDENCE_EVERY_TICKS = 5;
// Self-report prompts: a fixed random share of finished paragraphs, never conditioned on the model's posterior,
// so the labelled set is an unbiased sample of reading. Capped and spaced out to keep reading undisturbed.
export const PROMPT_PROBABILITY = 0.5;
const MAX_PROMPTS_PER_LESSON = 4;
const MIN_PROMPT_GAP_MS = 45_000;

interface ParagraphInfo {
  text: string;
  difficulty: number;
  stimulus: StimulusType | null;
}

interface PendingPrompt {
  paragraph: number;
  evidence: GazeEvidence;
}

interface ReadingGazeTrackerProps {
  lessonId: number;
  containerRef: RefObject<HTMLElement | null>;
  onAskTutor: (paragraphText: string) => void;
  /** Tracking is on: the page should use larger text, which offsets webcam gaze error. */
  onTrackingChange?: (active: boolean) => void;
}

function readStimulus(el: HTMLElement): StimulusType | null {
  const v = el.getAttribute(GAZE_STIMULUS_ATTR);
  return v === 'control' || v === 'factual' || v === 'contextual' ? v : null;
}

function measureParagraphs(container: HTMLElement): { layouts: ParagraphLayout[]; info: Map<number, ParagraphInfo> } {
  const layouts: ParagraphLayout[] = [];
  const info = new Map<number, ParagraphInfo>();
  container.querySelectorAll<HTMLElement>(`[${GAZE_PARAGRAPH_ATTR}]`).forEach((el) => {
    const index = Number(el.getAttribute(GAZE_PARAGRAPH_ATTR));
    if (!Number.isFinite(index)) return;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24;
    const text = el.textContent ?? '';
    layouts.push({
      index,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      lineHeight,
      wordCount: countWords(text),
    });
    info.set(index, { text, difficulty: textDifficultyScore(text), stimulus: readStimulus(el) });
  });
  return { layouts, info };
}

function qualityLabel(errorNorm: number): { tone: 'success' | 'warning' | 'danger'; text: string } {
  if (errorNorm <= 0.5) return { tone: 'success', text: 'tốt' };
  if (errorNorm < 1.5) return { tone: 'warning', text: 'trung bình' };
  return { tone: 'danger', text: 'quá nhiễu' };
}

export function ReadingGazeTracker({ lessonId, containerRef, onAskTutor, onTrackingChange }: ReadingGazeTrackerProps) {
  const sessionRef = useRef<ReadingGazeSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new ReadingGazeSession();
  const session = sessionRef.current;

  const infoRef = useRef(new Map<number, ParagraphInfo>());
  const promptsShownRef = useRef(0);
  const lastPromptAtRef = useRef(0);

  const cameraStreaming = useConfusionStore((s) => s.cameraStreaming);
  const rGaze = useConfusionStore((s) => s.rGaze);
  const [overlayMode, setOverlayMode] = useState<'calibrate' | 'validate' | null>(null);
  const [errorNorm, setErrorNorm] = useState(0);
  const [needsRevalidation, setNeedsRevalidation] = useState(false);
  const [currentParagraph, setCurrentParagraph] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [tutorOffer, setTutorOffer] = useState<number | null>(null);

  const calibrated = errorNorm > 0;

  useEffect(() => {
    onTrackingChange?.(calibrated);
  }, [calibrated, onTrackingChange]);

  useEffect(
    () => subscribeGazeFrames((frame) => session.onFrame(frame, { x: window.scrollX, y: window.scrollY })),
    [session],
  );

  const logSample = (
    paragraph: number,
    evidence: GazeEvidence,
    label: Pick<ReadingGazeSamplePayload, 'labelSource' | 'stimulusType' | 'selfReportLevel' | 'promptProbability'>,
  ) => {
    const f = evidence.features;
    void lmsApi.logReadingGazeSample({
      lessonId,
      paragraphIndex: paragraph,
      ...label,
      dwellRatio: f.dwell_ratio,
      rereadCount: f.reread_count,
      paraRegressionRate: f.para_regression_rate,
      sweepRatio: f.sweep_ratio,
      gazeTransitionEntropy: f.gaze_transition_entropy,
      saccadeRate: f.saccade_rate,
      rGaze: evidence.rGaze,
      llrGaze: evidence.llrGaze,
      calibrationErrorNorm: session.calibrationErrorNorm,
      textDifficulty: infoRef.current.get(paragraph)?.difficulty ?? 0,
      wordCount: session.getLayout(paragraph)?.wordCount ?? 0,
      readingWpm: session.readingWpm(),
      posteriorProb: useConfusionStore.getState().posteriorProb,
    });
  };
  const logSampleRef = useRef(logSample);
  logSampleRef.current = logSample;

  /** A finished paragraph: designed stimuli are logged with their design label, others may be prompted. */
  const onParagraphCompleted = (paragraph: number, evidence: GazeEvidence) => {
    if (evidence.rGaze <= 0) return;
    const stimulus = infoRef.current.get(paragraph)?.stimulus ?? null;
    if (stimulus) {
      logSampleRef.current(paragraph, evidence, {
        labelSource: 'designed_stimulus',
        stimulusType: stimulus,
        selfReportLevel: 0,
        promptProbability: 0,
      });
      return;
    }
    const now = Date.now();
    if (
      promptsShownRef.current < MAX_PROMPTS_PER_LESSON &&
      now - lastPromptAtRef.current >= MIN_PROMPT_GAP_MS &&
      Math.random() < PROMPT_PROBABILITY
    ) {
      promptsShownRef.current++;
      lastPromptAtRef.current = now;
      setPrompt((p) => p ?? { paragraph, evidence });
    }
  };
  const onCompletedRef = useRef(onParagraphCompleted);
  onCompletedRef.current = onParagraphCompleted;

  // Leaving the Reading View: close the last paragraph and drop the gaze evidence so it cannot keep feeding
  // the video/quiz posterior.
  useEffect(
    () => () => {
      const last = session.finishReading();
      if (last && infoRef.current.get(last.paragraph)?.stimulus) onCompletedRef.current(last.paragraph, last);
      useConfusionStore.getState().clearReadingGazeEvidence();
    },
    [session],
  );

  // Layouts are needed before calibration too: the error is normalized by the median paragraph height.
  useEffect(() => {
    let ticks = 0;
    const id = window.setInterval(() => {
      const container = containerRef.current;
      if (!container) return;
      const { layouts, info } = measureParagraphs(container);
      session.setLayouts(layouts);
      infoRef.current = info;
      if (!session.isCalibrated()) return;

      const now = Date.now();
      const tick = session.tick(now);
      setCurrentParagraph(tick.currentParagraph);
      setNeedsRevalidation(session.needsRevalidation(now));
      ticks++;

      if (tick.evidence && ticks % EVIDENCE_EVERY_TICKS === 0) {
        useConfusionStore.getState().updateReadingGazeEvidence({
          llrGaze: tick.evidence.llrGaze,
          rGaze: tick.evidence.rGaze,
          segmentPrior: getSegmentPriorForParagraph(info.get(tick.evidence.paragraph)?.difficulty ?? NaN),
        });
      }
      if (tick.completedParagraph !== null) {
        const evidence = session.evaluateParagraph(tick.completedParagraph);
        if (evidence) onCompletedRef.current(tick.completedParagraph, evidence);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [session, containerRef]);

  const answerPrompt = (level: 1 | 2 | 3 | 4) => {
    if (!prompt) return;
    setPrompt(null);
    setTutorOffer(level >= 3 ? prompt.paragraph : null);
    logSample(prompt.paragraph, prompt.evidence, {
      labelSource: 'self_report',
      stimulusType: '',
      selfReportLevel: level,
      promptProbability: PROMPT_PROBABILITY,
    });
  };

  const quality = qualityLabel(errorNorm);

  return (
    <div className="space-y-3 rounded-xl bg-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="visibility" size="xs" className="text-secondary" />
          <span className="text-xs font-medium text-primary">Theo dõi mắt khi đọc (webcam)</span>
          {!cameraStreaming ? (
            <Badge tone="neutral">Cần bật camera</Badge>
          ) : !calibrated ? (
            <Badge tone="neutral">Chưa hiệu chuẩn</Badge>
          ) : (
            <Badge tone={quality.tone}>
              Độ chính xác {quality.text} · r_gaze {rGaze.toFixed(2)}
            </Badge>
          )}
          {calibrated && currentParagraph !== null && (
            <span className="text-xs text-secondary">Đang đọc đoạn {currentParagraph + 1}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {calibrated && (
            <Button
              variant={needsRevalidation ? 'soft-brand' : 'ghost'}
              size="xs"
              disabled={!cameraStreaming}
              onClick={() => setOverlayMode('validate')}
            >
              {needsRevalidation ? 'Nên kiểm tra lại (~7 giây)' : 'Kiểm tra lại'}
            </Button>
          )}
          <Button
            variant={calibrated ? 'ghost' : 'soft-brand'}
            size="xs"
            disabled={!cameraStreaming}
            onClick={() => setOverlayMode('calibrate')}
          >
            <Icon name="visibility" size="xs" />
            {calibrated ? 'Hiệu chuẩn lại' : 'Hiệu chuẩn (~25 giây)'}
          </Button>
        </div>
      </div>

      {prompt && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-primary">Đoạn {prompt.paragraph + 1} vừa đọc có khó hiểu không?</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="xs" onClick={() => answerPrompt(1)}>
              Dễ hiểu
            </Button>
            <Button variant="secondary" size="xs" onClick={() => answerPrompt(2)}>
              Hơi khó
            </Button>
            <Button variant="soft-brand" size="xs" onClick={() => answerPrompt(3)}>
              Khó hiểu
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setPrompt(null)}>
              Bỏ qua
            </Button>
          </div>
        </div>
      )}

      {tutorOffer !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-primary">Muốn AI Tutor giải thích lại đoạn {tutorOffer + 1}?</span>
          <div className="flex gap-2">
            <Button
              variant="soft-brand"
              size="xs"
              onClick={() => {
                onAskTutor(infoRef.current.get(tutorOffer)?.text ?? '');
                setTutorOffer(null);
              }}
            >
              <Icon name="sparkles" size="xs" />
              Hỏi AI Tutor
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setTutorOffer(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {overlayMode && (
        <GazeCalibrationOverlay
          session={session}
          mode={overlayMode}
          referenceHeightPx={session.referenceHeightPx()}
          onDone={(err) => {
            setOverlayMode(null);
            setErrorNorm(err);
            setNeedsRevalidation(false);
          }}
          onCancel={() => {
            // A cancelled full calibration starts from scratch (uncalibrated); a cancelled re-check keeps the old one.
            setOverlayMode(null);
            setErrorNorm(session.calibrationErrorNorm);
          }}
        />
      )}
    </div>
  );
}
