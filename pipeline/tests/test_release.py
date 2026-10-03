"""Release artefacts: every file matches its manifest hash, counts match the build, the text is verbatim."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from jadhr_pipeline.release import REPO, build_release


def test_release_matches_its_manifest_and_the_build() -> None:
    m = build_release("2026.10.0")
    out = REPO / "data/release/2026.10.0"
    for f in m["files"]:
        assert hashlib.sha256((out / f["path"]).read_bytes()).hexdigest() == f["sha256"], f["path"]
    rows = {f["path"]: f["rows"] for f in m["files"]}
    for table in ("verses", "words", "roots", "lemmas"):
        assert rows[f"{table}.jsonl"] == rows[f"{table}.csv"] == m["counts"][table]
    text = [
        json.loads(line)["text_qpc"]
        for line in Path(out / "verses.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert hashlib.sha256("\n".join(text).encode()).hexdigest() == m["text_sha256"]
    assert {e["data"] for e in m["excluded"]} and all(e["reason"] for e in m["excluded"])


def test_release_labels_every_layer_by_its_real_source() -> None:
    """Research 07: the corpus block verbatim, the corpus's Tanzil text not labelled KFGQPC, Tanzil's
    metadata credited, unlicensed qac-v2 data left out, and publication held for the owner's decisions."""
    m = build_release("2026.10.0")
    raw = (REPO / "data/raw/qac/quranic-corpus-morphology-0.4.txt").read_text(encoding="utf-8")
    header = "\n".join(
        line.removeprefix("#").removeprefix("  ").rstrip()
        for line in raw.splitlines()[:26]
        if line.startswith("#")
    )
    for line in m["copyright_notices"]["qac"].splitlines():
        if line.strip():
            assert line.strip() in header, line
    notice = {f["path"].split(".")[0]: f["notice"] for f in m["files"]}
    assert "Tanzil Quran Text (Uthmani, version 1.0.2)" in notice["words"] and "KFGQPC" not in notice["words"]
    assert "Tanzil" in notice["verses"] and "KFGQPC" in notice["verses"]
    assert "may not be modified or sold" not in json.dumps(m, ensure_ascii=False)
    assert not any(f["path"].startswith("root_variants") for f in m["files"])
    lemma_cols = json.loads(
        (REPO / "data/release/2026.10.0/lemmas.jsonl").read_text(encoding="utf-8").splitlines()[0]
    )
    assert "gloss_en" not in lemma_cols
    # a root's gist is Maqāyīs's own words (display-only, D22): never in the bulk release
    root_cols = json.loads(
        (REPO / "data/release/2026.10.0/roots.jsonl").read_text(encoding="utf-8").splitlines()[0]
    )
    assert not {"gist_ar", "gist_source", "gloss_en"} & set(root_cols)
    assert m["publication_hold"] and all(h["decision"] for h in m["publication_hold"])
