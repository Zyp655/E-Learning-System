import type { Point3D } from '@/features/confusion-cv/realFaceTracker';

export interface GazeFrame {
  t: number;
  faceDetected: boolean;
  landmarks: readonly Point3D[];
  headYawDeg: number;
  headPitchDeg: number;
}

type Listener = (frame: GazeFrame) => void;

const listeners = new Set<Listener>();

/**
 * Face meshes from the single MediaPipe loop in CameraMonitorCard, re-published for the Reading View gaze
 * tracker so the page never runs a second landmarker on the same camera.
 */
export function publishGazeFrame(frame: GazeFrame): void {
  listeners.forEach((l) => l(frame));
}

export function subscribeGazeFrames(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
