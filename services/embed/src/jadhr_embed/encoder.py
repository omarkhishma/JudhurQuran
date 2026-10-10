"""Text to vectors with a pinned model (D34): its tokenizer and its ONNX graph, on the CPU, the same arithmetic on the
build's machine and on the server, so a question asked on the server meets the build's vectors in one space.

    enc = Encoder.load()                     # the chosen model, its files checked against their sha256
    enc.encode(["الصبر على البلاء"], "query")  # (1, dim) float32, unit length
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from .models import Spec, chosen, folder

Kind = Literal["query", "passage"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def verify(spec: Spec, root: Path | None = None) -> Path:
    """The model's folder when every file is there and is the pinned one; else an error naming what is wrong."""
    root = root or folder(spec)
    for rel, (digest, size) in spec.files.items():
        p = root / rel
        if not p.exists():
            raise FileNotFoundError(
                f"{spec.tag}: {rel} is missing — run `uv run python -m jadhr_embed fetch {spec.name}`"
            )
        if p.stat().st_size != size or sha256(p) != digest:
            raise RuntimeError(f"{spec.tag}: {rel} is not the pinned file (sha256 differs)")
    return root


class Encoder:
    def __init__(self, spec: Spec, root: Path, threads: int = 2):
        self.spec = spec
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        # the graph as written: the same operations on every machine, so the build's vectors and a query's agree
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        self.session = ort.InferenceSession(str(root / spec.onnx), opts, providers=["CPUExecutionProvider"])
        self.inputs = {i.name for i in self.session.get_inputs()}
        tok = Tokenizer.from_file(str(root / "tokenizer.json"))
        tok.enable_truncation(max_length=spec.max_tokens)
        pad = tok.token_to_id("<pad>")
        tok.enable_padding(pad_id=pad if pad is not None else 0, pad_token="<pad>")
        self.tokenizer = tok

    @classmethod
    def load(cls, spec: Spec | None = None, threads: int = 2, check: bool = True) -> Encoder:
        spec = spec or chosen()
        root = verify(spec) if check else folder(spec)
        return cls(spec, root, threads)

    def encode(self, texts: list[str], kind: Kind, batch: int = 1) -> np.ndarray:
        """Each text alone by default: the 8-bit model takes its activations' scale from the whole batch, padding
        included, so a text read beside others comes out a little different (cosine 0.996). Alone, a vector depends
        on its text only — the build's cache by text and a query's vector rely on that."""
        prefix = self.spec.query_prefix if kind == "query" else self.spec.passage_prefix
        out = np.zeros((len(texts), self.spec.dim), dtype=np.float32)
        # in batches of like length, so a short question is not padded to a long passage
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        for s in range(0, len(order), batch):
            idx = order[s : s + batch]
            enc = self.tokenizer.encode_batch([prefix + texts[i] for i in idx])
            ids = np.array([e.ids for e in enc], dtype=np.int64)
            mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
            feed = {"input_ids": ids, "attention_mask": mask}
            if "token_type_ids" in self.inputs:
                feed["token_type_ids"] = np.zeros_like(ids)
            hidden = self.session.run(None, feed)[0]
            if self.spec.pooling == "cls":
                vec = hidden[:, 0]
            else:
                m = mask[..., None].astype(np.float32)
                vec = (hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)
            vec = vec / np.clip(np.linalg.norm(vec, axis=1, keepdims=True), 1e-12, None)
            out[idx] = vec.astype(np.float32)
        return out
