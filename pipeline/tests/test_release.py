"""Release artefacts: every file matches its manifest hash, counts match the build, the text is verbatim."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import tarfile
import unicodedata
from pathlib import Path

import pytest
from jadhr_pipeline.release import REPO, Built, build_release


def test_release_matches_its_manifest_and_the_build(tmp_path: Path) -> None:
    out = tmp_path / "2026.10.0"
    m = build_release("2026.10.0", out)
    for f in m["files"]:
        assert hashlib.sha256((out / f["path"]).read_bytes()).hexdigest() == f["sha256"], f["path"]
    rows = {f["path"]: f["rows"] for f in m["files"]}
    for table in ("verses", "words", "roots", "lemmas", "segments"):
        assert rows[f"{table}.jsonl"] == rows[f"{table}.csv"] == m["counts"][table]
    lane = sum(
        1
        for line in (REPO / "data/build/2026.10.0/lexicon_entries.jsonl").open(encoding="utf-8")
        if '"work_id":"lane"' in line
    )
    assert lane > 5000 and rows["lexicon_lane.jsonl"] == rows["lexicon_lane.csv"] == lane
    # the lexicon as TEI Lex-0 and LMF: one entry per lemma, one per article of Lane's
    assert rows["lexicon_quran.tei.xml"] == rows["lexicon_quran.lmf.xml"] == m["counts"]["lemmas"]
    assert rows["lexicon_lane.tei.xml"] == rows["lexicon_lane.lmf.xml"] == lane
    assert {"tei", "lmf"} <= set(m["format_notes"])
    # RFC 4180: CRLF between records, and every record read back as written
    for table in ("verses", "words", "roots", "lemmas", "segments", "lexicon_lane"):
        raw = (out / f"{table}.csv").read_bytes()
        assert raw.count(b"\r\n") >= rows[f"{table}.csv"], table
        # a bare line feed only inside a quoted field: Lane's paragraphs, the text's own
        assert table == "lexicon_lane" or b"\n" not in raw.replace(b"\r\n", b""), table
        back = list(csv.DictReader(io.StringIO(raw.decode("utf-8"), newline="")))
        assert len(back) == rows[f"{table}.csv"], table
    lane_back = list(
        csv.DictReader(io.StringIO((out / "lexicon_lane.csv").read_text(encoding="utf-8"), newline=""))
    )
    lane_rows = [
        json.loads(line) for line in (out / "lexicon_lane.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert any("\n" in x["body"] for x in lane_rows)
    assert all(
        b["body"] == j["body"] and b["headword"] == j["headword"]
        for b, j in zip(lane_back, lane_rows, strict=True)
    )
    # the segment table keyed by place: every segment of the build, in order
    first = json.loads((out / "segments.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert first["segment"] == "1:1:1:1" and first["location"] == "1:1:1" and first["kind"] == "prefix"
    # the texts carried exactly from their sources; every other field NFC
    verbatim = {
        "text_qpc",
        "text_uthmani",
        "text",
        "ar",
        "lemma",
        "segments",
        "headword",
        "body",
    }  # segments: JSON of the forms
    for table in ("verses", "words", "lemmas", "roots", "segments", "lexicon_lane"):
        for line in (out / f"{table}.jsonl").read_text(encoding="utf-8").splitlines()[:2000]:
            for k, v in json.loads(line).items():
                if isinstance(v, str) and k not in verbatim:
                    assert unicodedata.is_normalized("NFC", v), (table, k)
    assert "NFC" in m["format_notes"]["unicode"] and "RFC 4180" in m["format_notes"]["csv"]
    text = [
        json.loads(line)["text_qpc"]
        for line in Path(out / "verses.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert hashlib.sha256("\n".join(text).encode()).hexdigest() == m["text_sha256"]
    assert {e["data"] for e in m["excluded"]} and all(e["reason"] for e in m["excluded"])
    # each file says its table, format and hold; a built release is not built again unless forced
    assert {(f["table"], f["format"], f["held"]) for f in m["files"] if f["table"] == "verses"} == {
        ("verses", "jsonl", "kfgqpc"),
        ("verses", "csv", "kfgqpc"),
    }
    assert {f["held"] for f in m["files"] if f["table"] not in ("verses", "lexicon_lane")} == {"qac"}
    assert {f["table"] for f in m["files"] if f["held"] == "qac"} == {
        "words",
        "segments",
        "lemmas",
        "roots",
        "lexicon_quran",
    }
    assert {(f["format"], f["held"]) for f in m["files"] if f["table"] == "lexicon_lane"} == {
        ("jsonl", None),
        ("csv", None),
        ("tei", None),
        ("lmf", None),
    }
    with pytest.raises(Built):
        build_release("2026.10.0", out)
    (out / "stray.txt").write_text("left from an earlier build")
    build_release("2026.10.0", out, force=True)
    assert not (out / "stray.txt").exists()


def test_release_labels_every_layer_by_its_real_source(tmp_path: Path) -> None:
    """Research 07: the corpus block verbatim, the corpus's Tanzil text not labelled KFGQPC, Tanzil's
    metadata credited, unlicensed qac-v2 data left out, and publication held for the owner's decisions."""
    m = build_release("2026.10.0", tmp_path)
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
    lemma_cols = json.loads((tmp_path / "lemmas.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert "gloss_en" not in lemma_cols
    # a root's gist is Maqāyīs's own words (display-only, D22): never in the bulk release
    root_cols = json.loads((tmp_path / "roots.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert not {"gist_ar", "gist_source", "gloss_en"} & set(root_cols)
    assert m["publication_hold"] and all(h["decision"] for h in m["publication_hold"])
    # Lane: Perseus's statement as Perseus's header writes it, the source credited, the notice on every file
    with tarfile.open(REPO / "data/raw/lexica/laneslexicon-lexicon_xml/lexicon_xml-f3c19fb.tar.gz") as tar:
        member = next(x for x in tar.getmembers() if x.name.endswith("/_0.xml"))
        perseus = tar.extractfile(member).read().decode("utf-8")  # type: ignore[union-attr]
    assert (
        m["copyright_notices"]["perseus"] in perseus
        and "You leave this availability statement intact." in m["copyright_notices"]["perseus"]
    )
    lane = next(x for x in m["sources"] if x["id"] == "lane")
    assert "Perseus" in lane["attribution_en"] and "CC BY-SA 3.0" in lane["attribution_en"]
    assert all(
        "Text provided by Perseus Digital Library" in f["notice"]
        for f in m["files"]
        if f["table"] == "lexicon_lane"
    )
    assert "Tanzil Quran Text" in next(
        f["notice"] for f in m["files"] if f["path"] == "lexicon_quran.lmf.xml"
    )
