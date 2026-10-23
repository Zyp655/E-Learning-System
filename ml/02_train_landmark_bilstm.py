"""
Step 02 — Train TemporalLandmarkModel (478x3 Landmarks -> Spatial MLP -> 2-Layer BiLSTM -> Attention + 5 Aux).

Architecture:
- Input sequence: T=5 frames of 478 3D MediaPipe facial landmarks (nose-centered at index 1) -> [B, 5, 478, 3]
- Spatial Feature Extractor: Linear(1434 -> 512) -> LayerNorm -> GELU -> Linear(512 -> 256)
- Temporal Sequence Encoder: 2-Layer Bidirectional LSTM (hidden_size=256)
- Temporal Attention Pooling: Softmax attention weights across T frames
- Multimodal Fusion: Concatenates 5 auxiliary affective features (Boredom, Engagement, Frustration,
  Bore/Engage ratio, Negative Affect sum) -> Classification Head -> Confusion Logit
- Loss & Regularization: Focal Loss (alpha=0.6, gamma=2.0, label smoothing=0.05) + Exponential Moving Average (EMA)
"""

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
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

BASE_DIR = Path(__file__).parent
FRAMES_DIR = BASE_DIR / "frames_v2"
OUTPUT_DIR = BASE_DIR / "output_gnn"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

BATCH_SIZE = 64
SEQ_LEN = 5
SEED = 42
EPOCHS = 50

torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class LandmarkDataset(Dataset):
    """Loads nose-centered 478x3 facial landmark sequences and 5 auxiliary features per clip."""

    def __init__(self, csv_path: Path, npz_path: Path, split: str, seq_len: int = SEQ_LEN):
        df = pd.read_csv(csv_path)
        sep_pattern = f"/{split}/" if "/" in str(df["frame_path"].iloc[0]) else f"\\\\{split}\\\\"
        df = df[df["frame_path"].str.contains(sep_pattern, regex=True)]

        self.seq_len = seq_len
        self.clips = []
        data = np.load(npz_path)

        for clip_id, group in df.groupby("clip_id"):
            cid_str = str(clip_id)
            if cid_str not in data:
                continue

            lm_seq = data[cid_str]  # [num_frames, 478, 3]
            label = int(group["is_confused"].iloc[0])
            b = float(group["boredom"].iloc[0]) / 3.0
            e = float(group["engagement"].iloc[0]) / 3.0
            f = float(group["frustration"].iloc[0]) / 3.0
            aux = [b, e, f, b / (e + 0.01), b + f]

            self.clips.append({
                "landmarks": lm_seq,
                "label": label,
                "aux": aux,
                "clip_id": clip_id,
            })

    def __len__(self):
        return len(self.clips)

    def __getitem__(self, idx):
        clip = self.clips[idx]
        lm_seq = clip["landmarks"]
        num_frames = len(lm_seq)

        if num_frames >= self.seq_len:
            indices = np.linspace(0, num_frames - 1, self.seq_len, dtype=int)
            lm_seq = lm_seq[indices]
        else:
            pad_len = self.seq_len - num_frames
            padding = np.repeat(lm_seq[-1:], pad_len, axis=0)
            lm_seq = np.concatenate([lm_seq, padding], axis=0)

        seq_tensor = torch.tensor(lm_seq, dtype=torch.float32)  # [5, 478, 3]
        # Nose-center at landmark index 1
        nose_coords = seq_tensor[:, 1:2, :]
        seq_tensor = seq_tensor - nose_coords

        aux = torch.tensor(clip["aux"], dtype=torch.float32)
        label = torch.tensor(clip["label"], dtype=torch.float32)
        return seq_tensor, aux, label


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
    def __init__(self, model: nn.Module, decay: float = 0.995):
        self.decay = decay
        self.shadow = {k: v.clone().detach() for k, v in model.state_dict().items()}

    def update(self, model: nn.Module):
        for k, v in model.state_dict().items():
            self.shadow[k] = self.decay * self.shadow[k] + (1.0 - self.decay) * v

    def apply(self, model: nn.Module):
        model.load_state_dict(self.shadow)


class TemporalLandmarkModel(nn.Module):
    """
    478x3 MediaPipe Landmarks -> Spatial MLP -> 2-layer BiLSTM -> Temporal Attention + 5 Aux Features.
    """

    def __init__(self, num_nodes: int = 478, node_dim: int = 3, num_aux: int = 5, hidden_size: int = 256):
        super().__init__()
        input_dim = num_nodes * node_dim  # 1434

        self.spatial = nn.Sequential(
            nn.Linear(input_dim, 512),
            nn.LayerNorm(512),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.LayerNorm(256),
            nn.GELU(),
            nn.Dropout(0.3),
        )

        self.lstm = nn.LSTM(
            256,
            hidden_size // 2,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.3,
        )

        self.attn = nn.Sequential(
            nn.Linear(hidden_size, 1),
            nn.Softmax(dim=1),
        )

        fusion_dim = hidden_size + num_aux
        self.head = nn.Sequential(
            nn.LayerNorm(fusion_dim),
            nn.Dropout(0.4),
            nn.Linear(fusion_dim, 128),
            nn.GELU(),
            nn.BatchNorm1d(128),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1),
        )

    def forward(self, seq: torch.Tensor, aux: torch.Tensor) -> torch.Tensor:
        B, T, N, D = seq.shape
        x = seq.reshape(B * T, N * D)
        x = self.spatial(x)
        x = x.reshape(B, T, 256)

        lstm_out, _ = self.lstm(x)
        attn_w = self.attn(lstm_out)
        context = (attn_w * lstm_out).sum(dim=1)

        fused = torch.cat([context, aux], dim=1)
        return self.head(fused).squeeze(1)


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_probs, all_labels = [], []
    criterion = nn.BCEWithLogitsLoss()

    for seq, aux, labels in loader:
        seq, aux, labels = seq.to(device), aux.to(device), labels.to(device)
        out = model(seq, aux)
        loss = criterion(out, labels)

        total_loss += loss.item() * seq.size(0)
        probs = torch.sigmoid(out)
        preds = (probs > 0.5).long()

        correct += (preds == labels.long()).sum().item()
        total += seq.size(0)
        all_probs.extend(probs.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

    acc = correct / max(total, 1)
    try:
        auc = roc_auc_score(all_labels, all_probs)
    except Exception:
        auc = 0.0
    return total_loss / max(total, 1), acc, auc


def find_optimal_threshold(model: nn.Module, loader: DataLoader) -> float:
    model.eval()
    all_probs, all_labels = [], []
    with torch.no_grad():
        for seq, aux, labels in loader:
            seq, aux = seq.to(device), aux.to(device)
            out = model(seq, aux)
            all_probs.extend(torch.sigmoid(out).cpu().numpy())
            all_labels.extend(labels.numpy())

    best_t, best_f1 = 0.5, 0.0
    probs_arr = np.array(all_probs)
    labels_arr = np.array(all_labels)
    for t in np.arange(0.1, 0.9, 0.01):
        preds = (probs_arr > t).astype(int)
        tp = ((preds == 1) & (labels_arr == 1)).sum()
        fp = ((preds == 1) & (labels_arr == 0)).sum()
        fn = ((preds == 0) & (labels_arr == 1)).sum()
        prec = tp / (tp + fp + 1e-8)
        rec = tp / (tp + fn + 1e-8)
        f1 = 2 * prec * rec / (prec + rec + 1e-8)
        if f1 > best_f1:
            best_f1 = f1
            best_t = float(t)
    return best_t


def main():
    print("=" * 68)
    print("  STEP 02: TEMPORAL LANDMARK BiLSTM CONFUSION MODEL")
    print("  478x3 MediaPipe Landmarks -> Spatial MLP -> 2-Layer BiLSTM -> Attention + 5 Aux")
    print("=" * 68)

    csv_path = FRAMES_DIR / "frame_labels.csv"
    npz_path = FRAMES_DIR / "landmarks.npz"

    if not npz_path.exists() or not csv_path.exists():
        print(f"  [INFO] {npz_path} not found. Run 01_extract_frames_and_landmarks.py first.")
        return

    train_ds = LandmarkDataset(csv_path, npz_path, "train")
    val_ds = LandmarkDataset(csv_path, npz_path, "validation")
    test_ds = LandmarkDataset(csv_path, npz_path, "test")

    labels = [c["label"] for c in train_ds.clips]
    class_counts = Counter(labels)
    weights = [1.0 / class_counts[l] for l in labels]
    sampler = WeightedRandomSampler(weights, len(weights))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = TemporalLandmarkModel().to(device)
    criterion = FocalLoss(alpha=0.6, gamma=2.0, smoothing=0.05)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=10, T_mult=2, eta_min=1e-6)
    ema = EMA(model, decay=0.995)

    best_auc = 0.0
    patience = 0
    patience_limit = 15
    history = {"train_loss": [], "val_auc": []}

    for epoch in range(EPOCHS):
        t0 = time.time()
        model.train()
        total_loss, total = 0.0, 0

        for seq, aux, y in train_loader:
            seq, aux, y = seq.to(device), aux.to(device), y.to(device)
            seq = seq + torch.randn_like(seq) * 0.005

            optimizer.zero_grad()
            out = model(seq, aux)
            loss = criterion(out, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            ema.update(model)

            total_loss += loss.item() * seq.size(0)
            total += seq.size(0)

        scheduler.step()
        ema_state = {k: v.clone() for k, v in model.state_dict().items()}
        ema.apply(model)
        val_loss, val_acc, val_auc = evaluate(model, val_loader)
        model.load_state_dict(ema_state)

        history["train_loss"].append(total_loss / max(total, 1))
        history["val_auc"].append(val_auc)

        print(
            f"  Epoch {epoch+1:2d}/{EPOCHS} | Train Loss: {total_loss/max(total,1):.4f} | "
            f"Val Acc: {val_acc:.4f} | Val AUC: {val_auc:.4f} | {time.time()-t0:.1f}s"
        )

        if val_auc > best_auc:
            best_auc = val_auc
            ema.apply(model)
            torch.save(model.state_dict(), MODELS_DIR / "best_landmark_bilstm.pth")
            model.load_state_dict(ema_state)
            patience = 0
        else:
            patience += 1
            if patience >= patience_limit:
                print(f"  Early stopping at epoch {epoch+1}")
                break

    model.load_state_dict(torch.load(MODELS_DIR / "best_landmark_bilstm.pth", weights_only=True))
    opt_threshold = find_optimal_threshold(model, val_loader)

    all_probs, all_labels = [], []
    model.eval()
    with torch.no_grad():
        for seq, aux, y in test_loader:
            seq, aux = seq.to(device), aux.to(device)
            out = model(seq, aux)
            all_probs.extend(torch.sigmoid(out).cpu().numpy())
            all_labels.extend(y.numpy())

    probs = np.array(all_probs)
    yt = np.array(all_labels)
    yp_opt = (probs > opt_threshold).astype(int)
    print("\n=== TEST SET CLASSIFICATION REPORT ===")
    print(classification_report(yt, yp_opt, target_names=["Not Confused", "Confused"], digits=4))


if __name__ == "__main__":
    main()
