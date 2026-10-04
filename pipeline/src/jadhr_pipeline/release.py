"""Release artefacts: the redistributable part of a built dataset, as JSON Lines and CSV, the lexicon also as TEI Lex-0
and LMF (lexicon_xml.py), with a manifest.

    uv run python -m jadhr_pipeline.release            # data/build/<version> → data/release/<version>

Only data whose licence allows redistribution goes in; everything left out is listed in MANIFEST.json
with the reason. Every file carries its sha256 and row count, its format and table, and the hold it is under if
any: a held file is listed with its reason and never served (the API, P10.1b). A release is built once — its
manifest is final; a folder that has one is rebuilt only with --force, before it is recorded. Publishing the
release is the owner's call.
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

from . import lexicon_xml

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
FORMAT_NOTES = {
    "jsonl": "JSON Lines: one record per line, UTF-8.",
    "csv": "RFC 4180: comma-separated, CRLF between records, a header row; a field with a comma, a quote or a line break quoted and its quotes doubled; UTF-8 without a byte-order mark. Nested values (segments, features) are JSON in their field.",
    "unicode": "Every field is NFC except the texts carried from their sources exactly as they are: text_qpc (KFGQPC), text_uthmani and the segment forms (the corpus's Tanzil copy, also inside words' segments) and the lemma forms (lemmas.ar, words.lemma), and Lane's headword and body as converted from Perseus's transliteration. Normalising them would reorder their combining marks, and the Quranic text is never altered. The XML files carry the same characters as the JSON Lines files.",
    "tei": "TEI Lex-0 0.9.5 (https://lex-0.org), UTF-8, validated against its schema when the release is built. lexicon_quran: each root a word family (entry type=wordFamily) holding its lemmas (type=mainEntry) with their pattern (form type=scheme, resp=#jadhr) and grammar; a lemma without a root an entry of its own. lexicon_lane: each of Lane's root articles a word family with its text as one sense.",
    "lmf": "LMF in its ISO 24613-4 TEI serialisation (teiCorpus type=lexicalResource holding one TEI type=lexicon), UTF-8, validated against its schema when the release is built. lexicon_quran: one entry per lemma, its root a form typed root, every word form the Quran attests (form type=inflected) with its inflection and its count (n). lexicon_lane: one entry per root article, its text one sense.",
    "keys": "A word is keyed surah:ayah:word, a segment surah:ayah:word:segment, a verse surah:ayah, a root by its letters.",
}

# Publication is the owner's call; the holds keep it until the named decisions are taken (research 07).
# Each hold and each exclusion says why in English and in Arabic (shown on the data page in the reader's language),
# in words that stand on their own; who decides is in "decision", for the owner (docs/PLAN.md decisions).
PUBLICATION_HOLD = [
    {
        "id": "qac",
        "tables": ["words", "segments", "lemmas", "roots", "lexicon_quran"],
        "data": "words, segments, lemmas and roots files and the Quranic lexicon (data derived from the Quranic Arabic Corpus)",
        "why": "the corpus permits verbatim copies only, its FAQ speaks of non-commercial use, and its text is CC BY-ND, which allows no changes; its maintainers will be asked first",
        "why_ar": "المدونة القرآنية اللغوية تجيز النسخ الحرفي وحده، وصفحة أسئلتها تذكر الاستعمال غير التجاري، ونصها بترخيص CC BY-ND الذي لا يجيز التعديل؛ سنسأل القائمين عليها أولا",
        "decision": "D19 (ask the corpus maintainers) and D2",
    },
    {
        "id": "kfgqpc",
        "tables": ["verses"],
        "data": "verses file (KFGQPC Unicode data)",
        "why": "the Complex's published terms describe the mushaf files; whether they allow its Unicode text to be redistributed will be asked of the Complex",
        "why_ar": "شروط مجمع الملك فهد المنشورة تصف ملفات المصحف، وسنسأل المجمع أتجيز إعادة نشر نصه بترميز Unicode أم لا",
        "decision": "D19 (ask the Complex)",
    },
]

EXCLUDED = [
    {
        "data": "root variants from the mustafa0x corrected fork",
        "data_ar": "الجذور البديلة من النسخة المصححة التي نشرها mustafa0x",
        "reason": "the repository has no licence; the site shows it only as a cited cross-check",
        "reason_ar": "مستودعها بلا ترخيص، فلا يعرضها الموقع إلا للمقارنة مع ذكر مصدرها",
    },
    {
        "data": "lemma glosses and root variants from the corpus author's revision (qac-v2)",
        "data_ar": "معاني المداخل والجذور البديلة من مراجعة مؤلف المدونة القرآنية اللغوية",
        "reason": "the data repository (kaisdukes/quranic-corpus-api) carries no licence; the site shows it, credited, as a cross-check until its author is asked",
        "reason_ar": "مستودع بياناتها بلا ترخيص، فيعرضها الموقع للمقارنة منسوبة إلى مؤلفها حتى يسأل",
    },
    {
        "data": "word-by-word English glosses and transliteration",
        "data_ar": "الترجمة الإنجليزية كلمة كلمة ونقحرتها اللاتينية",
        "reason": "the corpus's terms allow display with credit and a link; whether they allow redistributing them whole is unclear",
        "reason_ar": "تجيز شروط المدونة عرضها مع ذكرها ورابط إليها، ولا يتبين منها جواز إعادة نشرها كاملة",
    },
    {
        "data": "classical lexica (Kitab al-Ayn, Tahdhib al-Lugha, al-Sihah, Maqayis, al-Mufradat with its sub-entries and senses, Lisan al-Arab, al-Qamus al-Muhit, Taj al-Arus, Ibn Qutaybah)",
        "data_ar": "المعاجم العربية القديمة: العين، وتهذيب اللغة، والصحاح، ومقاييس اللغة، والمفردات بفروعها ومعانيها، ولسان العرب، والقاموس المحيط، وتاج العروس، وغريب ابن قتيبة",
        "reason": "their digital texts are for display only; Lane's Lexicon (CC BY-SA 3.0 US) is in this release as lexicon_lane",
        "reason_ar": "نصوصها الرقمية للعرض وحده؛ أما معجم لين فبترخيص CC BY-SA 3.0 US وهو في هذا الإصدار",
    },
    {
        "data": "al-Muyassar fi Gharib al-Qur'an (KFGQPC) meanings per word",
        "data_ar": "معاني الكلمات من الميسر في غريب القرآن الكريم (مجمع الملك فهد)",
        "reason": "the Complex offers the file for display in applications; its terms do not address redistribution",
        "reason_ar": "يتيح المجمع الملف للعرض في التطبيقات، ولا تتناول شروطه إعادة نشره",
    },
    {
        "data": "pattern catalog, particle entries and relation seeds (al-Shafiya, al-Kafiya, al-Radi, Mughni al-Labib, al-Jana al-Dani, the wujuh, furuq and addad works)",
        "data_ar": "فهرس الأوزان ومداخل الحروف وبذور العلاقات: الشافية، والكافية، وشرح الرضي، ومغني اللبيب، والجنى الداني، وكتب الوجوه والفروق والأضداد",
        "reason": "OpenITI texts under CC BY-NC-SA 4.0, whose share-alike would bind the whole release; the site shows them with credit",
        "reason_ar": "نصوص OpenITI بترخيص CC BY-NC-SA 4.0 الذي يلزم شرط المشاركة بالمثل فيه الإصدار كله؛ ويعرضها الموقع مع ذكر مصادرها",
    },
    {
        "data": "Quran knowledge layers (sura cards, Makki/Madani notes, occasions of revelation, cross-references, entity candidates)",
        "data_ar": "طبقات المعرفة القرآنية: بطاقات السور، والمكي والمدني، وأسباب النزول، والإحالات بين الآيات، والكيانات المقترحة",
        "reason": "each source keeps its own terms (Tafsir Center CC BY 4.0, OpenITI CC BY-NC-SA, Tanzil, Wikidata CC0); the site shows them with credit",
        "reason_ar": "لكل مصدر شروطه: مركز تفسير بترخيص CC BY 4.0 ونصوص OpenITI بترخيص CC BY-NC-SA وتنزيل وويكي بيانات بترخيص CC0 الحر؛ ويعرضها الموقع مع ذكر مصادرها",
    },
    {
        "data": "tafsir and translations",
        "data_ar": "التفاسير والترجمات",
        "reason": "each is published by its own source under its own terms (QuranEnc, QUL)",
        "reason_ar": "ينشر كلا منها مصدره بشروطه، كموسوعة القرآن الكريم والمكتبة القرآنية الشاملة",
    },
    {
        "data": "recitation audio and timings",
        "data_ar": "التلاوات الصوتية وتوقيتات كلماتها",
        "reason": "served by EveryAyah (CC BY-NC) and quran-align (CC BY 4.0)",
        "reason_ar": "تقدم التلاوات من EveryAyah بترخيص CC BY-NC، والتوقيتات من مشروع quran-align بترخيص CC BY 4.0 المفتوح",
    },
]


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def _csv(rows: list[dict[str, Any]], columns: list[str]) -> str:
    buf = io.StringIO()
    # RFC 4180: CRLF between records; a field with a comma, a quote or a line break quoted, its quotes doubled
    w = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore", lineterminator="\r\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: ("" if r.get(k) is None else r[k]) for k in columns})
    return buf.getvalue()


class Built(Exception):
    """A release folder that already has its manifest: a release is built once."""


def build_release(version: str, out: Path | None = None, force: bool = False) -> dict[str, Any]:
    src = REPO / "data/build" / version
    out = out or REPO / "data/release" / version
    if (out / "MANIFEST.json").exists() and not force:
        raise Built(f"{out} has its manifest: a release is built once (--force before it is recorded)")
    out.mkdir(parents=True, exist_ok=True)
    # a rebuild leaves nothing of the last one behind
    for stale in out.iterdir():
        if stale.is_file():
            stale.unlink()
    report = json.loads((src / "report.json").read_text(encoding="utf-8"))
    sources = {
        s["id"]: s
        for s in yaml.safe_load((REPO / "data/sources.yaml").read_text(encoding="utf-8"))["sources"]
    }

    roots = {r["id"]: r for r in _jsonl(src / "roots.jsonl")}
    lemmas = {x["id"]: x for x in _jsonl(src / "lemmas.jsonl")}
    verses = _jsonl(src / "verses.jsonl")
    words = _jsonl(src / "words.jsonl")
    lane_work = next(w for w in _jsonl(src / "lexicon_works.jsonl") if w["id"] == "lane")
    lane_rows = lexicon_xml.lane_rows(
        [x for x in _jsonl(src / "lexicon_entries.jsonl") if x["work_id"] == "lane"]
    )

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
    # the morphology as a token table (DAT-Q05): one row per segment, keyed by its place surah:ayah:word:segment
    segment_rows = [
        {
            "segment": f"{w['location']}:{g['index']}",
            "location": w["location"],
            "index": g["index"],
            "kind": g["kind"],
            "text": g["text"],
            "tag": (g.get("label") or {}).get("tag")
            or ((g.get("features") or {}).get("pos") or {}).get("tag"),
            "features": json.dumps(
                {
                    k: v["tag"]
                    for k, v in (g.get("features") or {}).items()
                    if isinstance(v, dict) and "tag" in v
                },
                ensure_ascii=False,
            ),
            "lemma_buckwalter": g.get("lemma"),
            "root": g.get("root"),
        }
        for w in words
        for g in w["segments"]
    ]
    root_rows = [
        {
            k: r[k]
            for k in ("key", "spaced", "translit", "occurrences", "verse_count", "surah_count", "lemma_count")
        }
        for r in roots.values()
    ]

    lane_notice = (
        f"{lane_work['attribution_en']} Perseus's availability statement is reproduced in MANIFEST.json and in the "
        "XML files' headers. root: this project's match of the article to a root of the Quran, given only where the "
        "site shows it (CC BY-SA 4.0); perseus: the article in Perseus's files."
    )
    tables: list[tuple[str, list[dict[str, Any]], list[str], str]] = [
        ("verses", verse_rows, list(verse_rows[0]), f"{TEXT_NOTICE} {TANZIL_META_NOTICE}"),
        ("words", word_rows, list(word_rows[0]), f"{TANZIL_CORPUS_TEXT_NOTICE} {QAC_NOTICE}"),
        ("segments", segment_rows, list(segment_rows[0]), f"{TANZIL_CORPUS_TEXT_NOTICE} {QAC_NOTICE}"),
        ("lemmas", lemma_rows, list(lemma_rows[0]), f"{QAC_NOTICE} Patterns (wazn): derived by this project, see docs/DECISIONS.md."),
        ("roots", root_rows, list(root_rows[0]), QAC_NOTICE),
        (lexicon_xml.LANE, lane_rows, list(lane_rows[0]), lane_notice),
    ]  # fmt: skip
    held = {t: h["id"] for h in PUBLICATION_HOLD for t in h["tables"]}
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
                    "table": name,
                    "format": ext,
                    "held": held.get(name),
                    "rows": len(rows),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "notice": notice,
                }
            )
    # the lexicon as TEI Lex-0 and LMF: each file checked against its schema and the release before it is written
    xml_notice = {
        (lexicon_xml.QURAN, "tei"): f"{QAC_NOTICE} Patterns (wazn): derived by this project (CC BY-SA 4.0).",
        (
            lexicon_xml.QURAN,
            "lmf",
        ): f"{TANZIL_CORPUS_TEXT_NOTICE.replace('words.text_uthmani and segments[].text', 'The word forms')} {QAC_NOTICE} Patterns (wazn): derived by this project (CC BY-SA 4.0).",
        (lexicon_xml.LANE, "tei"): lane_notice,
        (lexicon_xml.LANE, "lmf"): lane_notice,
    }
    for x in lexicon_xml.build(
        lemmas=list(lemmas.values()),
        roots=list(roots.values()),
        words=words,
        lane=lane_rows,
        lane_work=lane_work,
        version=version,
    ):
        (out / x["path"]).write_bytes(x["data"])
        files.append(
            {
                "path": x["path"],
                "table": x["table"],
                "format": x["format"],
                "held": held.get(x["table"]),
                "rows": x["rows"],
                "bytes": len(x["data"]),
                "sha256": hashlib.sha256(x["data"]).hexdigest(),
                "notice": xml_notice[(x["table"], x["format"])],
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
        ]
        + [
            {
                "id": "lane",
                "title_en": f"{lane_work['author_en']}, {lane_work['title_en']}",
                "url": lane_work["source_url"],
                "license": lane_work["license"],
                "attribution_en": lane_work["attribution_en"],
            }
        ],
        # Perseus: "You leave this availability statement intact" — as its header writes it
        "copyright_notices": {"qac": QAC_COPYRIGHT, "perseus": lexicon_xml.perseus_xml()},
        "publication_hold": PUBLICATION_HOLD,
        "excluded": EXCLUDED,
        "format_notes": FORMAT_NOTES,
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    force = "--force" in args
    names = [a for a in args if not a.startswith("--")]
    try:
        m = build_release(names[0] if names else "2026.10.0", force=force)
    except Built as e:
        print(e, file=sys.stderr)
        return 1
    print(
        json.dumps(
            {"version": m["version"], "files": [(f["path"], f["rows"]) for f in m["files"]]},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
