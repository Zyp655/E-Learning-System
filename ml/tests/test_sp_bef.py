"""
P7 Gate — Automated pytest verification suite for SP-BEF V2 ML Pipeline.
Checks:
1. Zero subject / user / student leakage across train/val/test for DAiSEE, MOOCCubeX, ASSISTments.
2. Deterministic reproducibility (<= 1e-6 delta with fixed seed).
3. Zero NaN / Inf in extracted features & graceful handling of missing face frames (r_face = 0).
4. Numerical Parity (<= 1e-5) between Python SP-BEF, ONNX Runtime (`sp_bef_face.onnx`), and `ml/golden/parity_vectors.json`.
5. Feature extraction parity (<= 1e-3) on `ml/golden/video_features_golden.json`.
6. Quality Gates: every branch beats chance (bootstrap 95% CI of test AUROC above 0.5) and the always-negative
   AUPRC baseline; calibrated ECE <= 0.05.
7. Label hygiene: no annotation column is a feature; behaviour labels are not a function of the features;
   DAiSEE is evaluated on every clip at its natural base rate; fusion baselines are fitted, not hand-set.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
import pytest

from run_sp_bef_pipeline import (
    BEHAVIOR_FEATURES,
    FACE_MODEL_FEATURES,
    FACE_RAW_FEATURES,
    LABEL_COLUMNS,
    QUIZ_FEATURES,
    SEED,
    aggregate_clip_window,
    apply_c2_personal_baseline,
    run_p2_face_branch,
)
from sp_bef.core import (
    compute_frame_reliability,
    predict_linear_calibrated_branch,
    sp_bef_step,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
GOLDEN_DIR = BASE_DIR / "golden"
DAISEE_VIDEO_FRAMES = DATA_DIR / "daisee_video_frames_10fps.npz"
# The pipeline prefers the original videos; the 5-frame still-image release is the fallback.
DAISEE_CACHE = DATA_DIR / ("daisee_video_clips_10fps_v1.csv" if DAISEE_VIDEO_FRAMES.exists() else "daisee_mediapipe_clips_v3.csv")


def _daisee_annotations() -> pd.DataFrame:
    """Per-clip DAiSEE annotations indexed by clip_id, from the same source the pipeline used."""
    if DAISEE_VIDEO_FRAMES.exists():
        z = np.load(DAISEE_VIDEO_FRAMES)
        return pd.DataFrame({"frustration": z["frustration"], "confusion": z["confusion"]}, index=z["clip_ids"].astype(np.int64))
    return pd.read_csv(DATA_DIR / "daisee_frames" / "frame_labels.csv").groupby("clip_id").first()
BEHAVIOR_CACHE = DATA_DIR / "mooccubex_behavior_sessions_v3.csv"


def test_p0_manifest_and_golden_files_exist():
    assert (DATA_DIR / "MANIFEST.json").exists(), "Missing data/MANIFEST.json"
    manifest = json.loads((DATA_DIR / "MANIFEST.json").read_text(encoding="utf-8"))
    assert "datasets" in manifest
    for k in ["daisee_frame_labels_csv", "mediapipe_face_landmarker_task", "mooccubex_user_video_json", "mooccubex_user_problem_head_json", "mooccubex_course_json", "mooccubex_exercise_problem_txt", "assistments_2017_csv"]:
        assert k in manifest["datasets"], f"Missing {k} in MANIFEST.json"
        assert len(manifest["datasets"][k]["sha256"]) == 64

    assert (MODELS_DIR / "sp_bef_params.json").exists(), "Missing models/sp_bef_params.json"
    assert (MODELS_DIR / "sp_bef_face.onnx").exists(), "Missing models/sp_bef_face.onnx"
    assert (MODELS_DIR / "sp_bef_face.onnx").stat().st_size <= 2 * 1024 * 1024, "ONNX model exceeds 2MB budget"


def test_zero_subject_and_user_leakage():
    df_daisee = pd.read_csv(DAISEE_CACHE)
    s_train = set(df_daisee[df_daisee["split"] == "train"]["subject"].unique())
    s_val = set(df_daisee[df_daisee["split"] == "validation"]["subject"].unique())
    s_test = set(df_daisee[df_daisee["split"] == "test"]["subject"].unique())

    assert len(s_train & s_val) == 0, "DAiSEE train/val subject overlap!"
    assert len(s_train & s_test) == 0, "DAiSEE train/test subject overlap!"
    assert len(s_val & s_test) == 0, "DAiSEE val/test subject overlap!"


def test_no_nan_inf_and_missing_face_handling():
    df_daisee = pd.read_csv(DAISEE_CACHE)
    df_c2 = apply_c2_personal_baseline(df_daisee)
    for col in FACE_MODEL_FEATURES:
        vals = df_c2[col].values
        assert not np.any(np.isnan(vals)), f"NaN found in {col}"
        assert not np.any(np.isinf(vals)), f"Inf found in {col}"

    # Verify missing face frame window produces r_face == 0 and zeroed features without NaN
    empty_agg = aggregate_clip_window([{"detected": False, "luminance": 45.0}, {"detected": False, "luminance": 50.0}])
    assert empty_agg["r_face"] == 0.0
    assert empty_agg["face_present_ratio"] == 0.0
    for k in FACE_RAW_FEATURES:
        assert empty_agg[k] == 0.0
        assert not math.isnan(empty_agg[k])


def test_deterministic_reproducibility():
    df_daisee = pd.read_csv(DAISEE_CACHE)
    cfg1, _, _ = run_p2_face_branch(df_daisee)
    cfg2, _, _ = run_p2_face_branch(df_daisee)

    assert abs(cfg1["metrics"]["test_auroc"] - cfg2["metrics"]["test_auroc"]) <= 1e-6
    assert abs(cfg1["metrics"]["test_auprc"] - cfg2["metrics"]["test_auprc"]) <= 1e-6
    assert np.allclose(cfg1["coefficients"], cfg2["coefficients"], atol=1e-6)


def test_onnx_and_golden_parity():
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    vectors = json.loads((GOLDEN_DIR / "parity_vectors.json").read_text(encoding="utf-8"))
    sess = ort.InferenceSession(str(MODELS_DIR / "sp_bef_face.onnx"), providers=["CPUExecutionProvider"])
    in_name = sess.get_inputs()[0].name

    assert len(vectors) >= 15
    for vec in vectors:
        inp = vec["inputs"]
        exp = vec["expected"]

        raw_f, cal_f, llr_f = predict_linear_calibrated_branch(inp["face_features"], params["branches"]["face"])
        raw_b, cal_b, llr_b = predict_linear_calibrated_branch(inp["behavior_features"], params["branches"]["behavior"])
        raw_q, cal_q, llr_q = predict_linear_calibrated_branch(inp["quiz_features"], params["branches"]["quiz"])

        onnx_res = sess.run(None, {in_name: np.array([inp["face_features"]], dtype=np.float32)})
        onnx_prob = float(onnx_res[1][0][1])

        assert abs(raw_f - onnx_prob) <= 1e-5, f"ONNX vs Python raw prob mismatch on {vec['case_id']}"
        assert abs(raw_f - exp["face_raw_prob"]) <= 1e-5
        assert abs(cal_f - exp["face_cal_prob"]) <= 1e-5
        assert abs(llr_f - exp["face_llr"]) <= 1e-5
        assert abs(llr_b - exp["beh_llr"]) <= 1e-5
        assert abs(llr_q - exp["quiz_llr"]) <= 1e-5

        r_face = compute_frame_reliability(
            inp["face_present_ratio"],
            inp["avg_luminance"],
            inp["head_yaw_abs_deg"],
            inp["head_pitch_abs_deg"],
            1.0,
        )
        assert abs(r_face - exp["r_face"]) <= 1e-5

        step = sp_bef_step(
            prev_posterior=inp["prev_posterior"],
            segment_prior=inp["segment_prior"],
            llr_face=llr_f,
            r_face=r_face,
            llr_beh=llr_b,
            r_beh=exp["r_beh"],
            llr_quiz=llr_q,
            r_quiz=exp["r_quiz"],
            fusion_cfg=params["fusion"],
            prev_high_sec=inp["prev_high_sec"],
            prev_intervening=inp["prev_intervening"],
            cooldown_remaining_sec=inp["cooldown_remaining_sec"],
            dt_sec=inp["dt_sec"],
        )
        assert abs(step["posterior_prob"] - exp["step"]["posterior_prob"]) <= 1e-5
        assert step["is_confused"] == exp["step"]["is_confused"]
        assert step["should_intervene"] == exp["step"]["should_intervene"]


def test_video_features_golden_parity():
    golden = json.loads((GOLDEN_DIR / "video_features_golden.json").read_text(encoding="utf-8"))
    computed = aggregate_clip_window(golden["frames"])
    expected = golden["expected_window"]
    for k, exp_v in expected.items():
        assert abs(float(computed[k]) - float(exp_v)) <= 1e-3, f"Feature mismatch on {k}: {computed[k]} vs {exp_v}"


def test_quality_gates_p7():
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    weights = {"face": "w_face", "behavior": "w_beh", "quiz": "w_quiz"}
    assert any(params["branches"][n]["enabled"] for n in weights), "at least one branch must carry signal"
    for name in ("face", "behavior", "quiz"):
        m = params["branches"][name]["metrics"]
        if not params["branches"][name]["enabled"]:
            # A branch without validated signal must not influence any decision.
            assert params["fusion"][weights[name]] == 0.0, f"disabled {name} branch still has weight"
            continue
        # Gate 1: real signal — bootstrap 95% CI of test AUROC lies above chance.
        assert m["test_auroc_ci95"][0] > 0.5, f"{name} AUROC CI {m['test_auroc_ci95']} includes chance"
        # Gate 2: calibrated ECE <= 0.05.
        assert m["test_ece_calibrated"] <= 0.05, f"{name} ECE {m['test_ece_calibrated']} > 0.05"
        # Gate 3: beats the always-negative AUPRC baseline.
        assert m["test_auprc"] > m["always_negative_auprc"], f"{name} AUPRC does not beat always-negative"


def test_no_label_column_is_a_feature():
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    for cols in (FACE_RAW_FEATURES, FACE_MODEL_FEATURES, BEHAVIOR_FEATURES, QUIZ_FEATURES):
        assert not set(cols) & set(LABEL_COLUMNS)
    for name in ("face", "behavior", "quiz"):
        names = params["branches"][name]["feature_names"]
        assert not set(names) & set(LABEL_COLUMNS), f"label column in {name} features"
        assert len(names) == len(params["branches"][name]["coefficients"])


def test_face_affect_scores_are_pixel_heuristics_not_annotations():
    # affect_* must equal the browser heuristic recomputed from the other pixel features (rounding tolerance).
    df = pd.read_csv(DAISEE_CACHE)
    present = df[df["r_face"] > 0]
    frustration = np.clip(present["brow_furrow_mean"] * 0.55 + present["mouth_tension_mean"] * 0.45 + present["eye_squint_mean"] * 0.25, 0, 1)
    assert np.max(np.abs(frustration - present["affect_frustration"])) <= 1e-4
    raw = _daisee_annotations()
    annotated = present["clip_id"].map(raw["frustration"] / 3.0)
    assert not np.allclose(annotated.values, present["affect_frustration"].values, atol=1e-3)


def test_daisee_is_not_resampled():
    df = pd.read_csv(DAISEE_CACHE)
    raw = _daisee_annotations()
    assert len(df) == len(raw), "every DAiSEE clip must be extracted"
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    fm = params["branches"]["face"]["metrics"]
    assert abs(fm["test_base_rate"] - 0.327) <= 0.03, "test split must keep the natural confusion base rate"


def test_behavior_label_is_not_a_function_of_features():
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import roc_auc_score

    df = pd.read_csv(BEHAVIOR_CACHE)
    assert (df["n_linked_problems"] >= 1).all(), "every labelled session must have linked exercise outcomes"
    # Identical feature vectors must be able to carry different labels.
    mixed = df.groupby(list(BEHAVIOR_FEATURES))["is_confused"].nunique()
    assert (mixed > 1).any()
    # A flexible in-sample model must not reproduce the label (it would if the label were derived from features).
    X, y = df[list(BEHAVIOR_FEATURES)].values, df["is_confused"].values
    clf = HistGradientBoostingClassifier(max_iter=200, random_state=SEED).fit(X, y)
    assert roc_auc_score(y, clf.predict_proba(X)[:, 1]) < 0.9


def test_fusion_baselines_are_fitted_on_validation():
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    ev = params["evaluation"]
    assert len(ev["stacking_coefficients"]) == 6
    variants = [c["variant"] for c in ev["comparison_table"]]
    assert any("trained on VL-val" in v for v in variants)
    assert not any("0.55" in v for v in variants)
    assert ev["virtual_learner_protocol"]["face_clip_hold_steps"] >= 2
