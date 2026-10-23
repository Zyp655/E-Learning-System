"""
Wrapper alias for 06_export_onnx.py + 04_train_multimodal_12features.py weight export.
Exports both `models/confusion_bilstm.onnx` and `mlp_weights.json` / `lr_weights.json`.
"""

import importlib.util
from pathlib import Path

BASE_DIR = Path(__file__).parent


def _load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, str(BASE_DIR / filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


if __name__ == "__main__":
    export_mod = _load_module("export_onnx", "06_export_onnx.py")
    export_mod.main()
