"""The public API (PLAN P10.2a, research 18, design 08 §8.8): stable answers for other people's programs, by product
(`quran` now; the dictionary, hadith and books will join under their own names, DAT-Q07), each in an envelope that
carries its provenance — `{meta: {dataset, dataset_version, release, layers, generated_at, docs}, data}` — so the
source and licence of every layer travel with the data (DAT-H02, Q02, Q03).

Only layers whose terms allow use in an application with credit are served here: the Quran's text (KFGQPC, and
Tanzil's text as the corpus carries it), the corpus's morphology, and our own derived patterns. The dictionaries
(display only, D22) and the word-by-word English glosses (left out of the bulk release, research 07) are not. A value
this project derived says how (`pattern_method`).
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

import yaml
from fastapi import APIRouter, Query, Request
from fastapi import Path as P
from fastapi.responses import Response
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import analyse, content, lexicon, releases
from .db import connect
from .search import search as run_search

router = APIRouter(prefix="/api/v1/public", tags=["public"])
REPO = Path(__file__).resolve().parents[4]
SITE = "https://jadhr.org"
OURS = {
    "id": "jadhr",
    "title_en": "Jadhr — this project's derived layers",
    "license": "CC BY-SA 4.0 (D14)",
    "attribution_en": "Jadhr (jadhr.org), dataset as versioned in meta.",
    "url": "https://creativecommons.org/licenses/by-sa/4.0/",
}
# which source each layer comes from
LAYERS = {
    "text_qpc": ("the verse text as the mushaf writes it", "qpc-hafs"),
    "text_corpus": ("the word forms, Tanzil's Uthmani text as the corpus carries it", "qac-tanzil"),
    "morphology": ("roots, lemmas, parts of speech, features and segments", "qac"),
    "patterns": ("each lemma's pattern (wazn), derived by this project", "jadhr"),
    "analysis": (
        "a text's words read against the Quran's own words by this project: the corpus's analysis where the text is "
        "the Quran's, else the same written form in the Quran, the form without its clitics, or the Quran's patterns "
        "over its roots — machine-derived, each reading with its confidence",
        "jadhr",
    ),
}
_LOC = re.compile(r"^\d{1,3}:\d{1,3}:\d{1,3}$")
_VERSE = re.compile(r"^\d{1,3}:\d{1,3}$")


# the word forms are the corpus's own copy of Tanzil's text (1.0.2), not the Tanzil 1.1 file the register lists for
# checking the text: said as the release says it (jadhr_pipeline.release, research 07)
CORPUS_TEXT = {
    "id": "qac-tanzil",
    "title_en": "Tanzil Quran Text (Uthmani, version 1.0.2), as the Quranic Arabic Corpus carries it",
    "license": "Creative Commons BY-ND 3.0 Unported, Copyright (C) 2008-2009 Tanzil.info — verbatim copies only",
    "attribution_en": "Quran text: Tanzil Project (tanzil.net), via the Quranic Arabic Corpus (corpus.quran.com).",
    "url": "https://tanzil.net",
}


@lru_cache
def _sources() -> dict[str, dict[str, Any]]:
    raw = yaml.safe_load((REPO / "data/sources.yaml").read_text(encoding="utf-8"))["sources"]
    return {s["id"]: s for s in raw} | {"jadhr": OURS, "qac-tanzil": CORPUS_TEXT}


def _layer(layer: str) -> dict[str, Any]:
    what, sid = LAYERS[layer]
    s = _sources()[sid]
    return {
        "layer": layer,
        "what": what,
        "source": sid,
        "title": s.get("title_en"),
        "license": s.get("license"),
        "attribution": s.get("attribution_en"),
        "url": s.get("url"),
    }


def _meta(conn: Any, layers: list[str]) -> dict[str, Any]:
    d = content.dataset(conn)
    recorded = releases.recorded(d["version"])
    return {
        "dataset": "jadhr-quran",
        "dataset_version": d["version"],
        # the recorded release of this version, when there is one: what a citation names
        "release": recorded,
        "layers": [_layer(x) for x in layers],
        "generated_at": d["loaded_at"].isoformat(),
        "docs": f"{SITE}/developers",
    }


def _answer(request: Request, conn: Any, layers: list[str], data: Any) -> Response:
    from .main import cached  # the content cache: strong ETag over the release, the board's state and the URL

    return cached(request, {"meta": _meta(conn, layers), "data": data})


def _not_found(what: str) -> Any:
    from .main import not_found

    return not_found(what)


# ─── the index ────────────────────────────────────────────────────────────────


@router.get("", summary="The public API: its products, endpoints and limits")
def index(request: Request) -> Response:
    from .settings import get_settings

    st = get_settings()
    data = {
        "products": {"quran": "the Quran's text, morphology and patterns"},
        "endpoints": [
            {"method": sorted(r.methods - {"HEAD"})[0], "path": r.path, "summary": r.summary}
            for r in router.routes
            if isinstance(r, APIRoute) and r.path != "/api/v1/public"
        ],
        # without a key, per address; with one, per key (RateLimit-* headers on every answer)
        "limits": {
            "per_minute_without_key": st.public_rate_per_minute,
            "per_minute_with_key": st.key_rate_per_minute,
        },
        "keys": f"{SITE}/me?tab=account",
        "openapi": "/api/v1/openapi.json",
    }
    with connect() as conn:
        return _answer(request, conn, [], data)


# ─── the Quran ────────────────────────────────────────────────────────────────


@router.get(
    "/quran/lookup",
    summary="Typed matches for any query: Arabic with or without vowels, a root, a pattern, a verse",
)
def lookup(
    request: Request,
    q: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> Response:
    with connect() as conn:
        r = run_search(conn, q, limit, 0, None)
        res = r["results"]
        data = {
            "query": r["query"],
            "detected": r["detected"]["kind"],
            "results": {
                "roots": [
                    {
                        k: x[k]
                        for k in ("key", "spaced", "translit", "occurrences", "verse_count", "lemma_count")
                    }
                    | {"url": f"{SITE}/roots/{x['key']}"}
                    for x in res.get("roots", [])
                ],
                "lemmas": [
                    {
                        "slug": x["slug"],
                        "ar": x["ar"],
                        "pos": x["pos"],
                        "root": x.get("root"),
                        "pattern": x.get("pattern"),
                        "occurrences": x["occurrences"],
                        "url": f"{SITE}/word/{x['slug']}",
                    }
                    for x in res.get("lemmas", [])
                ],
                "forms": [
                    {k: x.get(k) for k in ("form", "occurrences", "lemma", "root", "sample")}
                    for x in res.get("words", [])
                ],
                "verses": [
                    {
                        "key": x["key"],
                        "text_qpc": x["text_qpc"],
                        "url": f"{SITE}/quran/{x['surah']}/{x['ayah']}",
                    }
                    for x in res.get("verses", [])
                ],
                "patterns": [{"slug": x.get("slug"), "ar": x.get("ar")} for x in res.get("patterns", [])],
            },
        }
        return _answer(request, conn, ["morphology", "patterns", "text_qpc"], data)


@router.get(
    "/quran/roots/{root}",
    summary="A root (علم, ع ل م or ʿ-l-m): its lemmas with their patterns, its distribution",
)
def root(request: Request, root: Annotated[str, P(max_length=40)]) -> Response:
    with connect() as conn:
        r = content.root_detail(conn, root)
        if r is None:
            raise _not_found("root")
        data = {
            **{
                k: r[k]
                for k in (
                    "key",
                    "letters",
                    "spaced",
                    "translit",
                    "occurrences",
                    "verse_count",
                    "surah_count",
                    "lemma_count",
                )
            },
            "lemmas": [
                {
                    k: x.get(k)
                    for k in (
                        "slug",
                        "ar",
                        "pos",
                        "verb_form",
                        "derivation",
                        "pattern",
                        "pattern_method",
                        "occurrences",
                        "verse_count",
                    )
                }
                for x in r["lemmas"]
            ],
            "distribution": [
                {"surah": x["surah"], "occurrences": x["occurrences"]} for x in r["distribution"]
            ],
            "url": f"{SITE}/roots/{r['key']}",
        }
        return _answer(request, conn, ["morphology", "patterns"], data)


@router.get(
    "/quran/words/{location}",
    summary="One word of the Quran by its place (2:255:3): its form, morphology, lemma and root",
)
def word(request: Request, location: Annotated[str, P(max_length=12)]) -> Response:
    if not _LOC.match(location):
        raise _not_found("word")
    with connect() as conn:
        w = content.word(conn, location)
        if w is None:
            raise _not_found("word")
        lemma = w.get("lemma") or {}
        root_ = w.get("root") or {}
        # the lemma's stable slug (P1.3b), not the corpus's Buckwalter key
        slug = (
            conn.execute(text("select slug from content.lemmas where id = :i"), {"i": lemma["id"]}).scalar()
            if lemma.get("id")
            else None
        )
        data = {
            "location": w["location"],
            "verse_key": w["verse"]["key"],
            "position": w["position"],
            "text_uthmani": w["text_uthmani"],
            "pos": w["pos"],
            "features": w["features"],
            "segments": w["segments"],
            "lemma": {
                "slug": slug,
                "ar": lemma.get("ar"),
                "pattern": lemma.get("pattern"),
                "pattern_method": lemma.get("pattern_method"),
            }
            if lemma
            else None,
            "root": {"key": root_.get("key"), "spaced": root_.get("spaced")} if root_ else None,
            "url": f"{SITE}/quran/{w['surah']}/{w['ayah']}",
        }
        return _answer(request, conn, ["text_corpus", "morphology", "patterns"], data)


@router.get(
    "/quran/verses/{key}", summary="One verse (2:255): its text as the mushaf writes it, and its words"
)
def verse(request: Request, key: Annotated[str, P(max_length=8)]) -> Response:
    if not _VERSE.match(key):
        raise _not_found("verse")
    s, a = (int(x) for x in key.split(":"))
    with connect() as conn:
        v = content.verse(conn, s, a)
        if v is None:
            raise _not_found("verse")
        data = {
            **{k: v[k] for k in ("key", "surah", "ayah", "page", "juz", "text_qpc")},
            "words": [
                {k: x.get(k) for k in ("location", "text_uthmani", "pos", "root", "lemma", "lemma_slug")}
                for x in v["words"]
            ],
            "url": f"{SITE}/quran/{s}/{a}",
        }
        return _answer(request, conn, ["text_qpc", "text_corpus", "morphology"], data)


@router.get("/quran/patterns/{slug}", summary="A pattern (wazn) and its lemmas across roots")
def pattern(
    request: Request, slug: Annotated[str, P(max_length=40)], limit: Annotated[int, Query(ge=1, le=500)] = 100
) -> Response:
    with connect() as conn:
        p = lexicon.pattern_payload(conn, slug, limit)
        if p is None:
            raise _not_found("pattern")
        data = {
            **{k: p[k] for k in ("slug", "ar", "form_number", "pos_hint", "lemma_count", "occurrences")},
            "lemmas": [
                {
                    "slug": m["slug"],
                    "ar": m["ar"],
                    "pos": m["pos"]["tag"] if isinstance(m.get("pos"), dict) else m.get("pos"),
                    "root": (m.get("root") or {}).get("key"),
                    "occurrences": m["occurrences"],
                }
                for m in p.get("members", [])
            ],
        }
        return _answer(request, conn, ["morphology", "patterns"], data)


@router.get("/quran/concordance", summary="A root's lines in the Quran (KWIC), a page at a time")
def concordance(
    request: Request,
    root: Annotated[str, Query(min_length=1, max_length=40)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query(max_length=12)] = None,
) -> Response:
    after = int(cursor) if cursor and cursor.isdigit() else 0
    with connect() as conn:
        r = content.root_occurrences(conn, root, None, limit, after, None)
        if r is None:
            raise _not_found("root")
        data = {
            "root": r["root"],
            "total": r["total"],
            "lines": [
                {
                    k: x.get(k)
                    for k in ("location", "verse_key", "left", "keyword", "right", "form", "lemma", "pos")
                }
                for x in r["data"]
            ],
            "next_cursor": r.get("next_cursor"),
        }
        return _answer(request, conn, ["text_corpus", "morphology"], data)


class _Text(BaseModel):
    text: str = Field(min_length=1, max_length=600)


def _reading(c: dict[str, Any], at_place: bool) -> dict[str, Any]:
    """One reading of a word, as the public API gives it: no word-by-word English or transliteration (left out of
    the bulk release); the inflection and segments only for a word read at its own place in the Quran — for any
    other text they would be the inflection of the Quranic example, not of the reader's word."""
    out: dict[str, Any] = {
        "lemma": c["lemma"],
        "root": {"key": c["root"]["key"], "spaced": c["root"]["spaced"]} if c.get("root") else None,
        "pattern": c["pattern"],
        "pos": c["pos"],
        "confidence": c["confidence"],
    }
    if at_place:
        out |= {"location": c["location"], "features": c["features"], "segments": c["segments"]}
    else:
        out |= {"quran_occurrences": c["count"], "share": c["share"], "quran_example": c["location"]}
    return out


@router.post(
    "/quran/analyse",
    summary="A phrase read word by word against the Quran: the corpus's analysis where it is the Quran's, ranked "
    "readings otherwise — machine-derived, each with its confidence (the text is not stored)",
)
def analyse_text(body: _Text) -> Response:
    from .main import ORJSONResponse, dataset_release

    with connect() as conn:
        a = analyse.analyse(conn, body.text)
        tokens = []
        for t in a["tokens"]:
            # a word read from a verse has its place; any other word was matched to the Quran's words
            at_place = t.get("location") is not None
            tok: dict[str, Any] = {
                "surface": t["surface"],
                # how it was read: gold (the corpus, at its place), form, clitic, pattern, particle, none
                "kind": t["kind"],
                "confidence": t["confidence"],
                "location": t.get("location"),
                "clitics": t.get("clitics", []),
                "readings": [_reading(c, at_place) for c in t["candidates"]],
            }
            if t.get("particle"):
                tok["particle"] = _reading(t["particle"], at_place)
            tokens.append(tok)
        data = {
            "text": a["text"],
            "source": a["source"],
            "tokens": tokens,
            "counts": a["counts"],
            "truncated": a["truncated"],
        }
        payload = {"meta": _meta(conn, ["text_corpus", "morphology", "patterns", "analysis"]), "data": data}
    version, release = dataset_release()
    # a reader's text: answered, never kept, never cached
    return ORJSONResponse(
        payload,
        headers={"Cache-Control": "no-store", "X-Dataset-Version": version, "X-Dataset-Release": release},
    )


# ─── releases ─────────────────────────────────────────────────────────────────


@router.get("/releases", summary="Every recorded dataset release, with its files' hashes and holds")
def all_releases(request: Request) -> Response:
    with connect() as conn:
        return _answer(request, conn, [], releases.releases()["data"])
