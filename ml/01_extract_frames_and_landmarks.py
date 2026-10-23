"""
Step 01 — Extract 260x260 Face Crops and MediaPipe 478 3D Landmarks from DAiSEE Dataset.

Pipeline:
1. Scans DAiSEE video clips across Train, Validation, and Test splits (9,068 clips, 112 subjects).
2. Uniformly samples 10 frames per 10-second clip and crops 260x260 padded face regions.
3. Labels binary confusion using DAiSEE ordinal scale (Confusion >= 2 -> is_confused = 1).
4. Extracts 478 3D facial landmarks via MediaPipe FaceLandmarker and normalizes coordinates
   relative to the nose tip (landmark index 1) for translation invariance.
5. Saves `frame_labels.csv` and compressed `landmarks.npz` (`[N_frames, 478, 3]`).
"""

import argparse
import os
import urllib.request
import warnings
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm

from face_crop_utils import detect_and_crop_face

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).parent
DEFAULT_DAISEE_ROOT = os.environ.get("DAISEE_ROOT", "D:/DAiSEE/DAiSEE")
OUTPUT_DIR = BASE_DIR / "frames_v2"
CSV_PATH = OUTPUT_DIR / "frame_labels.csv"
OUTPUT_NPZ = OUTPUT_DIR / "landmarks.npz"
TASK_PATH = BASE_DIR / "face_landmarker.task"

FRAME_SIZE = (260, 260)
FRAMES_PER_CLIP = 10
CONFUSION_THRESHOLD = 2
NOSE_TIP_INDEX = 1


def extract_frames_from_clip(video_path: str, output_path: str, n_frames: int = FRAMES_PER_CLIP):
    """Samples n_frames uniformly across a video clip and saves 260x260 cropped faces."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return []

    indices = np.linspace(0, total_frames - 1, n_frames, dtype=int)
    saved = []

    for i, idx in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue

        face = detect_and_crop_face(frame, FRAME_SIZE)
        fname = f"{Path(video_path).stem}_f{i:02d}.jpg"
        fpath = os.path.join(output_path, fname)
        cv2.imwrite(fpath, face, [cv2.IMWRITE_JPEG_QUALITY, 95])
        saved.append(fpath)

    cap.release()
    return saved


def process_split(daisee_root: str, split_name: str):
    """Processes one split (Train / Validation / Test) of DAiSEE."""
    dataset_dir = os.path.join(daisee_root, "DataSet")
    labels_dir = os.path.join(daisee_root, "Labels")
    split_dir = os.path.join(dataset_dir, split_name)
    if not os.path.exists(split_dir):
        print(f"  [WARN] {split_dir} not found, skipping split '{split_name}'")
        return []

    labels_df = pd.read_csv(f"{labels_dir}/{split_name}Labels.csv")
    labels_df.columns = labels_df.columns.str.strip()
    label_map = {}
    for _, row in labels_df.iterrows():
        clip_id = str(row["ClipID"]).replace(".avi", "").replace(".mp4", "")
        label_map[clip_id] = {
            "confusion": int(row["Confusion"]),
            "boredom": int(row["Boredom"]),
            "engagement": int(row["Engagement"]),
            "frustration": int(row["Frustration"]),
        }

    out_dir = OUTPUT_DIR / split_name.lower()
    os.makedirs(out_dir / "confused", exist_ok=True)
    os.makedirs(out_dir / "not_confused", exist_ok=True)

    records = []
    processed = 0
    skipped = 0
    confusion_dist = {0: 0, 1: 0, 2: 0, 3: 0}

    subjects = sorted(
        s for s in os.listdir(split_dir) if os.path.isdir(os.path.join(split_dir, s))
    )

    for si, subject in enumerate(subjects):
        subject_dir = os.path.join(split_dir, subject)
        clips = sorted(
            c for c in os.listdir(subject_dir) if os.path.isdir(os.path.join(subject_dir, c))
        )

        for clip_folder in clips:
            clip_dir = os.path.join(subject_dir, clip_folder)
            video_files = [
                f for f in os.listdir(clip_dir) if f.endswith((".avi", ".mp4"))
            ]
            if not video_files or clip_folder not in label_map:
                skipped += 1
                continue

            labels = label_map[clip_folder]
            confusion_dist[labels["confusion"]] += 1

            is_confused = 1 if labels["confusion"] >= CONFUSION_THRESHOLD else 0
            class_dir = "confused" if is_confused else "not_confused"

            video_path = os.path.join(clip_dir, video_files[0])
            frame_out = str(out_dir / class_dir)
            frames = extract_frames_from_clip(video_path, frame_out)

            for fp in frames:
                records.append({
                    "frame_path": fp,
                    "clip_id": clip_folder,
                    "subject": subject,
                    "is_confused": is_confused,
                    **labels,
                })
            processed += 1

        if (si + 1) % 5 == 0 or si == len(subjects) - 1:
            print(
                f"  [{split_name}] {si+1}/{len(subjects)} subjects | "
                f"{processed} clips processed, {skipped} skipped"
            )

    print(f"  Confusion distribution ({split_name}): {confusion_dist}")
    return records


def normalize_nose_centered(landmarks: np.ndarray) -> np.ndarray:
    """
    Centers 478x3 landmarks around the nose tip (index 1) and scales by inter-ocular
    or max Euclidean extent for translation/scale invariance.
    """
    nose_origin = landmarks[NOSE_TIP_INDEX : NOSE_TIP_INDEX + 1, :]  # (1, 3)
    centered = landmarks - nose_origin
    scale = np.linalg.norm(centered, axis=-1).max()
    if scale > 1e-6:
        centered = centered / scale
    return centered.astype(np.float32)


def extract_mediapipe_landmarks(csv_path: Path = CSV_PATH, output_npz: Path = OUTPUT_NPZ):
    """Extracts 478 3D landmarks per frame using MediaPipe FaceLandmarker and normalizes at index 1."""
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not csv_path.exists():
        print(f"  [WARN] {csv_path} not found. Run frame extraction first.")
        return

    if not TASK_PATH.exists():
        print("  Downloading MediaPipe face_landmarker.task...")
        url = (
            "https://storage.googleapis.com/mediapipe-models/"
            "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        )
        urllib.request.urlretrieve(url, str(TASK_PATH))

    df = pd.read_csv(csv_path)
    grouped = df.groupby("clip_id")
    landmarks_dict = {}

    base_options = python.BaseOptions(model_asset_path=str(TASK_PATH))
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=False,
        num_faces=1,
    )

    print("  Initializing MediaPipe FaceLandmarker (478 3D landmarks, nose-centered at index 1)...")
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for clip_id, group in tqdm(grouped, desc="Extracting 478x3 Landmarks"):
            group = group.sort_values("frame_path")
            frames = group["frame_path"].tolist()

            clip_landmarks = []
            last_valid_lm = np.zeros((478, 3), dtype=np.float32)

            for fp in frames:
                if not os.path.exists(fp):
                    clip_landmarks.append(last_valid_lm)
                    continue

                image = cv2.imread(fp)
                if image is None:
                    clip_landmarks.append(last_valid_lm)
                    continue

                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                result = landmarker.detect(mp_image)

                if not result.face_landmarks:
                    clip_landmarks.append(last_valid_lm)
                else:
                    raw_lm = np.array(
                        [[lm.x, lm.y, lm.z] for lm in result.face_landmarks[0]],
                        dtype=np.float32,
                    )
                    norm_lm = normalize_nose_centered(raw_lm)
                    last_valid_lm = norm_lm
                    clip_landmarks.append(norm_lm)

            landmarks_dict[str(clip_id)] = np.array(clip_landmarks, dtype=np.float32)

    np.savez_compressed(output_npz, **landmarks_dict)
    print(f"  Saved {len(landmarks_dict)} clip landmark tensors to {output_npz}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract 260x260 Face Crops and 478x3 MediaPipe Landmarks from DAiSEE"
    )
    parser.add_argument("--daisee-root", default=DEFAULT_DAISEE_ROOT, help="Path to DAiSEE root")
    parser.add_argument("--landmarks-only", action="store_true", help="Only run MediaPipe landmark extraction")
    args = parser.parse_args()

    print("=" * 68)
    print("  STEP 01: DAiSEE 260x260 FACE CROPS & 478x3 MEDIAPIPE LANDMARKS")
    print(f"  Frame size: {FRAME_SIZE} | Frames/clip: {FRAMES_PER_CLIP} | Nose index: {NOSE_TIP_INDEX}")
    print("=" * 68)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not args.landmarks_only:
        all_records = []
        for split in ["Train", "Test", "Validation"]:
            print(f"\nProcessing {split} split...")
            records = process_split(args.daisee_root, split)
            all_records.extend(records)

        if all_records:
            df = pd.DataFrame(all_records)
            df.to_csv(CSV_PATH, index=False)
            print(f"\nSaved {len(df)} frame records to {CSV_PATH}")

    if CSV_PATH.exists():
        extract_mediapipe_landmarks(CSV_PATH, OUTPUT_NPZ)
    else:
        print(f"\n[INFO] Dataset directory '{args.daisee_root}' not mounted locally.")
        print("       Provide --daisee-root /path/to/DAiSEE when running on raw video clips.")


if __name__ == "__main__":
    main()
