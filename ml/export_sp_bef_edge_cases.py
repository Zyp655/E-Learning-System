"""
Cross-runtime edge-case vectors for the SP-BEF core (Python `sp_bef/core.py`, Go `confusion_predictor.go`,
TypeScript `spBefCore.ts`).

The golden parity vectors only cover well-formed inputs. This file pins the sanitization rules that all three
runtimes share (Go is the reference): negative / non-finite weights and <= 0 thresholds or HMM parameters fall
back to the defaults, NaN / Inf / negative dt, prev_high_sec and cooldown are treated as 0, NaN priors are
clamped into range, PiecewiseLinearInterp(NaN) returns fp[0], and the `mild` level is reachable.

JSON has no NaN / Infinity, so those values are written as the strings "NaN", "Infinity" and "-Infinity";
every consumer decodes them before calling the core.

Usage:
    .venv/bin/python export_sp_bef_edge_cases.py   # writes ml/golden/sp_bef_edge_cases.json + runtime copies
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any, Dict, List

from sp_bef.core import (
    compute_frame_reliability,
    compute_gaze_reliability,
    piecewise_linear_interp,
    predict_linear_calibrated_branch,
    sp_bef_step,
)

BASE_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = BASE_DIR / "golden"
EDGE_CASES_NAME = "sp_bef_edge_cases.json"
GO_MODELS_DIR = BASE_DIR.parent / "lms-api" / "internal" / "service" / "models"
WEB_TESTS_DIR = BASE_DIR.parent / "lms-web" / "src" / "features" / "confusion-cv" / "__tests__"

NAN = float("nan")
INF = float("inf")

# Self-contained copy of the shipped fusion block, so the vectors do not move when params are retuned.
BASE_FUSION = {
    "hmm_keep_confused": 0.6,
    "hmm_beta0": 0.04,
    "hmm_beta1": 0.45,
    "w_face": 0.7,
    "w_beh": 0.0,
    "w_quiz": 1.0,
    "w_gaze": 0.0,
    "theta_on": 0.4,
    "theta_off": 0.25,
    "min_hold_sec": 10.0,
    "cooldown_sec": 180.0,
}

BRANCH = {
    "feature_names": ["a", "b", "c"],
    "scaler_mean": [1.0, 0.5, 2.0],
    "scaler_scale": [0.5, 0.0, 2.0],  # a zero scale must be treated as 1.0
    "coefficients": [0.8, -0.4, 0.3],
    "intercept": -0.7,
    "base_rate": 0.2,
    "isotonic_xp": [0.0, 0.3, 0.6, 1.0],
    "isotonic_fp": [0.05, 0.25, 0.55, 0.9],
}

STEP_ARG_ORDER = [
    "prev_posterior", "segment_prior", "llr_face", "r_face", "llr_beh", "r_beh", "llr_quiz", "r_quiz",
    "prev_high_sec", "prev_intervening", "cooldown_remaining_sec", "dt_sec", "llr_gaze", "r_gaze",
]

DEFAULT_STEP_ARGS = {
    "prev_posterior": 0.5,
    "segment_prior": 0.3,
    "llr_face": 1.2,
    "r_face": 1.0,
    "llr_beh": 0.0,
    "r_beh": 0.0,
    "llr_quiz": 0.8,
    "r_quiz": 1.0,
    "prev_high_sec": 5.0,
    "prev_intervening": False,
    "cooldown_remaining_sec": 0.0,
    "dt_sec": 5.0,
    "llr_gaze": 0.0,
    "r_gaze": 0.0,
}

STEP_CASES: List[Dict[str, Any]] = [
    {"case_id": "negative_weights_use_defaults", "fusion": {"w_face": -1.0, "w_quiz": -0.5, "w_gaze": -2.0}, "args": {"r_gaze": 1.0, "llr_gaze": 2.0}},
    {"case_id": "zero_weight_disables_branch", "fusion": {"w_face": 0.0}, "args": {}},
    {"case_id": "zero_and_negative_thetas_use_defaults", "fusion": {"theta_on": 0.0, "theta_off": -0.3}, "args": {}},
    {"case_id": "nonpositive_hmm_and_timing_params_use_defaults", "fusion": {"hmm_keep_confused": 0.0, "hmm_beta0": -0.1, "hmm_beta1": 0.0, "min_hold_sec": 0.0, "cooldown_sec": -5.0}, "args": {"prev_high_sec": 10.0}},
    {"case_id": "nan_dt", "fusion": {}, "args": {"dt_sec": NAN, "cooldown_remaining_sec": 30.0}},
    {"case_id": "negative_dt", "fusion": {}, "args": {"dt_sec": -5.0, "cooldown_remaining_sec": 30.0}},
    {"case_id": "infinite_dt", "fusion": {}, "args": {"dt_sec": INF, "cooldown_remaining_sec": 30.0}},
    {"case_id": "nan_prev_high_sec", "fusion": {}, "args": {"prev_high_sec": NAN}},
    {"case_id": "negative_prev_high_sec", "fusion": {}, "args": {"prev_high_sec": -20.0}},
    {"case_id": "infinite_prev_high_sec", "fusion": {}, "args": {"prev_high_sec": INF}},
    {"case_id": "nan_and_negative_cooldown", "fusion": {}, "args": {"cooldown_remaining_sec": NAN, "prev_high_sec": 10.0}},
    {"case_id": "negative_cooldown", "fusion": {}, "args": {"cooldown_remaining_sec": -40.0, "prev_high_sec": 10.0}},
    {"case_id": "nan_priors_clamped", "fusion": {}, "args": {"prev_posterior": NAN, "segment_prior": NAN}},
    {"case_id": "infinite_priors_clamped", "fusion": {}, "args": {"prev_posterior": INF, "segment_prior": -INF}},
    {"case_id": "nan_llr_with_reliability", "fusion": {}, "args": {"llr_face": NAN, "llr_quiz": INF}},
    {"case_id": "nan_reliability", "fusion": {}, "args": {"r_face": NAN, "r_quiz": NAN}},
    {"case_id": "mild_level_with_shipped_thresholds", "fusion": {}, "args": {"prev_posterior": 0.2, "segment_prior": 0.2, "llr_face": 0.0, "r_quiz": 0.0, "prev_high_sec": 0.0}},
    {"case_id": "none_level_below_mild_floor", "fusion": {}, "args": {"prev_posterior": 0.1, "segment_prior": 0.1, "llr_face": -1.0, "r_quiz": 0.0, "prev_high_sec": 0.0}},
    {"case_id": "moderate_level_in_hysteresis_band", "fusion": {}, "args": {"prev_posterior": 0.3, "segment_prior": 0.3, "llr_face": 0.0, "r_quiz": 0.0, "prev_high_sec": 0.0}},
    {"case_id": "unknown_level_without_reliability", "fusion": {}, "args": {"r_face": 0.0, "r_quiz": 0.0}},
    {"case_id": "intervening_holds_above_theta_off", "fusion": {}, "args": {"prev_intervening": True, "prev_posterior": 0.3, "llr_face": 0.0, "r_quiz": 0.0}},
]

INTERP_CASES = [
    {"x": NAN, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": -1.0, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": 2.0, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": 0.25, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": INF, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": -INF, "xp": [0.0, 0.5, 1.0], "fp": [0.1, 0.4, 0.9]},
    {"x": 0.5, "xp": [0.0, 0.5, 0.5, 1.0], "fp": [0.1, 0.3, 0.6, 0.9]},
    {"x": NAN, "xp": [], "fp": []},
    {"x": 0.7, "xp": [], "fp": []},
]

FRAME_RELIABILITY_ARGS = [
    [1.0, 120.0, 5.0, 4.0, 1.0],
    [NAN, 120.0, 5.0, 4.0, 1.0],
    [1.0, NAN, 5.0, 4.0, 1.0],
    [1.0, 120.0, NAN, 4.0, 1.0],
    [1.0, 120.0, INF, 4.0, 1.0],
    [1.0, 120.0, 5.0, NAN, 1.0],
    [1.0, 120.0, 5.0, 4.0, NAN],
    [0.8, 60.0, -30.0, -20.0, 0.9],
    [1.5, 200.0, 0.0, 0.0, 2.0],
]

GAZE_RELIABILITY_ARGS = [
    [0.4, 1.0, 1.0, 0.0],
    [NAN, 1.0, 1.0, 0.0],
    [0.4, NAN, 1.0, 0.0],
    [0.4, 1.0, NAN, 0.0],
    [0.4, 1.0, 1.0, NAN],
    [1.2, 0.7, 0.3, 25.0],
]

BRANCH_FEATURES = [
    [1.0, 0.5, 2.0],
    [NAN, 0.5, 2.0],
    [1.0, INF, -INF],
    [3.0, 2.0, 6.0],
    [3.0, 2.0],  # shorter than the config: only the overlapping prefix is used
]


def encode(v: Any) -> Any:
    if isinstance(v, float):
        if math.isnan(v):
            return "NaN"
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
        return v
    if isinstance(v, list):
        return [encode(x) for x in v]
    if isinstance(v, dict):
        return {k: encode(x) for k, x in v.items()}
    return v


def build_edge_cases() -> Dict[str, Any]:
    steps = []
    for case in STEP_CASES:
        fusion = {**BASE_FUSION, **case["fusion"]}
        args = {**DEFAULT_STEP_ARGS, **case["args"]}
        a = [args[k] for k in STEP_ARG_ORDER]
        expected = sp_bef_step(
            a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], fusion,
            a[8], a[9], a[10], a[11], llr_gaze=a[12], r_gaze=a[13],
        )
        steps.append({"case_id": case["case_id"], "fusion": fusion, "args": args, "expected": expected})

    return encode({
        "description": "SP-BEF edge-case vectors shared by Python, Go and TypeScript. Regenerate with ml/export_sp_bef_edge_cases.py.",
        "step_arg_order": STEP_ARG_ORDER,
        "interp": [{**c, "expected": piecewise_linear_interp(c["x"], c["xp"], c["fp"])} for c in INTERP_CASES],
        "frame_reliability": [{"args": a, "expected": compute_frame_reliability(*a)} for a in FRAME_RELIABILITY_ARGS],
        "gaze_reliability": [{"args": a, "expected": compute_gaze_reliability(*a)} for a in GAZE_RELIABILITY_ARGS],
        "branch": {
            "cfg": BRANCH,
            "cases": [{"features": f, "expected": list(predict_linear_calibrated_branch(f, BRANCH))} for f in BRANCH_FEATURES],
        },
        "step": steps,
    })


def main() -> None:
    out = GOLDEN_DIR / EDGE_CASES_NAME
    out.write_text(json.dumps(build_edge_cases(), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    shutil.copy2(out, GO_MODELS_DIR / EDGE_CASES_NAME)
    shutil.copy2(out, WEB_TESTS_DIR / EDGE_CASES_NAME)
    print(f"wrote {out} and runtime copies")


if __name__ == "__main__":
    main()
