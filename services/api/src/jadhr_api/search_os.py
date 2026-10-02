"""Search on OpenSearch (design 09 §9.4): one msearch across words, roots, patterns and passages.

The response keeps the Postgres engine's keys (verses, surahs, roots, lemmas, words) so every client
keeps working, and adds ``patterns``, ``passages`` and per-result scores. Every Arabic display field
comes from Postgres-verified values carried in the index; the index only decides what matches.
"""

from __future__ import annotations

from typing import Any

from jadhr_arabic import has_marks, normalize
from opensearchpy import OpenSearch
from sqlalchemy import Connection

from .db import one, rows
from .lexicon import ar
from .search import LABELS, _lemma_candidates
from .searchindex import PREFIX


def _boosted(should: list[dict[str, Any]], freq_field: str | None) -> dict[str, Any]:
    q: dict[str, Any] = {"bool": {"should": should, "minimum_should_match": 1}}
    if not freq_field:
        return q
    # A mild frequency signal: common words first, but rare words are often what a scholar wants.
    return {
        "function_score": {
            "query": q,
            "field_value_factor": {"field": freq_field, "modifier": "log1p", "factor": 0.3, "missing": 0},
            "boost_mode": "multiply",
        }
    }


def _words_query(q: str, latin: bool) -> dict[str, Any]:
    if latin:
        should = [
            {"match": {"translit": {"query": q, "boost": 6}}},
            {"match": {"translit.prefix": {"query": q, "boost": 2}}},
            {"match": {"forms_translit": {"query": q, "boost": 4, "fuzziness": "AUTO"}}},
            {"match": {"translit": {"query": q, "boost": 2, "fuzziness": "AUTO"}}},
            {"match_phrase": {"gloss_en": {"query": q, "boost": 5}}},
            {"match": {"gloss_en": {"query": q, "boost": 3}}},
            {"match_phrase": {"senses_en": {"query": q, "boost": 4}}},
            {"match": {"senses_en": {"query": q, "boost": 2}}},
        ]
    else:
        should = [
            {"match_phrase": {"ar.exact": {"query": q, "boost": 12 if has_marks(q) else 4}}},
            {"match": {"ar": {"query": q, "boost": 8}}},
            {"match": {"forms": {"query": q, "boost": 5}}},
            {"match": {"ar.prefix": {"query": q, "boost": 2}}},
            {"match": {"forms.prefix": {"query": q, "boost": 1}}},
            {"match": {"ar.stemmed": {"query": q, "boost": 0.5}}},
        ]
        # الرحمن → رحمن: also try the query without a leading article or conjunction
        for cand in _lemma_candidates(normalize(q))[1:]:
            should.append({"match": {"ar": {"query": cand, "boost": 6}}})
    return _boosted(should, "occurrences")


def _roots_query(q: str, latin: bool) -> dict[str, Any]:
    should = (
        [{"match": {"translit": {"query": q, "boost": 6}}}, {"match": {"gloss_en": {"query": q, "boost": 2}}}]
        if latin
        else [{"match": {"ar": {"query": q, "boost": 6}}}, {"match": {"ar.prefix": {"query": q, "boost": 1}}}]
    )
    return _boosted(should, "occurrences")


def _patterns_query(q: str, latin: bool) -> dict[str, Any]:
    should = (
        [{"match": {"translit": {"query": q, "boost": 6}}}]
        if latin
        else [
            {"match_phrase": {"ar.exact": {"query": q, "boost": 10}}},
            {"match": {"ar": {"query": q, "boost": 5}}},
        ]
    )
    return {"bool": {"should": should, "minimum_should_match": 1}}


def _passages_query(q: str, latin: bool) -> dict[str, Any]:
    if latin:
        should = [
            {"match_phrase": {"trans_en": {"query": q, "boost": 4}}},
            {"match": {"trans_en": {"query": q, "operator": "and", "boost": 2}}},
        ]
    else:
        should = [
            {"match_phrase": {"ar": {"query": q, "boost": 8}}},
            {"match_phrase": {"ar_uthmani": {"query": q, "boost": 8}}},
            {"match": {"ar": {"query": q, "operator": "and", "boost": 3}}},
            {"match": {"ar_uthmani": {"query": q, "operator": "and", "boost": 3}}},
        ]
    return {"bool": {"should": should, "minimum_should_match": 1}}


def _lemma_hit(conn: Connection, src: dict[str, Any], score: float) -> dict[str, Any] | None:
    x = one(
        conn,
        """select l.id, l.slug, l.ar, l.translit, l.pos, l.pos_ar, l.pos_en, l.occurrences, l.gloss_en,
                  r.key as root, r.spaced as root_spaced, p.slug as pattern_slug
           from content.lemmas l left join content.roots r on r.id = l.root_id
           left join content.patterns p on p.id = l.pattern_id where l.slug = :s""",
        {"s": src["slug"]},
    )
    if x is None:
        return None
    from .content import lemma_display

    full = lemma_display(x["ar"])
    return {
        "id": x["id"],
        "slug": x["slug"],
        "ar": full,  # kept a plain string for clients of the Postgres engine's shape
        "envelope": ar(full, x["translit"]),
        "pos": x["pos"],
        "pos_label": {"ar": x["pos_ar"], "en": x["pos_en"]},
        "occurrences": x["occurrences"],
        "gloss_en": x["gloss_en"],
        "senses_en": src.get("senses_en", [])[:3],
        "root": x["root"],
        "root_spaced": x["root_spaced"],
        "pattern": x["pattern_slug"],
        "score": round(score, 3),
    }


def search(conn: Connection, es: OpenSearch, q: str, limit: int = 20) -> dict[str, Any]:
    from .search import search_pg

    # Detection, references, surah names and root letters are exact: the Postgres engine owns them.
    base = search_pg(conn, q, limit)
    kind = base["detected"]["kind"]
    results: dict[str, list[dict[str, Any]]] = base["results"]
    results.setdefault("patterns", [])
    results.setdefault("passages", [])
    if kind in ("empty", "verse_ref"):
        base["engine"] = "opensearch"
        return base

    latin = kind == "latin"
    body: list[dict[str, Any]] = []
    plan: list[str] = []
    if kind == "root":
        keys = [r["key"] for r in results["roots"]]
        body += [
            {"index": PREFIX + "words"},
            {"size": 200, "query": {"terms": {"root_key": keys}}, "sort": [{"occurrences": "desc"}]},
        ]
        plan.append("family")
    else:
        for name, query in (
            ("words", _words_query(q, latin)),
            ("roots", _roots_query(q, latin)),
            ("patterns", _patterns_query(q, latin)),
        ):
            body += [{"index": PREFIX + name}, {"size": limit, "query": query}]
            plan.append(name)
        body += [
            {"index": PREFIX + "passages"},
            {
                "size": limit,
                "query": _passages_query(q, latin),
                "highlight": {
                    "fields": {"ar": {}, "trans_en": {}},
                    "pre_tags": ["⁨"],  # FSI…PDI: bidi-safe markers the client turns into <mark>
                    "post_tags": ["⁩"],
                    "number_of_fragments": 0,
                },
            },
        ]
        plan.append("passages")
    responses = es.msearch(body=body)["responses"]
    for name, res in zip(plan, responses, strict=True):
        if "error" in res:
            raise RuntimeError(f"{name}: {res['error']}")
        hits = res["hits"]["hits"]
        if name in ("words", "family"):
            lemmas = [h for h in (_lemma_hit(conn, x["_source"], x.get("_score") or 0.0) for x in hits) if h]
            results["lemmas"] = lemmas
        elif name == "roots" and kind not in ("root",):
            have = {r["key"] for r in results["roots"]}
            for h in hits:
                s = h["_source"]
                if s["key"] in have:
                    continue
                r = one(
                    conn,
                    "select key, spaced, translit, occurrences, lemma_count, verse_count from content.roots where key = :k",
                    {"k": s["key"]},
                )
                if r:
                    results["roots"].append(r | {"score": round(h["_score"] or 0, 3)})
            results["roots"] = results["roots"][:limit]
        elif name == "patterns":
            results["patterns"] = [
                {
                    "slug": h["_source"]["slug"],
                    "ar": ar(h["_source"]["ar"], h["_source"]["translit"]),
                    "form_number": h["_source"]["form_number"],
                    "occurrences": h["_source"]["occurrences"],
                    "lemma_count": h["_source"]["lemma_count"],
                    "score": round(h["_score"] or 0, 3),
                }
                for h in hits
            ]
        elif name == "passages":
            refs = [h["_source"]["ref"] for h in hits]
            verses = {
                v["key"]: v
                for v in rows(
                    conn,
                    """select v.key, v.surah, v.ayah, v.text_qpc, v.text_imlaei, s.name_ar, s.name_translit
                       from content.verses v join content.surahs s on s.number = v.surah where v.key = any(:k)""",
                    {"k": refs},
                )
            }
            results["passages"] = [
                {
                    "uri": h["_source"]["uri"],
                    "ref": h["_source"]["ref"],
                    "text": {"slug": h["_source"]["text_slug"], "kind": h["_source"]["text_kind"]},
                    "verse": verses.get(h["_source"]["ref"]),
                    "highlight_ar": (h.get("highlight", {}).get("ar") or [None])[0],
                    "highlight_en": (h.get("highlight", {}).get("trans_en") or [None])[0],
                    "trans_en": h["_source"].get("trans_en"),
                    "score": round(h["_score"] or 0, 3),
                }
                for h in hits
                if h["_source"]["ref"] in verses
            ]
            # the Postgres engine's verse list, now ranked by relevance
            results["verses"] = [p["verse"] for p in results["passages"]]
    ar_label, en_label = LABELS[kind]
    base["detected"].update(label_ar=ar_label, label_en=en_label)
    base["engine"] = "opensearch"
    return base
