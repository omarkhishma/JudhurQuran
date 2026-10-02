"""The generic text model and the catalogues the design needs (PLAN P1.1, P1.2, P1.3b, P1.7a).

One model for every text — ``texts → chapters → passages → tokens`` — so the Quran, hadith
collections, classical books and user texts share one reader, one concordance and one root graph.
The Quran is projected into it from the verified Quran tables: its passages carry no text of their
own (the mushaf text stays in ``verses.text_qpc``, hash-checked), only the keys that tie them back.

Every addressable thing has a namespaced URI that never collides across texts:
``quran`` · ``quran:2`` · ``quran:2:255`` · ``quran:2:255:3``; later ``hadith:bukhari:1``,
``book:<openiti-uri>:1.3.2``, ``user:<uuid>:…``.

Also built here: stable slugs for lemmas and patterns (append-only registries in ``data/registry``),
the pattern catalogue, and the scholarly transliteration of every lemma.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import display_bare, normalize, scholarly, slug_lemma, slug_pattern

from . import labels
from .slugs import SlugRegistry

QURAN_TEXT = {
    "id": 1,
    "slug": "quran",
    "uri": "quran",
    "kind": "quran",
    "title_ar": "القرآن الكريم",
    "title_en": "The Quran",
    "author_ar": None,
    "author_en": None,
    "meta_ar": "مصحف المدينة برواية حفص عن عاصم — نص مجمع الملك فهد",
    "meta_en": "Madinah mushaf, Ḥafṣ ʿan ʿĀṣim — the King Fahd Complex text",
    "era_year": 632,
    "source_id": "qpc-hafs",
    "sort_order": 1,
}


def lemma_display(ar: str) -> str:
    """Corpus lemmas sometimes carry a shadda on their first letter that belongs to the preceding word's
    assimilation (رَّحْمَٰن); it is context, not part of the lemma (same rule as the API)."""
    return ar[0] + ar[2:] if len(ar) > 1 and ar[1] == "\u0651" else ar


def _pattern_rows(lemmas: list[dict[str, Any]], registry: SlugRegistry) -> list[dict[str, Any]]:
    by_pattern: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for lem in lemmas:
        if lem.get("pattern"):
            by_pattern[lem["pattern"]].append(lem)
    order = sorted(by_pattern, key=lambda p: (-sum(x["occurrences"] for x in by_pattern[p]), p))
    rows = []
    for pid, pat in enumerate(order, 1):
        members = by_pattern[pat]
        pos = Counter(x["pos"] for x in members).most_common(1)[0][0]
        forms = Counter(x["verb_form"] for x in members if x["verb_form"] and x["pos"] == "V")
        rows.append(
            {
                "id": pid,
                "slug": registry.assign(pat, slug_pattern(pat)),
                "ar": pat,
                "ar_bare": display_bare(pat),
                "translit": scholarly(pat),
                # Form I verbs carry no form tag in the corpus; a verb pattern without one is Form I.
                "form_number": forms.most_common(1)[0][0] if forms else (1 if pos == "V" else None),
                "pos_hint": pos,
                "lemma_count": len(members),
                "occurrences": sum(x["occurrences"] for x in members),
                # Function and plain explanations come from named sarf works, written in the editorial
                # workbench (P3.3). Until then they are null and the interface says so.
                "function_ar": None,
                "function_en": None,
                "plain_ar": None,
                "plain_en": None,
            }
        )
    return rows


def build_generic(
    surahs: list[dict[str, Any]],
    verses: list[dict[str, Any]],
    words: list[dict[str, Any]],
    lemmas: list[dict[str, Any]],
    registry_dir: Path,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Returns the new tables and a report. Mutates ``lemmas`` in place: adds slug, translit, pattern_id."""
    lemma_reg = SlugRegistry(registry_dir / "lemma-slugs.tsv")
    pattern_reg = SlugRegistry(registry_dir / "pattern-slugs.tsv")

    # Most frequent first, so common words get the clean slug when two romanise alike.
    for lem in sorted(lemmas, key=lambda x: (-x["occurrences"], x["key"])):
        shown = lemma_display(lem["ar"])
        lem["slug"] = lemma_reg.assign(lem["key"], slug_lemma(shown))
        lem["translit"] = scholarly(shown)
        lem["pos_ar"], lem["pos_en"] = labels.POS.get(lem["pos"], (lem["pos"], lem["pos"]))
    patterns = _pattern_rows(lemmas, pattern_reg)
    pattern_ids = {p["ar"]: p["id"] for p in patterns}
    for lem in lemmas:
        lem["pattern_id"] = pattern_ids.get(lem["pattern"]) if lem.get("pattern") else None

    texts = [QURAN_TEXT | {"chapter_count": 114, "passage_count": len(verses), "token_count": len(words)}]
    chapters = [
        {
            "id": s["number"],
            "text_id": 1,
            "ordinal": s["number"],
            "uri": f"quran:{s['number']}",
            "title_ar": s["name_ar"],
            "title_en": s["name_en"],
            "title_translit": s["name_translit"],
            "passage_count": s["verse_count"],
            "meta": {
                "revelation_place": s["revelation_place"],
                "revelation_order": s["revelation_order"],
                "page_start": s["page_start"],
                "juz_start": s["juz_start"],
            },
        }
        for s in surahs
    ]
    passages = [
        {
            "id": v["id"],
            "text_id": 1,
            "chapter_id": v["surah"],
            "ordinal": v["ayah"],
            "ref": v["key"],
            "uri": f"quran:{v['key']}",
            "verse_id": v["id"],
            # The mushaf text is never copied: readers join verses.text_qpc (hash-checked).
            "ar_full": None,
            "norm": v["norm"],
            "token_count": v["word_count"],
        }
        for v in verses
    ]
    lemma_by_id = {x["id"]: x for x in lemmas}
    tokens = [
        {
            "id": w["id"],
            "passage_id": w["verse_id"],
            "ordinal": w["position"],
            "uri": f"quran:{w['location']}",
            "surface": w["text_uthmani"],
            "surface_bare": display_bare(w["text_imlaei"] or w["text_uthmani"]),
            "norm": w["norm"],
            "lemma_id": w["lemma_id"],
            "root_id": w["root_id"],
            "pattern_id": lemma_by_id[w["lemma_id"]]["pattern_id"] if w["lemma_id"] else None,
            "pos": w["pos"],
            "confidence": 1.0,  # the corpus analysis, hand-verified by its authors
            "word_id": w["id"],
        }
        for w in words
    ]
    corpora = [
        {
            "id": "quran",
            "text_id": 1,
            "label_ar": "القرآن الكريم",
            "label_en": "The Quran",
            "year": 632,
            "sort_order": 1,
        }
    ]

    lemma_reg.save("lemma key (corpus Buckwalter)\tslug")
    pattern_reg.save("pattern (vocalised Arabic)\tslug")
    report = {
        "lemma_slugs_added": len(lemma_reg.added),
        "pattern_slugs_added": len(pattern_reg.added),
        "lemma_slug_suffixed": sum(1 for x in lemmas if x["slug"] != slug_lemma(lemma_display(x["ar"]))),
        "patterns": len(patterns),
        "texts": len(texts),
        "passages": len(passages),
        "tokens": len(tokens),
        "normalize_check": normalize("ٱلْكِتَٰبُ") == "الكتب",
    }
    return {
        "texts": texts,
        "chapters": chapters,
        "passages": passages,
        "passage_tokens": tokens,
        "patterns": patterns,
        "corpora": corpora,
    }, report


def load_glossary(path: Path) -> list[dict[str, Any]]:
    """data/glossary.yaml → rows. Keys are unique and both languages are required."""
    doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    cats = doc["categories"]
    rows, seen = [], set()
    for t in doc["terms"]:
        if t["key"] in seen:
            raise ValueError(f"glossary: duplicate key {t['key']!r}")
        seen.add(t["key"])
        if t["category"] not in cats:
            raise ValueError(f"glossary: {t['key']!r} has unknown category {t['category']!r}")
        for lang in ("ar", "en"):
            if not (t.get(lang) or {}).get("label") or not t[lang].get("body"):
                raise ValueError(f"glossary: {t['key']!r} lacks its {lang} label or body")
        rows.append(
            {
                "key": t["key"],
                "category": t["category"],
                "category_ar": cats[t["category"]]["ar"],
                "category_en": cats[t["category"]]["en"],
                "label_ar": t["ar"]["label"],
                "label_en": t["en"]["label"],
                "body_ar": t["ar"]["body"],
                "body_en": t["en"]["body"],
                "href": t.get("href"),
                "jump_target": t.get("jump_target"),
                "sort_order": t["sort_order"],
            }
        )
    return rows
