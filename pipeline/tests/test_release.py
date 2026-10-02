"""Release artefacts: every file matches its manifest hash, counts match the build, the text is verbatim."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from judhur_pipeline.release import REPO, build_release


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
