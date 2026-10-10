"""The embedding models we may run (P17.1, D34), each pinned: its repository's revision and every file's sha256.

The choice between them is research 25's (docs/research/25-semantic-models.md): an evaluation on Quranic queries
whose answers are known. A model's vectors are only comparable with vectors of the same model, so the model's name
and revision travel with every vector we store.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

REPO = Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class Spec:
    name: str
    repo: str
    revision: str
    licence: str
    # path in the repository → (sha256, bytes)
    files: dict[str, tuple[str, int]] = field(default_factory=dict)
    onnx: str = "onnx/model.onnx"
    pooling: Literal["mean", "cls"] = "mean"
    query_prefix: str = ""
    passage_prefix: str = ""
    dim: int = 768
    max_tokens: int = 512

    @property
    def tag(self) -> str:
        """The model as stored beside its vectors: a vector of another tag is never compared with it."""
        return f"{self.name}@{self.revision[:12]}"


def _e5(name: str, repo: str, revision: str, files: dict[str, tuple[str, int]], dim: int, onnx: str) -> Spec:
    """multilingual-E5 (MIT): mean pooling, and a prefix telling a question from a passage."""
    return Spec(
        name,
        repo,
        revision,
        "MIT",
        files,
        onnx=onnx,
        pooling="mean",
        query_prefix="query: ",
        passage_prefix="passage: ",
        dim=dim,
    )


# each repository's tokenizer, and its graph at full precision and quantised to 8-bit integers by its authors
_E5 = {
    "small": (
        "intfloat/multilingual-e5-small",
        "614241f622f53c4eeff9890bdc4f31cfecc418b3",
        384,
        ("0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39", 17082730),
        {"onnx/model.onnx": ("ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665", 470268510)},
        {
            "onnx/model_qint8_avx512_vnni.onnx": (
                "dd476dd0c2514e9b9be83aeb3853fac0763e0bdf4a71645407587d77c48a2d88",
                118346824,
            )
        },
    ),
    "base": (
        "intfloat/multilingual-e5-base",
        "d128750597153bb5987e10b1c3493a34e5a4502a",
        768,
        ("62c24cdc13d4c9952d63718d6c9fa4c287974249e16b7ade6d5a85e7bbb75626", 17082660),
        {"onnx/model.onnx": ("84a4d426f7e87a6bf5bf195f0bae2c4a7d15f675b23ca96f42fab8326d7a77aa", 1110059084)},
        {
            "onnx/model_qint8_avx512_vnni.onnx": (
                "2523551878658b305550d8759443822dbfda9ed9c8012ef2c354ba2c5b9de503",
                278686411,
            )
        },
    ),
    "large": (
        "intfloat/multilingual-e5-large",
        "3d7cfbdacd47fdda877c5cd8a79fbcc4f2a574f3",
        1024,
        ("62c24cdc13d4c9952d63718d6c9fa4c287974249e16b7ade6d5a85e7bbb75626", 17082660),
        {
            "onnx/model.onnx": ("bb5a52503a3ef35247f5b5ae6c473aaae60505dd3ffaef56d7b69e2f84683c05", 545850),
            "onnx/model.onnx_data": (
                "0cf1883fee81c63819a44e2ba0efa51d4043d9759685a4ebebbde97e0623d15c",
                2235363328,
            ),
        },
        {
            "onnx/model_qint8_avx512_vnni.onnx": (
                "46f5d13dba7ade0160c67d346087d870162950882be17ff9319f873cf6fedff1",
                561845741,
            )
        },
    ),
}

MODELS: dict[str, Spec] = {}
for _size, (_repo, _rev, _dim, _tok, _fp32, _q8) in _E5.items():
    MODELS[f"e5-{_size}"] = _e5(
        f"e5-{_size}", _repo, _rev, {**_fp32, "tokenizer.json": _tok}, _dim, "onnx/model.onnx"
    )
    MODELS[f"e5-{_size}-q8"] = _e5(
        f"e5-{_size}-q8", _repo, _rev, {**_q8, "tokenizer.json": _tok}, _dim, next(iter(_q8))
    )

# research 25's choice; JADHR_EMBED_MODEL names another for a trial, never in production without a rebuild
DEFAULT = "e5-large-q8"


def models_dir() -> Path:
    return Path(os.environ.get("JADHR_MODELS_DIR") or REPO / "data/tools/models")


def chosen() -> Spec:
    return MODELS[os.environ.get("JADHR_EMBED_MODEL") or DEFAULT]


def folder(spec: Spec) -> Path:
    return models_dir() / f"{spec.name}-{spec.revision[:12]}"
