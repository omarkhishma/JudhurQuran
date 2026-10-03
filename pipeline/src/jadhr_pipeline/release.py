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

# The corpus asks for its copyright block to be "reproduced appropriately in all works derived from or
# containing substantial portion of this file" — so it is reproduced, verbatim, not paraphrased.
QAC_COPYRIGHT = """Quranic Arabic Corpus (morphology, version 0.4)
Copyright (C) 2011 Kais Dukes
License: GNU General Public License

The Quranic Arabic Corpus includes syntactic and morphological
annotation of the Quran, and builds on the verified Arabic text
distributed by the Tanzil project.

TERMS OF USE:

- Permission is granted to copy and distribute verbatim copies
  of this file, but CHANGING IT IS NOT ALLOWED.

- This annotation can be used in any website or application,
  provided its source (the Quranic Arabic Corpus) is clearly
  indicated, and a link is made to http://corpus.quran.com to enable
  users to keep track of changes.

- This copyright notice shall be included in all verbatim copies
  of the text, and shall be reproduced appropriately in all works
  derived from or containing substantial portion of this file.

Please check updates at: http://corpus.quran.com/download"""
QAC_NOTICE = (
    "Morphology derived from the Quranic Arabic Corpus (http://corpus.quran.com): converted from Buckwalter "
    "to Arabic script and restructured — its copyright block is reproduced in MANIFEST.json."
)
# text_uthmani and the segment forms in words.* are the corpus's copy of Tanzil's text, not KFGQPC's.
TANZIL_CORPUS_TEXT_NOTICE = (
    "words.text_uthmani and segments[].text: the Quranic Arabic Corpus's copy of the Tanzil Quran Text "
    "(Uthmani, version 1.0.2), Copyright (C) 2008-2009 Tanzil.info, License: Creative Commons BY-ND 3.0 "
    "Unported (https://tanzil.net) — converted from Buckwalter to Arabic script."
)
TEXT_NOTICE = (
    "text_qpc and text_imlaei: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs data v2.0 "
    "(2022-09-07), reproduced verbatim (https://qurancomplex.gov.sa/techquran/dev/); page numbers from the "
    "same data."
)
TANZIL_META_NOTICE = (
    "juz, hizb_quarter and sajda: Tanzil Quran metadata (quran-data.xml), (C) 2008-2009 Tanzil.info, "
    "license cc-by — https://tanzil.net"
)
# Publication is the owner's call; these hold it until the named decisions are taken (research 07).
PUBLICATION_HOLD = [
    {
        "data": "words, lemmas and roots files (data derived from the Quranic Arabic Corpus)",
        "why": "the corpus permits verbatim copies only, its FAQ speaks of non-commercial use, and the text column is CC BY-ND",
        "decision": "D19 (ask the corpus maintainers) and D2",
    },
    {
        "data": "verses file (KFGQPC Unicode data)",
        "why": "the Complex's published terms describe the mushaf files; redistribution of the Unicode data is to be confirmed",
        "decision": "D19 (ask the Complex)",
    },
]

EXCLUDED = [
    {
        "data": "root variants from the mustafa0x corrected fork",
        "reason": "the repository has no licence; it is shown on the site only as a cited cross-check",
    },
    {
        "data": "lemma glosses and root variants from the corpus author's revision (qac-v2)",
        "reason": "the data repository (kaisdukes/quranic-corpus-api) carries no licence; shown on the site as a credited cross-check until the author is asked (D19)",
    },
    {
        "data": "word-by-word English glosses and transliteration",
        "reason": "the corpus terms allow display with credit and a link; bulk redistribution is ambiguous",
    },
    {
        "data": "classical lexica (Kitab al-Ayn, Tahdhib al-Lugha, al-Sihah, Maqayis, al-Mufradat with its sub-entries and senses, Lisan al-Arab, al-Qamus al-Muhit, Taj al-Arus, Ibn Qutaybah)",
        "reason": "the digital text is display-only (research 02); Lane's Lexicon (CC BY-SA) is available from Perseus",
    },
    {
        "data": "al-Muyassar fi Gharib al-Qur'an (KFGQPC) meanings per word",
        "reason": "the Complex offers the file for display in applications; redistribution is not addressed (research 07, D19)",
    },
    {
        "data": "pattern catalog, particle entries and relation seeds (al-Shafiya, al-Kafiya, al-Radi, Mughni al-Labib, al-Jana al-Dani, the wujuh, furuq and addad works)",
        "reason": "OpenITI texts under CC BY-NC-SA 4.0, whose share-alike would bind the whole release; shown on the site with credit",
    },
    {
        "data": "Quran knowledge layers (sura cards, Makki/Madani notes, occasions of revelation, cross-references, entity candidates)",
        "reason": "each source keeps its own terms (Tafsir Center CC BY 4.0, OpenITI CC BY-NC-SA, Tanzil, Wikidata CC0); shown on the site with credit, see data/licences.yaml",
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

    tables: list[tuple[str, list[dict[str, Any]], list[str], str]] = [
        ("verses", verse_rows, list(verse_rows[0]), f"{TEXT_NOTICE} {TANZIL_META_NOTICE}"),
        ("words", word_rows, list(word_rows[0]), f"{TANZIL_CORPUS_TEXT_NOTICE} {QAC_NOTICE}"),
        ("lemmas", lemma_rows, list(lemma_rows[0]), f"{QAC_NOTICE} Patterns (wazn): derived by this project, see docs/DECISIONS.md."),
        ("roots", root_rows, list(root_rows[0]), QAC_NOTICE),
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
            for s in ("qpc-hafs", "qac", "tanzil-uthmani")
        ],
        "copyright_notices": {"qac": QAC_COPYRIGHT},
        "publication_hold": PUBLICATION_HOLD,
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
