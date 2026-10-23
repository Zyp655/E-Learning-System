"""
Step 05 — Comprehensive Ablation Study (Visual/Temporal Architecture Ablation + Multimodal Feature Ablation).

Part A — Visual & Temporal Architecture Ablation on DAiSEE (5 Variants):
1. Full Model (Baseline): EfficientNetV2-S + SEBlock + 2-Layer BiLSTM + Temporal Attention + 5 Aux Features
2. No Aux Features:       Removes 5 affective auxiliary features (AUC drops 0.6610 -> 0.5710)
3. No Attention:          Replaces learned temporal attention with mean pooling (AUC drops 0.6610 -> 0.6300)
4. No Temporal LSTM:      Removes BiLSTM sequence modeling (AUC drops 0.6610 -> 0.6087, default Acc 0.3206)
5. No SE Block:           Removes Squeeze-and-Excitation channel attention (AUC drops 0.6610 -> 0.6193)

Part B — Multimodal 12-Feature Modality Ablation (7 Configurations):
- Behavior only (F1–F6)
- Emotion only (F7–F10)
- Quiz only (F11–F12)
- Behavior + Emotion (10 features)
- Behavior + Quiz (8 features)
- Emotion + Quiz (6 features)
- All Multimodal (12 features -> F1 = 0.9962, AUC = 0.9999)
"""

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

BASE_DIR = Path(__file__).parent
ABLATION_V2_DIR = BASE_DIR / "output_ablation_v2"
MULTIMODAL_DIR = BASE_DIR / "output_multimodal"

VARIANT_FILES = [
    ("Full Model (Baseline)", "result_Full_Model_Baseline.json"),
    ("No Aux Features", "result_No_Aux_Features.json"),
    ("No Attention", "result_No_Attention.json"),
    ("No Temporal LSTM", "result_No_Temporal_LSTM.json"),
    ("No SE Block", "result_No_SE_Block.json"),
]


def load_visual_ablation_results() -> list:
    results = []
    for label, fname in VARIANT_FILES:
        fpath = ABLATION_V2_DIR / fname
        if fpath.exists():
            with open(fpath, "r") as f:
                data = json.load(f)
            results.append(data)
    return results


def load_multimodal_ablation_results() -> list:
    summary_path = MULTIMODAL_DIR / "summary.json"
    if not summary_path.exists():
        return []
    with open(summary_path, "r") as f:
        data = json.load(f)
    return data.get("ablation_study", [])


def render_ablation_charts(visual_results: list):
    if not visual_results:
        return

    df = pd.DataFrame([
        {k: v for k, v in r.items() if k not in ("probs", "labels")}
        for r in visual_results
    ])
    df.to_csv(ABLATION_V2_DIR / "ablation_results_v2.csv", index=False)

    fig, axes = plt.subplots(1, 3, figsize=(20, 6))
    colors = ["#2ecc71", "#e74c3c", "#3498db", "#f39c12", "#9b59b6"]
    names = df["Variant"].tolist()

    for ax_idx, (col, title) in enumerate([
        ("AUC", "AUC Score by Variant"),
        ("Acc_optimal", "Accuracy (Optimal Threshold)"),
        ("F1_optimal", "F1 Score (Optimal Threshold)"),
    ]):
        bars = axes[ax_idx].bar(
            names, df[col], color=colors[: len(names)], edgecolor="white", linewidth=1.5
        )
        axes[ax_idx].set_title(title, fontsize=13, fontweight="bold")
        axes[ax_idx].set_ylabel(col)
        y_min = max(0.0, float(df[col].min()) - 0.05)
        axes[ax_idx].set_ylim(y_min, float(df[col].max()) + 0.05)
        for bar, val in zip(bars, df[col]):
            axes[ax_idx].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.005,
                f"{val:.4f}",
                ha="center",
                fontweight="bold",
                fontsize=10,
            )
        axes[ax_idx].tick_params(axis="x", rotation=20)

    plt.suptitle("Ablation Study — Confusion Detection on DAiSEE", fontsize=15, fontweight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(ABLATION_V2_DIR / "ablation_comparison_v2.png", dpi=200, bbox_inches="tight")
    plt.close()

    fig2, ax2 = plt.subplots(figsize=(8, 7))
    for i, r in enumerate(visual_results):
        if "probs" in r and "labels" in r:
            fpr, tpr, _ = roc_curve(np.array(r["labels"]), np.array(r["probs"]))
            ax2.plot(fpr, tpr, color=colors[i], lw=2, label=f"{r['Variant']} (AUC={r['AUC']:.4f})")
    ax2.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax2.set_xlabel("False Positive Rate", fontsize=12)
    ax2.set_ylabel("True Positive Rate", fontsize=12)
    ax2.set_title("ROC Curves — Visual & Temporal Ablation Study", fontsize=14, fontweight="bold")
    ax2.legend(loc="lower right", fontsize=10)
    plt.tight_layout()
    plt.savefig(ABLATION_V2_DIR / "ablation_roc_v2.png", dpi=200, bbox_inches="tight")
    plt.close()


def main():
    print("=" * 72)
    print("  STEP 05: SCIENTIFIC ABLATION STUDY (VISUAL/TEMPORAL & MULTIMODAL)")
    print("=" * 72)

    visual_results = load_visual_ablation_results()
    if visual_results:
        print("\n[A] Visual & Temporal Architecture Ablation (DAiSEE Test Split — 1,784 clips):")
        print(f"  {'Variant':<24s} | {'Acc(0.5)':>8s} | {'AUC':>6s} | {'Opt_t':>5s} | {'Acc(Opt)':>8s} | {'F1(Opt)':>7s}")
        print("  " + "-" * 68)
        for r in visual_results:
            print(
                f"  {r['Variant']:<24s} | {r['Acc_default']:>8.4f} | {r['AUC']:>6.4f} | "
                f"{r['Optimal_Threshold']:>5.2f} | {r['Acc_optimal']:>8.4f} | {r['F1_optimal']:>7.4f}"
            )
        render_ablation_charts(visual_results)

    mm_results = load_multimodal_ablation_results()
    if mm_results:
        print("\n[B] Multimodal 12-Feature Modality Ablation (5-Fold Stratified CV):")
        print(f"  {'Modality Configuration':<24s} | {'Feats':>5s} | {'Acc':>6s} | {'Prec':>6s} | {'Rec':>6s} | {'F1':>6s} | {'AUC':>6s}")
        print("  " + "-" * 68)
        for r in mm_results:
            print(
                f"  {r['config']:<24s} | {r['n_features']:>5d} | {r['accuracy']:>6.4f} | "
                f"{r['precision']:>6.4f} | {r['recall']:>6.4f} | {r['f1']:>6.4f} | {r['auc']:>6.4f}"
            )


if __name__ == "__main__":
    main()
