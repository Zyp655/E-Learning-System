"""
Extract per-frame MediaPipe telemetry from the ORIGINAL DAiSEE videos (10 s clips) at a fixed sampling rate.

Output: data/daisee_video_frames_<fps>fps.npz with, for every clip,
  - clip_ids, subjects, splits, labels (Boredom/Engagement/Confusion/Frustration from Labels/AllLabels.csv)
  - offsets into a flat per-frame matrix `frames` [n_frames_total, len(FRAME_COLUMNS)]
Frames without a detected face are kept with detected = 0 so that face-presence features stay correct.

Usage: .venv/bin/python extract_daisee_video_frames.py --root data/raw/daisee_video/DAiSEE --fps 10
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import time
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from run_sp_bef_pipeline import DATA_DIR, RAW_DIR, extract_single_frame_telemetry

BLENDSHAPE_NAMES = [
    "_neutral", "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
    "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft",
    "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft",
    "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "jawForward", "jawLeft",
    "jawOpen", "jawRight", "mouthClose", "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft",
    "mouthFrownRight", "mouthFunnel", "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft",
    "mouthPressRight", "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
    "mouthShrugUpper", "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
    "mouthUpperUpLeft", "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight",
]
DERIVED_COLUMNS = [
    "detected", "luminance", "brow_furrow", "eye_squint", "mouth_tension", "ear",
    "head_yaw_deg", "head_pitch_deg", "nose_x", "nose_y", "iod",
]
FRAME_COLUMNS = DERIVED_COLUMNS + [f"bs_{n}" for n in BLENDSHAPE_NAMES]
VIDEO_EXTS = (".avi", ".mp4")


def _frame_row(tel: Dict) -> List[float]:
    row = [1.0 if tel.get("detected") else 0.0] + [float(tel.get(k, 0.0)) for k in DERIVED_COLUMNS[1:]]
    bs = tel.get("blendshapes", {}) or {}
    return row + [float(bs.get(n, 0.0)) for n in BLENDSHAPE_NAMES]


def _worker(args: Tuple[List[Tuple[str, str]], float]) -> List[Tuple[str, np.ndarray]]:
    items, fps = args
    landmarker = mp_vision.FaceLandmarker.create_from_options(
        mp_vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(RAW_DIR / "face_landmarker.task")),
            output_face_blendshapes=True,
            num_faces=1,
        )
    )
    out = []
    for clip_id, path in items:
        cap = cv2.VideoCapture(path)
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step = max(1, int(round(src_fps / fps)))
        rows, idx = [], 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if idx % step == 0:
                rows.append(_frame_row(extract_single_frame_telemetry(landmarker, bgr)))
            idx += 1
        cap.release()
        out.append((clip_id, np.asarray(rows, dtype=np.float32).reshape(-1, len(FRAME_COLUMNS))))
    landmarker.close()
    return out


def find_clips(root: Path) -> pd.DataFrame:
    recs = []
    for dirpath, _, files in os.walk(root):
        for f in files:
            if f.lower().endswith(VIDEO_EXTS):
                p = Path(dirpath) / f
                parts = [x.lower() for x in p.parts]
                split = "train" if "train" in parts else "validation" if "validation" in parts else "test" if "test" in parts else None
                if split is None:
                    continue
                recs.append({"ClipID": f, "clip_stem": p.stem, "subject": p.parent.parent.name, "split": split, "path": str(p)})
    return pd.DataFrame(recs)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--fps", type=float, default=10.0)
    ap.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 4))
    args = ap.parse_args()

    root = Path(args.root)
    labels = pd.read_csv(next(root.rglob("AllLabels.csv")))
    labels.columns = [c.strip() for c in labels.columns]
    clips = find_clips(root)
    clips = clips.merge(labels, on="ClipID", how="inner").sort_values("clip_stem").reset_index(drop=True)
    print(f"{len(clips)} labelled clips found ({clips['split'].value_counts().to_dict()})")

    items = list(zip(clips["clip_stem"], clips["path"]))
    chunks = [(items[i :: args.workers], args.fps) for i in range(args.workers)]
    t0 = time.time()
    by_clip: Dict[str, np.ndarray] = {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(_worker, chunks):
            by_clip.update(res)
    print(f"extracted in {time.time() - t0:.0f}s")

    mats = [by_clip[c] for c in clips["clip_stem"]]
    offsets = np.cumsum([0] + [len(m) for m in mats])
    out = DATA_DIR / f"daisee_video_frames_{int(args.fps)}fps.npz"
    np.savez_compressed(
        out,
        frames=np.concatenate(mats, axis=0),
        offsets=offsets,
        columns=np.array(FRAME_COLUMNS),
        clip_ids=np.array(clips["clip_stem"].tolist(), dtype=str),
        subjects=np.array(clips["subject"].tolist(), dtype=str),
        splits=np.array(clips["split"].tolist(), dtype=str),
        boredom=clips["Boredom"].astype(np.int16).values,
        engagement=clips["Engagement"].astype(np.int16).values,
        confusion=clips["Confusion"].astype(np.int16).values,
        frustration=clips["Frustration"].astype(np.int16).values,
    )
    print(f"saved {out} ({offsets[-1]} frames)")


if __name__ == "__main__":
    main()
