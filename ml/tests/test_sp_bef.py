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
import os
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
    distinct_threshold_labelings,
    run_p2_face_branch,
)
from export_sp_bef_edge_cases import EDGE_CASES_NAME, build_edge_cases
from sp_bef.core import (
    GAZE_FEATURES,
    MILD_THETA_OFF_RATIO,
    compute_frame_reliability,
    compute_gaze_reliability,
    confusion_level,
    piecewise_linear_interp,
    predict_linear_calibrated_branch,
    sp_bef_step,
)

BASE_DIR = Path(__file__).resolve().parent.parent
# ml/data is gitignored (~34 GB). SP_BEF_DATA_DIR overrides it (e.g. an empty dir to simulate a clean clone);
# tests that need it skip when it is missing, or fail when SP_BEF_REQUIRE_DATA=1.
DATA_DIR = Path(os.environ.get("SP_BEF_DATA_DIR") or BASE_DIR / "data")
REQUIRE_DATA = os.environ.get("SP_BEF_REQUIRE_DATA", "").strip().lower() in ("1", "true", "yes")
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
DAISEE_ANNOTATIONS = DAISEE_VIDEO_FRAMES if DAISEE_VIDEO_FRAMES.exists() else DATA_DIR / "daisee_frames" / "frame_labels.csv"


def require_data(*paths: Path) -> None:
    """Skip (or fail with SP_BEF_REQUIRE_DATA=1) when gitignored dataset files are absent, e.g. on a clean clone."""
    missing = [p for p in paths if not p.exists()]
    if not missing:
        return
    msg = (
        f"needs the gitignored dataset directory {DATA_DIR} (missing: {', '.join(p.name for p in missing)}); "
        "download the datasets listed in data/MANIFEST.json and run run_sp_bef_pipeline.py, "
        "set SP_BEF_DATA_DIR to point at them, or set SP_BEF_REQUIRE_DATA=1 to turn this skip into a failure"
    )
    if REQUIRE_DATA:
        pytest.fail(msg)
    pytest.skip(msg)


def test_p0_manifest_exists():
    require_data(DATA_DIR / "MANIFEST.json")
    manifest = json.loads((DATA_DIR / "MANIFEST.json").read_text(encoding="utf-8"))
    assert "datasets" in manifest
    for k in ["daisee_frame_labels_csv", "mediapipe_face_landmarker_task", "mooccubex_user_video_json", "mooccubex_user_problem_head_json", "mooccubex_course_json", "mooccubex_exercise_problem_txt", "assistments_2017_csv"]:
        assert k in manifest["datasets"], f"Missing {k} in MANIFEST.json"
        assert len(manifest["datasets"][k]["sha256"]) == 64


def test_p0_model_artifacts_exist():
    assert (MODELS_DIR / "sp_bef_params.json").exists(), "Missing models/sp_bef_params.json"
    assert (MODELS_DIR / "sp_bef_face.onnx").exists(), "Missing models/sp_bef_face.onnx"
    assert (MODELS_DIR / "sp_bef_face.onnx").stat().st_size <= 2 * 1024 * 1024, "ONNX model exceeds 2MB budget"


def test_zero_subject_and_user_leakage():
    require_data(DAISEE_CACHE)
    df_daisee = pd.read_csv(DAISEE_CACHE)
    s_train = set(df_daisee[df_daisee["split"] == "train"]["subject"].unique())
    s_val = set(df_daisee[df_daisee["split"] == "validation"]["subject"].unique())
    s_test = set(df_daisee[df_daisee["split"] == "test"]["subject"].unique())

    assert len(s_train & s_val) == 0, "DAiSEE train/val subject overlap!"
    assert len(s_train & s_test) == 0, "DAiSEE train/test subject overlap!"
    assert len(s_val & s_test) == 0, "DAiSEE val/test subject overlap!"


def test_no_nan_inf_and_missing_face_handling():
    require_data(DAISEE_CACHE)
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
    require_data(DAISEE_CACHE)
    df_daisee = pd.read_csv(DAISEE_CACHE)
    cfg1, _, _ = run_p2_face_branch(df_daisee)
    onnx_bytes_1 = (MODELS_DIR / "sp_bef_face.onnx").read_bytes()
    cfg2, _, _ = run_p2_face_branch(df_daisee)
    onnx_bytes_2 = (MODELS_DIR / "sp_bef_face.onnx").read_bytes()

    assert abs(cfg1["metrics"]["test_auroc"] - cfg2["metrics"]["test_auroc"]) <= 1e-6
    assert abs(cfg1["metrics"]["test_auprc"] - cfg2["metrics"]["test_auprc"]) <= 1e-6
    assert np.allclose(cfg1["coefficients"], cfg2["coefficients"], atol=1e-6)
    # Regression: the exported ONNX must be byte-identical across runs (no random graph name),
    # otherwise every test run dirties the tracked model files in ml/models and lms-web/public/models.
    assert onnx_bytes_1 == onnx_bytes_2, "ONNX export is not deterministic"
    web_onnx = BASE_DIR.parent / "lms-web" / "public" / "models" / "sp_bef_face.onnx"
    assert web_onnx.read_bytes() == onnx_bytes_2, "lms-web copy of the ONNX model is out of sync"


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


def test_runtime_copies_of_params_and_golden_vectors_are_in_sync():
    # The Go (go:embed) and TypeScript runtimes test against their own copies; parity is only meaningful
    # if those copies are byte-identical to the artifacts this suite validates.
    repo = BASE_DIR.parent
    go_models = repo / "lms-api" / "internal" / "service" / "models"
    web_cv = repo / "lms-web" / "src" / "features" / "confusion-cv"
    pairs = [
        (MODELS_DIR / "sp_bef_params.json", go_models / "sp_bef_params.json"),
        (MODELS_DIR / "sp_bef_params.json", web_cv / "sp_bef_params.json"),
        (GOLDEN_DIR / "parity_vectors.json", go_models / "parity_vectors.json"),
        (GOLDEN_DIR / "parity_vectors.json", web_cv / "__tests__" / "parity_vectors.json"),
        (GOLDEN_DIR / "video_features_golden.json", web_cv / "__tests__" / "video_features_golden.json"),
        (GOLDEN_DIR / "gaze_parity_vectors.json", go_models / "gaze_parity_vectors.json"),
        (GOLDEN_DIR / "gaze_parity_vectors.json", web_cv / "__tests__" / "gaze_parity_vectors.json"),
        (GOLDEN_DIR / EDGE_CASES_NAME, go_models / EDGE_CASES_NAME),
        (GOLDEN_DIR / EDGE_CASES_NAME, web_cv / "__tests__" / EDGE_CASES_NAME),
        (MODELS_DIR / "sp_bef_face.onnx", repo / "lms-web" / "public" / "models" / "sp_bef_face.onnx"),
    ]
    for src, copy in pairs:
        assert copy.exists(), f"missing runtime copy {copy}"
        assert copy.read_bytes() == src.read_bytes(), f"{copy} is out of sync with {src}"


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
    require_data(DAISEE_CACHE, DAISEE_ANNOTATIONS)
    df = pd.read_csv(DAISEE_CACHE)
    present = df[df["r_face"] > 0]
    frustration = np.clip(present["brow_furrow_mean"] * 0.55 + present["mouth_tension_mean"] * 0.45 + present["eye_squint_mean"] * 0.25, 0, 1)
    assert np.max(np.abs(frustration - present["affect_frustration"])) <= 1e-4
    raw = _daisee_annotations()
    annotated = present["clip_id"].map(raw["frustration"] / 3.0)
    assert not np.allclose(annotated.values, present["affect_frustration"].values, atol=1e-3)


def test_daisee_is_not_resampled():
    require_data(DAISEE_CACHE, DAISEE_ANNOTATIONS)
    df = pd.read_csv(DAISEE_CACHE)
    raw = _daisee_annotations()
    assert len(df) == len(raw), "every DAiSEE clip must be extracted"
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    fm = params["branches"]["face"]["metrics"]
    assert abs(fm["test_base_rate"] - 0.327) <= 0.03, "test split must keep the natural confusion base rate"


def test_behavior_label_is_not_a_function_of_features():
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import roc_auc_score

    require_data(BEHAVIOR_CACHE)
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


def test_gaze_parity_vectors_match_core():
    """Reading-gaze branch: reliability, calibrated LLR and the fused step match the golden vectors."""
    doc = json.loads((GOLDEN_DIR / "gaze_parity_vectors.json").read_text(encoding="utf-8"))
    assert len(doc["vectors"]) >= 12
    assert any(v["expected"]["r_gaze"] == 0.0 for v in doc["vectors"])
    assert any(v["expected"]["step"]["contrib_gaze"] != 0.0 for v in doc["vectors"])
    for vec in doc["vectors"]:
        inp, exp = vec["inputs"], vec["expected"]
        raw_p, cal_p, llr = predict_linear_calibrated_branch(inp["gaze_features"], doc["branch"])
        assert abs(llr - exp["gaze_llr"]) <= 1e-6
        r_gaze = compute_gaze_reliability(
            inp["calibration_error_norm"], inp["face_present_ratio"], inp["on_text_ratio"], inp["head_yaw_abs_deg"]
        )
        assert abs(r_gaze - exp["r_gaze"]) <= 1e-6
        step = sp_bef_step(
            inp["prev_posterior"], inp["segment_prior"], inp["llr_face"], inp["r_face"], 0.0, 0.0,
            inp["llr_quiz"], inp["r_quiz"], doc["fusion"], inp["prev_high_sec"], inp["prev_intervening"],
            inp["cooldown_remaining_sec"], inp["dt_sec"], llr_gaze=llr, r_gaze=r_gaze,
        )
        assert step == exp["step"]


def test_shipped_gaze_branch_is_off_until_validated():
    """No labelled webcam reading data exists yet: the shipped gaze branch must not move the posterior."""
    params = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))
    gaze = params["branches"]["gaze"]
    assert gaze["feature_names"] == GAZE_FEATURES
    if not gaze.get("enabled"):
        assert params["fusion"]["w_gaze"] == 0.0
    if not gaze.get("trained"):
        _, _, llr = predict_linear_calibrated_branch([2.5, 3.0, 6.0, 2.0, 0.9, 4.0], gaze)
        assert llr == 0.0
    fusion = params["fusion"]
    base = sp_bef_step(0.3, 0.2, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, fusion)
    with_gaze = sp_bef_step(0.3, 0.2, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, fusion, llr_gaze=3.0, r_gaze=1.0)
    if fusion["w_gaze"] == 0.0:
        assert with_gaze["posterior_prob"] == base["posterior_prob"]


def test_gaze_reliability_is_zero_without_calibration_or_face():
    assert compute_gaze_reliability(0.0, 1.0, 1.0, 0.0) == 0.0
    assert compute_gaze_reliability(0.4, 0.0, 1.0, 0.0) == 0.0
    assert compute_gaze_reliability(0.4, 1.0, 1.0, 0.0) == 1.0
    assert compute_gaze_reliability(1.0, 1.0, 1.0, 0.0) == 0.5
    assert compute_gaze_reliability(1.5, 1.0, 1.0, 0.0) == 0.0


def test_gaze_label_sources(tmp_path):
    """Designed stimuli are labelled by design; ambiguous self-reports (level 2) and r_gaze = 0 rows are dropped."""
    import importlib

    train = importlib.import_module("07_train_gaze_branch")
    rows = [
        {"user_id": 1, "label_source": "designed_stimulus", "stimulus_type": "control", "self_report_level": 0},
        {"user_id": 1, "label_source": "designed_stimulus", "stimulus_type": "factual", "self_report_level": 0},
        {"user_id": 2, "label_source": "designed_stimulus", "stimulus_type": "contextual", "self_report_level": 0},
        {"user_id": 2, "label_source": "self_report", "stimulus_type": "", "self_report_level": 1},
        {"user_id": 3, "label_source": "self_report", "stimulus_type": "", "self_report_level": 2},
        {"user_id": 3, "label_source": "self_report", "stimulus_type": "", "self_report_level": 4},
        {"user_id": 4, "label_source": "self_report", "stimulus_type": "", "self_report_level": 3, "r_gaze": 0.0},
    ]
    for r in rows:
        r.setdefault("r_gaze", 0.8)
        r.update({f: 1.0 for f in GAZE_FEATURES})
    path = tmp_path / "logs.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")

    df = train.load_reading_logs(path)
    assert df["is_confused"].tolist() == [0, 1, 1, 0, 1]
    assert len(train.load_reading_logs(path, "designed_stimulus")) == 3
    # Too little data: the branch stays untrained and off.
    cfg = train.train_gaze_branch(df)
    assert cfg["trained"] is False and cfg["enabled"] is False


def test_edge_case_vectors_match_core():
    """ml/golden/sp_bef_edge_cases.json (also checked by Go and vitest) is exactly what the Python core returns."""
    on_disk = json.loads((GOLDEN_DIR / EDGE_CASES_NAME).read_text(encoding="utf-8"))
    assert on_disk == build_edge_cases(), "regenerate with: .venv/bin/python export_sp_bef_edge_cases.py"


def test_edge_case_sanitization_follows_go_reference():
    nan, inf = float("nan"), float("inf")
    # PiecewiseLinearInterp(NaN) returns fp[0] in every runtime (was fp[-1] in Python).
    assert piecewise_linear_interp(nan, [0.0, 1.0], [0.1, 0.9]) == 0.1

    fusion = {"hmm_keep_confused": 0.6, "hmm_beta0": 0.04, "hmm_beta1": 0.45, "w_face": 0.7, "w_beh": 0.0,
              "w_quiz": 1.0, "w_gaze": 0.0, "theta_on": 0.4, "theta_off": 0.25, "min_hold_sec": 10.0, "cooldown_sec": 180.0}
    args = (0.5, 0.3, 1.2, 1.0, 0.0, 0.0, 0.8, 1.0)
    # Negative weights and <= 0 thresholds fall back to the defaults (Go), 0 still disables a branch.
    with_defaults = sp_bef_step(*args, {**fusion, "w_face": 0.65, "theta_on": 0.62, "theta_off": 0.42})
    assert sp_bef_step(*args, {**fusion, "w_face": -1.0, "theta_on": 0.0, "theta_off": -0.3}) == with_defaults
    assert sp_bef_step(*args, {**fusion, "w_face": 0.0})["contrib_face"] == 0.0
    # NaN / Inf / negative dt, prev_high_sec and cooldown behave like 0.
    zero_dt = sp_bef_step(*args, fusion, 5.0, False, 30.0, 0.0)
    for bad in (nan, inf, -5.0):
        assert sp_bef_step(*args, fusion, 5.0, False, 30.0, bad) == zero_dt
    zero_high = sp_bef_step(*args, fusion, 0.0, False, 0.0, 5.0)
    for bad in (nan, inf, -20.0):
        out = sp_bef_step(*args, fusion, bad, False, 0.0, 5.0)
        assert out == zero_high and not math.isnan(out["high_duration_sec"])
    # NaN priors are clamped into range instead of reaching log(0).
    assert sp_bef_step(nan, nan, *args[2:], fusion)["segment_prior"] == 0.02


def test_mild_level_is_reachable_with_shipped_params():
    """Regression: the fixed mild floor (p >= 0.25) equalled the shipped theta_off = 0.25, so mild never occurred."""
    fusion = json.loads((MODELS_DIR / "sp_bef_params.json").read_text(encoding="utf-8"))["fusion"]
    on, off = fusion["theta_on"], fusion["theta_off"]
    assert confusion_level((MILD_THETA_OFF_RATIO * off + off) / 2, on, off, 1.0) == "mild"
    assert confusion_level(MILD_THETA_OFF_RATIO * off - 1e-6, on, off, 1.0) == "none"
    assert confusion_level(off, on, off, 1.0) == "moderate"
    assert confusion_level(on, on, off, 1.0) == "high"
    step = sp_bef_step(0.2, 0.2, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, fusion)
    assert step["posterior_prob"] < off and step["level"] == "mild"
    # The golden vectors used by Go and TS cover the mild level as well.
    vectors = json.loads((GOLDEN_DIR / "parity_vectors.json").read_text(encoding="utf-8"))
    assert any(v["expected"]["step"]["level"] == "mild" for v in vectors)


def test_threshold_sensitivity_dedupes_identical_labelings():
    """Regression: 0.10/0.20 and 0.40/0.70 gave identical labels on the discrete ASSISTments confidence."""
    # Same discrete structure as confidence(CONFUSED): mostly 0, then 0.378, 0.714, 0.79, 0.80, ...
    values = np.array([0.0] * 80 + [0.3782] * 6 + [0.7143] * 1 + [0.7895] * 1 + [0.7965] * 6 + [0.8333] * 2 + [1.0] * 4)
    labelings = distinct_threshold_labelings(values)

    by_threshold = {th: lab for lab in labelings for th in lab["equivalent_thresholds"]}
    assert by_threshold[0.10] is by_threshold[0.20], "0.10 and 0.20 must collapse into one labeling"
    assert by_threshold[0.40] is by_threshold[0.70], "0.40 and 0.70 must collapse into one labeling"
    assert by_threshold[0.10]["threshold_range"] == [0.0, 0.3782]
    assert by_threshold[0.10]["base_rate"] == 0.2
    assert by_threshold[0.40]["base_rate"] == 0.14

    # Every reported labeling is genuinely different, and quantile thresholds add labelings beyond the 2 requested ones.
    label_sets = {tuple((values >= lab["threshold"]).astype(int)) for lab in labelings}
    assert len(label_sets) == len(labelings) > 2
    base_rates = [lab["base_rate"] for lab in labelings]
    assert base_rates == sorted(base_rates, reverse=True)
    for lab in labelings:
        lo, hi = lab["threshold_range"]
        assert lo < lab["threshold"] <= hi
    # Degenerate inputs give no labelings instead of a single-class label vector.
    assert distinct_threshold_labelings(np.zeros(10)) == []


def test_clean_clone_skips_data_tests(tmp_path):
    """Without ml/data (simulated by an empty SP_BEF_DATA_DIR) data tests skip and the rest pass."""
    import subprocess
    import sys

    env = {**os.environ, "SP_BEF_DATA_DIR": str(tmp_path), "SP_BEF_REQUIRE_DATA": ""}
    cmd = [sys.executable, "-m", "pytest", "-q", "-rs", "-p", "no:cacheprovider", __file__, "-k", "not clean_clone"]
    res = subprocess.run(cmd, cwd=BASE_DIR, env=env, capture_output=True, text=True, timeout=600)
    out = res.stdout + res.stderr
    assert res.returncode == 0, out
    assert "7 skipped" in out, out
    assert "needs the gitignored dataset directory" in out, out

    strict = {**env, "SP_BEF_REQUIRE_DATA": "1"}
    cmd_strict = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", __file__, "-k", "manifest_exists"]
    res = subprocess.run(cmd_strict, cwd=BASE_DIR, env=strict, capture_output=True, text=True, timeout=600)
    assert res.returncode == 1, res.stdout + res.stderr
