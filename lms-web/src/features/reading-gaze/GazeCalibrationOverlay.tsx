'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/[locale]/(HOME_CATEGORY)/_components/ui';
import type { ReadingGazeSession } from './readingGazeSession';

// 9 fit dots on a 3x3 grid, then 4 validation dots the fit never saw (fractions of the viewport).
const FIT_DOTS = [0.1, 0.5, 0.9].flatMap((fy) => [0.1, 0.5, 0.9].map((fx) => ({ fx, fy })));
const VALIDATION_DOTS = [
  { fx: 0.3, fy: 0.3 },
  { fx: 0.7, fy: 0.3 },
  { fx: 0.3, fy: 0.7 },
  { fx: 0.7, fy: 0.7 },
];
const DOT_MS = 1600;
// The eyes need a moment to land on a new dot; samples before this are discarded.
const SETTLE_MS = 600;

interface GazeCalibrationOverlayProps {
  session: ReadingGazeSession;
  /** 'calibrate' fits a new gaze map; 'validate' only re-measures the error of the current one (~7 s). */
  mode: 'calibrate' | 'validate';
  referenceHeightPx: number;
  onDone: (errorNorm: number) => void;
  onCancel: () => void;
}

export function GazeCalibrationOverlay({ session, mode, referenceHeightPx, onDone, onCancel }: GazeCalibrationOverlayProps) {
  const [step, setStep] = useState(0);
  // Parents pass inline callbacks; refs keep the effects below from restarting the calibration on re-render.
  const onDoneRef = useRef(onDone);
  const onCancelRef = useRef(onCancel);
  onDoneRef.current = onDone;
  onCancelRef.current = onCancel;
  const dots = [
    ...(mode === 'calibrate' ? FIT_DOTS.map((d) => ({ ...d, phase: 'fit' as const })) : []),
    ...VALIDATION_DOTS.map((d) => ({ ...d, phase: 'validate' as const })),
  ];
  const dot = dots[step];

  useEffect(() => {
    if (mode === 'calibrate') session.startCalibration();
    else session.startValidation();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      session.setCalibrationTarget(null);
    };
  }, [session, mode]);

  useEffect(() => {
    if (!dot) {
      onDoneRef.current(session.finishCalibration(referenceHeightPx, mode === 'validate'));
      return;
    }
    session.setCalibrationTarget(null);
    const settle = window.setTimeout(() => {
      session.setCalibrationTarget({
        x: dot.fx * window.innerWidth,
        y: dot.fy * window.innerHeight,
        phase: dot.phase,
      });
    }, SETTLE_MS);
    const next = window.setTimeout(() => setStep((s) => s + 1), DOT_MS);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(next);
    };
    // `dot` is derived from `step`; re-running on step is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="fixed inset-0 z-100 bg-white" role="dialog" aria-modal="true" aria-label="Hiệu chuẩn theo dõi mắt">
      <div className="absolute inset-x-0 top-1/5 mx-auto max-w-md -translate-y-1/2 space-y-2 px-4 text-center">
        <p className="text-sm font-medium text-primary">
          Nhìn vào chấm đỏ cho tới khi nó chuyển chỗ, giữ đầu yên ({Math.min(step + 1, dots.length)}/{dots.length})
        </p>
        <p className="text-xs text-secondary">
          Ảnh camera chỉ xử lý trên trình duyệt; chỉ các đặc trưng đọc (thời gian, số lần đọc lại) được lưu.
        </p>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Huỷ (Esc)
        </Button>
      </div>
      {dot && (
        <span
          className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-4 ring-brand/20 transition-all duration-300"
          style={{ left: `${dot.fx * 100}%`, top: `${dot.fy * 100}%` }}
        />
      )}
    </div>
  );
}
