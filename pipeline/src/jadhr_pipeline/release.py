"""Release artefacts: the redistributable part of a built dataset, as JSON Lines + CSV with a manifest.

    uv run python -m jadhr_pipeline.release            # data/build/<version> → data/release/<version>

Only data whose licence allows redistribution goes in; everything left out is listed in MANIFEST.json
with the reason. Every file carries its sha256 and row count. Publishing the release is the owner's call.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[3]

QAC_NOTICE = (
    "Morphology derived from the Quranic Arabic Corpus (corpus.quran.com), GNU General Public License; "
    "the source must be indicated with a link to http://corpus.quran.com."
)
TEXT_NOTICE = (
    "Quranic text: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs data v2.0 — reproduced verbatim; "
    "it may not be modified or sold."
)

EXCLUDED = [
    {
        "data": "root variants from the mustafa0x corrected fork",
        "reason": "the repository has no licence; it is shown on the site only as a cited cross-check",
    },
    {
        "data": "word-by-word English glosses and transliteration",
        "reason": "the corpus terms allow display with credit and a link; bulk redistribution is ambiguous",
    },
    {
        "data": "classical lexica (al-Mufradat, Maqayis, Lisan al-Arab, al-Sihah, Ibn Qutaybah)",
        "reason": "the digital text is display-only (research 02); Lane's Lexicon (CC BY-SA) is available from Perseus",
    },
    {
        "data": "tafsir and translations",
        "reason": "each is published by its own source under its own terms (QuranEnc, QUL) — see data/works.yaml",
    },
    {
        "data": "recitation audio and timings",
        "reason": "served by EveryAyah (CC BY-NC) and quran-align (CC BY 4.0)",
    },
]


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def _csv(rows: list[dict[str, Any]], columns: list[str]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: ("" if r.get(k) is None else r[k]) for k in columns})
    return buf.getvalue()


def build_release(version: str) -> dict[str, Any]:
    src = REPO / "data/build" / version
    out = REPO / "data/release" / version
    out.mkdir(parents=True, exist_ok=True)
    report = json.loads((src / "report.json").read_text(encoding="utf-8"))
    sources = {
        s["id"]: s
        for s in yaml.safe_load((REPO / "data/sources.yaml").read_text(encoding="utf-8"))["sources"]
    }

    roots = {r["id"]: r for r in _jsonl(src / "roots.jsonl")}
    lemmas = {x["id"]: x for x in _jsonl(src / "lemmas.jsonl")}
    verses = _jsonl(src / "verses.jsonl")
    words = _jsonl(src / "words.jsonl")
    variants = [v for v in _jsonl(src / "root_variants.jsonl") if v["source"] == "qac-v2"]

    verse_rows = [
        {
            k: v[k]
            for k in (
                "key",
                "surah",
                "ayah",
                "page",
                "juz",
                "hizb_quarter",
                "sajda",
                "text_qpc",
                "text_imlaei",
            )
        }
        for v in verses
    ]
    word_rows = [
        {
            "location": w["location"],
            "surah": w["surah"],
            "ayah": w["ayah"],
            "position": w["position"],
            "text_uthmani": w["text_uthmani"],
            "text_imlaei": w["text_imlaei"],
            "pos": w["pos"],
            "root": roots[w["root_id"]]["key"] if w["root_id"] else None,
            "lemma": lemmas[w["lemma_id"]]["ar"] if w["lemma_id"] else None,
            "lemma_id": w["lemma_id"],
            "segments": json.dumps(w["segments"], ensure_ascii=False),
        }
        for w in words
    ]
    lemma_rows = [
        {
            "id": x["id"],
            "key_buckwalter": x["key"],
            "ar": x["ar"],
            "root": roots[x["root_id"]]["key"] if x["root_id"] else None,
            "pos": x["pos"],
            "verb_form": x["verb_form"],
            "derivation": x["derivation"],
            "pattern": x.get("pattern"),
            "pattern_method": x.get("pattern_method"),
            "gloss_en": x.get("gloss_en"),
            "occurrences": x["occurrences"],
            "verse_count": x["verse_count"],
        }
        for x in lemmas.values()
    ]
    root_rows = [
        {
            k: r[k]
            for k in ("key", "spaced", "translit", "occurrences", "verse_count", "surah_count", "lemma_count")
        }
        for r in roots.values()
    ]
    variant_rows = [{"location": v["location"], "source": v["source"], "root": v["root"]} for v in variants]

    tables: list[tuple[str, list[dict[str, Any]], list[str], str]] = [
        ("verses", verse_rows, list(verse_rows[0]), TEXT_NOTICE),
        ("words", word_rows, list(word_rows[0]), f"{TEXT_NOTICE} {QAC_NOTICE}"),
        ("lemmas", lemma_rows, list(lemma_rows[0]), f"{QAC_NOTICE} Lemma glosses: the corpus author's revision, GPL-3.0. Patterns (wazn): derived by this project, see docs/DECISIONS.md."),
        ("roots", root_rows, list(root_rows[0]), QAC_NOTICE),
        ("root_variants_qac_v2", variant_rows, ["location", "source", "root"], "Quranic Arabic Corpus, author's revision (github.com/kaisdukes/quranic-corpus), GPL-3.0."),
    ]  # fmt: skip
    files = []
    for name, rows, cols, notice in tables:
        for ext, body in (
            ("jsonl", "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)),
            ("csv", _csv(rows, cols)),
        ):
            data = body.encode("utf-8")
            (out / f"{name}.{ext}").write_bytes(data)
            files.append(
                {
                    "path": f"{name}.{ext}",
                    "rows": len(rows),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "notice": notice,
                }
            )
    manifest = {
        "dataset": "jadhr-quran",
        "version": version,
        "created": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "text_sha256": report["text_sha256"],
        "counts": report["counts"],
        "files": files,
        "sources": [
            {k: sources[s][k] for k in ("id", "title_en", "url", "license", "attribution_en")}
            for s in ("qpc-hafs", "qac", "qac-v2")
        ],
        "excluded": EXCLUDED,
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    m = build_release(args[0] if args else "2026.10.0")
    print(
        json.dumps(
            {"version": m["version"], "files": [(f["path"], f["rows"]) for f in m["files"]]},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
