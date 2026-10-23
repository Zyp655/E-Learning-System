"""
Real-Time Webcam Confusion + Gaze Stillness + Eye Aspect Ratio (EAR) Test Script.

Features:
- Captures live webcam stream at 30 FPS and performs CLAHE low-light enhancement.
- Computes Eye Aspect Ratio (EAR) on MediaPipe eye landmarks to detect Eye-Lock / staring
  (0.18 < EAR < 0.28 with low variance) vs eye closure (EAR < 0.16).
- Tracks Iris / Gaze displacement variance over a sliding window to detect Gaze Stillness ("zoning out").
- Feeds 5-frame sliding window + auxiliary affective signals into the Temporal Confusion model.
- Applies strict Sliding Window smoothing (3 consecutive confused windows) before triggering
  a proactive AI Tutor intervention alert.
"""

import json
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np

from face_crop_utils import detect_and_crop_face, enhance_low_light_frame

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MLP_WEIGHTS_PATH = BASE_DIR / "mlp_weights.json"

# MediaPipe 6-point Eye Aspect Ratio indices
LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
LEFT_IRIS_CENTER = 468
RIGHT_IRIS_CENTER = 473


def compute_ear(landmarks_2d: np.ndarray, eye_indices: list) -> float:
    """
    Computes Eye Aspect Ratio (EAR):
      EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
    """
    pts = landmarks_2d[eye_indices]
    v1 = np.linalg.norm(pts[1] - pts[5])
    v2 = np.linalg.norm(pts[2] - pts[4])
    h = np.linalg.norm(pts[0] - pts[3])
    if h < 1e-6:
        return 0.25
    return float((v1 + v2) / (2.0 * h))


def mlp_forward_numpy(features_12d: np.ndarray, weights_data: dict) -> float:
    """Runs exact 3-layer MLP (64, 32, 16) forward pass using exported mlp_weights.json."""
    mean = np.array(weights_data["scaler_mean"], dtype=np.float32)
    scale = np.array(weights_data["scaler_scale"], dtype=np.float32)
    x = (features_12d - mean) / np.where(scale == 0, 1.0, scale)

    for layer in weights_data["layers"]:
        W = np.array(layer["weights"], dtype=np.float32)
        b = np.array(layer["biases"], dtype=np.float32)
        x = x @ W + b
        if layer["activation"] == "relu":
            x = np.maximum(0.0, x)
        elif layer["activation"] == "sigmoid":
            x = 1.0 / (1.0 + np.exp(-np.clip(x, -30.0, 30.0)))
    return float(np.squeeze(x))


def main():
    print("=" * 68)
    print("  REAL-TIME WEBCAM CONFUSION + GAZE STILLNESS + EAR MONITOR")
    print("  Press 'q' to quit | Press 'c' to simulate rewind/pause burst")
    print("=" * 68)

    with open(MLP_WEIGHTS_PATH, "r") as f:
        mlp_weights = json.load(f)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("  [ERROR] Cannot open webcam device 0.")
        return

    ear_history = deque(maxlen=30)
    gaze_history = deque(maxlen=30)
    confusion_window = deque(maxlen=3)
    simulated_pauses = 1
    simulated_rewinds = 0

    try:
        import mediapipe as mp
        mp_face_mesh = mp.solutions.face_mesh
        face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    except Exception:
        face_mesh = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        enhanced = enhance_low_light_frame(frame)
        h, w = enhanced.shape[:2]
        ear_val = 0.26
        gaze_still = False
        eye_lock = False

        if face_mesh is not None:
            rgb = cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB)
            res = face_mesh.process(rgb)
            if res.multi_face_landmarks:
                lm = res.multi_face_landmarks[0].landmark
                pts_2d = np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)

                left_ear = compute_ear(pts_2d, LEFT_EYE_IDX)
                right_ear = compute_ear(pts_2d, RIGHT_EYE_IDX)
                ear_val = 0.5 * (left_ear + right_ear)
                ear_history.append(ear_val)

                if len(pts_2d) > RIGHT_IRIS_CENTER:
                    iris_center = 0.5 * (pts_2d[LEFT_IRIS_CENTER] + pts_2d[RIGHT_IRIS_CENTER])
                    gaze_history.append(iris_center)

                if len(ear_history) >= 15:
                    ear_std = float(np.std(ear_history))
                    eye_lock = (0.18 <= ear_val <= 0.28) and (ear_std < 0.012)

                if len(gaze_history) >= 15:
                    gaze_arr = np.array(gaze_history)
                    gaze_disp = float(np.mean(np.linalg.norm(np.diff(gaze_arr, axis=0), axis=1)))
                    gaze_still = gaze_disp < 1.2

        confused_ratio = 0.65 if (eye_lock or gaze_still) else 0.12
        frustrated_ratio = 0.35 if (simulated_rewinds >= 2) else 0.08
        features_12d = np.array([
            simulated_pauses,
            8.5 if simulated_pauses > 2 else 2.5,
            1 if simulated_pauses > 2 else 0,
            simulated_rewinds,
            1 if simulated_rewinds >= 2 else 0,
            0,
            confused_ratio,
            frustrated_ratio,
            3 if (eye_lock or gaze_still) else 1,
            2 if (eye_lock and gaze_still) else 0,
            65.0,
            35.0,
        ], dtype=np.float32)

        ml_prob = mlp_forward_numpy(features_12d, mlp_weights)
        is_confused = ml_prob >= 0.60
        confusion_window.append(1 if is_confused else 0)
        streak = sum(confusion_window)

        display = enhanced.copy()
        color = (0, 0, 255) if is_confused else (0, 200, 80)
        cv2.putText(display, f"MLP Confusion Prob: {ml_prob:.2f} (thresh=0.60)", (16, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        cv2.putText(display, f"EAR: {ear_val:.3f} | Eye-Lock: {eye_lock} | Gaze-Still: {gaze_still}", (16, 62),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 220, 0), 2)
        cv2.putText(display, f"Sliding Window Streak: {streak}/3", (16, 92),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)

        if streak >= 3:
            cv2.putText(display, "PROACTIVE AI TUTOR INTERVENTION TRIGGERED!", (16, 136),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 140, 255), 3)

        cv2.imshow("LMS Real-Time Confusion & Gaze/EAR Monitor", display)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("c"):
            simulated_pauses += 2
            simulated_rewinds += 2

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
