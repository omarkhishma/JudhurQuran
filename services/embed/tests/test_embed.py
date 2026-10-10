"""The embedding package (P17.2, D34): every model pinned; the chosen model's files present and the pinned ones; its
vectors unit-length, the same on every call, and nearer for a related text than an unrelated one; the service
refusing what it should and answering what it should. Without the model's files (CI) the model's tests skip with
that reason; JADHR_REQUIRE_DATA=1 makes the absence a failure.
"""

from __future__ import annotations

import base64
import os
import re

import numpy as np
import pytest
from jadhr_embed.models import DEFAULT, MODELS, chosen, folder

HEX = re.compile(r"^[0-9a-f]{64}$")


def test_every_model_is_pinned_to_a_revision_and_each_file_to_its_sha256() -> None:
    assert DEFAULT in MODELS
    tags = set()
    for name, s in MODELS.items():
        assert s.name == name
        assert re.fullmatch(r"[0-9a-f]{40}", s.revision), name
        assert s.licence in ("MIT", "Apache-2.0"), name  # D34: open models only
        assert s.onnx in s.files and "tokenizer.json" in s.files, name
        for rel, (digest, size) in s.files.items():
            assert HEX.match(digest) and size > 0, (name, rel)
        tags.add(s.tag)
    # two variants of one model (full precision and 8-bit) never share a tag: their vectors are not comparable
    assert len(tags) == len(MODELS)


def _have_model() -> bool:
    spec = chosen()
    return all((folder(spec) / rel).exists() for rel in spec.files)


needs_model = pytest.mark.skipif(
    not _have_model() and os.environ.get("JADHR_REQUIRE_DATA") != "1",
    reason="the chosen model's files are not here (uv run python -m jadhr_embed fetch)",
)


@pytest.fixture(scope="module")
def enc():
    from jadhr_embed.encoder import Encoder

    return Encoder.load()  # verifies every file against its sha256


@needs_model
def test_vectors_are_unit_length_deterministic_and_nearer_for_related_text(enc) -> None:
    texts = [
        "الصبر على البلاء",
        "إن الله مع الصابرين على ما يصيبهم من الشدائد",
        "يوصيكم الله في أولادكم للذكر مثل حظ الأنثيين",
    ]
    q = enc.encode(texts[:1], "query")
    p = enc.encode(texts[1:], "passage")
    assert q.shape == (1, enc.spec.dim) and p.shape == (2, enc.spec.dim)
    assert np.allclose(np.linalg.norm(p, axis=1), 1, atol=1e-5)
    assert np.array_equal(p, enc.encode(texts[1:], "passage"))
    # a text's vector depends on the text alone, not on the texts read with it (the 8-bit model's scale is taken from
    # its whole input, so the encoder reads one text at a time)
    assert np.array_equal(p[0], enc.encode(texts[1:2], "passage")[0])
    assert np.array_equal(p[1], enc.encode([texts[2], texts[0], texts[1]], "passage")[0])
    sims = (p @ q.T).ravel()
    assert sims[0] > sims[1], sims  # patience is nearer patience than inheritance
    # a question and a passage are told apart by the model's prefixes
    assert not np.array_equal(enc.encode(texts[:1], "passage"), q)


@needs_model
def test_the_service_answers_vectors_and_refuses_what_it_should() -> None:
    from jadhr_embed.server import app
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        h = c.get("/healthz").json()
        assert h == {"model": chosen().tag, "dim": chosen().dim}
        r = c.post("/embed", json={"texts": ["رحمة", "mercy"], "kind": "query"})
        assert r.status_code == 200
        body = r.json()
        vec = np.frombuffer(base64.b64decode(body["vectors"]), dtype="<f4").reshape(2, body["dim"])
        assert body["model"] == chosen().tag and np.allclose(np.linalg.norm(vec, axis=1), 1, atol=1e-5)
        for bad in (
            {"texts": [], "kind": "query"},
            {"texts": ["x"] * 33, "kind": "query"},
            {"texts": ["x" * 2001], "kind": "query"},
            {"texts": [""], "kind": "query"},
            {"texts": ["x"], "kind": "other"},
            {"texts": "x", "kind": "query"},
        ):
            assert c.post("/embed", json=bad).status_code == 422, bad
        assert c.post("/embed", content=b"not json").status_code == 400
        assert c.get("/embed").status_code == 405
