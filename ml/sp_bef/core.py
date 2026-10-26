"""
SP-BEF (Segment-Prior Bayesian Evidence Fusion) Reference Core Library.
Shared across P2 (Face), P3 (Behavior + Segment Prior), P4 (Quiz), P5 (Fusion), and P7 (Parity Tests).
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

EPS = 1e-6
LLR_CLIP = 4.0


def clip_val(x: float, lo: float, hi: float) -> float:
    if math.isnan(x) or math.isinf(x):
        return 0.0
    return max(lo, min(hi, float(x)))


def sigmoid(z: float) -> float:
    z_c = clip_val(z, -20.0, 20.0)
    return 1.0 / (1.0 + math.exp(-z_c))


def logit(p: float) -> float:
    p_c = clip_val(p, 1e-4, 1.0 - 1e-4)
    return math.log(p_c / (1.0 - p_c))


def piecewise_linear_interp(x: float, xp: List[float], fp: List[float]) -> float:
    """
    Deterministic 1D piecewise-linear interpolation identical in Python, TypeScript, and Go.
    Used to represent monotonic Isotonic Calibration maps across all runtimes with < 1e-9 parity.
    """
    if not xp or not fp or len(xp) != len(fp):
        return clip_val(x, 1e-4, 1.0 - 1e-4)
    if x <= xp[0]:
        return float(fp[0])
    if x >= xp[-1]:
        return float(fp[-1])
    for i in range(len(xp) - 1):
        x0, x1 = xp[i], xp[i + 1]
        if x0 <= x <= x1:
            if abs(x1 - x0) < 1e-12:
                return float(fp[i])
            t = (x - x0) / (x1 - x0)
            return float(fp[i] + t * (fp[i + 1] - fp[i]))
    return float(fp[-1])


def compute_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    """Expected Calibration Error (ECE) with uniform probability bins."""
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    if n == 0:
        return 0.0
    for i in range(n_bins):
        mask = (y_prob >= bins[i]) & (y_prob < bins[i + 1] if i < n_bins - 1 else y_prob <= bins[i + 1])
        if np.any(mask):
            acc = float(np.mean(y_true[mask]))
            conf = float(np.mean(y_prob[mask]))
            ece += (np.sum(mask) / n) * abs(acc - conf)
    return float(ece)


def compute_frame_reliability(
    face_present_ratio: float,
    avg_luminance: float,
    head_yaw_abs_deg: float,
    head_pitch_abs_deg: float,
    landmark_confidence: float = 1.0,
) -> float:
    """
    C4 Dynamic Frame Reliability r_face(t) in [0, 1].
    Returns 0.0 when modality is missing (face_present_ratio <= 0).
    """
    if (
        math.isnan(face_present_ratio)
        or face_present_ratio <= 0.0
        or landmark_confidence <= 0.0
    ):
        return 0.0
    r_pres = clip_val(face_present_ratio, 0.0, 1.0)
    r_luma = clip_val((avg_luminance - 35.0) / 60.0, 0.0, 1.0)
    r_yaw = clip_val(1.0 - max(abs(head_yaw_abs_deg) - 15.0, 0.0) / 30.0, 0.0, 1.0)
    r_pitch = clip_val(1.0 - max(abs(head_pitch_abs_deg) - 12.0, 0.0) / 25.0, 0.0, 1.0)
    r_conf = clip_val(landmark_confidence, 0.0, 1.0)
    return round(float(r_pres * r_luma * r_yaw * r_pitch * r_conf), 6)


def predict_linear_calibrated_branch(
    features: List[float],
    branch_cfg: Dict,
) -> Tuple[float, float, float]:
    """
    Evaluates a standardized linear/logistic branch + isotonic piecewise calibration map,
    and returns (raw_prob, calibrated_prob, llr).
    """
    mean = branch_cfg["scaler_mean"]
    scale = branch_cfg["scaler_scale"]
    coef = branch_cfg["coefficients"]
    intercept = float(branch_cfg["intercept"])
    base_rate = float(branch_cfg["base_rate"])

    z = intercept
    for x, m, s, c in zip(features, mean, scale, coef):
        val = 0.0 if (math.isnan(x) or math.isinf(x)) else float(x)
        denom = float(s) if abs(float(s)) > 1e-9 else 1.0
        z += ((val - float(m)) / denom) * float(c)

    raw_p = sigmoid(z)
    calib_x = branch_cfg.get("isotonic_xp", [])
    calib_y = branch_cfg.get("isotonic_fp", [])
    cal_p = piecewise_linear_interp(raw_p, calib_x, calib_y)
    cal_p = clip_val(cal_p, 1e-3, 1.0 - 1e-3)

    llr = clip_val(logit(cal_p) - logit(base_rate), -LLR_CLIP, LLR_CLIP)
    return round(raw_p, 6), round(cal_p, 6), round(llr, 6)


def sp_bef_step(
    prev_posterior: float,
    segment_prior: float,
    llr_face: float,
    r_face: float,
    llr_beh: float,
    r_beh: float,
    llr_quiz: float,
    r_quiz: float,
    fusion_cfg: Dict,
    prev_high_sec: float = 0.0,
    prev_intervening: bool = False,
    cooldown_remaining_sec: float = 0.0,
    dt_sec: float = 5.0,
) -> Dict:
    """
    Single forward-filtering step of the SP-BEF 2-State HMM + Hysteresis + Cooldown decision rule.
    Identical mathematical specification across Python, TypeScript, and Go.
    """
    a_keep = float(fusion_cfg.get("hmm_keep_confused", 0.78))
    beta_0 = float(fusion_cfg.get("hmm_beta0", 0.04))
    beta_1 = float(fusion_cfg.get("hmm_beta1", 0.45))

    w_face = float(fusion_cfg.get("w_face", 0.65))
    w_beh = float(fusion_cfg.get("w_beh", 0.85))
    w_quiz = float(fusion_cfg.get("w_quiz", 0.90))

    theta_on = float(fusion_cfg.get("theta_on", 0.62))
    theta_off = float(fusion_cfg.get("theta_off", 0.42))
    min_hold_sec = float(fusion_cfg.get("min_hold_sec", 10.0))
    cooldown_sec = float(fusion_cfg.get("cooldown_sec", 180.0))

    pi_s = clip_val(segment_prior, 0.02, 0.85)
    p_prev = clip_val(prev_posterior, 0.01, 0.99)

    # 1. HMM 2-state prior transition modulated by segment prior pi_s (C3 + C5)
    beta_pi = clip_val(beta_0 + beta_1 * pi_s, 0.02, 0.65)
    p_prior = clip_val(a_keep * p_prev + beta_pi * (1.0 - p_prev), 0.01, 0.99)
    prior_logit = logit(p_prior)

    # 2. Reliability-weighted calibrated LLR evidence sum (C1 + C4)
    rf = clip_val(r_face, 0.0, 1.0)
    rb = clip_val(r_beh, 0.0, 1.0)
    rq = clip_val(r_quiz, 0.0, 1.0)

    lf = clip_val(llr_face, -LLR_CLIP, LLR_CLIP) if rf > 0 else 0.0
    lb = clip_val(llr_beh, -LLR_CLIP, LLR_CLIP) if rb > 0 else 0.0
    lq = clip_val(llr_quiz, -LLR_CLIP, LLR_CLIP) if rq > 0 else 0.0

    contrib_face = round(rf * w_face * lf, 6)
    contrib_beh = round(rb * w_beh * lb, 6)
    contrib_quiz = round(rq * w_quiz * lq, 6)

    post_logit = prior_logit + contrib_face + contrib_beh + contrib_quiz
    p_post = round(sigmoid(post_logit), 6)

    # 3. Hysteresis (theta_on / theta_off) + Cooldown decision rule
    new_cooldown = max(0.0, float(cooldown_remaining_sec) - float(dt_sec))
    if p_post >= theta_on:
        high_sec = float(prev_high_sec) + float(dt_sec)
    elif p_post < theta_off:
        high_sec = 0.0
    else:
        high_sec = float(prev_high_sec)

    if prev_intervening:
        is_confused_state = p_post >= theta_off
    else:
        is_confused_state = p_post >= theta_on and high_sec >= min_hold_sec

    should_intervene = False
    if is_confused_state and new_cooldown <= 0.0 and not prev_intervening:
        should_intervene = True
        new_cooldown = cooldown_sec

    total_reliability = rf + rb + rq
    if total_reliability <= 1e-6:
        level = "unknown"
    elif p_post >= theta_on:
        level = "high"
    elif p_post >= theta_off:
        level = "moderate"
    elif p_post >= 0.25:
        level = "mild"
    else:
        level = "none"

    return {
        "prior_prob": round(p_prior, 6),
        "posterior_prob": p_post,
        "llr_face": round(lf, 6),
        "llr_beh": round(lb, 6),
        "llr_quiz": round(lq, 6),
        "r_face": round(rf, 6),
        "r_beh": round(rb, 6),
        "r_quiz": round(rq, 6),
        "contrib_face": contrib_face,
        "contrib_beh": contrib_beh,
        "contrib_quiz": contrib_quiz,
        "segment_prior": round(pi_s, 6),
        "high_duration_sec": round(high_sec, 2),
        "is_confused": bool(is_confused_state),
        "should_intervene": bool(should_intervene),
        "cooldown_remaining_sec": round(new_cooldown, 2),
        "level": level,
    }


def sha256_file(path: Path, max_bytes: Optional[int] = None) -> str:
    h = hashlib.sha256()
    read_so_far = 0
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            if max_bytes is not None and read_so_far + len(chunk) > max_bytes:
                h.update(chunk[: max_bytes - read_so_far])
                break
            h.update(chunk)
            read_so_far += len(chunk)
    return h.hexdigest()
