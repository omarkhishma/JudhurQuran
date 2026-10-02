"""Load a built dataset release into the `content` schema — atomically.

    uv run python -m judhur_api.loader data/build/2026.10.0 data/sources.yaml

Everything happens in one transaction: truncate content tables, COPY every
JSONL file, record the dataset row. A failure leaves the previous release in
place. After loading, the displayed text is re-hashed from the database and
compared with the build report — the mushaf-integrity check.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import yaml
from psycopg.types.json import Jsonb

from .settings import get_settings

# table → (file, columns, json columns)
TABLES: list[tuple[str, str, list[str], set[str]]] = [
    ("surahs", "surahs.jsonl", ["number", "name_ar", "name_translit", "name_en", "revelation_place",
                                "revelation_order", "verse_count", "rukus", "page_start", "page_end",
                                "juz_start", "word_count", "has_basmala"], set()),
    ("verses", "verses.jsonl", ["id", "surah", "ayah", "key", "page", "juz", "line_start", "line_end", "hizb_mark",
                                "hizb_quarter", "manzil", "ruku",
                                "sajda", "text_qpc", "number_text", "text_tanzil", "text_imlaei", "norm", "norm_uthmani",
                                "word_count", "token_count", "sha256"], set()),
    ("tokens", "tokens.jsonl", ["id", "verse_id", "position", "text", "word_from", "word_to"], set()),
    ("roots", "roots.jsonl", ["id", "key", "letters", "spaced", "translit", "occurrences", "verse_count",
                              "surah_count", "lemma_count"], set()),
    ("lemmas", "lemmas.jsonl", ["id", "key", "ar", "ar_bare", "norm", "norm_plain", "root_id", "pos", "verb_form",
                                "derivation", "occurrences", "verse_count", "gloss_en", "pattern"], set()),
    ("words", "words.jsonl", ["id", "verse_id", "surah", "ayah", "position", "location", "token_from", "token_to",
                              "text_uthmani", "text_imlaei", "norm", "norm_uthmani", "root_id", "lemma_id", "pos",
                              "definite", "features", "segments", "translit", "gloss_en"], {"features", "segments"}),
    ("root_variants", "root_variants.jsonl", ["word_id", "source", "root_key"], set()),
    ("works", "works.jsonl", ["id", "kind", "lang", "level", "title_ar", "title_en", "author_ar", "author_en",
                              "source_id", "version", "file_sha256", "sort_order", "default_for",
                              "strip_leading_number", "verse_coverage", "passage_count"], set()),
    ("work_passages", "work_passages.jsonl", ["id", "work_id", "verse_from", "verse_to", "text", "footnotes"], set()),
    ("lexicon_works", "lexicon_works.jsonl", ["id", "title_ar", "title_en", "author_ar", "author_en", "death_hijri",
                                              "death_ce", "lang", "edition_note", "source_url", "license",
                                              "attribution_ar", "attribution_en", "redistributable", "sort_order"], set()),
    ("lexicon_entries", "lexicon_entries.jsonl", ["id", "work_id", "root_key", "headword", "match", "confidence",
                                                  "displayable", "body", "core_meaning", "page_ref", "source_ref"], set()),
    ("gharib_glosses", "gharib_glosses.jsonl", ["id", "work_id", "surah", "ayah", "phrase", "gloss", "word_locations",
                                                "page_ref", "source_ref"], set()),
]  # fmt: skip

TRUNCATE_ORDER = [
    "work_passages",
    "works",
    "root_variants",
    "words",
    "lemmas",
    "roots",
    "tokens",
    "verses",
    "surahs",
    "sources",
    "dataset",
]


def _rows(
    path: Path, columns: list[str], json_cols: set[str], rename: dict[str, str]
) -> Iterator[tuple[Any, ...]]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            obj = json.loads(line)
            for src, dst in rename.items():
                if src in obj:
                    obj[dst] = obj.pop(src)
            yield tuple(Jsonb(obj.get(c)) if c in json_cols else obj.get(c) for c in columns)


def load(build_dir: Path, sources_file: Path, dsn: str | None = None) -> dict[str, int]:
    report = json.loads((build_dir / "report.json").read_text(encoding="utf-8"))
    sources = yaml.safe_load(sources_file.read_text(encoding="utf-8"))["sources"]
    dsn = dsn or get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")
    counts: dict[str, int] = {}
    with psycopg.connect(dsn) as conn, conn.transaction():
        cur = conn.cursor()
        cur.execute("truncate " + ", ".join(f"content.{t}" for t in TRUNCATE_ORDER))
        for src in sources:
            cur.execute(
                """insert into content.sources (id, kind, title_ar, title_en, version, url, license, license_url,
                   attribution_ar, attribution_en, role, files)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    src["id"],
                    src["kind"],
                    src["title_ar"],
                    src["title_en"],
                    src.get("version"),
                    src["url"],
                    src["license"],
                    src.get("license_url"),
                    src["attribution_ar"],
                    src["attribution_en"],
                    src["role"],
                    Jsonb(src.get("files", [])),
                ),
            )
        counts["sources"] = len(sources)
        for table, file, columns, json_cols in TABLES:
            path = build_dir / file
            if not path.exists():
                counts[table] = 0
                continue
            rename = {"root": "root_key"} if table == "root_variants" else {}
            n = 0
            with cur.copy(f"copy content.{table} ({', '.join(columns)}) from stdin") as copy:
                for row in _rows(path, columns, json_cols, rename):
                    copy.write_row(row)
                    n += 1
            counts[table] = n
        cur.execute(
            "insert into content.dataset (version, text_sha256, counts, report) values (%s, %s, %s, %s)",
            (report["version"], report["text_sha256"], Jsonb(report["counts"]), Jsonb(report)),
        )
        # Mushaf integrity: the text as stored must hash exactly as built.
        cur.execute("select text_qpc from content.verses order by id")
        stored = hashlib.sha256("\n".join(r[0] for r in cur.fetchall()).encode()).hexdigest()
        if stored != report["text_sha256"]:
            raise RuntimeError(f"text hash mismatch after load: {stored} ≠ {report['text_sha256']}")
        cur.execute("analyze")
    return counts


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python -m judhur_api.loader <build_dir> <sources.yaml>", file=sys.stderr)
        return 2
    t = time.time()
    counts = load(Path(sys.argv[1]), Path(sys.argv[2]))
    print(json.dumps({"loaded": counts, "seconds": round(time.time() - t, 1)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
