"""
End-to-End SP-BEF V2 Training, Calibration, ONNX Export, Virtual Learner Evaluation & Golden Generation.
Implements Phases P0, P2, P3, P4, P5 of PLAN_V2_CONFUSION.md using 100% Real Public Datasets:
- Face Branch: DAiSEE (MediaPipe FaceLandmarker 0.10.14 478 Landmarks + 52 Blendshapes + Personal Baseline C2)
- Behavior Branch & Segment Prior: MOOCCubeX (user-video.json & user-problem.json)
- Quiz Branch: ASSISTments (anonymized_full_release_competition_dataset.csv with confidence(CONFUSED))
"""

from __future__ import annotations

import calendar
import concurrent.futures
import hashlib
import json
import math
import os
import shutil
import time
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from sp_bef.core import (
    LLR_CLIP,
    clip_val,
    compute_ece,
    compute_frame_reliability,
    logit,
    piecewise_linear_interp,
    predict_linear_calibrated_branch,
    sha256_file,
    sigmoid,
    sp_bef_step,
)

SEED = 42
np.random.seed(SEED)

BASE_DIR = Path(__file__).parent
# SP_BEF_DATA_DIR overrides the (gitignored, ~34 GB) data directory, e.g. to simulate a clean clone.
DATA_DIR = Path(os.environ.get("SP_BEF_DATA_DIR") or BASE_DIR / "data")
RAW_DIR = DATA_DIR / "raw"
DAISEE_DIR = DATA_DIR / "daisee_frames"
# Per-frame MediaPipe telemetry of the original DAiSEE videos (written by extract_daisee_video_frames.py).
DAISEE_VIDEO_FRAMES = DATA_DIR / "daisee_video_frames_10fps.npz"
DAISEE_VIDEO_LABELS = RAW_DIR / "daisee_video" / "x" / "DAiSEE" / "Labels" / "AllLabels.csv"
MODELS_DIR = BASE_DIR / "models"
GOLDEN_DIR = BASE_DIR / "golden"
OUTPUT_V2_DIR = BASE_DIR / "output_v2"
# Deterministic ONNX graph name for the exported face branch (see run_p2_face_branch). The value is the
# name already stored in the committed ml/models/sp_bef_face.onnx, so re-exports stay byte-identical with
# the shipped artifact and with `onnx_size_bytes` recorded in models/sp_bef_params.json.
ONNX_FACE_GRAPH_NAME = "bb76a2e21b604e3ea3a861898a3f6061"

for d in [MODELS_DIR, GOLDEN_DIR, OUTPUT_V2_DIR]:
    d.mkdir(parents=True, exist_ok=True)

LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]

FACE_RAW_FEATURES = [
    "brow_furrow_mean",
    "brow_furrow_std",
    "brow_furrow_max",
    "eye_squint_mean",
    "eye_squint_std",
    "ear_mean",
    "ear_std",
    "mouth_tension_mean",
    "head_yaw_abs_mean",
    "head_pitch_abs_mean",
    "nose_drift_norm",
    "eye_lock_ratio",
    "affect_boredom",
    "affect_engagement",
    "affect_frustration",
]

FACE_MODEL_FEATURES = FACE_RAW_FEATURES + [
    "brow_furrow_z",
    "eye_squint_z",
    "ear_z",
    "mouth_tension_z",
    "affect_frustration_z",
]

BEHAVIOR_FEATURES = [
    "pause_count",
    "avg_pause_duration",
    "long_pause_count",
    "rewind_count",
    "rewind_same_spot",
    "speed_change_down",
]

# Annotation columns that must never appear in any feature list (checked by assertions and tests).
LABEL_COLUMNS = ["is_confused", "confusion_level", "confusion", "boredom", "engagement", "frustration"]

QUIZ_FEATURES = [
    "quiz_accuracy",
    "quiz_time_norm",
    "attempt_count",
]


def generate_p0_manifest() -> Dict:
    """P0.2: Compute and save SHA256 checksums for all real datasets and assets."""
    manifest_files = {
        "daisee_frame_labels_csv": DAISEE_DIR / "frame_labels.csv",
        "daisee_video_all_labels_csv": DAISEE_VIDEO_LABELS,
        "daisee_video_frames_10fps_npz": DAISEE_VIDEO_FRAMES,
        "mediapipe_face_landmarker_task": RAW_DIR / "face_landmarker.task",
        "mooccubex_user_video_json": RAW_DIR / "mooccubex" / "user-video.json",
        "mooccubex_user_problem_head_json": RAW_DIR / "mooccubex" / "user-problem.head.json",
        "mooccubex_course_json": RAW_DIR / "mooccubex" / "course.json",
        "mooccubex_exercise_problem_txt": RAW_DIR / "mooccubex" / "exercise-problem.txt",
        "assistments_2017_csv": RAW_DIR / "anonymized_full_release_competition_dataset.csv",
    }
    records = {}
    for key, p in manifest_files.items():
        if p.exists():
            records[key] = {
                "path": str(p.relative_to(BASE_DIR)),
                "size_bytes": p.stat().st_size,
                "sha256": sha256_file(p),
            }
    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "seed": SEED,
        "python_version": "3.11.17",
        "mediapipe_task_version": "0.10.14-float16",
        "datasets": records,
    }
    out_path = DATA_DIR / "MANIFEST.json"
    out_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def _compute_ear(landmarks, indices) -> float:
    pts = [landmarks[i] for i in indices]
    v1 = math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y)
    v2 = math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y)
    h = max(math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y), 1e-5)
    return max(0.08, min(0.45, (v1 + v2) / (2.0 * h)))


def extract_single_frame_telemetry(landmarker, img_path) -> Dict:
    """
    Extracts MediaPipe FaceLandmarker 478 landmarks + 52 blendshapes + luminance from an image path or a BGR array.
    Matches the exact mathematical definition in `lms-web/src/features/confusion-cv/realFaceTracker.ts`.
    """
    if isinstance(img_path, np.ndarray):
        bgr = img_path
    else:
        if not os.path.exists(img_path):
            return {"detected": False, "luminance": 0.0}
        bgr = cv2.imread(img_path)
    if bgr is None:
        return {"detected": False, "luminance": 0.0}

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    luma = float(np.mean(0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]))

    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    res = landmarker.detect(mp_img)
    if not res.face_landmarks or len(res.face_landmarks[0]) < 468:
        return {"detected": False, "luminance": luma}

    lms = res.face_landmarks[0]
    cats = {c.category_name: float(c.score) for c in (res.face_blendshapes[0] if res.face_blendshapes else [])}

    # 1. Blendshape scores (AU4 brow furrow, AU7 eye squint, AU15/24 mouth tension)
    brow_down_l = cats.get("browDownLeft", 0.0)
    brow_down_r = cats.get("browDownRight", 0.0)
    brow_inner_up = cats.get("browInnerUp", 0.0)
    # Also incorporate geometric brow-to-eye vertical compression normalized by IOD
    left_outer = lms[33]
    right_outer = lms[263]
    iod = max(math.hypot(left_outer.x - right_outer.x, left_outer.y - right_outer.y), 1e-4)
    brow_dist_norm = (
        math.hypot(lms[107].x - lms[336].x, lms[107].y - lms[336].y) / iod
    )
    brow_eye_v = ((lms[159].y - lms[65].y) + (lms[386].y - lms[295].y)) / (2.0 * iod)
    geom_furrow = clip_val((0.36 - brow_eye_v) * 2.5 + (0.28 - brow_dist_norm) * 2.0, 0.0, 1.0)

    brow_furrow = min(1.0, (brow_down_l + brow_down_r) * 0.55 + brow_inner_up * 0.40 + geom_furrow * 0.35)
    eye_squint = min(
        1.0,
        (cats.get("eyeSquintLeft", 0.0) + cats.get("eyeSquintRight", 0.0)) * 0.55
        + (cats.get("cheekSquintLeft", 0.0) + cats.get("cheekSquintRight", 0.0)) * 0.25,
    )
    mouth_press = (cats.get("mouthPressLeft", 0.0) + cats.get("mouthPressRight", 0.0)) * 0.5
    mouth_frown = (cats.get("mouthFrownLeft", 0.0) + cats.get("mouthFrownRight", 0.0)) * 0.5
    jaw_open = cats.get("jawOpen", 0.0)
    mouth_tension = min(1.0, mouth_press * 0.55 + mouth_frown * 0.55 + jaw_open * 0.15)

    # 2. EAR (Left & Right 6-point contour)
    ear_l = _compute_ear(lms, LEFT_EYE_IDX)
    ear_r = _compute_ear(lms, RIGHT_EYE_IDX)
    ear_avg = 0.5 * (ear_l + ear_r)

    # 3. Head pose (Yaw & Pitch in degrees)
    nose = lms[1]
    eye_mid_x = 0.5 * (left_outer.x + right_outer.x)
    eye_mid_y = 0.5 * (left_outer.y + right_outer.y)
    head_yaw_deg = ((nose.x - eye_mid_x) / iod) * 55.0
    head_pitch_deg = ((nose.y - eye_mid_y) / iod - 0.35) * 45.0

    return {
        "detected": True,
        "luminance": luma,
        "blendshapes": cats,
        "brow_furrow": brow_furrow,
        "eye_squint": eye_squint,
        "mouth_tension": mouth_tension,
        "ear": ear_avg,
        "head_yaw_deg": head_yaw_deg,
        "head_pitch_deg": head_pitch_deg,
        "nose_x": float(nose.x),
        "nose_y": float(nose.y),
        "iod": float(iod),
    }


def aggregate_clip_window(frame_stats: List[Dict]) -> Dict:
    """
    Aggregates a sequence of frame telemetry dicts into the 12 standardized 10-second Face Window features
    + C4 Frame Reliability `r_face`.
    """
    n_total = max(len(frame_stats), 1)
    valid = [f for f in frame_stats if f.get("detected", False)]
    face_present_ratio = len(valid) / float(n_total)
    avg_luma = float(np.mean([f.get("luminance", 0.0) for f in frame_stats])) if frame_stats else 0.0

    if not valid:
        out = {k: 0.0 for k in FACE_RAW_FEATURES}
        out["face_present_ratio"] = 0.0
        out["avg_luminance"] = avg_luma
        out["r_face"] = 0.0
        return out

    furrows = np.array([f["brow_furrow"] for f in valid], dtype=np.float64)
    squints = np.array([f["eye_squint"] for f in valid], dtype=np.float64)
    mouths = np.array([f["mouth_tension"] for f in valid], dtype=np.float64)
    ears = np.array([f["ear"] for f in valid], dtype=np.float64)
    yaws = np.abs(np.array([f["head_yaw_deg"] for f in valid], dtype=np.float64))
    pitches = np.abs(np.array([f["head_pitch_deg"] for f in valid], dtype=np.float64))

    nose_xs = np.array([f["nose_x"] for f in valid], dtype=np.float64)
    nose_ys = np.array([f["nose_y"] for f in valid], dtype=np.float64)
    mean_iod = float(np.mean([f["iod"] for f in valid]))

    if len(valid) > 1:
        drifts = np.hypot(nose_xs - nose_xs[0], nose_ys - nose_ys[0]) / max(mean_iod, 1e-4)
        nose_drift_norm = float(np.max(drifts))
    else:
        nose_drift_norm = 0.0

    ear_std = float(np.std(ears))
    eye_lock_frames = [
        1.0 if (f["ear"] > 0.22 and ear_std < 0.045 and nose_drift_norm < 0.18) else 0.0
        for f in valid
    ]
    eye_lock_ratio = float(np.mean(eye_lock_frames))

    yaw_mean = float(np.mean(yaws))
    pitch_mean = float(np.mean(pitches))
    r_face = compute_frame_reliability(
        face_present_ratio=face_present_ratio,
        avg_luminance=avg_luma,
        head_yaw_abs_deg=yaw_mean,
        head_pitch_abs_deg=pitch_mean,
        landmark_confidence=1.0,
    )

    ear_mean_val = float(np.mean(ears))
    furrow_mean_val = float(np.mean(furrows))
    squint_mean_val = float(np.mean(squints))
    mouth_mean_val = float(np.mean(mouths))

    # Continuous affective sub-scores in [0, 1] computable identically on live webcam frames
    affect_boredom = clip_val(
        max(0.0, (0.24 - ear_mean_val) * 3.2) + (yaw_mean / 45.0) * 0.35 + (pitch_mean / 35.0) * 0.25,
        0.0,
        1.0,
    )
    affect_engagement = clip_val(
        1.0 - affect_boredom * 0.65 + eye_lock_ratio * 0.25 - (nose_drift_norm * 0.30),
        0.0,
        1.0,
    )
    affect_frustration = clip_val(
        furrow_mean_val * 0.55 + mouth_mean_val * 0.45 + squint_mean_val * 0.25,
        0.0,
        1.0,
    )

    return {
        "brow_furrow_mean": round(furrow_mean_val, 6),
        "brow_furrow_std": round(float(np.std(furrows)), 6),
        "brow_furrow_max": round(float(np.max(furrows)), 6),
        "eye_squint_mean": round(squint_mean_val, 6),
        "eye_squint_std": round(float(np.std(squints)), 6),
        "ear_mean": round(ear_mean_val, 6),
        "ear_std": round(ear_std, 6),
        "mouth_tension_mean": round(mouth_mean_val, 6),
        "head_yaw_abs_mean": round(yaw_mean, 6),
        "head_pitch_abs_mean": round(pitch_mean, 6),
        "nose_drift_norm": round(nose_drift_norm, 6),
        "eye_lock_ratio": round(eye_lock_ratio, 6),
        "affect_boredom": round(affect_boredom, 6),
        "affect_engagement": round(affect_engagement, 6),
        "affect_frustration": round(affect_frustration, 6),
        "face_present_ratio": round(face_present_ratio, 6),
        "avg_luminance": round(avg_luma, 4),
        "r_face": round(r_face, 6),
    }


def _worker_extract_clips(batch_items: List[Tuple]) -> List[Dict]:
    """Multiprocessing worker that initializes one MediaPipe FaceLandmarker and extracts a batch of clips."""
    opts = mp_vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(RAW_DIR / "face_landmarker.task")),
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=False,
        num_faces=1,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(opts)
    results = []
    for clip_id, subject, split, is_confused, confusion_lvl, frame_paths in batch_items:
        f_stats = [extract_single_frame_telemetry(landmarker, fp) for fp in frame_paths]
        # affect_* stay as the heuristic sub-scores computed in aggregate_clip_window (identical to the
        # browser). DAiSEE's annotated boredom/engagement/frustration are labels, never features.
        agg = aggregate_clip_window(f_stats)
        valid = [f for f in f_stats if f.get("detected", False)]
        bs_names = sorted({k for f in valid for k in f["blendshapes"]})
        for name in bs_names:
            agg[f"bs_{name}"] = round(float(np.mean([f["blendshapes"].get(name, 0.0) for f in valid])), 6)
        agg["clip_id"] = int(clip_id)
        agg["subject"] = int(subject)
        agg["split"] = str(split)
        agg["is_confused"] = int(is_confused)
        agg["confusion_level"] = int(confusion_lvl)
        results.append(agg)
    landmarker.close()
    return results


def build_daisee_features_from_video() -> pd.DataFrame:
    """
    Aggregates the 10 fps per-frame telemetry of every original DAiSEE video into one 10 s face window per clip,
    with exactly the same aggregate_clip_window() the browser runs on its live frames.
    """
    cache_path = DATA_DIR / "daisee_video_clips_10fps_v1.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)

    z = np.load(DAISEE_VIDEO_FRAMES)
    col = {n: i for i, n in enumerate(z["columns"])}
    derived = [n for n in col if n != "detected" and not n.startswith("bs_")]
    bs_names = [n for n in col if n.startswith("bs_")]
    frames, offsets = z["frames"], z["offsets"]
    rows = []
    for i, clip_id in enumerate(z["clip_ids"]):
        m = frames[offsets[i] : offsets[i + 1]]
        det = m[:, col["detected"]] > 0
        f_stats = [
            {"detected": bool(d), **{k: float(r[col[k]]) for k in derived}} for r, d in zip(m, det)
        ]
        agg = aggregate_clip_window(f_stats)
        for name in bs_names:
            agg[name] = round(float(m[det, col[name]].mean()), 6) if det.any() else 0.0
        agg["clip_id"] = int(clip_id)
        agg["subject"] = int(z["subjects"][i])
        agg["split"] = str(z["splits"][i])
        agg["is_confused"] = int(z["confusion"][i] >= 1)
        agg["confusion_level"] = int(z["confusion"][i])
        rows.append(agg)

    df_clips = pd.DataFrame(rows).sort_values(["split", "subject", "clip_id"]).reset_index(drop=True)
    df_clips.to_csv(cache_path, index=False)
    return df_clips


def build_or_load_daisee_features() -> pd.DataFrame:
    """
    Extracts face-window features for EVERY DAiSEE clip (no per-subject resampling), so the test split keeps
    its natural confusion base rate. Only clip_id/subject/split/is_confused/confusion_level come from the
    annotations; every feature column is computed from pixels.

    The original videos (10 fps, ~100 frames per clip) are preferred because they match the browser's 10 s
    window; the 5-frame-per-clip still-image release is the fallback when the videos are not available.
    """
    if DAISEE_VIDEO_FRAMES.exists():
        return build_daisee_features_from_video()

    cache_path = DATA_DIR / "daisee_mediapipe_clips_v3.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)

    df_raw = pd.read_csv(DAISEE_DIR / "frame_labels.csv")

    def resolve_split(p: str) -> str:
        pl = p.lower()
        if "validation" in pl:
            return "validation"
        if "test" in pl:
            return "test"
        return "train"

    df_raw["split"] = df_raw["frame_path"].apply(resolve_split)
    df_raw["rel_path"] = df_raw["frame_path"].apply(
        lambda s: str(DAISEE_DIR / s.replace("\\", "/").split("/frames/")[-1])
    )

    clip_groups = []
    for clip_id, c_grp in df_raw.groupby("clip_id"):
        c_sorted = c_grp.sort_values("rel_path")
        clip_groups.append(
            (
                int(clip_id),
                int(c_sorted["subject"].iloc[0]),
                str(c_sorted["split"].iloc[0]),
                int(c_sorted["is_confused"].iloc[0]),
                int(c_sorted["confusion"].iloc[0]),
                list(c_sorted["rel_path"].values),
            )
        )

    print(f"[P2] Extracting MediaPipe 0.10.14 features on {len(clip_groups)} clips across {df_raw['subject'].nunique()} subjects...")
    n_workers = min(8, os.cpu_count() or 4)
    chunks = [clip_groups[i::n_workers] for i in range(n_workers)]
    all_rows = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=n_workers) as ex:
        for res in ex.map(_worker_extract_clips, chunks):
            all_rows.extend(res)

    df_clips = pd.DataFrame(all_rows).sort_values(["split", "subject", "clip_id"]).reset_index(drop=True)
    bs_cols = [c for c in df_clips.columns if c.startswith("bs_")]
    df_clips[bs_cols] = df_clips[bs_cols].fillna(0.0)
    df_clips.to_csv(cache_path, index=False)
    return df_clips


def apply_c2_personal_baseline(df_clips: pd.DataFrame) -> pd.DataFrame:
    """
    C2: Computes personal baseline z-score deltas per subject using ONLY the first clip (clip_idx == 0)
    of that subject (zero label access!), and marks the first clip (`is_baseline_clip = True`)
    to exclude it from train/val/test evaluation.
    """
    df = df_clips.sort_values(["split", "subject", "clip_id"]).reset_index(drop=True).copy()
    df["is_baseline_clip"] = False

    z_cols = [
        ("brow_furrow_mean", "brow_furrow_z", 0.05),
        ("eye_squint_mean", "eye_squint_z", 0.05),
        ("ear_mean", "ear_z", 0.03),
        ("mouth_tension_mean", "mouth_tension_z", 0.05),
        ("affect_frustration", "affect_frustration_z", 0.08),
    ]
    for _, zc, _ in z_cols:
        df[zc] = 0.0

    for subj, grp in df.groupby("subject"):
        idx_list = list(grp.index)
        first_idx = idx_list[0]
        df.loc[first_idx, "is_baseline_clip"] = True

        # Strictly use clip 0 (first clip of the subject, without checking any ground-truth label!)
        b0 = grp.iloc[0]
        for raw_col, z_col, min_std in z_cols:
            mu = float(b0[raw_col])
            sd = max(float(grp[raw_col].std(ddof=0)), min_std)
            df.loc[idx_list, z_col] = (df.loc[idx_list, raw_col] - mu) / sd

    return df


def fit_isotonic_knots(
    probs: np.ndarray,
    y_true: np.ndarray,
    n_knots: int = 15,
    shrinkage: float = 0.85,
) -> Tuple[List[float], List[float]]:
    iso = IsotonicRegression(y_min=0.01, y_max=0.99, out_of_bounds="clip")
    iso.fit(probs, y_true)
    grid = np.linspace(0.0, 1.0, n_knots)
    iso_pred = np.clip(iso.predict(grid), 0.01, 0.99)
    # Regularized monotonic calibration (prevents step-function overfitting on small validation sets)
    mapped = np.clip((1.0 - shrinkage) * grid + shrinkage * iso_pred, 0.01, 0.99)
    mapped = np.maximum.accumulate(mapped)
    return [round(float(x), 6) for x in grid], [round(float(y), 6) for y in mapped]


def bootstrap_auroc_ci(y_true: np.ndarray, y_prob: np.ndarray, n_boot: int = 1000) -> List[float]:
    """95% percentile bootstrap interval of AUROC (rows resampled with replacement, fixed seed)."""
    rng = np.random.RandomState(SEED)
    y_true, y_prob = np.asarray(y_true), np.asarray(y_prob)
    scores = []
    for _ in range(n_boot):
        idx = rng.randint(0, len(y_true), len(y_true))
        if y_true[idx].min() == y_true[idx].max():
            continue
        scores.append(roc_auc_score(y_true[idx], y_prob[idx]))
    return [round(float(np.percentile(scores, 2.5)), 4), round(float(np.percentile(scores, 97.5)), 4)]


def _fit_face_lr(train_df: pd.DataFrame, cols: List[str]) -> Pipeline:
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=0.08, max_iter=2000, random_state=SEED)),
    ])
    pipe.fit(train_df[cols].values.astype(np.float32), train_df["is_confused"].values.astype(int))
    return pipe


def _linear_branch_cfg(pipe: Pipeline, cols: List[str], base_rate: float, xp: List[float], fp: List[float]) -> Dict:
    scaler_step = pipe.named_steps["scaler"]
    clf_step = pipe.named_steps["clf"]
    return {
        "feature_names": list(cols),
        "scaler_mean": [round(float(v), 6) for v in scaler_step.mean_],
        "scaler_scale": [round(float(v), 6) for v in scaler_step.scale_],
        "coefficients": [round(float(v), 6) for v in clf_step.coef_[0]],
        "intercept": round(float(clf_step.intercept_[0]), 6),
        "base_rate": round(float(base_rate), 6),
        "isotonic_xp": xp,
        "isotonic_fp": fp,
    }


def _attach_branch_outputs(df: pd.DataFrame, cfg: Dict, suffix: str = "") -> None:
    cols = cfg["feature_names"]
    outs = [predict_linear_calibrated_branch(list(row), cfg) for row in df[cols].values.astype(np.float64)]
    df["cal_prob" + suffix] = [o[1] for o in outs]
    df["llr" + suffix] = [o[2] for o in outs]


def run_p2_face_branch(df_raw_clips: pd.DataFrame) -> Tuple[Dict, pd.DataFrame, pd.DataFrame]:
    """
    P2: Face branch on DAiSEE (official subject-disjoint splits, natural base rate, no label-derived features).
    Candidate feature sets (with / without the C2 personal baseline) are compared on VALIDATION only; the
    selected one is calibrated on validation and evaluated ONCE on the full official test split.
    """
    df_all = apply_c2_personal_baseline(df_raw_clips)
    # Baseline clip is excluded for every candidate so that all candidates are scored on the same clips.
    df_eval = df_all[(~df_all["is_baseline_clip"]) & (df_all["r_face"] > 0.0)].copy()

    train_df = df_eval[df_eval["split"] == "train"].reset_index(drop=True)
    val_df = df_eval[df_eval["split"] == "validation"].reset_index(drop=True)
    test_df = df_eval[df_eval["split"] == "test"].reset_index(drop=True)

    s_tr = set(train_df["subject"].unique())
    s_va = set(val_df["subject"].unique())
    s_te = set(test_df["subject"].unique())
    assert len(s_tr & s_va) == 0 and len(s_tr & s_te) == 0 and len(s_va & s_te) == 0, "Subject leakage!"
    for cols in (FACE_RAW_FEATURES, FACE_MODEL_FEATURES):
        assert not set(cols) & set(LABEL_COLUMNS), "Label column used as face feature!"

    y_va = val_df["is_confused"].values.astype(int)
    y_te = test_df["is_confused"].values.astype(int)
    base_rate_face = float(train_df["is_confused"].mean())

    candidate_sets = {"raw": list(FACE_RAW_FEATURES), "raw_plus_c2": list(FACE_MODEL_FEATURES)}
    fitted, candidates = {}, {}
    for name, cols in candidate_sets.items():
        pipe = _fit_face_lr(train_df, cols)
        p_val = pipe.predict_proba(val_df[cols].values.astype(np.float32))[:, 1]
        fitted[name] = (pipe, cols, p_val)
        candidates[name] = {
            "val_auroc": round(float(roc_auc_score(y_va, p_val)), 4),
            "val_auprc": round(float(average_precision_score(y_va, p_val)), 4),
        }
    selected = max(candidates, key=lambda k: candidates[k]["val_auroc"])
    alternative = [k for k in candidates if k != selected][0]

    cfgs = {}
    for name, (pipe, cols, p_val) in fitted.items():
        xp, fp = fit_isotonic_knots(p_val, y_va, n_knots=15, shrinkage=0.25)
        cfgs[name] = _linear_branch_cfg(pipe, cols, base_rate_face, xp, fp)

    pipe_sel, cols_sel, _ = fitted[selected]
    # Fixed graph name: skl2onnx otherwise draws a random UUID, so every run (including the pytest
    # reproducibility check) rewrote the tracked ONNX files with byte-level noise.
    onnx_model = convert_sklearn(
        pipe_sel,
        name=ONNX_FACE_GRAPH_NAME,
        initial_types=[("float_input", FloatTensorType([None, len(cols_sel)]))],
        options={id(pipe_sel.named_steps["clf"]): {"zipmap": False}},
        target_opset=15,
    )
    onnx_path = MODELS_DIR / "sp_bef_face.onnx"
    onnx.save_model(onnx_model, str(onnx_path))
    web_onnx_dir = BASE_DIR.parent / "lms-web" / "public" / "models"
    web_onnx_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(onnx_path, web_onnx_dir / "sp_bef_face.onnx")

    # Single evaluation on the official test split (natural base rate, every clip with a detected face).
    branch_cfg = cfgs[selected]
    p_te_raw = pipe_sel.predict_proba(test_df[cols_sel].values.astype(np.float32))[:, 1]
    p_te_cal = np.array([piecewise_linear_interp(float(p), branch_cfg["isotonic_xp"], branch_cfg["isotonic_fp"]) for p in p_te_raw])

    pipe_alt, cols_alt, _ = fitted[alternative]
    p_te_alt = pipe_alt.predict_proba(test_df[cols_alt].values.astype(np.float32))[:, 1]

    branch_cfg["metrics"] = {
        "train_clips": len(train_df),
        "val_clips": len(val_df),
        "test_clips": len(test_df),
        "train_subjects": len(s_tr),
        "val_subjects": len(s_va),
        "test_subjects": len(s_te),
        "test_base_rate": round(float(np.mean(y_te)), 4),
        "selected_feature_set": selected,
        "candidates_val": candidates,
        "posthoc_test_auroc_" + alternative: round(float(roc_auc_score(y_te, p_te_alt)), 4),
        "test_auroc": round(float(roc_auc_score(y_te, p_te_cal)), 4),
        "test_auroc_ci95": bootstrap_auroc_ci(y_te, p_te_cal),
        "test_auprc": round(float(average_precision_score(y_te, p_te_cal)), 4),
        "always_negative_auprc": round(float(np.mean(y_te)), 4),
        "test_ece_uncalibrated": round(compute_ece(y_te, p_te_raw), 4),
        "test_ece_calibrated": round(compute_ece(y_te, p_te_cal), 4),
        "test_brier": round(float(brier_score_loss(y_te, p_te_cal)), 4),
        "onnx_size_bytes": onnx_path.stat().st_size,
    }

    # Branch outputs for the Virtual Learner protocol: selected model -> llr/cal_prob, C2 variant -> *_c2 / *_raw.
    for df in (val_df, test_df):
        _attach_branch_outputs(df, branch_cfg)
        _attach_branch_outputs(df, cfgs["raw_plus_c2"], "_c2")
        _attach_branch_outputs(df, cfgs["raw"], "_raw")
    return branch_cfg, val_df, test_df


MOOCCUBEX_DIR = RAW_DIR / "mooccubex"
BEHAVIOR_LABEL_WINDOW_SEC = 14 * 24 * 3600
BEHAVIOR_FAIL_RATE_THRESHOLD = 0.5
CHINA_UTC_OFFSET_SEC = 8 * 3600


def session_behavior_features(segs: List[Dict]) -> Dict[str, float]:
    """6 runtime-identical watching-behaviour features from one user's MOOCCubeX segments of one video."""
    pause_durations = []
    rewind_spots = []
    speed_down = 0
    for k in range(len(segs)):
        s_cur = segs[k]
        sp = float(s_cur.get("start_point", 0.0) or 0.0)
        spd = float(s_cur.get("speed", 1.0) or 1.0)
        t_cur = float(s_cur.get("local_start_time", 0.0) or 0.0)
        if spd < 1.0:
            speed_down = 1
        if k == 0:
            continue
        s_prev = segs[k - 1]
        sp_prev = float(s_prev.get("start_point", 0.0) or 0.0)
        ep_prev = float(s_prev.get("end_point", sp_prev) or sp_prev)
        spd_prev = max(0.5, float(s_prev.get("speed", 1.0) or 1.0))
        t_prev = float(s_prev.get("local_start_time", 0.0) or 0.0)
        if spd < spd_prev:
            speed_down = 1
        if sp < ep_prev - 2.0:
            rewind_spots.append(sp)
        watch_wall = max(0.0, (ep_prev - sp_prev) / spd_prev)
        gap = (t_cur - t_prev) - watch_wall
        if 2.0 <= gap <= 180.0:
            pause_durations.append(gap)

    rewind_same = 0
    spots = sorted(rewind_spots)
    for r_i in range(1, len(spots)):
        if abs(spots[r_i] - spots[r_i - 1]) <= 30.0:
            rewind_same = 1
            break
    return {
        "pause_count": float(min(len(pause_durations), 15)),
        "avg_pause_duration": round(float(min(np.mean(pause_durations), 180.0)) if pause_durations else 0.0, 4),
        "long_pause_count": float(min(sum(1 for d in pause_durations if d > 10.0), 10)),
        "rewind_count": float(min(len(rewind_spots), 12)),
        "rewind_same_spot": float(rewind_same),
        "speed_change_down": float(speed_down),
    }


def _load_mooccubex_chapter_links() -> Tuple[Dict[str, set], Dict[str, set]]:
    """Maps video_id and problem_id to the (course_id, top-level chapter) units they belong to."""
    video_units: Dict[str, set] = {}
    exercise_units: Dict[str, set] = {}
    with open(MOOCCUBEX_DIR / "course.json", "r", encoding="utf-8") as f:
        for line in f:
            try:
                course = json.loads(line)
            except Exception:
                continue
            cid = course.get("id")
            for res in course.get("resource", []) or []:
                rid = str(res.get("resource_id", ""))
                chapter = str(res.get("chapter", "") or "").split(".")[0]
                if not chapter:
                    continue
                unit = (cid, chapter)
                if rid.startswith("V_"):
                    video_units.setdefault(rid, set()).add(unit)
                elif rid.startswith("Ex_"):
                    exercise_units.setdefault(rid, set()).add(unit)
    problem_units: Dict[str, set] = {}
    with open(MOOCCUBEX_DIR / "exercise-problem.txt", "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) == 2 and parts[0] in exercise_units:
                problem_units.setdefault(parts[1], set()).update(exercise_units[parts[0]])
    return video_units, problem_units


def build_mooccubex_behavior_sessions(max_sessions: int = 120000) -> pd.DataFrame:
    """
    Real proxy label (fixed before training, never computed from the behaviour features):
      is_confused = 1 if the user got >= 50% of the problems of the SAME course chapter wrong, counting only
      submissions within 14 days after first watching the video. Sessions with no such submissions are dropped.
    """
    cache_path = DATA_DIR / "mooccubex_behavior_sessions_v3.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)

    video_units, problem_units = _load_mooccubex_chapter_links()

    # (user, unit) -> list of (submit_ts, is_correct); the downloaded head of user-problem.json may end mid-line.
    attempts: Dict[Tuple[str, Tuple[str, str]], List[Tuple[float, int]]] = {}
    with open(MOOCCUBEX_DIR / "user-problem.head.json", "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            units = problem_units.get(str(obj.get("problem_id", "")))
            if not units or obj.get("is_correct") is None:
                continue
            try:
                # submit_time is wall-clock China time (UTC+8); convert to a UTC epoch like local_start_time.
                ts = calendar.timegm(time.strptime(obj["submit_time"], "%Y-%m-%d %H:%M:%S")) - CHINA_UTC_OFFSET_SEC
            except Exception:
                continue
            uid = str(obj["user_id"])
            for unit in units:
                attempts.setdefault((uid, unit), []).append((ts, int(obj["is_correct"])))
    users_with_attempts = {u for u, _ in attempts}

    sessions = []
    with open(MOOCCUBEX_DIR / "user-video.json", "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if len(sessions) >= max_sessions:
                break
            try:
                obj = json.loads(line)
            except Exception:
                continue
            uid = str(obj.get("user_id", ""))
            if uid not in users_with_attempts:
                continue
            for item in obj.get("seq", []) or []:
                vid = str(item.get("video_id", ""))
                segs = item.get("segment", []) or []
                if not segs or vid not in video_units:
                    continue
                t0 = min(float(sg.get("local_start_time", 0.0) or 0.0) for sg in segs)
                outcomes = [
                    c
                    for unit in video_units[vid]
                    for ts, c in attempts.get((uid, unit), [])
                    if t0 <= ts <= t0 + BEHAVIOR_LABEL_WINDOW_SEC
                ]
                if not outcomes:
                    continue
                fail_rate = 1.0 - float(np.mean(outcomes))
                row = session_behavior_features(segs)
                row.update({
                    "user_id": uid,
                    "video_id": vid,
                    "n_linked_problems": len(outcomes),
                    "is_confused": int(fail_rate >= BEHAVIOR_FAIL_RATE_THRESHOLD),
                })
                sessions.append(row)

    df = pd.DataFrame(sessions)
    df.to_csv(cache_path, index=False)
    return df


def run_p3_behavior_and_prior() -> Tuple[Dict, Dict, pd.DataFrame, pd.DataFrame]:
    """
    P3: Behaviour branch on real MOOCCubeX sessions with the chapter-exercise proxy label, split by user.
    The C3 segment prior ships as a uniform cold-start prior: open data has no per-segment confusion labels,
    so a position-in-video prior cannot be validated (see REPORT_V2.md).
    """
    df_beh = build_mooccubex_behavior_sessions()
    assert not set(BEHAVIOR_FEATURES) & set(LABEL_COLUMNS + ["n_linked_problems"])

    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=SEED)
    tr_idx, temp_idx = next(gss1.split(df_beh, df_beh["is_confused"], groups=df_beh["user_id"]))
    df_tr = df_beh.iloc[tr_idx].reset_index(drop=True)
    df_temp = df_beh.iloc[temp_idx].reset_index(drop=True)
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=SEED)
    va_idx, te_idx = next(gss2.split(df_temp, df_temp["is_confused"], groups=df_temp["user_id"]))
    df_va = df_temp.iloc[va_idx].reset_index(drop=True)
    df_te = df_temp.iloc[te_idx].reset_index(drop=True)
    assert len(set(df_tr["user_id"]) & set(df_va["user_id"])) == 0
    assert len(set(df_tr["user_id"]) & set(df_te["user_id"])) == 0
    assert len(set(df_va["user_id"]) & set(df_te["user_id"])) == 0

    pipe_lr = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)),
    ])
    pipe_lr.fit(df_tr[BEHAVIOR_FEATURES].values.astype(np.float32), df_tr["is_confused"].values.astype(int))
    y_va = df_va["is_confused"].values.astype(int)
    y_te = df_te["is_confused"].values.astype(int)
    p_va_raw = pipe_lr.predict_proba(df_va[BEHAVIOR_FEATURES].values.astype(np.float32))[:, 1]
    xp_beh, fp_beh = fit_isotonic_knots(p_va_raw, y_va, n_knots=15)
    p_te_raw = pipe_lr.predict_proba(df_te[BEHAVIOR_FEATURES].values.astype(np.float32))[:, 1]
    p_te_cal = np.array([piecewise_linear_interp(float(p), xp_beh, fp_beh) for p in p_te_raw])
    base_rate_beh = float(np.mean(df_tr["is_confused"]))

    beh_cfg = _linear_branch_cfg(pipe_lr, list(BEHAVIOR_FEATURES), base_rate_beh, xp_beh, fp_beh)
    beh_cfg["metrics"] = {
        "label_definition": "fail rate >= 0.5 on same-chapter problems submitted within 14 days after first watch",
        "train_sessions": len(df_tr),
        "val_sessions": len(df_va),
        "test_sessions": len(df_te),
        "unique_users_total": int(df_beh["user_id"].nunique()),
        "test_base_rate": round(float(np.mean(y_te)), 4),
        "test_auroc": round(float(roc_auc_score(y_te, p_te_cal)), 4),
        "test_auroc_ci95": bootstrap_auroc_ci(y_te, p_te_cal),
        "test_auprc": round(float(average_precision_score(y_te, p_te_cal)), 4),
        "always_negative_auprc": round(float(np.mean(y_te)), 4),
        "test_ece_calibrated": round(compute_ece(y_te, p_te_cal), 4),
        "test_brier": round(float(brier_score_loss(y_te, p_te_cal)), 4),
    }
    for df in (df_va, df_te):
        _attach_branch_outputs(df, beh_cfg)

    prior_cfg = {
        "source": "uniform_cold_start (no per-segment confusion labels in open data)",
        "cold_start_prior": round(base_rate_beh, 4),
        "bin_duration_sec": 30,
        "mooccubex_bin_priors_20": [round(base_rate_beh, 4)] * 20,
        "density_to_prior_intercept": 0.0,
        "density_to_prior_slope": 0.0,
    }
    return beh_cfg, prior_cfg, df_va, df_te


SENSITIVITY_THRESHOLDS = (0.10, 0.20, 0.40, 0.70)
SENSITIVITY_QUANTILES = (0.25, 0.50, 0.75)


def distinct_threshold_labelings(
    values: np.ndarray,
    candidate_thresholds=SENSITIVITY_THRESHOLDS,
    quantiles=SENSITIVITY_QUANTILES,
) -> List[Dict]:
    """
    Groups label thresholds by the labeling they actually produce on `values`.

    confidence(CONFUSED) in ASSISTments takes only a handful of discrete values, so different thresholds
    often give identical labels (0.10 and 0.20 both cut just below 0.378). Besides the requested
    `candidate_thresholds`, a data-driven threshold is added at each quantile of the positive values,
    placed at the midpoint below the distinct value holding that quantile so it is a real cut point.
    Thresholds that give an all-positive or all-negative labeling are dropped.

    Returns one entry per distinct labeling, ordered by cut point:
    `threshold` (a requested threshold if one maps to this labeling, else the midpoint),
    `equivalent_thresholds` (requested thresholds with the same labels), `threshold_range` ([lo, hi]:
    every threshold in (lo, hi] gives these labels), `base_rate` (share of values >= hi).
    """
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v)]
    levels = np.unique(v)
    if len(levels) < 2:
        return []

    positives = v[v > levels[0]]
    data_driven = []
    for q in quantiles:
        level = float(np.quantile(positives, q, method="lower"))
        idx = int(np.searchsorted(levels, level))
        data_driven.append(round(float((levels[idx - 1] + levels[idx]) / 2.0), 4))

    groups: Dict[int, Dict] = {}
    for th, requested in [(float(t), True) for t in candidate_thresholds] + [(t, False) for t in data_driven]:
        cut = int(np.searchsorted(levels, th, side="left"))  # first distinct value labelled positive
        if cut <= 0 or cut >= len(levels):
            continue
        g = groups.setdefault(cut, {"requested": [], "midpoint": th})
        if requested and th not in g["requested"]:
            g["requested"].append(th)

    out = []
    for cut in sorted(groups):
        g = groups[cut]
        out.append({
            "threshold": g["requested"][0] if g["requested"] else g["midpoint"],
            "equivalent_thresholds": sorted(g["requested"]),
            "threshold_range": [round(float(levels[cut - 1]), 4), round(float(levels[cut]), 4)],
            "base_rate": round(float(np.mean(v >= levels[cut])), 4),
        })
    return out


def run_p4_quiz_branch() -> Tuple[Dict, pd.DataFrame, pd.DataFrame]:
    """
    P4: Parse real ASSISTments 2017 CSV (`anonymized_full_release_competition_dataset.csv`),
    keep ONLY LMS-compatible features (`quiz_accuracy`, `quiz_time_norm`, `attempt_count`),
    group-split strictly by `studentId`, calibrate, and report threshold sensitivity.
    """
    use_cols = ["studentId", "correct", "timeTaken", "attemptCount", "confidence(CONFUSED)"]
    df_raw = pd.read_csv(
        RAW_DIR / "anonymized_full_release_competition_dataset.csv",
        usecols=use_cols,
    ).dropna()

    df_quiz = pd.DataFrame({
        "student_id": df_raw["studentId"].astype(int),
        "quiz_accuracy": (df_raw["correct"].astype(float).clip(0.0, 1.0)) * 100.0,
        "quiz_time_norm": df_raw["timeTaken"].astype(float).clip(1.0, 180.0),
        "attempt_count": df_raw["attemptCount"].astype(float).clip(1.0, 5.0),
        "conf_raw": df_raw["confidence(CONFUSED)"].astype(float),
    })

    # Default fixed threshold on detector confidence(CONFUSED) >= 0.20
    DEFAULT_TH = 0.20
    df_quiz["is_confused"] = (df_quiz["conf_raw"] >= DEFAULT_TH).astype(int)

    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=SEED)
    tr_idx, temp_idx = next(gss1.split(df_quiz, df_quiz["is_confused"], groups=df_quiz["student_id"]))
    df_tr = df_quiz.iloc[tr_idx].reset_index(drop=True)
    df_temp = df_quiz.iloc[temp_idx].reset_index(drop=True)

    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=SEED)
    va_idx, te_idx = next(gss2.split(df_temp, df_temp["is_confused"], groups=df_temp["student_id"]))
    df_va = df_temp.iloc[va_idx].reset_index(drop=True)
    df_te = df_temp.iloc[te_idx].reset_index(drop=True)

    assert len(set(df_tr["student_id"]) & set(df_va["student_id"])) == 0
    assert len(set(df_tr["student_id"]) & set(df_te["student_id"])) == 0
    assert len(set(df_va["student_id"]) & set(df_te["student_id"])) == 0

    X_tr = df_tr[QUIZ_FEATURES].values.astype(np.float32)
    y_tr = df_tr["is_confused"].values.astype(int)
    X_va = df_va[QUIZ_FEATURES].values.astype(np.float32)
    y_va = df_va["is_confused"].values.astype(int)
    X_te = df_te[QUIZ_FEATURES].values.astype(np.float32)
    y_te = df_te["is_confused"].values.astype(int)

    pipe_lr = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)),
    ])
    pipe_lr.fit(X_tr, y_tr)

    p_va_raw = pipe_lr.predict_proba(X_va)[:, 1]
    xp_quiz, fp_quiz = fit_isotonic_knots(p_va_raw, y_va, n_knots=15)

    p_te_raw = pipe_lr.predict_proba(X_te)[:, 1]
    p_te_cal = np.array([piecewise_linear_interp(float(p), xp_quiz, fp_quiz) for p in p_te_raw])
    base_rate_quiz = float(np.mean(y_tr))

    # Sensitivity analysis over label thresholds. confidence(CONFUSED) is discrete, so thresholds are grouped
    # by the labeling they produce and each distinct labeling is evaluated once.
    labelings = distinct_threshold_labelings(df_quiz["conf_raw"].values)
    sensitivity = {}
    for lab in labelings:
        th = lab["threshold"]
        y_tr_th = (df_tr["conf_raw"].values >= th).astype(int)
        y_te_th = (df_te["conf_raw"].values >= th).astype(int)
        m_th = Pipeline([("s", StandardScaler()), ("c", LogisticRegression(C=1.0, random_state=SEED))])
        m_th.fit(X_tr, y_tr_th)
        p_th = m_th.predict_proba(X_te)[:, 1]
        sensitivity[f"th_{th:.4g}"] = {
            "base_rate": round(float(np.mean(y_tr_th)), 4),
            "base_rate_all": lab["base_rate"],
            "threshold_range": lab["threshold_range"],
            "equivalent_thresholds": lab["equivalent_thresholds"],
            "test_auroc": round(float(roc_auc_score(y_te_th, p_th)), 4),
            "test_auprc": round(float(average_precision_score(y_te_th, p_th)), 4),
        }

    quiz_cfg = _linear_branch_cfg(pipe_lr, list(QUIZ_FEATURES), base_rate_quiz, xp_quiz, fp_quiz)
    quiz_cfg["metrics"] = {
        "label_definition": f"ASSISTments 2017 confidence(CONFUSED) >= {DEFAULT_TH:.2f}",
        "label_caveat": "confidence(CONFUSED) is itself a detector output built from interaction features "
        "(correctness, attempts, time), so this branch partly re-learns that detector",
        "train_rows": len(df_tr),
        "val_rows": len(df_va),
        "test_rows": len(df_te),
        "unique_students_total": int(df_quiz["student_id"].nunique()),
        "test_base_rate": round(float(np.mean(y_te)), 4),
        "test_auroc": round(float(roc_auc_score(y_te, p_te_cal)), 4),
        "test_auroc_ci95": bootstrap_auroc_ci(y_te, p_te_cal),
        "test_auprc": round(float(average_precision_score(y_te, p_te_cal)), 4),
        "always_negative_auprc": round(float(np.mean(y_te)), 4),
        "test_ece_calibrated": round(compute_ece(y_te, p_te_cal), 4),
        "test_brier": round(float(brier_score_loss(y_te, p_te_cal)), 4),
        "threshold_sensitivity": sensitivity,
        "label_confidence_distinct_values": int(df_quiz["conf_raw"].nunique()),
    }
    for df in (df_va, df_te):
        _attach_branch_outputs(df, quiz_cfg)
    return quiz_cfg, df_va, df_te


VL_PROTOCOL = {
    "n_learners": 300,
    "n_steps_per_learner": 48,  # 48 x 5s = 4 minutes per virtual session
    "dt_sec": 5.0,
    "p_enter_confused": 0.06,
    "p_keep_confused": 0.80,
    "face_clip_hold_steps": 2,  # one DAiSEE clip covers 10s -> reused for two 5s steps
    "behavior_hold_steps": 12,  # behaviour session redrawn on state change or every 60s
    "quiz_event_rate": 0.15,
    "missing_camera_rate": 0.30,
    "degraded_camera_rate": 0.25,
}

MAX_FALSE_INTERVENTIONS_PER_HOUR = 2.0

BASE_FUSION_CFG = {
    "hmm_keep_confused": 0.78,
    "hmm_beta0": 0.04,
    "hmm_beta1": 0.45,
    "w_face": 0.65,
    "w_beh": 0.85,
    "w_quiz": 0.90,
    "theta_on": 0.62,
    "theta_off": 0.42,
    "min_hold_sec": 10.0,
    "cooldown_sec": 180.0,
}


def build_virtual_learners(face_df: pd.DataFrame, beh_df: pd.DataFrame, quiz_df: pd.DataFrame, seed: int) -> List[List[Dict]]:
    """
    C6 semi-synthetic protocol: latent confusion follows a fixed 2-state Markov chain (independent of pi_s), and
    each step reuses REAL held-out branch outputs whose label matches the latent state. Evidence is temporally
    correlated (clips/sessions are held over several steps) so temporal filtering is not credited with
    averaging independent draws.
    """
    cfg = VL_PROTOCOL
    rng = np.random.RandomState(seed)
    pools = {
        name: {y: df[df["is_confused"] == y].reset_index(drop=True) for y in (0, 1)}
        for name, df in (("face", face_df), ("beh", beh_df), ("quiz", quiz_df))
    }

    def draw(name: str, y: int) -> pd.Series:
        pool = pools[name][y]
        return pool.iloc[rng.randint(0, len(pool))]

    trajectories = []
    for _ in range(cfg["n_learners"]):
        camera_on = rng.rand() >= cfg["missing_camera_rate"]
        state, prev_state = 0, -1
        face_row = beh_row = None
        face_age = beh_age = 0
        steps = []
        for _t in range(cfg["n_steps_per_learner"]):
            if state == 1:
                state = 1 if rng.rand() < cfg["p_keep_confused"] else 0
            else:
                state = 1 if rng.rand() < cfg["p_enter_confused"] else 0
            changed = state != prev_state
            if changed or face_age >= cfg["face_clip_hold_steps"]:
                face_row, face_age = draw("face", state), 0
            if changed or beh_age >= cfg["behavior_hold_steps"]:
                beh_row, beh_age = draw("beh", state), 0
            face_age += 1
            beh_age += 1
            prev_state = state

            step = {
                "y": int(state),
                "p_face": float(face_row["cal_prob"]),
                "llr_face": float(face_row["llr"]),
                "p_face_alt": float(face_row["cal_prob_alt"]),
                "llr_face_alt": float(face_row["llr_alt"]),
                "r_face": float(face_row["r_face"]) if camera_on else 0.0,
                "p_beh": float(beh_row["cal_prob"]),
                "llr_beh": float(beh_row["llr"]),
                "r_beh": 1.0,
                "p_quiz": 0.0,
                "llr_quiz": 0.0,
                "r_quiz": 0.0,
            }
            if camera_on and rng.rand() < cfg["degraded_camera_rate"]:
                # Assumption under test for C4: a low-quality frame yields an uninformative face LLR.
                step["r_face"] = round(float(rng.uniform(0.10, 0.35)), 4)
                noisy = clip_val(float(rng.normal(0.0, 2.2)), -LLR_CLIP, LLR_CLIP)
                step["llr_face"] = step["llr_face_alt"] = noisy
                step["p_face"] = step["p_face_alt"] = sigmoid(noisy)
            if rng.rand() < cfg["quiz_event_rate"]:
                q_row = draw("quiz", state)
                step.update({"p_quiz": float(q_row["cal_prob"]), "llr_quiz": float(q_row["llr"]), "r_quiz": 1.0})
            steps.append(step)
        trajectories.append(steps)
    return trajectories


def _stacking_features(s: Dict) -> List[float]:
    mf = 1.0 if s["r_face"] > 0 else 0.0
    mq = 1.0 if s["r_quiz"] > 0 else 0.0
    return [mf * logit(s["p_face"]), mf, logit(s["p_beh"]), mq * logit(s["p_quiz"]), mq]


def run_fusion_variant(trajectories: List[List[Dict]], mode: str, fusion_cfg: Dict, base_rates: Dict, stacker=None) -> Dict:
    dt_sec = VL_PROTOCOL["dt_sec"]
    cold_prior = base_rates["behavior"]
    all_y, all_p, latencies = [], [], []
    false_alarms, episodes, detected = 0, 0, 0
    for traj in trajectories:
        p_prev, high_sec, intervening, cooldown, consec = cold_prior, 0.0, False, 0.0, 0
        in_ep, ep_start, ep_detected = False, 0, False
        for t, s in enumerate(traj):
            y = s["y"]
            if y == 1 and not in_ep:
                in_ep, ep_start, ep_detected = True, t, False
                episodes += 1
            elif y == 0:
                in_ep = False

            if mode in ("legacy_3x060", "naive_prob_avg", "stacking"):
                if mode == "legacy_3x060":
                    pf = s["p_face"] if s["r_face"] > 0 else 0.5
                    pq = s["p_quiz"] if s["r_quiz"] > 0 else 0.5
                    p_t = (pf + s["p_beh"] + pq) / 3.0
                    consec = consec + 1 if p_t >= 0.60 else 0
                    fire = consec >= 3
                else:
                    if mode == "naive_prob_avg":
                        ps = [s["p_beh"]] + ([s["p_face"]] if s["r_face"] > 0 else []) + ([s["p_quiz"]] if s["r_quiz"] > 0 else [])
                        p_t = float(np.mean(ps))
                    else:
                        p_t = float(stacker.predict_proba(np.array([_stacking_features(s)]))[0, 1])
                    fire = p_t >= fusion_cfg["theta_on"]
                cooldown = max(0.0, cooldown - dt_sec)
                trig = fire and cooldown <= 0
                if trig:
                    cooldown = fusion_cfg["cooldown_sec"]
            else:
                rf = s["r_face"]
                lf, lb, lq = s["llr_face"], s["llr_beh"], s["llr_quiz"]
                cfg = fusion_cfg
                prev = p_prev
                if mode == "no_c4_reliability":
                    rf = 1.0 if rf > 0 else 0.0
                elif mode == "alt_face_model":
                    lf = s["llr_face_alt"]
                elif mode == "no_c1_llr":
                    lf = clip_val(logit(s["p_face"]), -LLR_CLIP, LLR_CLIP)
                    lb = clip_val(logit(s["p_beh"]), -LLR_CLIP, LLR_CLIP)
                    lq = clip_val(logit(s["p_quiz"]), -LLR_CLIP, LLR_CLIP)
                elif mode == "no_c5_hmm":
                    # a_keep == beta makes the predicted prior constant (no memory); theta_off == theta_on and
                    # min_hold == dt remove the hysteresis.
                    beta = clip_val(fusion_cfg["hmm_beta0"] + fusion_cfg["hmm_beta1"] * cold_prior, 0.02, 0.65)
                    cfg = {**fusion_cfg, "hmm_keep_confused": beta, "theta_off": fusion_cfg["theta_on"], "min_hold_sec": dt_sec}
                res = sp_bef_step(
                    prev_posterior=prev, segment_prior=cold_prior,
                    llr_face=lf, r_face=rf, llr_beh=lb, r_beh=s["r_beh"], llr_quiz=lq, r_quiz=s["r_quiz"],
                    fusion_cfg=cfg, prev_high_sec=high_sec, prev_intervening=intervening,
                    cooldown_remaining_sec=cooldown, dt_sec=dt_sec,
                )
                p_t = res["posterior_prob"]
                p_prev = p_t
                high_sec = res["high_duration_sec"]
                intervening = res["is_confused"]
                cooldown = res["cooldown_remaining_sec"]
                trig = res["should_intervene"]

            all_y.append(y)
            all_p.append(p_t)
            if trig:
                if y == 1 and in_ep and not ep_detected:
                    latencies.append((t - ep_start) * dt_sec)
                    ep_detected = True
                    detected += 1
                elif y == 0:
                    false_alarms += 1

    y_arr, p_arr = np.array(all_y, dtype=int), np.array(all_p, dtype=np.float64)
    total_hours = len(all_y) * dt_sec / 3600.0
    return {
        "auroc": round(float(roc_auc_score(y_arr, p_arr)), 4),
        "auprc": round(float(average_precision_score(y_arr, p_arr)), 4),
        "ece": round(compute_ece(y_arr, p_arr), 4),
        "brier": round(float(brier_score_loss(y_arr, p_arr)), 4),
        "episode_recall": round(detected / max(episodes, 1), 4),
        "mean_detection_latency_sec": round(float(np.mean(latencies)), 2) if latencies else None,
        "false_interventions_per_hour": round(false_alarms / max(total_hours, 1e-4), 2),
    }


def run_p5_virtual_learner_evaluation(
    face_cfg: Dict, face_val_df: pd.DataFrame, face_test_df: pd.DataFrame,
    beh_cfg: Dict, beh_val_df: pd.DataFrame, beh_test_df: pd.DataFrame,
    quiz_cfg: Dict, quiz_val_df: pd.DataFrame, quiz_test_df: pd.DataFrame,
) -> Dict:
    """
    P5 & C6: fusion hyper-parameters and the stacking baseline are fitted on VL-val (built from branch
    validation outputs); every method is then scored once on VL-test (built from branch test outputs).
    """
    alt = "c2" if face_cfg["metrics"]["selected_feature_set"] == "raw" else "raw"
    for df in (face_val_df, face_test_df):
        df["cal_prob_alt"] = df["cal_prob_" + alt]
        df["llr_alt"] = df["llr_" + alt]
    base_rates = {"face": face_cfg["base_rate"], "behavior": beh_cfg["base_rate"], "quiz": quiz_cfg["base_rate"]}

    # Deployment gate: a branch takes part in fusion only if the bootstrap 95% CI of its calibrated AUROC is
    # above chance on BOTH validation and test. Using the test split here can only remove a branch.
    enabled = {}
    for name, cfg_b, df_val in (("face", face_cfg, face_val_df), ("behavior", beh_cfg, beh_val_df), ("quiz", quiz_cfg, quiz_val_df)):
        ci = bootstrap_auroc_ci(df_val["is_confused"].values, df_val["cal_prob"].values)
        cfg_b["metrics"]["val_auroc_ci95"] = ci
        cfg_b["enabled"] = bool(ci[0] > 0.5 and cfg_b["metrics"]["test_auroc_ci95"][0] > 0.5)
        enabled[name] = cfg_b["enabled"]
    weight_grid = {
        name: ((0.4, 0.7, 1.0) if enabled[key] else (0.0,))
        for name, key in (("w_face", "face"), ("w_beh", "behavior"), ("w_quiz", "quiz"))
    }

    vl_val = build_virtual_learners(face_val_df, beh_val_df, quiz_val_df, seed=SEED)
    vl_test = build_virtual_learners(face_test_df, beh_test_df, quiz_test_df, seed=SEED + 1)

    # Tune SP-BEF evidence weights and HMM persistence on VL-val (minimum Brier score).
    best_cfg, best_brier, tuning = dict(BASE_FUSION_CFG), float("inf"), []
    for w_face in weight_grid["w_face"]:
        for w_beh in weight_grid["w_beh"]:
            for w_quiz in weight_grid["w_quiz"]:
                for keep in (0.6, 0.78, 0.9):
                    cfg = {**BASE_FUSION_CFG, "w_face": w_face, "w_beh": w_beh, "w_quiz": w_quiz, "hmm_keep_confused": keep}
                    brier = run_fusion_variant(vl_val, "sp_bef_full", cfg, base_rates)["brier"]
                    tuning.append({"w_face": w_face, "w_beh": w_beh, "w_quiz": w_quiz, "hmm_keep_confused": keep, "val_brier": brier})
                    if brier < best_brier:
                        best_cfg, best_brier = cfg, brier

    # Intervention threshold chosen on VL-val: highest episode recall with <= MAX_FALSE_INTERVENTIONS_PER_HOUR.
    theta_choice = None
    for theta_on in (0.62, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25):
        cfg = {**best_cfg, "theta_on": theta_on, "theta_off": round(max(0.05, theta_on - 0.15), 2)}
        r = run_fusion_variant(vl_val, "sp_bef_full", cfg, base_rates)
        tuning.append({"theta_on": theta_on, "val_episode_recall": r["episode_recall"], "val_false_per_hour": r["false_interventions_per_hour"]})
        if r["false_interventions_per_hour"] <= MAX_FALSE_INTERVENTIONS_PER_HOUR and (
            theta_choice is None or r["episode_recall"] > theta_choice[1]
        ):
            theta_choice = (cfg, r["episode_recall"])
    if theta_choice is not None:
        best_cfg = theta_choice[0]

    # Trained stacking baseline (masked logits + availability indicators), fitted on VL-val.
    X_val = np.array([_stacking_features(s) for traj in vl_val for s in traj])
    y_val = np.array([s["y"] for traj in vl_val for s in traj])
    stacker = LogisticRegression(max_iter=1000, random_state=SEED).fit(X_val, y_val)

    alt_label = "with C2 personal baseline" if alt == "c2" else "without C2 personal baseline"
    variants = [
        ("(a) Legacy Rule (avg, 3 consecutive >= 0.60)", "legacy_3x060"),
        ("(b) Naive Probability Average", "naive_prob_avg"),
        ("(c) Logistic Stacking (trained on VL-val)", "stacking"),
        ("(d) SP-BEF (tuned on VL-val)", "sp_bef_full"),
        ("Ablation: w/o C1 (raw logit, no base-rate removal)", "no_c1_llr"),
        (f"Ablation: face model {alt_label}", "alt_face_model"),
        ("Ablation: w/o C4 (r_face binary)", "no_c4_reliability"),
        ("Ablation: w/o C5 (no HMM memory / hysteresis)", "no_c5_hmm"),
    ]
    comparison = []
    for label, mode in variants:
        row = run_fusion_variant(vl_test, mode, best_cfg, base_rates, stacker=stacker)
        comparison.append({"variant": label, **row})

    plt.figure(figsize=(10, 5))
    labels = [c["variant"] for c in comparison]
    y_pos = np.arange(len(labels))
    plt.barh(y_pos - 0.18, [c["auroc"] for c in comparison], height=0.35, label="AUROC", color="#0A3150")
    plt.barh(y_pos + 0.18, [c["auprc"] for c in comparison], height=0.35, label="AUPRC", color="#1c906c")
    plt.yticks(y_pos, labels, fontsize=9)
    plt.xlim(0.0, 1.0)
    plt.xlabel("Score")
    plt.title("Virtual Learner (semi-synthetic) — VL-test, hyper-parameters from VL-val")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(OUTPUT_V2_DIR / "sp_bef_ablation_v2.png", dpi=160)
    plt.close()

    return {
        "fusion_config": best_cfg,
        "virtual_learner_protocol": dict(VL_PROTOCOL),
        "branches_enabled": enabled,
        "tuning_best_val_brier": best_brier,
        "tuning_log": tuning,
        "stacking_coefficients": [round(float(c), 6) for c in stacker.coef_[0]] + [round(float(stacker.intercept_[0]), 6)],
        "comparison_table": comparison,
    }


def generate_golden_files(sp_bef_params: Dict, df_raw_clips: pd.DataFrame) -> None:
    """
    P7: Generate golden test files (`ml/golden/parity_vectors.json` & `ml/golden/video_features_golden.json`)
    to verify <= 1e-5 numerical parity across Python, ONNX Runtime, TypeScript (`lms-web`), and Go (`lms-api`).
    """
    face_cfg = sp_bef_params["branches"]["face"]
    beh_cfg = sp_bef_params["branches"]["behavior"]
    quiz_cfg = sp_bef_params["branches"]["quiz"]
    fusion_cfg = sp_bef_params["fusion"]

    # Also verify ONNX model against Python linear branch on 20 vectors
    sess = ort.InferenceSession(str(MODELS_DIR / "sp_bef_face.onnx"), providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name

    rng = np.random.RandomState(SEED + 99)
    vectors = []
    for idx in range(20):
        f_vec = [round(float(x), 4) for x in rng.normal(0.25, 0.15, len(face_cfg["feature_names"]))]
        b_vec = [
            float(rng.randint(0, 6)),
            round(float(rng.uniform(0, 45)), 2),
            float(rng.randint(0, 3)),
            float(rng.randint(0, 5)),
            float(rng.randint(0, 2)),
            float(rng.randint(0, 2)),
        ]
        q_vec = [
            float(rng.choice([0.0, 25.0, 50.0, 75.0, 100.0])),
            round(float(rng.uniform(8.0, 95.0)), 2),
            float(rng.randint(1, 4)),
        ]

        # Include explicit edge cases (missing face, missing quiz, high confusion, cooldown active)
        has_face = idx % 4 != 0
        has_quiz = idx % 3 == 0
        avg_luma = 25.0 if idx == 5 else 130.0
        yaw_deg = 38.0 if idx == 6 else 5.0
        pitch_deg = 4.0
        pres_ratio = 1.0 if has_face else 0.0

        r_face = compute_frame_reliability(pres_ratio, avg_luma, yaw_deg, pitch_deg, 1.0)
        r_beh = 1.0
        r_quiz = 1.0 if has_quiz else 0.0

        raw_f, cal_f, llr_f = predict_linear_calibrated_branch(f_vec, face_cfg)
        raw_b, cal_b, llr_b = predict_linear_calibrated_branch(b_vec, beh_cfg)
        raw_q, cal_q, llr_q = predict_linear_calibrated_branch(q_vec, quiz_cfg)

        # Verify ONNX raw probability matches raw_f within 1e-5
        onnx_out = sess.run(None, {input_name: np.array([f_vec], dtype=np.float32)})
        onnx_prob = float(onnx_out[1][0][1])
        assert abs(onnx_prob - raw_f) <= 1e-5, f"ONNX parity mismatch: {onnx_prob} vs {raw_f}"

        prev_post = round(float(rng.uniform(0.12, 0.68)), 4)
        pi_s = round(float(rng.uniform(0.10, 0.38)), 4)
        prev_high = 10.0 if idx in (7, 15) else 0.0
        cooldown_in = 45.0 if idx == 11 else 0.0

        step_out = sp_bef_step(
            prev_posterior=prev_post,
            segment_prior=pi_s,
            llr_face=llr_f,
            r_face=r_face,
            llr_beh=llr_b,
            r_beh=r_beh,
            llr_quiz=llr_q,
            r_quiz=r_quiz,
            fusion_cfg=fusion_cfg,
            prev_high_sec=prev_high,
            prev_intervening=(idx == 14),
            cooldown_remaining_sec=cooldown_in,
            dt_sec=5.0,
        )

        vectors.append({
            "case_id": f"golden_{idx:02d}",
            "inputs": {
                "face_features": f_vec,
                "behavior_features": b_vec,
                "quiz_features": q_vec,
                "has_face": has_face,
                "has_quiz": has_quiz,
                "face_present_ratio": pres_ratio,
                "avg_luminance": avg_luma,
                "head_yaw_abs_deg": yaw_deg,
                "head_pitch_abs_deg": pitch_deg,
                "prev_posterior": prev_post,
                "segment_prior": pi_s,
                "prev_high_sec": prev_high,
                "prev_intervening": (idx == 14),
                "cooldown_remaining_sec": cooldown_in,
                "dt_sec": 5.0,
            },
            "expected": {
                "face_raw_prob": raw_f,
                "face_cal_prob": cal_f,
                "face_llr": llr_f,
                "beh_raw_prob": raw_b,
                "beh_cal_prob": cal_b,
                "beh_llr": llr_b,
                "quiz_raw_prob": raw_q,
                "quiz_cal_prob": cal_q,
                "quiz_llr": llr_q,
                "r_face": r_face,
                "r_beh": r_beh,
                "r_quiz": r_quiz,
                "step": step_out,
            },
        })

    (GOLDEN_DIR / "parity_vectors.json").write_text(json.dumps(vectors, indent=2), encoding="utf-8")

    # Also save golden frame sequence telemetry -> aggregated window features for Python vs TS parity (<= 1e-3)
    golden_frames = [
        {
            "detected": True,
            "luminance": 118.5,
            "brow_furrow": 0.42,
            "eye_squint": 0.31,
            "mouth_tension": 0.22,
            "ear": 0.255,
            "head_yaw_deg": -4.2,
            "head_pitch_deg": 2.1,
            "nose_x": 0.502,
            "nose_y": 0.512,
            "iod": 0.145,
        },
        {
            "detected": True,
            "luminance": 120.0,
            "brow_furrow": 0.48,
            "eye_squint": 0.35,
            "mouth_tension": 0.28,
            "ear": 0.248,
            "head_yaw_deg": -3.8,
            "head_pitch_deg": 2.4,
            "nose_x": 0.504,
            "nose_y": 0.513,
            "iod": 0.145,
        },
        {
            "detected": True,
            "luminance": 119.2,
            "brow_furrow": 0.51,
            "eye_squint": 0.38,
            "mouth_tension": 0.30,
            "ear": 0.251,
            "head_yaw_deg": -3.5,
            "head_pitch_deg": 1.9,
            "nose_x": 0.503,
            "nose_y": 0.511,
            "iod": 0.146,
        },
        {
            "detected": True,
            "luminance": 121.0,
            "brow_furrow": 0.46,
            "eye_squint": 0.33,
            "mouth_tension": 0.25,
            "ear": 0.253,
            "head_yaw_deg": -4.0,
            "head_pitch_deg": 2.0,
            "nose_x": 0.501,
            "nose_y": 0.512,
            "iod": 0.145,
        },
        {
            "detected": True,
            "luminance": 119.8,
            "brow_furrow": 0.49,
            "eye_squint": 0.36,
            "mouth_tension": 0.27,
            "ear": 0.249,
            "head_yaw_deg": -3.9,
            "head_pitch_deg": 2.2,
            "nose_x": 0.503,
            "nose_y": 0.512,
            "iod": 0.145,
        },
    ]
    golden_agg = aggregate_clip_window(golden_frames)
    (GOLDEN_DIR / "video_features_golden.json").write_text(
        json.dumps({"frames": golden_frames, "expected_window": golden_agg}, indent=2),
        encoding="utf-8",
    )


def write_report_v2(manifest: Dict, sp_bef_params: Dict) -> None:
    """Writes REPORT_V2.md. Every number and every comparison sentence is derived from sp_bef_params."""
    face = sp_bef_params["branches"]["face"]
    fm = face["metrics"]
    daisee_source = (
        "video gốc DAiSEE, MediaPipe 10 fps (~100 frame/clip), cùng hàm gộp cửa sổ 10s như trình duyệt"
        if DAISEE_VIDEO_FRAMES.exists()
        else "bản ảnh tĩnh DAiSEE, 5 frame/clip"
    )
    bm = sp_bef_params["branches"]["behavior"]["metrics"]
    qm = sp_bef_params["branches"]["quiz"]["metrics"]
    ev = sp_bef_params["evaluation"]
    comp = {c["variant"]: c for c in ev["comparison_table"]}
    proto = ev["virtual_learner_protocol"]
    fus = sp_bef_params["fusion"]

    def fmt_latency(v):
        return "—" if v is None else f"{v:.1f}s"

    comp_rows = "\n".join(
        f"| {c['variant']} | {c['auroc']:.4f} | {c['auprc']:.4f} | {c['ece']:.4f} | {c['brier']:.4f} | "
        f"{c['episode_recall']:.2f} | {fmt_latency(c['mean_detection_latency_sec'])} | {c['false_interventions_per_hour']:.2f} |"
        for c in ev["comparison_table"]
    )
    def fmt_sens_row(k, v):
        rng = v.get("threshold_range")
        rng_txt = f"({rng[0]:.4f}, {rng[1]:.4f}]" if rng else "—"
        eq = ", ".join(f"{t:.2f}" for t in v.get("equivalent_thresholds", [])) or "—"
        return f"| `{k}` | {rng_txt} | {eq} | {v['base_rate']:.4f} | {v['test_auroc']:.4f} | {v['test_auprc']:.4f} |"

    sens_rows = "\n".join(fmt_sens_row(k, v) for k, v in qm["threshold_sensitivity"].items())
    n_conf_levels = qm.get("label_confidence_distinct_values")
    sens_note = (
        f"confidence(CONFUSED) chỉ có {n_conf_levels} giá trị rời rạc, nên nhiều ngưỡng cho cùng một cách gán nhãn. "
        f"Bảng gộp các ngưỡng theo cách gán nhãn thực tế: mỗi dòng là một cách gán nhãn khác nhau, "
        f"mọi ngưỡng trong khoảng (lo, hi] cho cùng nhãn; cột \"Ngưỡng tương đương\" liệt kê các ngưỡng "
        f"{', '.join(f'{t:.2f}' for t in SENSITIVITY_THRESHOLDS)} rơi vào dòng đó, các dòng còn lại là ngưỡng lấy theo "
        f"phân vị {', '.join(f'{q:.2f}' for q in SENSITIVITY_QUANTILES)} của các giá trị dương."
        if n_conf_levels
        else ""
    )
    cand_rows = "\n".join(
        f"| `{k}` | {v['val_auroc']:.4f} | {v['val_auprc']:.4f} |" for k, v in fm["candidates_val"].items()
    )
    posthoc_key = [k for k in fm if k.startswith("posthoc_test_auroc_")][0]

    sp = comp["(d) SP-BEF (tuned on VL-val)"]
    findings = []
    for name in ("(a) Legacy Rule (avg, 3 consecutive >= 0.60)", "(b) Naive Probability Average", "(c) Logistic Stacking (trained on VL-val)"):
        o = comp[name]
        verdict = "cao hơn" if sp["auroc"] > o["auroc"] else ("bằng" if sp["auroc"] == o["auroc"] else "thấp hơn")
        findings.append(
            f"- So với **{name}**: AUROC SP-BEF {sp['auroc']:.4f} {verdict} {o['auroc']:.4f}; "
            f"Brier {sp['brier']:.4f} vs {o['brier']:.4f}; can thiệp sai/giờ {sp['false_interventions_per_hour']:.2f} vs {o['false_interventions_per_hour']:.2f}."
        )
    for c in ev["comparison_table"]:
        if c["variant"].startswith("Ablation"):
            delta = sp["auroc"] - c["auroc"]
            findings.append(f"- {c['variant']}: ΔAUROC (Full − ablation) = {delta:+.4f}, ΔBrier = {sp['brier'] - c['brier']:+.4f}.")
    findings_md = "\n".join(findings)

    report_md = f"""# Báo cáo Thực nghiệm V2.1 — SP-BEF

> Seed `{SEED}` · MediaPipe FaceLandmarker `0.10.14 (float16)` · Toàn bộ số liệu trong file này được sinh tự động bởi `run_sp_bef_pipeline.py` từ `models/sp_bef_params.json`.
> Bản V2.1 sửa các lỗi của V2.0: (1) nhãn DAiSEE (boredom/engagement/frustration) từng bị dùng làm đặc trưng khuôn mặt; (2) nhãn nhánh hành vi từng được sinh từ chính các đặc trưng; (3) tập DAiSEE từng bị lấy mẫu cân bằng 14/14 mỗi người; (4) baseline stacking dùng hệ số tự đặt; (5) ablation C2 bị mô phỏng bằng cách nhân LLR × 0.55. Các con số của V2.0 không còn giá trị.

## 1. Dữ liệu & chia tách

| Nhánh | Dữ liệu | train / val / test | Đơn vị chia | Base rate (train) | Base rate (test) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Khuôn mặt | DAiSEE, split chính thức, **toàn bộ clip** có mặt người | {fm['train_clips']} / {fm['val_clips']} / {fm['test_clips']} | subject ({fm['train_subjects']}/{fm['val_subjects']}/{fm['test_subjects']}) | {face['base_rate']:.4f} | {fm['test_base_rate']:.4f} |
| Hành vi | MOOCCubeX `user-video` + `user-problem` (phần đầu) + `course.json` + `exercise-problem` | {bm['train_sessions']} / {bm['val_sessions']} / {bm['test_sessions']} | user ({bm['unique_users_total']} user) | {sp_bef_params['branches']['behavior']['base_rate']:.4f} | {bm['test_base_rate']:.4f} |
| Quiz | ASSISTments 2017 (toàn bộ file) | {qm['train_rows']} / {qm['val_rows']} / {qm['test_rows']} | student ({qm['unique_students_total']} học sinh) | {sp_bef_params['branches']['quiz']['base_rate']:.4f} | {qm['test_base_rate']:.4f} |

Giao tập subject/user/student giữa train, val, test đều bằng ∅ (assert trong pipeline và `tests/test_sp_bef.py`).

## 2. Từng nhánh (đánh giá một lần trên test)

### 2.1 Khuôn mặt (DAiSEE)
Đặc trưng: chỉ lấy từ pixel qua MediaPipe (blendshape, EAR, tư thế đầu, độ trôi mũi, các điểm affect heuristic giống hệt trình duyệt). Không có cột nhãn nào.

Chọn bộ đặc trưng trên **validation**:

| Bộ đặc trưng | val AUROC | val AUPRC |
| :--- | :--- | :--- |
{cand_rows}

- Chọn: `{fm['selected_feature_set']}` ({len(face['feature_names'])} đặc trưng).
- Test: **AUROC = {fm['test_auroc']:.4f}** (95% CI {fm['test_auroc_ci95']}), AUPRC = {fm['test_auprc']:.4f} (luôn-âm = {fm['always_negative_auprc']:.4f}), ECE trước/sau hiệu chỉnh = {fm['test_ece_uncalibrated']:.4f} / {fm['test_ece_calibrated']:.4f}, Brier = {fm['test_brier']:.4f}.
- Ablation hậu kiểm (không dùng để chọn model): `{posthoc_key}` = {fm[posthoc_key]:.4f}.
- Nhận định: tín hiệu khuôn mặt trên DAiSEE **yếu** (AUROC gần 0.5–0.6). Nhãn DAiSEE gán cho cả clip 10s và có độ đồng thuận thấp. Nguồn đặc trưng: {daisee_source}.

### 2.2 Hành vi xem video (MOOCCubeX)
- Nhãn proxy (cố định trước khi train, không tính từ đặc trưng): {bm['label_definition']}.
- Test: **AUROC = {bm['test_auroc']:.4f}** (95% CI {bm['test_auroc_ci95']}), AUPRC = {bm['test_auprc']:.4f} (luôn-âm = {bm['always_negative_auprc']:.4f}), ECE = {bm['test_ece_calibrated']:.4f}, Brier = {bm['test_brier']:.4f}.
- Prior theo đoạn video (C3): `{sp_bef_params['segment_prior']['source']}`. Dữ liệu mở không có nhãn bối rối theo từng đoạn nên **C3 chưa được kiểm chứng** và không nằm trong ablation.

### 2.3 Quiz (ASSISTments)
- Nhãn: {qm['label_definition']}. Lưu ý: {qm['label_caveat']}.
- Test: **AUROC = {qm['test_auroc']:.4f}** (95% CI {qm['test_auroc_ci95']}), AUPRC = {qm['test_auprc']:.4f} (luôn-âm = {qm['always_negative_auprc']:.4f}), ECE = {qm['test_ece_calibrated']:.4f}, Brier = {qm['test_brier']:.4f}.

{sens_note}

| Ngưỡng nhãn | Khoảng ngưỡng cùng nhãn | Ngưỡng tương đương | Base rate (train) | Test AUROC | Test AUPRC |
| :--- | :--- | :--- | :--- | :--- | :--- |
{sens_rows}

## 3. Fusion — Virtual Learner (bán tổng hợp)

Nhánh tham gia fusion (CI 95% của AUROC > 0.5 trên cả validation và test; CI val/test: {', '.join(f"{k} {sp_bef_params['branches'][k]['metrics']['val_auroc_ci95']}/{sp_bef_params['branches'][k]['metrics']['test_auroc_ci95']}" for k in ev['branches_enabled'])}): {', '.join(f"{k}={'bật' if v else 'TẮT (w=0)'}" for k, v in ev['branches_enabled'].items())}.

Giao thức: {proto['n_learners']} học sinh ảo × {proto['n_steps_per_learner']} bước × {proto['dt_sec']:.0f}s. Trạng thái ẩn theo chuỗi Markov cố định (vào = {proto['p_enter_confused']}, giữ = {proto['p_keep_confused']}), **không phụ thuộc π_s**. Mỗi bước dùng đầu ra thật của từng nhánh có nhãn khớp trạng thái; clip khuôn mặt giữ {proto['face_clip_hold_steps']} bước, phiên hành vi giữ tối đa {proto['behavior_hold_steps']} bước (bằng chứng có tương quan theo thời gian). Quiz xuất hiện ở {proto['quiz_event_rate']:.0%} số bước; {proto['missing_camera_rate']:.0%} phiên tắt camera; {proto['degraded_camera_rate']:.0%} bước camera kém (giả định: LLR nhiễu, r_face thấp).

Siêu tham số SP-BEF (w_face={fus['w_face']}, w_beh={fus['w_beh']}, w_quiz={fus['w_quiz']}, a_keep={fus['hmm_keep_confused']}, theta_on/off={fus['theta_on']}/{fus['theta_off']} — ngưỡng chọn để recall cao nhất với ≤ {MAX_FALSE_INTERVENTIONS_PER_HOUR:.0f} can thiệp sai/giờ, cùng ngưỡng áp cho mọi phương pháp) và baseline stacking được **fit trên VL-val** (dựng từ tập val của các nhánh); bảng dưới là **VL-test** (dựng từ tập test).

| Phương pháp | AUROC | AUPRC | ECE | Brier | Recall đợt | Độ trễ TB | Can thiệp sai/giờ |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{comp_rows}

### Nhận xét (sinh tự động từ bảng)
{findings_md}

## 4. Giới hạn
1. Fusion được đánh giá trên dữ liệu **bán tổng hợp**. Giả định độc lập có điều kiện giữa các nhánh đúng theo cách dựng VL nên kết quả fusion là cận trên; cần dữ liệu thật đồng thời ba phương thức để khẳng định.
2. Lợi ích của C4 trong VL phụ thuộc giả định "camera kém ⇒ LLR nhiễu" do chính giao thức đặt ra.
3. Nhãn hành vi (sai bài tập cùng chương) và nhãn quiz (đầu ra detector) là nhãn yếu, không phải nhãn bối rối do người quan sát.
4. Nhánh khuôn mặt: kết quả trên DAiSEE thấp; không nên quảng bá là "phát hiện bối rối bằng camera" mà không có dữ liệu tốt hơn (OL-SFED, ConfusionBench khi công bố).
"""
    (BASE_DIR / "REPORT_V2.md").write_text(report_md, encoding="utf-8")


def main() -> None:
    t_start = time.time()
    print("=== [P0] Generating MANIFEST.json ===")
    manifest = generate_p0_manifest()

    print("=== [P2] Building/Loading DAiSEE MediaPipe 0.10.14 Features & Training Face Branch ===")
    df_daisee = build_or_load_daisee_features()
    face_cfg, face_val_df, face_test_df = run_p2_face_branch(df_daisee)
    print("Face Branch Metrics:", json.dumps(face_cfg["metrics"], indent=2))

    print("=== [P3] Training Behavior Branch on Real MOOCCubeX (chapter-exercise proxy label) ===")
    beh_cfg, prior_cfg, beh_val_df, beh_test_df = run_p3_behavior_and_prior()
    print("Behavior Branch Metrics:", json.dumps(beh_cfg["metrics"], indent=2))

    print("=== [P4] Training Quiz Branch on Real ASSISTments ===")
    quiz_cfg, quiz_val_df, quiz_test_df = run_p4_quiz_branch()
    print("Quiz Branch Metrics:", json.dumps(quiz_cfg["metrics"], indent=2))

    print("=== [P5] Running SP-BEF Fusion & Virtual Learner Evaluation ===")
    eval_res = run_p5_virtual_learner_evaluation(
        face_cfg, face_val_df, face_test_df,
        beh_cfg, beh_val_df, beh_test_df,
        quiz_cfg, quiz_val_df, quiz_test_df,
    )

    sp_bef_params = {
        "version": "2.1.0-sp-bef",
        "seed": SEED,
        "llr_clip": LLR_CLIP,
        "fusion": eval_res["fusion_config"],
        "segment_prior": prior_cfg,
        "branches": {
            "face": face_cfg,
            "behavior": beh_cfg,
            "quiz": quiz_cfg,
        },
        "evaluation": eval_res,
    }

    out_json = MODELS_DIR / "sp_bef_params.json"
    # The reading-gaze branch is trained separately (07_train_gaze_branch.py) on LMS logs; keep it.
    if out_json.exists():
        prev = json.loads(out_json.read_text(encoding="utf-8"))
        if "gaze" in prev.get("branches", {}):
            sp_bef_params["branches"]["gaze"] = prev["branches"]["gaze"]
            sp_bef_params["fusion"]["w_gaze"] = prev.get("fusion", {}).get("w_gaze", 0.0)
    out_json.write_text(json.dumps(sp_bef_params, indent=2), encoding="utf-8")

    # Copy sp_bef_params.json to Go Backend and Web Frontend
    go_models_dir = BASE_DIR.parent / "lms-api" / "internal" / "service" / "models"
    go_models_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_json, go_models_dir / "sp_bef_params.json")

    web_cv_dir = BASE_DIR.parent / "lms-web" / "src" / "features" / "confusion-cv"
    web_cv_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_json, web_cv_dir / "sp_bef_params.json")

    print("=== [P7] Generating Golden Parity Files & REPORT_V2.md ===")
    generate_golden_files(sp_bef_params, df_daisee)
    # Go and web parity tests read their own copies of the golden files.
    for name in ("parity_vectors.json", "video_features_golden.json"):
        shutil.copy2(GOLDEN_DIR / name, web_cv_dir / "__tests__" / name)
    shutil.copy2(GOLDEN_DIR / "parity_vectors.json", go_models_dir / "parity_vectors.json")
    write_report_v2(manifest, sp_bef_params)

    print(f"=== Completed SP-BEF V2 Pipeline in {time.time() - t_start:.2f}s ===")


if __name__ == "__main__":
    main()
