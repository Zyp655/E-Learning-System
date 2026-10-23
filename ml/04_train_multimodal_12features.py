"""
Step 04 — Train 12-Feature Multimodal Confusion Classifier (LR, RandomForest, GradientBoosting, 3-Layer MLP)
and Export Standardized Weights (`mlp_weights.json`, `lr_weights.json`) for Go Backend (`ConfusionPredictor`).

12 Multimodal Features (per 5-minute learning window):
- Video Behavior (F1–F6):
  F1: pause_count           — Number of video pauses
  F2: avg_pause_duration    — Mean pause duration (seconds)
  F3: long_pause_count      — Pauses > 10 seconds
  F4: rewind_count          — Number of rewinds/seeks backward
  F5: rewind_same_spot      — Repeated rewind to same segment (0/1)
  F6: speed_decrease        — Playback speed lowered < 1.0x (0/1)
- Facial Affective / CV Emotion (F7–F10):
  F7: confused_ratio        — Ratio of frames classified as confused
  F8: frustrated_ratio      — Ratio of frames classified as frustrated
  F9: emotion_transitions   — Number of state transitions toward negative affect
  F10: neg_emotion_streak   — Longest consecutive confused/frustrated streak
- In-Video Segment Quiz (F11–F12):
  F11: quiz_score           — Segment quiz accuracy (0..100)
  F12: quiz_time            — Time spent answering segment quiz (seconds)
"""

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output_multimodal"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_NAMES = [
    "pause_count",
    "avg_pause_duration",
    "long_pause_count",
    "rewind_count",
    "rewind_same_spot",
    "speed_decrease",
    "confused_ratio",
    "frustrated_ratio",
    "emotion_transitions",
    "neg_emotion_streak",
    "quiz_score",
    "quiz_time",
]

BEHAVIOR_FEATURES = [0, 1, 2, 3, 4, 5]
EMOTION_FEATURES = [6, 7, 8, 9]
QUIZ_FEATURES = [10, 11]


def load_data_from_logs(db_export_path: str) -> tuple:
    df = pd.read_json(db_export_path)
    X = df[FEATURE_NAMES].values.astype(np.float32)
    y = (df["ground_truth"] >= 1).astype(int).values
    return X, y


def generate_synthetic_data(n_samples: int = 2000, seed: int = 42) -> tuple:
    rng = np.random.RandomState(seed)
    n_confused = n_samples // 3
    n_normal = n_samples - n_confused

    X_normal = np.column_stack([
        rng.poisson(1.0, n_normal),
        rng.exponential(3.0, n_normal),
        rng.poisson(0.3, n_normal),
        rng.poisson(0.5, n_normal),
        rng.binomial(1, 0.1, n_normal),
        rng.binomial(1, 0.15, n_normal),
        rng.beta(1, 8, n_normal),
        rng.beta(1, 10, n_normal),
        rng.poisson(1.0, n_normal),
        rng.poisson(0.5, n_normal),
        rng.normal(75, 15, n_normal).clip(0, 100),
        rng.normal(30, 10, n_normal).clip(5, 120),
    ])

    X_confused = np.column_stack([
        rng.poisson(4.0, n_confused),
        rng.exponential(12.0, n_confused),
        rng.poisson(1.5, n_confused),
        rng.poisson(3.0, n_confused),
        rng.binomial(1, 0.6, n_confused),
        rng.binomial(1, 0.5, n_confused),
        rng.beta(4, 3, n_confused),
        rng.beta(3, 4, n_confused),
        rng.poisson(4.0, n_confused),
        rng.poisson(2.5, n_confused),
        rng.normal(40, 20, n_confused).clip(0, 100),
        rng.normal(60, 20, n_confused).clip(5, 120),
    ])

    X = np.vstack([X_normal, X_confused]).astype(np.float32)
    y = np.array([0] * n_normal + [1] * n_confused, dtype=int)

    noise = rng.normal(0, 0.05, X.shape)
    X = np.abs(X + noise * X)

    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def build_models() -> dict:
    return {
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(
                C=1.0, max_iter=1000, class_weight="balanced", random_state=42
            )),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(
                n_estimators=200, max_depth=8, min_samples_leaf=5,
                class_weight="balanced", random_state=42, n_jobs=-1
            )),
        ]),
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.1,
                subsample=0.8, random_state=42
            )),
        ]),
        "MLP": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", MLPClassifier(
                hidden_layer_sizes=(64, 32, 16),
                activation="relu",
                solver="adam",
                max_iter=500,
                early_stopping=True,
                validation_fraction=0.15,
                random_state=42,
                learning_rate="adaptive",
                alpha=1e-3,
            )),
        ]),
    }


def evaluate_model(name: str, model: Pipeline, X: np.ndarray, y: np.ndarray, cv) -> dict:
    y_pred = cross_val_predict(model, X, y, cv=cv, method="predict")
    y_prob = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]

    return {
        "name": name,
        "accuracy": float(accuracy_score(y, y_pred)),
        "precision": float(precision_score(y, y_pred, zero_division=0)),
        "recall": float(recall_score(y, y_pred, zero_division=0)),
        "f1": float(f1_score(y, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y, y_prob)) if len(set(y)) > 1 else 0.0,
        "y_pred": y_pred,
        "y_prob": y_prob,
    }


def export_mlp_weights(model: Pipeline, output_paths: list):
    scaler = model.named_steps["scaler"]
    mlp = model.named_steps["clf"]

    weights = {
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "layers": [],
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
    }

    for i, (w, b) in enumerate(zip(mlp.coefs_, mlp.intercepts_)):
        weights["layers"].append({
            "weights": w.tolist(),
            "biases": b.tolist(),
            "activation": "relu" if i < len(mlp.coefs_) - 1 else "sigmoid",
        })

    for p in output_paths:
        with open(p, "w") as f:
            json.dump(weights, f, indent=2)
        print(f"  Exported 3-Layer MLP (64, 32, 16) weights -> {p}")


def export_lr_weights(model: Pipeline, output_paths: list):
    scaler = model.named_steps["scaler"]
    lr = model.named_steps["clf"]

    weights = {
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "coefficients": lr.coef_[0].tolist(),
        "intercept": float(lr.intercept_[0]),
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
    }

    for p in output_paths:
        with open(p, "w") as f:
            json.dump(weights, f, indent=2)
        print(f"  Exported LogisticRegression weights -> {p}")


def main():
    print("=" * 68)
    print("  STEP 04: 12-FEATURE MULTIMODAL CONFUSION CLASSIFIER")
    print("  Features: F1-F6 (Behavior) + F7-F10 (Emotion) + F11-F12 (Quiz)")
    print("  Models:   LogisticRegression | RandomForest | GBDT | MLP (64,32,16)")
    print("=" * 68)

    db_export = BASE_DIR / "confusion_logs_export.json"
    if db_export.exists():
        X, y = load_data_from_logs(str(db_export))
    else:
        X, y = generate_synthetic_data(n_samples=2000)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    models = build_models()
    results = []

    for name, model in models.items():
        r = evaluate_model(name, model, X, y, cv)
        results.append(r)
        print(
            f"  {name:20s} | Acc: {r['accuracy']:.4f} | Prec: {r['precision']:.4f} | "
            f"Rec: {r['recall']:.4f} | F1: {r['f1']:.4f} | AUC: {r['auc']:.4f}"
        )

    for model in models.values():
        model.fit(X, y)

    export_mlp_weights(
        models["MLP"],
        [BASE_DIR / "mlp_weights.json", OUTPUT_DIR / "mlp_weights.json", MODELS_DIR / "mlp_weights.json"],
    )
    export_lr_weights(
        models["LogisticRegression"],
        [BASE_DIR / "lr_weights.json", OUTPUT_DIR / "lr_weights.json", MODELS_DIR / "lr_weights.json"],
    )


if __name__ == "__main__":
    main()
