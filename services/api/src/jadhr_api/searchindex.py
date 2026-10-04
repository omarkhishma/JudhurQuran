"""The search index: OpenSearch, derived from Postgres and fully rebuildable (design 09; PLAN P1.4, D11).

    uv run python -m jadhr_api.searchindex reindex      # build every index anew, verify, flip aliases
    uv run python -m jadhr_api.searchindex status

Each logical index (``jadhr_words``…) is an alias onto a versioned physical index
(``jadhr_words_<stamp>``). A reindex builds new physical indices, checks their document counts
against Postgres, then moves every alias in one atomic call and drops the old indices — searches
never see a half-built index. Content changes only with a dataset release, so the loader calls
``reindex`` after each load (the release is the outbox for content; user edits get a real outbox
when proposals merge, P7).

The Arabic chain implements ``packages/arabic-spec``: marks stripped (harakat, dagger alef,
Quranic signs, tatweel, format characters) and the alef/yeh/teh-marbuta/hamza-carrier fold —
the same key the Python and TypeScript normalisers produce. Root identity never comes from a
stemmer: the stemmed sub-field is a low-boost recall fallback only (design 09 §9.2).
"""

from __future__ import annotations

import json
import sys
import time
from collections import Counter
from collections.abc import Iterable, Iterator
from typing import Any

from jadhr_arabic import normalize
from opensearchpy import OpenSearch, helpers
from sqlalchemy import Connection

from .content import lemma_display
from .db import connect, rows, scalar
from .settings import get_settings

STRIP_PATTERN = (
    "[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u08D3-\\u08E1\\u08E3-\\u08FF"
    "\\u0640\\u200B-\\u200F\\u061C\\uFEFF]"
)
FOLD = [
    "ٱ => ا", "أ => ا", "إ => ا", "آ => ا", "ٲ => ا", "ٳ => ا", "ٵ => ا",
    "ى => ي", "ی => ي", "ة => ه", "ؤ => و", "ئ => ي", "ک => ك",
]  # fmt: skip

ANALYSIS: dict[str, Any] = {
    "char_filter": {
        "strip_marks": {"type": "pattern_replace", "pattern": STRIP_PATTERN, "replacement": ""},
        "fold": {"type": "mapping", "mappings": FOLD},
        # ʿ ʾ and apostrophes carry no letter in a Latin query: kitāb, kitab, 3ilm → ilm
        "translit_clean": {"type": "mapping", "mappings": ["ʿ => ", "ʾ => ", "' => ", "’ => ", "‘ => "]},
    },
    "filter": {
        "ar_stop": {"type": "stop", "stopwords": "_arabic_"},
        "ar_stem": {"type": "arabic_stem"},
        "edge_2_20": {"type": "edge_ngram", "min_gram": 2, "max_gram": 20},
        "latin_fold": {"type": "asciifolding", "preserve_original": True},
    },
    "analyzer": {
        "ar_exact": {"tokenizer": "standard", "filter": ["lowercase"]},
        "ar_bare": {"char_filter": ["strip_marks", "fold"], "tokenizer": "standard", "filter": ["lowercase"]},
        "ar_stemmed": {
            "char_filter": ["strip_marks", "fold"],
            "tokenizer": "standard",
            "filter": ["lowercase", "ar_stop", "ar_stem"],
        },
        "ar_prefix": {
            "char_filter": ["strip_marks", "fold"],
            "tokenizer": "standard",
            "filter": ["lowercase", "edge_2_20"],
        },
        "translit": {
            "char_filter": ["translit_clean"],
            "tokenizer": "standard",
            "filter": ["lowercase", "latin_fold"],
        },
        "translit_prefix": {
            "char_filter": ["translit_clean"],
            "tokenizer": "standard",
            "filter": ["lowercase", "latin_fold", "edge_2_20"],
        },
    },
}

AR_FIELD = {
    "type": "text",
    "analyzer": "ar_bare",
    "fields": {
        "exact": {"type": "text", "analyzer": "ar_exact"},
        "stemmed": {"type": "text", "analyzer": "ar_stemmed"},
        "prefix": {"type": "text", "analyzer": "ar_prefix", "search_analyzer": "ar_bare"},
        "kw": {"type": "keyword"},
    },
}
TR_FIELD = {
    "type": "text",
    "analyzer": "translit",
    "fields": {"prefix": {"type": "text", "analyzer": "translit_prefix", "search_analyzer": "translit"}},
}
KW = {"type": "keyword"}
INT = {"type": "integer"}

MAPPINGS: dict[str, dict[str, Any]] = {
    "words": {
        "slug": KW, "ar": AR_FIELD, "forms": AR_FIELD, "translit": TR_FIELD, "forms_translit": TR_FIELD,
        "gloss_en": {"type": "text", "analyzer": "english"}, "senses_en": {"type": "text", "analyzer": "english"},
        "root_key": KW, "root_letters": KW, "root_spaced": KW, "pattern_slug": KW, "pattern_ar": KW,
        "pos": KW, "occurrences": INT, "lemma_id": INT,
    },
    "roots": {
        "key": KW, "letters": KW, "ar": AR_FIELD, "spaced": KW, "translit": TR_FIELD,
        "gloss_en": {"type": "text", "analyzer": "english"}, "occurrences": INT, "lemma_count": INT,
    },
    "patterns": {
        "slug": KW, "ar": AR_FIELD, "translit": TR_FIELD, "form_number": INT, "occurrences": INT,
        "lemma_count": INT,
    },
    "passages": {
        "uri": KW, "ref": KW, "text_slug": KW, "text_kind": KW, "chapter": INT, "ordinal": INT,
        "chapter_name_ar": KW, "chapter_name_translit": KW,
        "ar": AR_FIELD, "ar_uthmani": AR_FIELD, "ar_plain": AR_FIELD, "trans_en": {"type": "text", "analyzer": "english"},
        "era_year": INT,
    },
    "occurrences": {
        "uri": KW, "location": KW, "passage_uri": KW, "ref": KW, "text_slug": KW, "text_kind": KW,
        "chapter": INT, "passage": INT, "position": INT, "word_id": INT,
        "surface": AR_FIELD, "surface_uthmani": AR_FIELD, "lemma_slug": KW, "root_key": KW,
        "pattern_slug": KW, "pos": KW,
        "left_sort": {"type": "keyword", "doc_values": True}, "right_sort": {"type": "keyword", "doc_values": True},
        "era_year": INT,
    },
    "dict_articles": {
        "entry_id": INT, "uri": KW, "work_id": KW, "lang": KW, "root_key": KW, "dict_roots": KW, "headword": AR_FIELD,
        "body": {"type": "text", "analyzer": "ar_bare", "fields": {"exact": {"type": "text", "analyzer": "ar_exact"}}},
        "body_en": {"type": "text", "analyzer": "english"}, "death_ce": INT,
    },
    # the dictionary's roots (P11.1): every root the lexica file an article under, the Quran's and the others
    "dict_roots": {"key": KW, "display": AR_FIELD, "first": KW, "letters": INT, "quran_root": KW, "lexica": INT},
    # the texts beyond the Quran (P11.4a): a hadith collection's records, a book's passages — no prefix field, a
    # passage being long; its roots, the sure and the possible apart, for the filters to come (P11.4b)
    "texts": {
        "uri": KW, "ref": KW, "text_slug": KW, "text_kind": KW, "chapter": INT, "top": INT,
        "ar": {"type": "text", "analyzer": "ar_bare",
               "fields": {"exact": {"type": "text", "analyzer": "ar_exact"},
                          "stemmed": {"type": "text", "analyzer": "ar_stemmed"}}},
        "roots": KW, "roots_low": KW, "era_year": INT,
    },
}  # fmt: skip

PREFIX = "jadhr_"


def client(timeout: float | None = None) -> OpenSearch | None:
    """Queries use the short request timeout; index administration passes a long one."""
    s = get_settings()
    if not s.search_url:
        return None
    return OpenSearch(
        s.search_url,
        timeout=timeout or s.search_timeout,
        max_retries=0,
        retry_on_timeout=False,
        http_compress=True,
    )


def available(es: OpenSearch | None) -> bool:
    if es is None:
        return False
    try:
        return bool(es.ping())
    except Exception:
        return False


# ─── documents ──────────────────────────────────────────────────────────────


def _words(conn: Connection) -> Iterator[dict[str, Any]]:
    lemmas = rows(
        conn,
        """select l.id, l.slug, l.ar, l.norm_plain, l.translit, l.gloss_en, l.pos, l.occurrences,
                  r.key as root_key, r.letters as root_letters, r.spaced as root_spaced,
                  p.slug as pattern_slug, p.ar as pattern_ar
           from content.lemmas l left join content.roots r on r.id = l.root_id
           left join content.patterns p on p.id = l.pattern_id""",
    )
    forms: dict[int, set[str]] = {}
    translits: dict[int, set[str]] = {}
    glosses: dict[int, Counter[str]] = {}
    for f in rows(
        conn,
        """select lemma_id, text_imlaei, text_uthmani, norm_plain, translit, gloss_en from content.words
           where lemma_id is not null""",
    ):
        # the everyday spelling read off the mushaf too: السماوات finds its word (migration 0017)
        forms.setdefault(f["lemma_id"], set()).update(
            x for x in (f["text_imlaei"], f["text_uthmani"], f["norm_plain"]) if x
        )
        if f["translit"]:
            translits.setdefault(f["lemma_id"], set()).add(f["translit"])
        if f["gloss_en"]:
            glosses.setdefault(f["lemma_id"], Counter())[f["gloss_en"]] += 1
    for x in lemmas:
        yield {
            "_id": x["slug"],
            "slug": x["slug"],
            "lemma_id": x["id"],
            # the lemma as the corpus writes it, and in everyday spelling (كِتَٰب → كتاب)
            "ar": [lemma_display(x["ar"]), x["norm_plain"]],
            "forms": sorted(forms.get(x["id"], ())),
            "translit": x["translit"],
            "forms_translit": sorted(translits.get(x["id"], ())),
            "gloss_en": x["gloss_en"],
            # The corpus' word-by-word glosses of this lemma's occurrences (credited at display), most used
            # first — what lets "knowledge" find ʿilm, whose lemma has no gloss of its own.
            "senses_en": [g for g, _ in glosses.get(x["id"], Counter()).most_common(12)],
            "root_key": x["root_key"],
            "root_letters": x["root_letters"],
            "root_spaced": x["root_spaced"],
            "pattern_slug": x["pattern_slug"],
            "pattern_ar": x["pattern_ar"],
            "pos": x["pos"],
            "occurrences": x["occurrences"],
        }


def _roots(conn: Connection) -> Iterator[dict[str, Any]]:
    for r in rows(
        conn, "select key, letters, spaced, translit, gloss_en, occurrences, lemma_count from content.roots"
    ):
        yield {
            "_id": r["key"],
            "key": r["key"],
            "letters": r["letters"],
            "ar": [r["key"], r["spaced"]],
            "spaced": r["spaced"],
            "translit": [r["translit"], r["translit"].replace("-", "")],
            "gloss_en": r["gloss_en"],
            "occurrences": r["occurrences"],
            "lemma_count": r["lemma_count"],
        }


def _patterns(conn: Connection) -> Iterator[dict[str, Any]]:
    for p in rows(
        conn, "select slug, ar, translit, form_number, occurrences, lemma_count from content.patterns"
    ):
        yield {"_id": p["slug"], **p}


def _passages(conn: Connection) -> Iterator[dict[str, Any]]:
    trans = {
        r["verse_from"]: r["text"]
        for r in rows(
            conn,
            """select p.verse_from, p.text from content.work_passages p join content.works w on w.id = p.work_id
               where w.kind = 'translation' and w.default_for = 'en' and p.verse_from = p.verse_to""",
        )
    }
    for v in rows(
        conn,
        """select v.id, v.key, v.surah, v.ayah, v.text_imlaei, v.text_qpc, v.norm_plain, s.name_ar, s.name_translit
           from content.verses v join content.surahs s on s.number = v.surah order by v.id""",
    ):
        yield {
            "_id": f"quran:{v['key']}",
            "uri": f"quran:{v['key']}",
            "ref": v["key"],
            "text_slug": "quran",
            "text_kind": "quran",
            "chapter": v["surah"],
            "ordinal": v["ayah"],
            "chapter_name_ar": v["name_ar"],
            "chapter_name_translit": v["name_translit"],
            "ar": v["text_imlaei"],
            "ar_uthmani": v["text_qpc"],
            "ar_plain": v["norm_plain"],
            "trans_en": trans.get(v["id"]),
            "era_year": 632,
        }


def _occurrences(conn: Connection) -> Iterator[dict[str, Any]]:
    words = rows(
        conn,
        """select w.id, w.location, w.surah, w.ayah, w.position, w.verse_id, w.text_imlaei, w.text_uthmani, w.pos,
                  l.slug as lemma_slug, r.key as root_key, p.slug as pattern_slug
           from content.words w left join content.lemmas l on l.id = w.lemma_id
           left join content.roots r on r.id = w.root_id left join content.patterns p on p.id = l.pattern_id
           order by w.id""",
    )
    by_verse: dict[int, list[dict[str, Any]]] = {}
    for w in words:
        by_verse.setdefault(w["verse_id"], []).append(w)
    for vw in by_verse.values():
        keys = [normalize(w["text_imlaei"] or w["text_uthmani"]) for w in vw]
        for i, w in enumerate(vw):
            yield {
                "_id": f"quran:{w['location']}",
                "uri": f"quran:{w['location']}",
                "location": w["location"],
                "passage_uri": f"quran:{w['surah']}:{w['ayah']}",
                "ref": f"{w['surah']}:{w['ayah']}",
                "text_slug": "quran",
                "text_kind": "quran",
                "chapter": w["surah"],
                "passage": w["ayah"],
                "position": w["position"],
                "word_id": w["id"],
                "surface": w["text_imlaei"] or w["text_uthmani"],
                "surface_uthmani": w["text_uthmani"],
                "lemma_slug": w["lemma_slug"],
                "root_key": w["root_key"],
                "pattern_slug": w["pattern_slug"],
                "pos": w["pos"],
                # The concordance trick: context to the left reversed word by word, so a plain keyword
                # sort orders rows by the word nearest the keyword (design 09 §9.3).
                "left_sort": " ".join(reversed(keys[:i])),
                "right_sort": " ".join(keys[i + 1 :]),
                "era_year": 632,
            }


def _dict_articles(conn: Connection) -> Iterator[dict[str, Any]]:
    for e in rows(
        conn,
        # every article the dictionary files under a root (P11.1), not only those under the Quran's
        """select e.id, e.uri, e.work_id, e.root_key, e.dict_roots, e.headword, e.body, w.lang, w.death_ce
           from content.lexicon_entries e join content.lexicon_works w on w.id = e.work_id
           where e.displayable or cardinality(e.dict_roots) > 0""",
    ):
        doc = {
            "_id": e["id"],
            "entry_id": e["id"],
            "uri": e["uri"],
            "work_id": e["work_id"],
            "lang": e["lang"],
            "root_key": e["root_key"],
            "dict_roots": e["dict_roots"],
            "headword": e["headword"],
            "death_ce": e["death_ce"],
        }
        doc["body_en" if e["lang"] == "en" else "body"] = e["body"]
        yield doc


def _dict_roots(conn: Connection) -> Iterator[dict[str, Any]]:
    for r in rows(
        conn,
        "select key, display, first, letters, quran_root, cardinality(lexica) as lexica from content.dict_roots",
    ):
        yield {"_id": r["key"], **r, "display": [r["display"], " ".join(r["display"])]}


def _texts(conn: Connection) -> Iterator[dict[str, Any]]:
    tops = {
        r["id"]: r["top"]
        for r in rows(
            conn,
            """with recursive up as (
                 select c.id, c.ordinal as top from content.chapters c
                  join content.texts t on t.id = c.text_id where t.kind <> 'quran' and c.parent_id is null
                 union all
                 select k.id, up.top from up join content.chapters k on k.parent_id = up.id
               ) select id, top from up""",
        )
    }
    for p in rows(
        conn,
        """select p.uri, p.ref, p.chapter_id, c.ordinal as chapter, p.ar_full, p.roots, p.roots_low,
                  t.slug, t.kind, t.era_year
             from content.passages p join content.texts t on t.id = p.text_id
             join content.chapters c on c.id = p.chapter_id
            where t.kind <> 'quran' order by p.id""",
    ):
        yield {
            "_id": p["uri"],
            "uri": p["uri"],
            "ref": p["ref"],
            "text_slug": p["slug"],
            "text_kind": p["kind"],
            "chapter": p["chapter"],
            "top": tops.get(p["chapter_id"]),
            "ar": p["ar_full"],
            "roots": p["roots"] or [],
            "roots_low": p["roots_low"] or [],
            "era_year": p["era_year"],
        }


SOURCES = {
    "words": (_words, "select count(*) from content.lemmas"),
    "roots": (_roots, "select count(*) from content.roots"),
    "patterns": (_patterns, "select count(*) from content.patterns"),
    "passages": (_passages, "select count(*) from content.verses"),
    "occurrences": (_occurrences, "select count(*) from content.words"),
    "dict_articles": (
        _dict_articles,
        "select count(*) from content.lexicon_entries where displayable or cardinality(dict_roots) > 0",
    ),
    "dict_roots": (_dict_roots, "select count(*) from content.dict_roots"),
    "texts": (
        _texts,
        "select count(*) from content.passages p join content.texts t on t.id = p.text_id where t.kind <> 'quran'",
    ),
}


# ─── reindex ────────────────────────────────────────────────────────────────


def _actions(index: str, docs: Iterable[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    for d in docs:
        _id = d.pop("_id")
        yield {"_index": index, "_id": _id, "_source": d}


def reindex(names: list[str] | None = None) -> dict[str, Any]:
    es = client(timeout=180)
    if not available(es):
        raise RuntimeError(f"OpenSearch is not reachable at {get_settings().search_url}")
    assert es is not None
    # Physical indices that no alias points at are leftovers of an interrupted reindex.
    aliased = {i for i, a in es.indices.get_alias(index=f"{PREFIX}*").items() if a.get("aliases")}
    for i in es.indices.get(index=f"{PREFIX}*"):
        if i not in aliased:
            es.indices.delete(index=i)
    stamp = time.strftime("%Y%m%d%H%M%S")
    names = names or list(MAPPINGS)
    report: dict[str, Any] = {}
    built: dict[str, str] = {}
    with connect() as conn:
        for name in names:
            physical = f"{PREFIX}{name}_{stamp}"
            es.indices.create(
                index=physical,
                body={
                    "settings": {
                        "index": {"number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "-1"},
                        "analysis": ANALYSIS,
                    },
                    "mappings": {"dynamic": "strict", "properties": MAPPINGS[name]},
                },
            )
            gen, count_sql = SOURCES[name]
            t = time.time()
            _ok, errors = helpers.bulk(
                es, _actions(physical, gen(conn)), chunk_size=2000, request_timeout=120, raise_on_error=False
            )
            if errors:
                es.indices.delete(index=physical)
                raise RuntimeError(
                    f"{name}: {len(errors)} documents failed, first: {json.dumps(errors[0], ensure_ascii=False)[:500]}"
                )
            es.indices.put_settings(index=physical, body={"index": {"refresh_interval": "1s"}})
            es.indices.refresh(index=physical)
            indexed = es.count(index=physical)["count"]
            expected = int(scalar(conn, count_sql) or 0)
            if indexed != expected:
                es.indices.delete(index=physical)
                raise RuntimeError(f"{name}: indexed {indexed} documents, Postgres has {expected}")
            built[name] = physical
            report[name] = {"documents": indexed, "seconds": round(time.time() - t, 1)}
    # Flip every alias in one call, then drop what they pointed at before.
    actions: list[dict[str, Any]] = []
    old: list[str] = []
    for name, physical in built.items():
        alias = PREFIX + name
        if es.indices.exists_alias(name=alias):
            current = list(es.indices.get_alias(name=alias))
            old += current
            actions += [{"remove": {"index": i, "alias": alias}} for i in current]
        elif es.indices.exists(index=alias):
            es.indices.delete(index=alias)
        actions.append({"add": {"index": physical, "alias": alias}})
    es.indices.update_aliases(body={"actions": actions})
    for i in old:
        es.indices.delete(index=i, ignore_unavailable=True)
    return {"stamp": stamp, "indices": report, "dropped": old}


def status() -> dict[str, Any]:
    es = client()
    if not available(es):
        return {"available": False, "url": get_settings().search_url}
    assert es is not None
    out = {"available": True, "indices": {}}
    for name in MAPPINGS:
        alias = PREFIX + name
        if es.indices.exists_alias(name=alias):
            out["indices"][name] = {
                "physical": list(es.indices.get_alias(name=alias)),
                "documents": es.count(index=alias)["count"],
            }
        else:
            out["indices"][name] = None
    return out


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "reindex":
        out = reindex(sys.argv[2:] or None)
        # the site's server-rendered search pages read the index through its cache: expire it, as a load does
        from .loader import revalidate_web

        out["web_revalidate"] = revalidate_web()
        print(json.dumps(out, ensure_ascii=False))
        return 0
    if cmd == "status":
        print(json.dumps(status(), ensure_ascii=False))
        return 0
    print("usage: python -m jadhr_api.searchindex reindex [names…] | status", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
