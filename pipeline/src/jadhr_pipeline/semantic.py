"""The verses' vectors for semantic search (PLAN P17.2, D34), built after the layers into the same directory.

Each verse is read twice by the pinned model (``jadhr_embed``): in Arabic, its plain text with al-Muyassar's
explanation of it; in English, Saheeh International's translation without its verse number and footnote marks. The
model reads them as the sources wrote them; we add no words. A vector is cached by the model and the sha256 of the
text it read (``data/tools/embed-cache``, gitignored), so a rebuild embeds only what changed.

Each verse's nearest verses (``verse_neighbours``) are computed once here: the mean of the two languages' cosines,
the verse itself and the verses around it in its own sūra left out — those are its context, which the reader shows
apart (P15) — ten kept. They are a computation, shown as such, never a claim that two verses mean the same.

    uv run python -m jadhr_pipeline.semantic data/build/2026.10.0
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

REPO = Path(__file__).resolve().parents[3]
CACHE = REPO / "data/tools/embed-cache"
SOURCES = {"ar": "muyassar", "en": "saheeh"}
NEIGHBOURS = 10
# verses this close in their own sūra are the verse's context, not a neighbour found elsewhere
CONTEXT = 5

_EN_NUMBER = re.compile(r"^\(\d+\)\s*")
_EN_NOTE = re.compile(r"\[\d+\]")


def documents(build_dir: Path) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    verses = [json.loads(line) for line in (build_dir / "verses.jsonl").open(encoding="utf-8")]
    passages: dict[str, dict[int, str]] = {w: {} for w in SOURCES.values()}
    for line in (build_dir / "work_passages.jsonl").open(encoding="utf-8"):
        p = json.loads(line)
        if p["work_id"] in passages and p["verse_from"] == p["verse_to"]:
            passages[p["work_id"]][p["verse_from"]] = p["text"]
    missing = {w: len(verses) - len(ps) for w, ps in passages.items() if len(ps) != len(verses)}
    if missing:
        raise RuntimeError(f"semantic: every verse needs its explanation and translation; missing {missing}")
    texts = {
        "ar": [f"{v['text_imlaei']} — {passages['muyassar'][v['id']]}" for v in verses],
        "en": [_EN_NOTE.sub("", _EN_NUMBER.sub("", passages["saheeh"][v["id"]])).strip() for v in verses],
    }
    return verses, texts


def _cached_encode(enc: Any, texts: list[str]) -> tuple[np.ndarray, int]:
    """The texts' vectors, from the cache where the same model already read the same text."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{enc.spec.tag.replace('@', '-')}.npz"
    have: dict[str, np.ndarray] = {}
    if path.exists():
        with np.load(path) as z:
            have = dict(zip(z["keys"].tolist(), z["vecs"], strict=True))
    keys = [hashlib.sha256(t.encode()).hexdigest() for t in texts]
    todo = [i for i, k in enumerate(keys) if k not in have]
    if todo:
        fresh = enc.encode([texts[i] for i in todo], "passage")
        for i, v in zip(todo, fresh, strict=True):
            have[keys[i]] = v
        ks = sorted(have)
        np.savez(path, keys=np.array(ks), vecs=np.stack([have[k] for k in ks]))
    return np.stack([have[k] for k in keys]).astype(np.float32), len(todo)


def neighbours(
    verses: list[dict[str, Any]], vecs: dict[str, np.ndarray]
) -> list[tuple[int, int, int, float]]:
    sim = sum(v @ v.T for v in vecs.values()) / len(vecs)
    surah = np.array([v["surah"] for v in verses])
    ayah = np.array([v["ayah"] for v in verses])
    out: list[tuple[int, int, int, float]] = []
    for i, v in enumerate(verses):
        s = sim[i].copy()
        s[(surah == surah[i]) & (np.abs(ayah - ayah[i]) <= CONTEXT)] = -np.inf
        top = np.argsort(-s, kind="stable")[:NEIGHBOURS]
        out += [(v["id"], r + 1, verses[j]["id"], round(float(s[j]), 4)) for r, j in enumerate(top)]
    return out


def build_semantic(build_dir: Path) -> dict[str, Any]:
    from jadhr_embed.encoder import Encoder

    t = time.time()
    enc = Encoder.load(threads=8)
    verses, texts = documents(build_dir)
    vecs: dict[str, np.ndarray] = {}
    embedded = 0
    for lang, docs in texts.items():
        vecs[lang], n = _cached_encode(enc, docs)
        embedded += n
    tag = enc.spec.tag
    with (build_dir / "verse_vectors.jsonl").open("w", encoding="utf-8") as fh:
        for lang, m in vecs.items():
            for v, row in zip(verses, m, strict=True):
                fh.write(
                    json.dumps(
                        {
                            "verse_id": v["id"],
                            "lang": lang,
                            "source": SOURCES[lang],
                            "model": tag,
                            "vec": base64.b64encode(row.astype("<f4").tobytes()).decode(),
                        },
                        separators=(",", ":"),
                    )
                    + "\n"
                )
    near = neighbours(verses, vecs)
    with (build_dir / "verse_neighbours.jsonl").open("w", encoding="utf-8") as fh:
        for vid, rank, nid, score in near:
            fh.write(
                json.dumps({"verse_id": vid, "rank": rank, "neighbour_id": nid, "score": score, "model": tag})
                + "\n"
            )
    return {
        "model": tag,
        "repo": enc.spec.repo,
        "dim": enc.spec.dim,
        "vectors": sum(len(m) for m in vecs.values()),
        "embedded_now": embedded,
        "neighbours": len(near),
        "seconds": round(time.time() - t, 1),
    }


if __name__ == "__main__":
    print(json.dumps(build_semantic(Path(sys.argv[1])), ensure_ascii=False))
