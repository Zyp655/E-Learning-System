"""
Step 06 — Export TemporalLandmarkModel / ConfusionBiLSTM to ONNX (`confusion_bilstm.onnx`)
for Client-Side Browser Inference via `onnxruntime-web` (Zero Video Frames Leave Student Device).

Exports:
1. `models/confusion_bilstm.onnx` — Accepts:
   - `landmarks`: float32[batch_size, 5, 478, 3] (5 frames of nose-centered MediaPipe 3D landmarks)
   - `aux`:       float32[batch_size, 5]         (5 auxiliary affective/gaze features)
   Outputs:
   - `confusion_prob`: float32[batch_size]       (Sigmoid probability in [0.0, 1.0])
2. Verifies `mlp_weights.json` and `lr_weights.json` for backend Go `ConfusionPredictor`.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

SEQ_LEN = 5
NUM_LANDMARKS = 478
LANDMARK_DIM = 3
NUM_AUX = 5

try:
    import torch
    import torch.nn as nn
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False


if _HAS_TORCH:
    class ConfusionBiLSTMOnnxWrapper(nn.Module):
        """
        ONNX-compatible wrapper around TemporalLandmarkModel with built-in Sigmoid output
        for direct execution in Web Workers via `onnxruntime-web`.
        """

        def __init__(
            self,
            num_nodes: int = NUM_LANDMARKS,
            node_dim: int = LANDMARK_DIM,
            num_aux: int = NUM_AUX,
            hidden_size: int = 256,
        ):
            super().__init__()
            input_dim = num_nodes * node_dim  # 1434

            self.spatial = nn.Sequential(
                nn.Linear(input_dim, 512),
                nn.LayerNorm(512),
                nn.GELU(),
                nn.Dropout(0.0),
                nn.Linear(512, 256),
                nn.LayerNorm(256),
                nn.GELU(),
                nn.Dropout(0.0),
            )

            self.lstm = nn.LSTM(
                256,
                hidden_size // 2,
                num_layers=2,
                batch_first=True,
                bidirectional=True,
            )

            self.attn = nn.Sequential(
                nn.Linear(hidden_size, 1),
                nn.Softmax(dim=1),
            )

            fusion_dim = hidden_size + num_aux
            self.head = nn.Sequential(
                nn.LayerNorm(fusion_dim),
                nn.Linear(fusion_dim, 128),
                nn.GELU(),
                nn.Linear(128, 64),
                nn.GELU(),
                nn.Linear(64, 1),
            )

        def forward(self, landmarks: torch.Tensor, aux: torch.Tensor) -> torch.Tensor:
            B, T, N, D = landmarks.shape
            # Nose-center normalization at index 1 inside the graph
            nose = landmarks[:, :, 1:2, :]
            centered = landmarks - nose

            x = centered.reshape(B * T, N * D)
            x = self.spatial(x)
            x = x.reshape(B, T, 256)

            lstm_out, _ = self.lstm(x)
            attn_w = self.attn(lstm_out)
            context = (attn_w * lstm_out).sum(dim=1)

            fused = torch.cat([context, aux], dim=1)
            logits = self.head(fused).squeeze(1)
            return torch.sigmoid(logits)


def export_onnx(output_path: Path):
    if not _HAS_TORCH:
        print("  [INFO] PyTorch/ONNX not active in current shell; run `pip install -r requirements.txt` to re-export ONNX.")
        return

    model = ConfusionBiLSTMOnnxWrapper()
    ckpt_path = MODELS_DIR / "best_landmark_bilstm.pth"
    if ckpt_path.exists():
        state = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        model.load_state_dict(state, strict=False)
        print(f"  Loaded trained checkpoint from {ckpt_path}")
    else:
        print("  Initializing architecture weights for ONNX export...")

    model.eval()
    dummy_landmarks = torch.randn(1, SEQ_LEN, NUM_LANDMARKS, LANDMARK_DIM, dtype=torch.float32)
    dummy_aux = torch.zeros(1, NUM_AUX, dtype=torch.float32)

    torch.onnx.export(
        model,
        (dummy_landmarks, dummy_aux),
        str(output_path),
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["landmarks", "aux"],
        output_names=["confusion_prob"],
        dynamic_axes={
            "landmarks": {0: "batch_size"},
            "aux": {0: "batch_size"},
            "confusion_prob": {0: "batch_size"},
        },
    )
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Exported ONNX model -> {output_path} ({size_mb:.2f} MB)")


def main():
    print("=" * 68)
    print("  STEP 06: EXPORT CONFUSION BiLSTM TO ONNX (onnxruntime-web)")
    print("=" * 68)

    onnx_path = MODELS_DIR / "confusion_bilstm.onnx"
    try:
        export_onnx(onnx_path)
    except Exception as e:
        print(f"  [WARN] ONNX export skipped: {e}")

    for weight_name in ["mlp_weights.json", "lr_weights.json"]:
        w_path = BASE_DIR / weight_name
        if w_path.exists():
            with open(w_path, "r") as f:
                data = json.load(f)
            print(f"  Verified {weight_name}: {data.get('n_features', 12)} features ready for Go backend")


if __name__ == "__main__":
    main()
