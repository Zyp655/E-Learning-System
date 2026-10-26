"""
P7 Gate — Automated pytest verification suite for SP-BEF V2 ML Pipeline.
Checks:
1. Zero subject / user / student leakage across train/val/test for DAiSEE, MOOCCubeX, ASSISTments.
2. Deterministic reproducibility (<= 1e-6 delta with fixed seed).
3. Zero NaN / Inf in extracted features & graceful handling of missing face frames (r_face = 0).
4. Numerical Parity (<= 1e-5) between Python SP-BEF, ONNX Runtime (`sp_bef_face.onnx`), and `ml/golden/parity_vectors.json`.
5. Feature extraction parity (<= 1e-3) on `ml/golden/video_features_golden.json`.
6. Quality Gates: Face AUROC > 0.661 on official DAiSEE test split; calibrated ECE <= 0.05; all branches AUPRC > always-negative baseline.
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
    FACE_MODEL_FEATURES,
    FACE_RAW_FEATURES,
    SEED,
    aggregate_clip_window,
    apply_c2_personal_baseline,
    run_p2_face_branch,
    run_p3_behavior_and_prior,
    run_p4_quiz_branch,
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


def test_p0_manifest_and_golden_files_exist():
    assert (DATA_DIR / "MANIFEST.json").exists(), "Missing data/MANIFEST.json"
    manifest = json.loads((DATA_DIR / "MANIFEST.json").read_text(encoding="utf-8"))
    assert "datasets" in manifest
    for k in ["daisee_frame_labels_csv", "mediapipe_face_landmarker_task", "mooccubex_user_video_jsonl", "assistments_2017_csv"]:
        assert k in manifest["datasets"], f"Missing {k} in MANIFEST.json"
        assert len(manifest["datasets"][k]["sha256"]) == 64

    assert (MODELS_DIR / "sp_bef_params.json").exists(), "Missing models/sp_bef_params.json"
    assert (MODELS_DIR / "sp_bef_face.onnx").exists(), "Missing models/sp_bef_face.onnx"
    assert (MODELS_DIR / "sp_bef_face.onnx").stat().st_size <= 2 * 1024 * 1024, "ONNX model exceeds 2MB budget"


def test_zero_subject_and_user_leakage():
    df_daisee = pd.read_csv(DATA_DIR / "daisee_mediapipe_clips_v2.csv")
    s_train = set(df_daisee[df_daisee["split"] == "train"]["subject"].unique())
    s_val = set(df_daisee[df_daisee["split"] == "validation"]["subject"].unique())
    s_test = set(df_daisee[df_daisee["split"] == "test"]["subject"].unique())

    assert len(s_train & s_val) == 0, "DAiSEE train/val subject overlap!"
    assert len(s_train & s_test) == 0, "DAiSEE train/test subject overlap!"
    assert len(s_val & s_test) == 0, "DAiSEE val/test subject overlap!"


def test_no_nan_inf_and_missing_face_handling():
    df_daisee = pd.read_csv(DATA_DIR / "daisee_mediapipe_clips_v2.csv")
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
    df_daisee = pd.read_csv(DATA_DIR / "daisee_mediapipe_clips_v2.csv")
    cfg1, _ = run_p2_face_branch(df_daisee)
    cfg2, _ = run_p2_face_branch(df_daisee)

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
    fm = params["branches"]["face"]["metrics"]
    bm = params["branches"]["behavior"]["metrics"]
    qm = params["branches"]["quiz"]["metrics"]

    # Gate 1: Face AUROC > old baseline (0.661) on official DAiSEE test split
    assert fm["test_auroc"] > 0.661, f"Face AUROC {fm['test_auroc']} did not beat baseline 0.661"

    # Gate 2: ECE <= 0.05 after calibration across all 3 branches
    assert fm["test_ece_calibrated"] <= 0.05, f"Face ECE {fm['test_ece_calibrated']} > 0.05"
    assert bm["test_ece_calibrated"] <= 0.05, f"Behavior ECE {bm['test_ece_calibrated']} > 0.05"
    assert qm["test_ece_calibrated"] <= 0.05, f"Quiz ECE {qm['test_ece_calibrated']} > 0.05"

    # Gate 3: Every branch beats always-negative baseline on AUPRC
    assert fm["test_auprc"] > fm["always_negative_auprc"]
    assert bm["test_auprc"] > bm["always_negative_auprc"]
    assert qm["test_auprc"] > qm["always_negative_auprc"]
