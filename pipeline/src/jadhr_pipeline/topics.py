"""Topics (PLAN P8.3, research 06 Part 3, D29): the headings a source gives and the verses it gathers under each.

Registry ``data/topics.yaml``. Quranpedia's Arabic tree is read from its versioned dump — every topic with its parent
and the verses it lists — and checked against the dump's per-verse file; QSAC's tags from its ontology (domain ›
category › tag) with the tags each verse carries, its verse text and English translation never read. Every link keeps
its source; a source the reader is not shown (``shown: false``) is kept for the editorial board. La Beaume's index
(1878) gives only its 18 chapters, read from the scan's table of contents — the top level the board may adopt under
Arabic names of its own (P8.3b); its verses are not read. Names are the source's own, verbatim: a stray mark in
Quranpedia's spelling («الَّريش») is counted, not corrected — the board renames in the workbench. Coverage per sūra is
reported.

Entry point: ``build_topics(raw, out, registry)``.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import normalize


class TopicsError(ValueError):
    pass


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def _pinned(raw: Path, f: dict[str, str]) -> Path:
    path = raw / f["path"]
    if not path.exists():
        raise FileNotFoundError(f"topic source missing from data/raw: {f['path']}")
    if _sha256(path) != f["sha256"]:
        raise TopicsError(f"{f['path']}: sha256 differs from the pinned {f['sha256']}")
    return path


_KEY = re.compile(r"^(\d{1,3}):(\d{1,3})$")
# a short vowel or shadda on a letter that should not bear it at the start of a word («الَّريش»): counted, kept
_STRAY = re.compile(r"(?:^|\s)ال[ً-ْ]")


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def build_topics(
    raw: Path, out: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    verses = {f"{v['surah']}:{v['ayah']}" for v in _jsonl(out / "verses.jsonl")}
    per_surah = Counter(int(k.split(":")[0]) for k in verses)
    sources: list[dict[str, Any]] = []
    topics: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    report: dict[str, Any] = {"sources": {}}
    for src in reg["sources"]:
        sid = src["id"]
        files = {k: _pinned(raw, f) for k, f in src["files"].items()}
        sources.append(
            {
                k: src.get(k)
                for k in (
                    "id",
                    "title_ar",
                    "title_en",
                    "publisher_ar",
                    "publisher_en",
                    "language",
                    "method",
                    "version",
                    "generated_at",
                    "url",
                    "licence",
                    "licence_url",
                    "shown",
                    "attribution_ar",
                    "attribution_en",
                )
            }
            | {"file_sha256": src["files"][next(iter(src["files"]))]["sha256"]}
        )
        if sid == "quranpedia-topics":
            t, lk, rep = _quranpedia(sid, files, verses)
        elif sid == "qsac":
            t, lk, rep = _qsac(sid, files, verses)
        elif sid == "labeaume":
            t, lk, rep = _labeaume(sid, files)
        else:
            raise TopicsError(f"{sid}: no reader for this source")
        topics += t
        links += lk
        covered = {x["verse_key"] for x in lk}
        by_surah = Counter(int(k.split(":")[0]) for k in covered)
        rep["coverage"] = {
            "verses": len(covered),
            "of": len(verses),
            "surahs_without": sum(1 for s in per_surah if not by_surah.get(s)),
            "surahs_1_39": f"{sum(by_surah[s] for s in range(1, 40))}/{sum(per_surah[s] for s in range(1, 40))}",
            "surahs_40_114": f"{sum(by_surah[s] for s in range(40, 115))}/{sum(per_surah[s] for s in range(40, 115))}",
            "per_surah": {str(s): [by_surah.get(s, 0), per_surah[s]] for s in sorted(per_surah)},
        }
        report["sources"][sid] = rep
    # what a search matches: the Arabic name folded as every Arabic search here is, another lower-cased
    for x in topics:
        x.setdefault("name_fr", None)
        x["name_norm"] = (
            normalize(x["name_ar"]) if x["name_ar"] else (x["name_en"] or x["name_fr"] or "").lower()
        )
    ids = [x["id"] for x in topics]
    if len(ids) != len(set(ids)):
        raise TopicsError(f"duplicate topic ids: {[k for k, v in Counter(ids).items() if v > 1][:5]}")
    report["totals"] = {
        "topics": len(topics),
        "links": len(links),
        "by_source": dict(Counter(x["source_id"] for x in links)),
    }
    return {"topic_sources": sources, "topics": topics, "topic_links": links}, report


def _quranpedia(
    sid: str, files: dict[str, Path], verses: set[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    with gzip.open(files["index"]) as fh:
        index = json.load(fh)
    with gzip.open(files["per_verse"]) as fh:
        per_verse = json.load(fh)
    version = index["license"]["version"]
    rows = index["data"]
    by_id = {r["id"]: r for r in rows}
    # a topic's level is its depth from a root; a parent the dump does not hold leaves it at the top, said
    orphans = 0

    def level(r: dict[str, Any], seen: frozenset[int] = frozenset()) -> int:
        nonlocal orphans
        p = r.get("parent_id")
        if p is None:
            return 0
        if p not in by_id or p in seen:
            orphans += 1
            return 0
        return 1 + level(by_id[p], seen | {r["id"]})

    topics: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    bad_keys = 0
    for r in rows:
        keys = [k.strip() for k in (r.get("ayahs") or "").split(",") if k.strip()]
        good = []
        for k in keys:
            if _KEY.match(k) and k in verses:
                good.append(k)
            else:
                bad_keys += 1
        topics.append(
            {
                "id": f"qp:{r['id']}",
                "source_id": sid,
                "source_ref": str(r["id"]),
                "name_ar": r["name"],
                "name_en": None,
                "description": None,
                "parent_id": f"qp:{r['parent_id']}" if r.get("parent_id") in by_id else None,
                "level": level(r),
                "verse_count": len(dict.fromkeys(good)),
            }
        )
        for k in dict.fromkeys(good):
            links.append(
                {
                    "id": f"qp:{r['id']}@{k}",
                    "topic_id": f"qp:{r['id']}",
                    "verse_key": k,
                    "source_id": sid,
                    "version": version,
                }
            )
    # the per-verse file is the same data from the other side: every link it gives is in the index
    from_verses = {(t["id"], f"{v['surah']}:{v['ayah']}") for v in per_verse["data"] for t in v["topics"]}
    in_index = {(int(x["topic_id"][3:]), x["verse_key"]) for x in links}
    report = {
        "version": version,
        "topics": len(topics),
        "levels": dict(sorted(Counter(t["level"] for t in topics).items())),
        "links": len(links),
        "topics_without_verses": sum(1 for t in topics if not t["verse_count"]),
        "keys_dropped": bad_keys,
        "parents_missing": orphans,
        "names_with_stray_marks": sum(1 for t in topics if _STRAY.search(t["name_ar"])),
        "per_verse_file": {
            "verses": len(per_verse["data"]),
            "links": len(from_verses),
            "not_in_index": len(from_verses - in_index),
            "index_not_in_file": len(in_index - from_verses),
        },
    }
    return topics, links, report


def _qsac(
    sid: str, files: dict[str, Path], verses: set[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    onto = json.loads(files["ontology"].read_text(encoding="utf-8"))
    version = files["links"].parent.parent.name  # the dataset revision the files were fetched at
    topics: list[dict[str, Any]] = []
    tag_id: dict[str, str] = {}
    for d in onto["domains"]:
        did = f"qsac:{_slug(d['name'])}"
        topics.append(
            {
                "id": did,
                "source_id": sid,
                "source_ref": d["name"],
                "name_ar": None,
                "name_en": d["name"],
                "description": d.get("description"),
                "parent_id": None,
                "level": 0,
                "verse_count": 0,
            }
        )
        for c in d["categories"]:
            cid = f"{did}/{_slug(c['name'])}"
            topics.append(
                {
                    "id": cid,
                    "source_id": sid,
                    "source_ref": c["name"],
                    "name_ar": None,
                    "name_en": c["name"],
                    "description": c.get("description"),
                    "parent_id": did,
                    "level": 1,
                    "verse_count": 0,
                }
            )
            for tg in c["tags"]:
                tid = f"{cid}/{_slug(tg['name'])}"
                tag_id.setdefault(tg["name"], tid)
                topics.append(
                    {
                        "id": tid,
                        "source_id": sid,
                        "source_ref": tg["name"],
                        "name_ar": None,
                        "name_en": tg["name"],
                        "description": tg.get("description"),
                        "parent_id": cid,
                        "level": 2,
                        "verse_count": 0,
                    }
                )
    links: list[dict[str, Any]] = []
    unknown: Counter[str] = Counter()
    with files["links"].open(encoding="utf-8") as fh:
        # only the sūra, the verse and its tags: the file's verse text and English translation are not read (L1)
        reader = csv.DictReader(line for line in fh if not line.startswith("#"))
        for row in reader:
            key = f"{int(row['surah'])}:{int(row['ayah'])}"
            if key not in verses:
                unknown["verse"] += 1
                continue
            for name in dict.fromkeys(x.strip() for x in (row["tags"] or "").split("|") if x.strip()):
                tid = tag_id.get(name)
                if not tid:
                    unknown["tag"] += 1
                    continue
                links.append(
                    {
                        "id": f"{tid}@{key}",
                        "topic_id": tid,
                        "verse_key": key,
                        "source_id": sid,
                        "version": version,
                    }
                )
    count = Counter(x["topic_id"] for x in links)
    for t in topics:
        t["verse_count"] = count.get(t["id"], 0)
    report = {
        "version": version,
        "topics": len(topics),
        "levels": dict(sorted(Counter(t["level"] for t in topics).items())),
        "links": len(links),
        "tags_used": len(count),
        "unknown": dict(unknown),
    }
    return topics, links, report


# the book's own table of chapters, at its end: "Chapitre 1. Histoire 1", then "— 2. Mahomet 6" … "— 18. Progrès 772"
_LB_ROW = re.compile(r"^(?:Chapitre|—)\s+(\S+)\.\s+(.+?)[\s.,]*?\s(\d+)\s*$")


def _labeaume(
    sid: str, files: dict[str, Path]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """La Beaume's 18 chapters with the page each starts on, numbered by their place in the table: the OCR misreads
    one printed number («— 0. Chrétiens» for 6), which is counted. No verses are read."""
    lines = files["text"].read_text(encoding="utf-8").splitlines()
    start = max(
        i for i, x in enumerate(lines) if x.strip().startswith("TABLE  DES  CHAPITRES") and "KORAN" not in x
    )
    end = next(i for i in range(start, len(lines)) if lines[i].strip().startswith("Table  alphabétique"))
    found = [m for m in (_LB_ROW.match(x.strip()) for x in lines[start:end]) if m]
    if len(found) != 18:
        raise TopicsError(f"{sid}: the table of chapters gives {len(found)} rows, not 18")
    misread = 0
    topics = []
    for n, m in enumerate(found, 1):
        printed, title, page = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip(" .,"), int(m.group(3))
        if printed != str(n):
            misread += 1
        topics.append(
            {
                "id": f"lb:{n}",
                "source_id": sid,
                "source_ref": f"chapitre {n}, p. {page}",
                "name_ar": None,
                "name_en": None,
                "name_fr": title,
                "description": None,
                "parent_id": None,
                "level": 0,
                "verse_count": 0,
            }
        )
    pages = [int(t["source_ref"].rsplit(" ", 1)[1]) for t in topics]
    if pages != sorted(pages):
        raise TopicsError(f"{sid}: the chapters' pages are out of order: {pages}")
    report = {
        "chapters": len(topics),
        "numbers_misread": misread,
        "first": topics[0]["name_fr"],
        "last": topics[-1]["name_fr"],
    }
    return topics, [], report
