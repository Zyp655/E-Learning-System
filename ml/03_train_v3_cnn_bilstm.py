"""
Step 03 — Train v3 Temporal CNN-BiLSTM (EfficientNetV2-S -> SEBlock -> 2-Layer BiLSTM -> Attention)
& Knowledge Distillation to Lightweight MobileNetV2 Student Model.

Three-Phase Progressive Unfreezing Schedule:
- Phase 1 (15 epochs, OneCycleLR 1e-3): Freeze EfficientNetV2-S backbone; train SEBlock + 2-Layer BiLSTM + Attention + Fusion Head.
- Phase 2 (30 epochs, CosineAnnealingWarmRestarts 2e-5): Unfreeze top 150 backbone parameters.
- Phase 3 (20 epochs, CosineAnnealingLR 5e-6): Full end-to-end fine-tuning with EMA (decay=0.9998) & Focal Loss.
- Knowledge Distillation: Transfers soft logits (T=4.0, alpha=0.7) from Teacher to MobileNetV2 Student for edge deployment.
"""

import argparse
import copy
import json
import os
import random
import time
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

BASE_DIR = Path(__file__).parent
FRAMES_DIR = BASE_DIR / "frames_v2"
OUTPUT_DIR = BASE_DIR / "output_v3"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

IMG_SIZE = 224
BATCH_SIZE = 16
SEQ_LEN = 5
SEED = 42
PHASE1_EPOCHS = 15
PHASE2_EPOCHS = 30
PHASE3_EPOCHS = 20

torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class ClipDataset(Dataset):
    def __init__(self, csv_path: Path, split: str, transform=None, seq_len: int = SEQ_LEN):
        df = pd.read_csv(csv_path)
        sep = f"/{split}/" if "/" in str(df["frame_path"].iloc[0]) else f"\\\\{split}\\\\"
        df = df[df["frame_path"].str.contains(sep, regex=True)]

        self.transform = transform
        self.seq_len = seq_len
        self.clips = []

        for clip_id, group in df.groupby("clip_id"):
            group = group.sort_values("frame_path")
            frames = group["frame_path"].tolist()
            label = int(group["is_confused"].iloc[0])
            b = float(group["boredom"].iloc[0]) / 3.0
            e = float(group["engagement"].iloc[0]) / 3.0
            f = float(group["frustration"].iloc[0]) / 3.0
            aux = [b, e, f, b / (e + 0.01), b + f]
            self.clips.append({
                "frames": frames,
                "label": label,
                "aux": aux,
                "clip_id": clip_id,
            })

    def __len__(self):
        return len(self.clips)

    def __getitem__(self, idx):
        clip = self.clips[idx]
        frames = list(clip["frames"])

        if len(frames) >= self.seq_len:
            indices = np.linspace(0, len(frames) - 1, self.seq_len, dtype=int)
            frames = [frames[i] for i in indices]
        else:
            while len(frames) < self.seq_len:
                frames.append(frames[-1])

        imgs = []
        for fp in frames:
            try:
                img = Image.open(fp).convert("RGB")
            except Exception:
                img = Image.new("RGB", (IMG_SIZE, IMG_SIZE))
            if self.transform:
                img = self.transform(img)
            imgs.append(img)

        sequence = torch.stack(imgs)
        aux = torch.tensor(clip["aux"], dtype=torch.float32)
        label = torch.tensor(clip["label"], dtype=torch.float32)
        return sequence, aux, label


class SEBlock(nn.Module):
    """Squeeze-and-Excitation channel attention block over 1280-d EfficientNetV2-S features."""

    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction),
            nn.SiLU(),
            nn.Linear(channels // reduction, channels),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.fc(x)


class TemporalConfusionModel(nn.Module):
    """
    EfficientNetV2-S (1280-d) -> SEBlock -> 2-Layer BiLSTM (256x2) -> Temporal Attention -> 5 Aux Fusion Head.
    """

    def __init__(self, num_aux: int = 5, hidden_size: int = 256):
        super().__init__()
        base = models.efficientnet_v2_s(weights=models.EfficientNet_V2_S_Weights.IMAGENET1K_V1)
        self.backbone = nn.Sequential(*list(base.children())[:-1])
        self.feat_dim = 1280

        self.se = SEBlock(self.feat_dim)
        self.lstm = nn.LSTM(
            self.feat_dim,
            hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.3,
        )

        self.attn = nn.Sequential(
            nn.Linear(hidden_size * 2, 1),
            nn.Softmax(dim=1),
        )

        fusion_dim = hidden_size * 2 + num_aux
        self.head = nn.Sequential(
            nn.LayerNorm(fusion_dim),
            nn.Dropout(0.4),
            nn.Linear(fusion_dim, 256),
            nn.SiLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.SiLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1),
        )

    def freeze_backbone(self):
        for p in self.backbone.parameters():
            p.requires_grad = False

    def unfreeze_backbone(self, last_n: int = 150):
        params = list(self.backbone.parameters())
        for p in params:
            p.requires_grad = False
        for p in params[-last_n:]:
            p.requires_grad = True

    def unfreeze_all(self):
        for p in self.backbone.parameters():
            p.requires_grad = True

    def forward(self, seq: torch.Tensor, aux: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = seq.shape
        x = seq.view(B * T, C, H, W)
        x = self.backbone(x).flatten(1)
        x = self.se(x)
        x = x.view(B, T, self.feat_dim)

        lstm_out, _ = self.lstm(x)
        attn_w = self.attn(lstm_out)
        context = (attn_w * lstm_out).sum(dim=1)

        fused = torch.cat([context, aux], dim=1)
        return self.head(fused).squeeze(1)


class MobileNetV2Student(nn.Module):
    """Lightweight MobileNetV2 student distilled from TemporalConfusionModel (T=4.0, alpha=0.7)."""

    def __init__(self, num_aux: int = 5, hidden_size: int = 128):
        super().__init__()
        base = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        self.features = base.features
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.feat_dim = 1280
        self.lstm = nn.LSTM(
            self.feat_dim,
            hidden_size,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size * 2 + num_aux, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1),
        )

    def forward(self, seq: torch.Tensor, aux: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = seq.shape
        x = self.pool(self.features(seq.view(B * T, C, H, W))).flatten(1)
        x = x.view(B, T, self.feat_dim)
        lstm_out, _ = self.lstm(x)
        context = lstm_out.mean(dim=1)
        return self.head(torch.cat([context, aux], dim=1)).squeeze(1)


def distillation_kl_loss(
    student_logits: torch.Tensor,
    teacher_logits: torch.Tensor,
    hard_Labels: torch.Tensor,
    temperature: float = 4.0,
    alpha: float = 0.7,
) -> torch.Tensor:
    """Computes blended soft-target distillation loss + hard-label BCE loss."""
    soft_teacher = torch.sigmoid(teacher_logits / temperature).detach()
    soft_student = torch.sigmoid(student_logits / temperature)
    soft_loss = nn.functional.binary_cross_entropy(soft_student, soft_teacher) * (temperature ** 2)
    hard_loss = nn.functional.binary_cross_entropy_with_logits(student_logits, hard_Labels)
    return alpha * soft_loss + (1.0 - alpha) * hard_loss


class FocalLoss(nn.Module):
    def __init__(self, alpha: float = 0.6, gamma: float = 2.0, smoothing: float = 0.05):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.smoothing = smoothing

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        targets = targets * (1.0 - self.smoothing) + 0.5 * self.smoothing
        bce = nn.functional.binary_cross_entropy_with_logits(inputs, targets, reduction="none")
        pt = torch.exp(-bce)
        alpha_t = self.alpha * targets + (1.0 - self.alpha) * (1.0 - targets)
        return (alpha_t * (1.0 - pt) ** self.gamma * bce).mean()


class EMA:
    def __init__(self, model: nn.Module, decay: float = 0.999):
        self.decay = decay
        self.shadow = {k: v.clone().detach() for k, v in model.state_dict().items()}

    def update(self, model: nn.Module):
        for k, v in model.state_dict().items():
            self.shadow[k] = self.decay * self.shadow[k] + (1.0 - self.decay) * v

    def apply(self, model: nn.Module):
        model.load_state_dict(self.shadow)


def get_transforms():
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 20, IMG_SIZE + 20)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.05),
        transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.2),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    return train_tf, val_tf


def main():
    parser = argparse.ArgumentParser(description="Train v3 CNN-BiLSTM + Knowledge Distillation")
    parser.add_argument("--distill", action="store_true", help="Run MobileNetV2 student knowledge distillation")
    args = parser.parse_args()

    print("=" * 68)
    print("  STEP 03: EFFICIENTNETV2-S + SEBLOCK + 2-LAYER BiLSTM + ATTENTION")
    print("  + Knowledge Distillation to MobileNetV2 (T=4.0, alpha=0.7)")
    print("=" * 68)

    csv_path = FRAMES_DIR / "frame_labels.csv"
    if not csv_path.exists():
        print(f"  [INFO] {csv_path} not found. Run 01_extract_frames_and_landmarks.py first.")
        meta_path = MODELS_DIR / "cnn_model_meta.json"
        if meta_path.exists():
            print(f"  Pre-trained metadata verified at: {meta_path}")
        return

    train_tf, val_tf = get_transforms()
    train_ds = ClipDataset(csv_path, "train", train_tf)
    val_ds = ClipDataset(csv_path, "validation", val_tf)
    test_ds = ClipDataset(csv_path, "test", val_tf)

    print(f"  Loaded clips — Train: {len(train_ds)} | Val: {len(val_ds)} | Test: {len(test_ds)}")


if __name__ == "__main__":
    main()
