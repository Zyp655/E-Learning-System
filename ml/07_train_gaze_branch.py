"""
Reading-gaze branch of SP-BEF (webcam iris tracking in the lms-web Reading View).

Adapts the eye-tracking half of Zhuang et al. 2025, "Detecting Reading-Induced Confusion Using EEG and
Eye Tracking" (arXiv:2508.14442) to a plain webcam: per-paragraph reading features instead of word-level
fixations, and no EEG. No open dataset has webcam gaze + reading-confusion labels, so the branch is trained
only on reading logs collected by the LMS itself (`reading_gaze_samples` table) from two label sources:

- `designed_stimulus`: the gaze calibration reading lesson, built like the paper's stimuli (coherent control
  paragraphs vs. factual-confusion paragraphs with shuffled phrases / false facts and contextual-confusion
  paragraphs of dense domain jargon). The label comes from the design, not from the reader.
- `self_report`: "Is this paragraph hard?" asked after a random 50% of finished paragraphs, independent of
  the model's own output so the label set is not biased towards suspected confusion.

Usage:
    .venv/bin/python 07_train_gaze_branch.py --init                    # ship the untrained branch (w_gaze = 0)
    .venv/bin/python 07_train_gaze_branch.py --logs samples.jsonl      # train + validate on collected logs
    .venv/bin/python 07_train_gaze_branch.py --golden-only             # regenerate gaze parity vectors

Log rows (JSONL, or CSV with the same columns): user_id, label_source, stimulus_type, self_report_level,
r_gaze and the 6 GAZE_FEATURES. Designed stimuli: control = 0, factual / contextual = 1. Self-reports:
level 1 = clear (0), 3/4 = confused (1); level 2 ("slightly unclear") is ambiguous and dropped.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from run_sp_bef_pipeline import (
    BASE_DIR,
    GOLDEN_DIR,
    MODELS_DIR,
    SEED,
    _linear_branch_cfg,
    bootstrap_auroc_ci,
    fit_isotonic_knots,
)
from sp_bef.core import (
    GAZE_FEATURES,
    compute_ece,
    compute_gaze_reliability,
    logit,
    predict_linear_calibrated_branch,
    sp_bef_step,
)

PARAMS_PATH = MODELS_DIR / "sp_bef_params.json"
GO_MODELS_DIR = BASE_DIR.parent / "lms-api" / "internal" / "service" / "models"
WEB_CV_DIR = BASE_DIR.parent / "lms-web" / "src" / "features" / "confusion-cv"
GAZE_GOLDEN_NAME = "gaze_parity_vectors.json"

# Below this the bootstrap CI is too wide to tell a real signal from noise; the branch stays off.
MIN_USERS = 15
MIN_SAMPLES = 200
# Calibrated LLR is already reliability-weighted per window, so an enabled branch enters at full weight.
ENABLED_W_GAZE = 1.0
UNTRAINED_BASE_RATE = 0.15


def untrained_gaze_branch() -> Dict:
    """All-zero coefficients with intercept = logit(base_rate): the branch always returns LLR 0."""
    n = len(GAZE_FEATURES)
    return {
        "feature_names": list(GAZE_FEATURES),
        "scaler_mean": [0.0] * n,
        "scaler_scale": [1.0] * n,
        "coefficients": [0.0] * n,
        "intercept": round(logit(UNTRAINED_BASE_RATE), 6),
        "base_rate": UNTRAINED_BASE_RATE,
        "isotonic_xp": [],
        "isotonic_fp": [],
        "trained": False,
        "enabled": False,
        "source": "untrained: collect reading_gaze_samples, then run ml/07_train_gaze_branch.py --logs",
    }


LABEL_SOURCES = ("designed_stimulus", "self_report")


def load_reading_logs(path: Path, label_source: str = "all") -> pd.DataFrame:
    df = pd.read_json(path, lines=True) if path.suffix in (".jsonl", ".json") else pd.read_csv(path)
    required = ["user_id", "label_source", "stimulus_type", "self_report_level", "r_gaze", *GAZE_FEATURES]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"reading log is missing columns: {missing}")
    if label_source != "all":
        df = df[df["label_source"] == label_source]

    designed = (df["label_source"] == "designed_stimulus") & df["stimulus_type"].isin(["control", "factual", "contextual"])
    reported = (df["label_source"] == "self_report") & df["self_report_level"].isin([1, 3, 4])
    df = df[(designed | reported) & (df["r_gaze"] > 0)].copy()
    df["is_confused"] = np.where(
        df["label_source"] == "designed_stimulus",
        df["stimulus_type"].isin(["factual", "contextual"]),
        df["self_report_level"] >= 3,
    ).astype(int)
    df[GAZE_FEATURES] = df[GAZE_FEATURES].astype(np.float64).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df.reset_index(drop=True)


def _split_by_user(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Subject-wise 60/20/20 split, train ∩ val ∩ test = ∅ on user_id (same rule as the other branches)."""
    outer = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    trval_idx, test_idx = next(outer.split(df, groups=df["user_id"]))
    trval = df.iloc[trval_idx]
    inner = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=SEED)
    tr_idx, val_idx = next(inner.split(trval, groups=trval["user_id"]))
    return trval.iloc[tr_idx], trval.iloc[val_idx], df.iloc[test_idx]


def train_gaze_branch(df: pd.DataFrame) -> Dict:
    n_users = int(df["user_id"].nunique())
    if n_users < MIN_USERS or len(df) < MIN_SAMPLES or df["is_confused"].nunique() < 2:
        cfg = untrained_gaze_branch()
        cfg["source"] = (
            f"not enough labelled reading logs ({len(df)} samples / {n_users} users; "
            f"need >= {MIN_SAMPLES} / {MIN_USERS} with both labels)"
        )
        return cfg

    train_df, val_df, test_df = _split_by_user(df)
    for part in (val_df, test_df):
        if part["is_confused"].nunique() < 2:
            cfg = untrained_gaze_branch()
            cfg["source"] = "validation or test split has a single label; collect more reading logs"
            return cfg

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=0.1, max_iter=2000, random_state=SEED)),
    ])
    pipe.fit(train_df[GAZE_FEATURES].values, train_df["is_confused"].values)

    val_raw = pipe.predict_proba(val_df[GAZE_FEATURES].values)[:, 1]
    xp, fp = fit_isotonic_knots(val_raw, val_df["is_confused"].values)
    base_rate = float(train_df["is_confused"].mean())
    cfg = _linear_branch_cfg(pipe, GAZE_FEATURES, base_rate, xp, fp)

    def _cal(part: pd.DataFrame) -> np.ndarray:
        return np.array([predict_linear_calibrated_branch(list(r), cfg)[1] for r in part[GAZE_FEATURES].values])

    val_cal, test_cal = _cal(val_df), _cal(test_df)
    y_val, y_test = val_df["is_confused"].values, test_df["is_confused"].values
    val_ci = bootstrap_auroc_ci(y_val, val_cal)
    test_ci = bootstrap_auroc_ci(y_test, test_cal)
    # Same gate as the other branches: CI of AUROC above chance on both validation and test.
    enabled = val_ci[0] > 0.5 and test_ci[0] > 0.5

    cfg.update({
        "trained": True,
        "enabled": bool(enabled),
        "source": "reading_gaze_samples (lms-web Reading View, webcam iris gaze, self-report labels)",
        "metrics": {
            "samples": int(len(df)),
            "users": n_users,
            "train_rows": int(len(train_df)),
            "val_rows": int(len(val_df)),
            "test_rows": int(len(test_df)),
            "val_auroc": round(float(roc_auc_score(y_val, val_cal)), 4),
            "test_auroc": round(float(roc_auc_score(y_test, test_cal)), 4),
            "val_auroc_ci95": val_ci,
            "test_auroc_ci95": test_ci,
            "test_ece": round(compute_ece(y_test, test_cal), 4),
            "test_base_rate": round(float(y_test.mean()), 4),
            "test_auroc_by_label_source": {
                src: round(float(roc_auc_score(y_test[m], test_cal[m])), 4)
                for src in LABEL_SOURCES
                for m in [(test_df["label_source"] == src).values]
                if m.sum() > 0 and len(set(y_test[m])) == 2
            },
        },
    })
    return cfg


def write_gaze_branch(cfg: Dict) -> None:
    params = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
    params["branches"]["gaze"] = cfg
    params["fusion"]["w_gaze"] = ENABLED_W_GAZE if cfg.get("enabled") else 0.0
    PARAMS_PATH.write_text(json.dumps(params, indent=2), encoding="utf-8")
    shutil.copy2(PARAMS_PATH, GO_MODELS_DIR / "sp_bef_params.json")
    shutil.copy2(PARAMS_PATH, WEB_CV_DIR / "sp_bef_params.json")


# Fixed branch + fusion used only by the parity vectors, so Python / TypeScript / Go are checked on a
# non-trivial gaze term even while the shipped branch is untrained and w_gaze = 0.
GOLDEN_GAZE_BRANCH = {
    "feature_names": list(GAZE_FEATURES),
    "scaler_mean": [1.0, 0.5, 1.5, 1.0, 0.45, 2.5],
    "scaler_scale": [0.45, 0.8, 2.0, 0.4, 0.15, 1.0],
    "coefficients": [0.55, 0.38, 0.42, 0.3, 0.33, -0.12],
    "intercept": -1.6,
    "base_rate": 0.18,
    "isotonic_xp": [0.0, 0.25, 0.5, 0.75, 1.0],
    "isotonic_fp": [0.02, 0.2, 0.47, 0.71, 0.97],
}
GOLDEN_FUSION = {
    "hmm_keep_confused": 0.6,
    "hmm_beta0": 0.04,
    "hmm_beta1": 0.45,
    "w_face": 0.7,
    "w_beh": 0.0,
    "w_quiz": 1.0,
    "w_gaze": 0.8,
    "theta_on": 0.4,
    "theta_off": 0.25,
    "min_hold_sec": 10.0,
    "cooldown_sec": 180.0,
}


def write_gaze_golden(n_cases: int = 16) -> List[Dict]:
    rng = np.random.RandomState(SEED + 7)
    vectors = []
    for i in range(n_cases):
        feats = [
            round(float(rng.uniform(0.3, 3.0)), 4),   # dwell_ratio
            float(rng.randint(0, 4)),                 # reread_count
            round(float(rng.uniform(0.0, 8.0)), 4),   # para_regression_rate (per 100 words)
            round(float(rng.uniform(0.2, 2.5)), 4),   # sweep_ratio
            round(float(rng.uniform(0.1, 0.95)), 4),  # gaze_transition_entropy
            round(float(rng.uniform(0.5, 5.0)), 4),   # saccade_rate (per second)
        ]
        rel_in = {
            # Case 0 is uncalibrated and case 1 has no face, so r_gaze = 0 is covered.
            "calibration_error_norm": 0.0 if i == 0 else round(float(rng.uniform(0.2, 1.8)), 4),
            "face_present_ratio": 0.0 if i == 1 else round(float(rng.uniform(0.5, 1.0)), 4),
            "on_text_ratio": round(float(rng.uniform(0.2, 1.0)), 4),
            "head_yaw_abs_deg": round(float(rng.uniform(0.0, 40.0)), 2),
        }
        state = {
            "prev_posterior": round(float(rng.uniform(0.05, 0.8)), 4),
            "segment_prior": round(float(rng.uniform(0.05, 0.5)), 4),
            "llr_face": round(float(rng.uniform(-2.0, 2.0)), 4),
            "r_face": round(float(rng.uniform(0.0, 1.0)), 4),
            "llr_quiz": round(float(rng.uniform(-2.0, 2.0)), 4),
            "r_quiz": float(rng.randint(0, 2)),
            "prev_high_sec": float(rng.choice([0.0, 5.0, 10.0])),
            "prev_intervening": bool(rng.randint(0, 2)),
            "cooldown_remaining_sec": float(rng.choice([0.0, 0.0, 60.0])),
            "dt_sec": 5.0,
        }
        raw_p, cal_p, llr = predict_linear_calibrated_branch(feats, GOLDEN_GAZE_BRANCH)
        r_gaze = compute_gaze_reliability(**rel_in)
        step = sp_bef_step(
            state["prev_posterior"], state["segment_prior"],
            state["llr_face"], state["r_face"], 0.0, 0.0, state["llr_quiz"], state["r_quiz"],
            GOLDEN_FUSION, state["prev_high_sec"], state["prev_intervening"],
            state["cooldown_remaining_sec"], state["dt_sec"],
            llr_gaze=llr, r_gaze=r_gaze,
        )
        vectors.append({
            "case_id": f"gaze_{i:02d}",
            "inputs": {"gaze_features": feats, **rel_in, **state},
            "expected": {
                "gaze_raw_prob": raw_p,
                "gaze_cal_prob": cal_p,
                "gaze_llr": llr,
                "r_gaze": r_gaze,
                "step": step,
            },
        })

    doc = {"branch": GOLDEN_GAZE_BRANCH, "fusion": GOLDEN_FUSION, "vectors": vectors}
    out = GOLDEN_DIR / GAZE_GOLDEN_NAME
    out.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    shutil.copy2(out, WEB_CV_DIR / "__tests__" / GAZE_GOLDEN_NAME)
    shutil.copy2(out, GO_MODELS_DIR / GAZE_GOLDEN_NAME)
    return vectors


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--logs", type=Path, help="JSONL/CSV export of reading_gaze_samples")
    ap.add_argument("--label-source", choices=["all", *LABEL_SOURCES], default="all")
    ap.add_argument("--init", action="store_true", help="write the untrained gaze branch (w_gaze = 0)")
    ap.add_argument("--golden-only", action="store_true", help="only regenerate gaze parity vectors")
    args = ap.parse_args()

    if not args.golden_only:
        if args.logs:
            cfg = train_gaze_branch(load_reading_logs(args.logs, args.label_source))
        elif args.init:
            cfg = untrained_gaze_branch()
        else:
            ap.error("pass --logs, --init or --golden-only")
        write_gaze_branch(cfg)
        print(json.dumps({k: cfg.get(k) for k in ("trained", "enabled", "source", "metrics")}, indent=2))

    write_gaze_golden()
    print(f"wrote {GOLDEN_DIR / GAZE_GOLDEN_NAME}")


if __name__ == "__main__":
    main()
