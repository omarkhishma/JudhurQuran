"""Curated sets of Quranic words (PLAN P5.2, inventory COL with COL-Q03).

The sets are editorial (``data/collections.yaml``: title, copy, rule); their items are computed here from
the build by each rule, most frequent first, so a set's copy can only describe what its items are. A word the
copy names is listed under ``mentions`` and the build fails if the rule does not yield it (COL-23). The
frequent-words set's copy carries ``{coverage}``: the share of the Quran's words its items account for,
computed here. A set may quote its rule from the pattern catalogue (al-Shāfiya), verbatim with its source.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

# the parts of speech that carry content (as the Analyser counts them, services/api analyse.py CONTENT_POS);
# a lemma with a root is content whatever its tag
CONTENT_POS = {"N", "V", "PN", "ADJ", "IMPN", "T", "LOC"}
COLOURS = {"root", "form", "word", "sentence", "desc", "amber"}


def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def _content(lem: dict[str, Any]) -> bool:
    return lem["root_id"] is not None or lem["pos"] in CONTENT_POS


def build_collections(out: Path, registry: Path) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    lemmas = _jsonl(out / "lemmas.jsonl")
    roots = {r["id"]: r["key"] for r in _jsonl(out / "roots.jsonl")}
    patterns = {p["id"]: p["slug"] for p in _jsonl(out / "patterns.jsonl")}
    words = _jsonl(out / "words.jsonl")
    total_words = len(words)
    first: dict[int, str] = {}
    for w in words:  # in mushaf order: the first occurrence of each lemma
        if w["lemma_id"] is not None and w["lemma_id"] not in first:
            first[w["lemma_id"]] = w["location"]
    # only claims about the word as a whole: a claim about one place or one form («صلوات» as synagogues in
    # 22:40) says nothing of the word elsewhere, and listing the lemma would misattribute it
    loan_ids = {
        x["lemma_id"]
        for x in _jsonl(out / "loanword_links.jsonl")
        if x["kind"] == "lemma" and x["scope"] == "lemma" and x["lemma_id"]
    }
    functions = _jsonl(out / "pattern_functions.jsonl") if (out / "pattern_functions.jsonl").exists() else []
    sources = (
        {s["id"]: s for s in _jsonl(out / "pattern_sources.jsonl")}
        if (out / "pattern_sources.jsonl").exists()
        else {}
    )

    def matches(lem: dict[str, Any], rule: dict[str, Any]) -> bool:
        if "root" in rule:
            return roots.get(lem["root_id"]) in rule["root"]
        if "patterns" in rule:
            return (
                patterns.get(lem["pattern_id"]) in rule["patterns"]
                and (not rule.get("pos") or lem["pos"] in rule["pos"])
                and (not rule.get("derivation") or lem["derivation"] == rule["derivation"])
            )
        if rule.get("frequent"):
            return _content(lem)
        if rule.get("function_words"):
            return not _content(lem)
        if rule.get("loanwords"):
            return lem["id"] in loan_ids
        raise ValueError(f"unknown collection rule {rule}")

    sets: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for n, c in enumerate(reg["collections"], start=1):
        if c["colour"] not in COLOURS:
            raise ValueError(f"collection {c['id']}: colour {c['colour']!r} is not a type colour")
        excluded = set(c.get("exclude", []))
        chosen = sorted(
            (x for x in lemmas if x["slug"] not in excluded and matches(x, c["rule"])),
            key=lambda x: (-x["occurrences"], x["id"]),
        )
        if c.get("limit"):
            chosen = chosen[: c["limit"]]
        slugs = {x["slug"] for x in chosen}
        missing = [m for m in c.get("mentions", []) if m not in slugs]
        if missing:
            raise ValueError(f"collection {c['id']}: its copy names {missing}, which its rule does not yield")
        if len(chosen) < 4:
            raise ValueError(f"collection {c['id']}: {len(chosen)} items, too few to walk through")
        occurrences = sum(x["occurrences"] for x in chosen)
        quote = None
        if c.get("quote"):
            q = c["quote"]
            row = next(
                (
                    f
                    for f in functions
                    if f["section"] == q["section"]
                    and f["kind"] == q["kind"]
                    and f["source_id"] == q["source_id"]
                ),
                None,
            )
            if row is None:
                raise ValueError(f"collection {c['id']}: no {q} in the pattern catalogue")
            src = sources.get(row["source_id"], {})
            quote = {
                "text_ar": row["text_ar"],
                "heading_ar": row.get("heading_ar"),
                "source_id": row["source_id"],
                "attribution_ar": src.get("attribution_ar") or src.get("title_ar"),
                "attribution_en": src.get("attribution_en") or src.get("title_en"),
            }
        sets.append(
            {
                "id": c["id"],
                "ordinal": n,
                "colour": c["colour"],
                "title_ar": c["title_ar"],
                "title_en": c["title_en"],
                "intro_ar": c["intro_ar"],
                "intro_en": c["intro_en"],
                "why_ar": c["why_ar"],
                "why_en": c["why_en"],
                "rule": c["rule"],
                "item_count": len(chosen),
                "root_count": len({x["root_id"] for x in chosen if x["root_id"] is not None}),
                "occurrences": occurrences,
                "coverage": round(occurrences / total_words, 4),
                "quote": quote,
                "source": c.get("source"),
            }
        )
        items += [
            {
                "collection_id": c["id"],
                "ordinal": i,
                "lemma_id": x["id"],
                "first_location": first.get(x["id"]),
            }
            for i, x in enumerate(chosen, start=1)
        ]
    report = {
        "collections": len(sets),
        "items": len(items),
        "by_set": {s["id"]: s["item_count"] for s in sets},
    }
    return {"collections": sets, "collection_items": items}, report
