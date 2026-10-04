"""Jadhr public API — Quran text, morphology, roots and search, read-only and cited.

Run: ``uv run uvicorn jadhr_api.main:app --port 8000``  ·  Docs: ``/api/v1/docs``
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime, timedelta
from typing import Annotated, Any

import orjson
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Query, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import (
    accounts,
    analyse,
    apikeys,
    board,
    classroom,
    collections,
    concordance,
    content,
    daily,
    entities,
    hear,
    intake,
    knowledge,
    lexicon,
    path,
    relations,
    review,
    rootlife,
    routes_classroom,
    routes_contrib,
    routes_dictionary,
    routes_editorial,
    routes_graphs,
    routes_me,
    routes_narrators,
    routes_public,
    routes_published,
    routes_releases,
    topics,
)
from . import catalogue as catalogue_api
from . import texts as texts_api
from .db import connect, one, rows
from .refusal import Refusal
from .search import search as run_search
from .settings import get_settings

API_PREFIX = "/api/v1"
MAX_BODY = 8_000_000  # bytes: the largest request body the API reads
CONTENT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"


class ORJSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_NON_STR_KEYS, default=str)


def error(status: int, code: str, message: str, field: str | None = None) -> ORJSONResponse:
    return ORJSONResponse({"error": {"code": code, "message": message, "field": field}}, status_code=status)


# The loaded release, re-read every RELEASE_TTL seconds so a new release is served without a restart.
RELEASE_TTL = 30.0
_RELEASE: dict[str, Any] = {"checked": float("-inf"), "version": "", "id": ""}


def dataset_release() -> tuple[str, str]:
    """(version, release id). The id adds the load time, so reloading the same version still changes
    every ETag — a corrected rebuild must never be answered with 304 from the previous load."""
    now = time.monotonic()
    if now - _RELEASE["checked"] > RELEASE_TTL:
        with connect() as conn:
            d = content.dataset(conn)
        _RELEASE.update(checked=now, version=d["version"], id=f"{d['version']}@{d['loaded_at'].isoformat()}")
    return _RELEASE["version"], _RELEASE["id"]


def cached(request: Request, payload: Any) -> Response:
    """Content is immutable within a dataset release but for what the editorial board puts in force beside it: strong
    ETag over release + the board's state + URL, long cache."""
    version, release = dataset_release()
    etag = (
        '"'
        + hashlib.sha256(
            f"{release}|{board.version()}|{request.url.path}?{request.url.query}".encode()
        ).hexdigest()[:32]
        + '"'
    )
    headers = {
        "ETag": etag,
        "Cache-Control": CONTENT_CACHE,
        "X-Dataset-Version": version,
        "X-Dataset-Release": release,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return ORJSONResponse(payload, headers=headers)


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"No {what} with that identifier.")


router = APIRouter(prefix=API_PREFIX)


@router.get("/meta", summary="Dataset version, counts and sources")
def meta(request: Request) -> Response:
    with connect() as conn:
        d = content.dataset(conn)
        return cached(request, {"dataset": d, "sources": content.sources(conn)})


@router.get(
    "/catalog", summary="Every verse (with its word count) and every root key — for sitemaps and crawlers"
)
def catalog(request: Request) -> Response:
    with connect() as conn:
        return cached(request, content.catalog(conn))


@router.get(
    "/catalog/{part}",
    summary="Every page of a part of the site (dictionary, hadith, its chapters, narrators, books) — for sitemaps",
)
def catalog_part(request: Request, part: str) -> Response:
    if part not in content.CATALOG_PARTS:
        raise Refusal(404, "not_found", f"No such part; the parts are {', '.join(content.CATALOG_PARTS)}.")
    with connect() as conn:
        return cached(request, content.catalog_paths(conn, part))


@router.get("/sources", summary="Every data source with its license and required attribution")
def sources(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.sources(conn), "layers": content.source_layers(conn)})


@router.get("/surahs", summary="The 114 surahs")
def surahs(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.surahs(conn)})


@router.get(
    "/surahs/lemma-sets", summary="The distinct words (lemma slugs) of every sūra, for vocabulary coverage"
)
def surah_lemma_sets(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.surah_lemma_sets(conn)})


@router.get("/surahs/{number}", summary="One surah with its verses, display tokens and words")
def surah(
    request: Request,
    number: int,
    start: int = Query(1, ge=1, description="first ayah"),
    end: int | None = Query(None, ge=1, description="last ayah (inclusive)"),
    translation: str | None = Query(None, description="attach a translation work, e.g. saheeh"),
) -> Response:
    if not 1 <= number <= 114:
        raise not_found("surah")
    with connect() as conn:
        s = content.surah(conn, number)
        if s is None:
            raise not_found("surah")
        last = min(end or s["verse_count"], s["verse_count"])
        if start > last:
            raise HTTPException(status_code=400, detail="start is after end")
        verses = content.surah_verses(conn, number, start, last)
        payload: dict[str, Any] = {"surah": s, "verses": verses}
        if translation:
            work = content.attach_translation(conn, verses, translation)
            if work is None:
                raise not_found("translation")
            payload["translation"] = work
        return cached(request, payload)


@router.get(
    "/surahs/{number}/lines",
    summary="One optional reading line per verse: standard spelling or transliteration",
)
def surah_lines(
    request: Request, number: int, kind: str = Query(..., pattern="^(imlaei|translit)$")
) -> Response:
    if not 1 <= number <= 114:
        raise not_found("surah")
    with connect() as conn:
        return cached(
            request, {"surah": number, "kind": kind, "data": content.surah_lines(conn, number, kind)}
        )


@router.get("/surahs/{number}/roots", summary="Every root used in a sūra with its count there")
def surah_roots(request: Request, number: int) -> Response:
    if not 1 <= number <= 114:
        raise not_found("surah")
    with connect() as conn:
        return cached(request, {"surah": number, "data": content.surah_roots(conn, number)})


@router.get("/verses/{key}/related", summary="Verses sharing roots with this one, rare roots weighing more")
def related_verses(request: Request, key: str, limit: int = Query(10, ge=1, le=50)) -> Response:
    with connect() as conn:
        out = content.related_verses(conn, key, limit)
        if out is None:
            raise not_found("verse")
        return cached(request, out)


@router.get(
    "/verses/{key}/knowledge",
    summary="Occasions of revelation, Makki/Madani notes, verses cited in its explanation, people and places",
)
def verse_knowledge(request: Request, key: str) -> Response:
    with connect() as conn:
        out = knowledge.verse_knowledge(conn, key)
        if out is None:
            raise not_found("verse")
        return cached(request, out)


@router.get(
    "/surahs/{number}/card", summary="A sūra's card: names, revelation, virtues, counts, aims (verbatim)"
)
def surah_card(request: Request, number: int) -> Response:
    with connect() as conn:
        out = knowledge.surah_card(conn, number)
        if out is None:
            raise not_found("surah")
        return cached(request, out)


@router.get(
    "/words/{slug}/relations",
    summary="Classical wujūh senses with their verses, furūq contrasts and aḍdād for a lemma and its root",
)
def word_relations(
    request: Request, slug: str, at: str | None = Query(None, pattern=r"^\d{1,3}:\d{1,3}(:\d{1,3})?$")
) -> Response:
    with connect() as conn:
        out = knowledge.word_relations(conn, slug, at)
        if out is None:
            raise not_found("word")
        return cached(request, out)


@router.get(
    "/verses", summary="Several verses by key (up to 60), with their tokens and words — a map's verse cards"
)
def verses(
    request: Request, keys: str = Query(..., max_length=600, description="comma-separated, as 2:255,1:1")
) -> Response:
    pairs: list[tuple[int, int]] = []
    for k in dict.fromkeys(x.strip() for x in keys.split(",") if x.strip()):
        try:
            s_str, a_str = k.split(":")
            pairs.append((int(s_str), int(a_str)))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="each key must look like 2:255") from exc
    if len(pairs) > 60:
        raise HTTPException(status_code=422, detail="at most 60 verses at once")
    with connect() as conn:
        return cached(request, {"data": content.verses_by_key(conn, pairs)})


@router.get("/verses/{key}", summary="One verse (e.g. 2:255) with full word morphology")
def verse(request: Request, key: str) -> Response:
    try:
        s_str, a_str = key.split(":")
        s, a = int(s_str), int(a_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="verse key must look like 2:255") from exc
    with connect() as conn:
        v = content.verse(conn, s, a)
        if v is None:
            raise not_found("verse")
        return cached(request, v)


@router.get("/works", summary="Tafsir and translation works with their sources and licenses")
def works(
    request: Request,
    kind: str | None = Query(None, pattern="^(tafsir|translation)$"),
    lang: str | None = None,
) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.works(conn, kind, lang)})


@router.get("/works/{work_id}/surahs/{number}", summary="All passages of one work for one surah")
def work_surah(request: Request, work_id: str, number: int) -> Response:
    if not 1 <= number <= 114:
        raise not_found("surah")
    with connect() as conn:
        out = content.work_surah(conn, work_id, number)
        if out is None:
            raise not_found("work")
        return cached(request, out)


@router.get(
    "/verses/{key}/commentary", summary="Tafsir/translation passages covering a verse, per requested work"
)
def commentary(
    request: Request, key: str, works: str = Query("muyassar", description="comma-separated work ids")
) -> Response:
    ids = [w for w in works.split(",") if w][:10]
    with connect() as conn:
        out = content.verse_commentary(conn, key, ids)
        if out is None:
            raise not_found("verse")
        return cached(request, {"verse": key, "data": out})


@router.get("/divisions", summary="Where each juzʾ and ḥizb begins, with its mushaf page")
def divisions(request: Request) -> Response:
    with connect() as conn:
        return cached(request, content.divisions(conn))


@router.get("/pages/{page}", summary="All verses on one Madinah-mushaf page (1–604)")
def page(request: Request, page: int) -> Response:
    if not 1 <= page <= 604:
        raise not_found("page")
    with connect() as conn:
        return cached(request, {"page": page, "verses": content.verses_by_page(conn, page)})


_LOCATION = re.compile(r"^\d{1,3}:\d{1,3}:\d{1,3}$")


@router.get(
    "/words/{ident}",
    summary="A word: by lemma slug (maktaba) the panel's one-request payload; by location (2:255:1) one occurrence",
)
def word(
    request: Request,
    ident: str,
    at: str | None = Query(
        None, description="a Quran location (2:255:3): adds that occurrence's grammar and glosses"
    ),
    limit: int = Query(12, ge=0, le=50, description="attestations returned inline"),
    in_text: str | None = Query(
        None,
        max_length=80,
        pattern="^[a-z0-9-]+$",
        description="a hadith collection or a book (its slug): adds the word's places in it as `in_text`",
    ),
) -> Response:
    with connect() as conn:
        if _LOCATION.match(ident):
            w = content.word(conn, ident)
            if w is None:
                raise not_found("word")
            return cached(request, w)
        if at is not None and not _LOCATION.match(at):
            raise HTTPException(status_code=400, detail="at must be a Quran location such as 2:255:3")
        payload = lexicon.word_payload(conn, ident, at, limit)
        if payload is None:
            raise not_found("word")
        if in_text is not None:
            # the panel's "In this text" for a word read in a hadith or a book (P1.3, RDR-268…271)
            payload["in_text"] = rootlife.lemma_in_text(conn, ident, in_text)
        return cached(request, payload)


@router.get(
    "/texts/{text}/words/{slug}",
    summary="A Quranic word in one hadith collection or book: its places there, or in the texts that hold it",
)
def word_in_text(
    request: Request,
    text: Annotated[str, Path(max_length=80, pattern="^[a-z0-9-]+$")],
    slug: Annotated[str, Path(max_length=80)],
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> Response:
    with connect() as conn:
        out = rootlife.lemma_in_text(conn, slug, text, limit)
        if out is None:
            raise not_found("word or text")
        return cached(request, out)


@router.get(
    "/words/{slug}/verses", summary="A lemma's verses, paged by verse, each with every place it takes there"
)
def word_verses(
    request: Request,
    slug: str,
    form: str | None = Query(None, max_length=60, description="only one written form (mushaf spelling)"),
    surah: int | None = Query(None, ge=1, le=114, description="only within one sūra"),
    limit: int = Query(10, ge=1, le=50),
    cursor: str | None = Query(None, max_length=12, description="the last verse of the page before"),
) -> Response:
    after = int(cursor) if cursor and cursor.isdigit() else 0
    with connect() as conn:
        out = lexicon.word_verses(conn, slug, after, limit, form, surah)
        if out is None:
            raise not_found("word")
        return cached(request, out)


@router.get("/words/{slug}/attestations", summary="Every occurrence of a lemma as KWIC rows, paged")
def word_attestations(
    request: Request,
    slug: str,
    form: str | None = Query(
        None, max_length=60, description="restrict to one surface form (mushaf spelling)"
    ),
    scope: str = Query("lemma", pattern="^(lemma|root)$", description="this word only, or its whole root"),
    surah: int | None = Query(None, ge=1, le=114, description="only within one sūra"),
    limit: int = Query(50, ge=1, le=500),
    cursor: str | None = Query(None),
) -> Response:
    after = int(cursor) if cursor and cursor.isdigit() else 0
    with connect() as conn:
        out = lexicon.word_attestations(conn, slug, after, limit, form, scope, surah)
        if out is None:
            raise not_found("word")
        return cached(request, out)


@router.get("/locations/{location}/word", summary="The lemma slug of the word at a Quran location")
def location_word(request: Request, location: str) -> Response:
    if not _LOCATION.match(location):
        raise not_found("location")
    with connect() as conn:
        slug = lexicon.slug_at(conn, location)
        return cached(request, {"location": location, "slug": slug})


@router.get("/patterns", summary="Every pattern (wazn) attested in the Quran, most used first")
def patterns(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": lexicon.patterns_list(conn)})


@router.get("/patterns/{slug}", summary="One pattern with every lemma on it")
def pattern(request: Request, slug: str, limit: int = Query(200, ge=1, le=5000)) -> Response:
    with connect() as conn:
        p = lexicon.pattern_payload(conn, slug, limit)
        if p is None:
            raise not_found("pattern")
        return cached(request, p)


@router.get("/particles/{entry_id}", summary="A particle entry (Mughnī, al-Janā al-Dānī) with its senses")
def particle(request: Request, entry_id: str) -> Response:
    with connect() as conn:
        e = content.particle_entry(conn, entry_id)
        if e is None:
            raise not_found("particle entry")
        return cached(request, e)


@router.get("/glossary", summary="The plain-language glossary (Arabic and English)")
def glossary(request: Request) -> Response:
    with connect() as conn:
        return cached(request, lexicon.glossary(conn))


@router.get("/texts", summary="Every text the product reads (the library shelf)")
def texts(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": lexicon.texts(conn)})


@router.get("/texts/{slug}", summary="One text with its source and its top-level chapters")
def text(request: Request, slug: Annotated[str, Path(max_length=40)]) -> Response:
    with connect() as conn:
        t = texts_api.text_detail(conn, slug)
        if t is None:
            raise not_found("text")
        return cached(request, t)


@router.get(
    "/texts/{slug}/chapters/{ordinal}",
    summary="A chapter: its place in the text, its sub-chapters and the passages under it, paged",
)
def text_chapter(
    request: Request,
    slug: Annotated[str, Path(max_length=40)],
    ordinal: Annotated[int, Path(ge=1)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    words: bool = False,
) -> Response:
    with connect() as conn:
        c = texts_api.chapter(conn, slug, ordinal, offset, limit, words)
        if c is None:
            raise not_found("chapter")
        return cached(request, c)


@router.get(
    "/texts/{slug}/passages/{ref}",
    summary="A passage beyond the Quran: its text verbatim, cut into its words, each with its reading",
)
def text_passage(
    request: Request, slug: Annotated[str, Path(max_length=40)], ref: Annotated[str, Path(max_length=40)]
) -> Response:
    with connect() as conn:
        p = texts_api.passage(conn, slug, ref)
        if p is None:
            raise not_found("passage")
        return cached(request, p)


@router.get(
    "/roots/{key}/texts",
    summary="A root's life in the hadith and the books: counts by text, the sure apart from the possible, its passages",
)
def root_texts(
    request: Request,
    key: Annotated[str, Path(max_length=20)],
    kind: Annotated[str | None, Query(pattern="^(hadith|book)$")] = None,
    text: Annotated[str | None, Query(max_length=80)] = None,
    which: Annotated[str, Query(pattern="^(sure|possible|all)$")] = "sure",
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Response:
    with connect() as conn:
        out = rootlife.root_in_texts(conn, key, kind, text, which, offset, limit)
        if out is None:
            raise not_found("root")
        return cached(request, out)


@router.get(
    "/catalogue", summary="The catalogue: the works the D9 gate lets in, by title, author and century"
)
def catalogue(
    request: Request,
    q: Annotated[str | None, Query(max_length=100)] = None,
    century: Annotated[int | None, Query(ge=0, le=14, description="0: the poets before Islam")] = None,
    shelf: bool = False,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
) -> Response:
    with connect() as conn:
        return cached(request, catalogue_api.catalogue(conn, q, century, shelf, offset, limit))


@router.get(
    "/hadeethenc/{item_id}",
    summary="One HadeethEnc item verbatim (v1.7.0), with the hadith it cites in our texts and how far each agrees",
)
def hadeethenc_item(request: Request, item_id: Annotated[int, Path(ge=1)]) -> Response:
    with connect() as conn:
        it = texts_api.hadeethenc_item(conn, item_id)
        if it is None:
            raise not_found("HadeethEnc item")
        return cached(request, it)


@router.get(
    "/dictionaries", summary="The classical dictionaries with authors, death years, editions and licences"
)
def dictionaries(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": lexicon.dictionaries(conn)})


@router.get("/corpora", summary="Corpora on the timeline, by date")
def corpora(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": lexicon.corpora(conn)})


@router.get("/roots", summary="Roots, optionally filtered by letter position (the root builder)")
def roots(
    request: Request,
    l1: str | None = Query(None, max_length=1),
    l2: str | None = Query(None, max_length=1),
    l3: str | None = Query(None, max_length=1),
    l4: str | None = Query(None, max_length=1),
    order: str = Query("frequency", pattern="^(frequency|alphabetical)$"),
    keys: str | None = Query(None, max_length=600, description="comma-separated root keys (e.g. علم,رحم)"),
    limit: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> Response:
    key_list = [k.strip() for k in keys.split(",") if k.strip()][:100] if keys else None
    with connect() as conn:
        data, total = content.roots_list(conn, [l1, l2, l3, l4], order, limit, offset, key_list)
        return cached(request, {"data": data, "total": total, "limit": limit, "offset": offset})


@router.get(
    "/roots/{root}", summary="A root (e.g. علم, ع ل م, ʿ-l-m): family by lemma and form, distribution"
)
def root(request: Request, root: str) -> Response:
    with connect() as conn:
        r = content.root_detail(conn, root)
        if r is None:
            raise not_found("root")
        return cached(request, r)


@router.get("/roots/{root}/family", summary="A root's lemmas grouped by pattern")
def root_family(request: Request, root: str) -> Response:
    with connect() as conn:
        out = lexicon.root_family(conn, root)
        if out is None:
            raise not_found("root")
        return cached(request, out)


@router.get(
    "/roots/{root}/relations",
    summary="The classical relations in force on a root (reviewed by the editorial board), and how many wait",
)
def root_relations(request: Request, root: str) -> Response:
    with connect() as conn:
        if not one(conn, "select 1 as x from content.roots where key = :k", {"k": root}):
            raise not_found("root")
        return cached(request, relations.of_root(conn, root))


@router.get(
    "/topics", summary="Topics: the top of the tree, a topic's sub-topics, or a search by name (credited)"
)
def topics_browse(
    request: Request,
    parent: str | None = Query(None, max_length=40),
    q: str | None = Query(None, max_length=80),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0, le=10000),
) -> Response:
    with connect() as conn:
        return cached(request, topics.browse(conn, parent, q, limit, offset))


@router.get("/topics/coverage", summary="How many verses of each sūra the topics gather")
def topics_coverage(request: Request) -> Response:
    with connect() as conn:
        return cached(request, topics.coverage(conn))


@router.get(
    "/topics/{topic_id}", summary="A topic: the chain above it, its sub-topics and its verses (credited)"
)
def topic(
    request: Request,
    topic_id: Annotated[str, Path(max_length=40)],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0, le=10000),
) -> Response:
    with connect() as conn:
        out = topics.topic(conn, topic_id, limit, offset)
        if out is None:
            raise not_found("topic")
        return cached(request, out)


@router.get("/verses/{key}/topics", summary="The topics a verse is gathered under (credited)")
def verse_topics(request: Request, key: Annotated[str, Path(pattern=r"^\d{1,3}:\d{1,3}$")]) -> Response:
    with connect() as conn:
        return cached(request, topics.of_verse(conn, key))


@router.get(
    "/entities", summary="Proper names the corpus tags, the most often named first, or a search (credited)"
)
def entities_browse(
    request: Request,
    q: str | None = Query(None, max_length=80),
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0, le=10000),
) -> Response:
    with connect() as conn:
        return cached(request, entities.browse(conn, q, limit, offset))


@router.get("/entities/{entity_id}", summary="A proper name with the verses it is named in (credited)")
def entity(
    request: Request,
    entity_id: Annotated[int, Path(ge=1, le=1_000_000)],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0, le=10000),
) -> Response:
    with connect() as conn:
        out = entities.entity(conn, entity_id, limit, offset)
        if out is None:
            raise not_found("entity")
        return cached(request, out)


@router.get("/verses/{key}/entities", summary="The proper names a verse names (credited)")
def verse_entities(request: Request, key: Annotated[str, Path(pattern=r"^\d{1,3}:\d{1,3}$")]) -> Response:
    with connect() as conn:
        return cached(request, entities.of_verse(conn, key))


@router.get("/roots/{root}/shared", summary="The verses where two roots both occur, in the mushaf's order")
def roots_shared(
    request: Request,
    root: str,
    other: str = Query(..., alias="with", max_length=20),
    limit: int = Query(50, ge=1, le=500),
) -> Response:
    with connect() as conn:
        return cached(request, relations.shared(conn, root, other, limit))


@router.get(
    "/relations/{relation_id}", summary="One classical relation: in force, or extracted and said to be"
)
def relation(request: Request, relation_id: Annotated[str, Path(max_length=80)]) -> Response:
    with connect() as conn:
        out = relations.one_relation(conn, relation_id)
        if out is None:
            raise not_found("relation")
        return cached(request, out)


@router.get(
    "/relations", summary="The relations in force among a set of roots, with the verses each pair shares"
)
def relations_among(
    request: Request,
    roots: str = Query(..., max_length=600, description="comma-separated root keys, at most 50"),
) -> Response:
    keys = [k.strip() for k in roots.split(",") if k.strip()][:50]
    with connect() as conn:
        return cached(request, relations.among(conn, keys))


class _ConcordanceFilters:
    """The filters every concordance endpoint takes (CON-14…18, CON-Q03, CON-Q05)."""

    def __init__(
        self,
        lemma: str | None = Query(None, max_length=80, description="a lemma slug"),
        pattern: str | None = Query(None, max_length=40, description="a pattern slug"),
        surah: int | None = Query(None, ge=1, le=114, description="a sūra, or the first of a range"),
        surah_to: int | None = Query(None, ge=1, le=114, description="the last sūra of a range"),
        place: str | None = Query(None, pattern="^(meccan|medinan)$"),
        juz: int | None = Query(None, ge=1, le=30, description="a juzʾ, or the first of a range"),
        juz_to: int | None = Query(None, ge=1, le=30, description="the last juzʾ of a range"),
        pos: str | None = Query(None, max_length=8, pattern="^[A-Z]+$", description="a part-of-speech tag"),
        form: str | None = Query(None, max_length=60, description="a surface form in standard spelling"),
        near: str | None = Query(None, max_length=80, description="a lemma slug found within two words"),
    ) -> None:
        self.values = {
            "lemma": lemma,
            "pattern": pattern,
            "surah": surah,
            "surah_to": surah_to,
            "place": place,
            "juz": juz,
            "juz_to": juz_to,
            "pos": pos,
            "form": form,
            "near": near,
        }


@router.get("/concordance", summary="KWIC lines of a root with filters, sorts and server totals")
def concordance_lines(
    request: Request,
    f: Annotated[_ConcordanceFilters, Depends()],
    root: str = Query(..., max_length=20),
    sort: str = Query("mushaf", pattern="^(mushaf|following|preceding)$"),
    tr: str | None = Query(None, max_length=40, description="a translation work id for each line's verse"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> Response:
    with connect() as conn:
        out = concordance.concordance(
            conn, root, sort=sort, offset=offset, limit=limit, translation=tr, **f.values
        )
        if out is None:
            raise not_found("root")
        return cached(request, out)


@router.get(
    "/concordance/distribution", summary="A root's hits per sūra (per 100 words), by form, and its collocates"
)
def concordance_distribution(
    request: Request,
    f: Annotated[_ConcordanceFilters, Depends()],
    root: str = Query(..., max_length=20),
) -> Response:
    with connect() as conn:
        out = concordance.distribution(conn, root, **f.values)
        if out is None:
            raise not_found("root")
        return cached(request, out)


@router.get("/concordance.csv", summary="Every KWIC line under the filters as CSV (UTF-8 with BOM)")
def concordance_csv(
    f: Annotated[_ConcordanceFilters, Depends()],
    root: str = Query(..., max_length=20),
    sort: str = Query("mushaf", pattern="^(mushaf|following|preceding)$"),
    tr: str | None = Query(None, max_length=40),
) -> Response:
    with connect() as conn:
        out = concordance.concordance_csv(conn, root, sort=sort, translation=tr, **f.values)
    if out is None:
        raise not_found("root")
    body, name = out
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/roots/{root}/occurrences", summary="Concordance (KWIC) rows for a root")
def root_occurrences(
    request: Request,
    root: str,
    lemma: int | None = Query(None, description="restrict to one lemma id"),
    form: str | None = Query(
        None, max_length=60, description="restrict to one surface form (imlaei spelling)"
    ),
    limit: int = Query(50, ge=1, le=500),
    cursor: str | None = Query(None),
) -> Response:
    after = int(cursor) if cursor and cursor.isdigit() else 0
    with connect() as conn:
        r = content.root_occurrences(conn, root, lemma, limit, after, form)
        if r is None:
            raise not_found("root")
        return cached(request, r)


@router.get(
    "/roots/{root}/graph", summary="Root-family graph document: root → lemmas → word forms (with first verse)"
)
def root_graph(request: Request, root: str) -> Response:
    with connect() as conn:
        g = content.root_graph(conn, root)
        if g is None:
            raise not_found("root")
        return cached(request, g)


@router.get(
    "/loanwords/dispute",
    summary="Whether the Quran holds non-Arabic words: al-Suyūṭī's account, view by view",
)
def loanword_dispute(request: Request) -> Response:
    with connect() as conn:
        return cached(request, content.loanword_dispute(conn))


@router.get("/collections", summary="Curated sets of Quranic words, with every member's slug")
def collections_index(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": collections.collections_list(conn)})


@router.get(
    "/collections/{set_id}", summary="One curated set: its copy, its words with root, pattern and first place"
)
def collection_detail(request: Request, set_id: str) -> Response:
    with connect() as conn:
        out = collections.collection(conn, set_id[:40])
        if out is None:
            raise not_found("collection")
        return cached(request, out)


class _Slugs(BaseModel):
    slugs: list[str] = Field(max_length=collections.MAX_SLUGS)


@router.post(
    "/lemmas/coverage", summary="How much of the Quran a reader's words cover (not stored, not cached)"
)
def lemmas_coverage(body: _Slugs) -> Response:
    # the reader's word list is personal: it comes in a body, and nothing about it is kept or cached
    with connect() as conn:
        return ORJSONResponse(collections.coverage(conn, body.slugs), headers={"Cache-Control": "no-store"})


@router.post("/lemmas/roots", summary="The root of each of a reader's words (not stored, not cached)")
def lemmas_roots(body: _Slugs) -> Response:
    # the reader's starred and known words: in a body, kept nowhere
    with connect() as conn:
        return ORJSONResponse(
            {"data": review.lemma_roots(conn, body.slugs)}, headers={"Cache-Control": "no-store"}
        )


@router.get("/roots/{root}/review", summary="A root for the review deck: its family and a verse that uses it")
def root_review(request: Request, root: str, pick: int = Query(0, ge=0, le=1000)) -> Response:
    with connect() as conn:
        out = review.root_review(conn, root[:20], pick)
        if out is None:
            raise not_found("root")
        return cached(request, out)


@router.get("/path", summary="The roots in lessons of ten, by how much of the Quran each family makes up")
def path_lessons(request: Request) -> Response:
    with connect() as conn:
        return cached(request, path.lessons(conn))


@router.get("/path/{n}", summary="One lesson of the path: its roots and each one's most frequent words")
def path_lesson(request: Request, n: int) -> Response:
    with connect() as conn:
        out = path.lesson(conn, n)
        if out is None:
            raise not_found("lesson")
        return cached(request, out)


@router.get(
    "/hear", summary="Every occurrence of a root or a word as its slice of the word recitation, in order"
)
def hear_playlist(
    request: Request,
    root: str | None = Query(None, max_length=20),
    lemma: str | None = Query(None, max_length=80),
) -> Response:
    if (root is None) == (lemma is None):
        raise HTTPException(status_code=400, detail="give a root or a lemma")
    with connect() as conn:
        out = hear.playlist(conn, root=root, lemma=lemma)
        if out is None:
            raise not_found("root" if root is not None else "lemma")
        return cached(request, out)


class _ReviewAsk(BaseModel):
    root: str = Field(max_length=20)
    pick: int = Field(0, ge=0, le=1000)


@router.post(
    "/review/root", summary="A root for the reader's review, asked in a body (not stored, not cached)"
)
def review_root(body: _ReviewAsk) -> Response:
    # which roots a reader is due and how often each was reviewed is theirs: in a body, kept nowhere (P5.6)
    with connect() as conn:
        out = review.root_review(conn, body.root, body.pick)
        if out is None:
            raise not_found("root")
        return ORJSONResponse(out, headers={"Cache-Control": "no-store"})


class _Tokens(BaseModel):
    tokens: list[str] = Field(max_length=20000)


@router.post("/analyse/tokens", summary="The reader's own text, form by form (not stored, not cached)")
def analyse_tokens(body: _Tokens) -> Response:
    with connect() as conn:
        return ORJSONResponse(analyse.analyse_many(conn, body.tokens), headers={"Cache-Control": "no-store"})


class _Form(BaseModel):
    token: str = Field(min_length=1, max_length=80)


@router.post(
    "/analyse/form", summary="One word of the reader's own text, every reading of it (not stored, not cached)"
)
def analyse_form(body: _Form) -> Response:
    # a word of the reader's text is theirs: in a body, answered no-store (the privacy page says so)
    with connect() as conn:
        f = analyse.analyse_form(conn, body.token)
        if f is None:
            raise not_found("word")
        return ORJSONResponse(f, headers={"Cache-Control": "no-store"})


class _Known(BaseModel):
    lemmas: list[Annotated[str, Field(max_length=80)]] = Field(max_length=10000)


@router.post(
    "/texts/known",
    summary="How many of each text's Quranic words the reader knows (LIB-Q08): asked in a body, kept nowhere",
)
def texts_known(body: _Known) -> Response:
    # the words a reader knows are theirs: in a body, answered no-store, never logged (the privacy page says so)
    with connect() as conn:
        found = rows(
            conn,
            """with mine as (select id from content.lemmas where slug = any(:s))
               select t.slug, count(*)::int as total, count(m.id)::int as known
                 from content.text_lemmas x join content.texts t on t.id = x.text_id
                 left join mine m on m.id = x.lemma_id
                group by t.id order by t.sort_order""",
            {"s": body.lemmas},
        )
    return ORJSONResponse({"data": found}, headers={"Cache-Control": "no-store"})


class _UrlIntake(BaseModel):
    url: str = Field(min_length=8, max_length=2000)


_INTAKE_REFUSALS = {
    "bad_url": "Give an http or https address.",
    "not_public": "That address is not on the public internet.",
    "unreachable": "The site could not be reached.",
    "fetch_failed": "The page could not be fetched.",
    "not_html": "That address is not a web page.",
    "too_large": "The file is too large.",
    "no_text": "The page holds no Arabic text to speak of.",
    "not_pdf": "That file is not a PDF we can read.",
    "encrypted": "The PDF is locked.",
    "too_many_pages": "The PDF has too many pages.",
}


def _refuse(e: intake.IntakeError) -> Refusal:
    return Refusal(422, e.code, _INTAKE_REFUSALS.get(e.code, "The text could not be read."))


@router.post(
    "/intake/url",
    summary="A web page's main text, for the reader's library (fetched, handed back, never stored)",
)
def intake_url(body: _UrlIntake) -> Response:
    # the reader's address and the page stay out of every log and cache (D9a): in a body, answered no-store
    try:
        out = intake.from_url(body.url, get_settings().intake_allow_private)
    except intake.IntakeError as e:
        raise _refuse(e) from e
    return ORJSONResponse(out, headers={"Cache-Control": "no-store"})


@router.post(
    "/intake/pdf",
    summary="A PDF's pages told apart — a text layer, one in visual order, a broken one, a scan — never stored",
)
def intake_pdf(file: UploadFile) -> Response:
    data = file.file.read(intake.PDF_BYTES + 1)
    with connect() as conn:
        lex = intake.lexicon(conn)
    try:
        out = intake.from_pdf(data, file.filename or "", lex)
    except intake.IntakeError as e:
        raise _refuse(e) from e
    return ORJSONResponse(out, headers={"Cache-Control": "no-store"})


@router.get(
    "/analyse", summary="A phrase word by word: corpus analysis for Quranic text, ranked candidates otherwise"
)
def analyse_phrase(request: Request, q: str = Query("", max_length=600)) -> Response:
    with connect() as conn:
        return cached(request, analyse.analyse(conn, q))


@router.get(
    "/word-of-the-day",
    summary="The word of the day: one Quranic word per date in Mecca's time zone, the same for everyone",
)
def word_of_the_day(
    request: Request,
    day: Annotated[
        date | None, Query(alias="date", description="YYYY-MM-DD; today in Asia/Riyadh when absent")
    ] = None,
) -> Response:
    with connect() as conn:
        if day is not None:
            if not date(2000, 1, 1) <= day <= date(2200, 12, 31):
                raise HTTPException(status_code=422, detail="date must be between 2000-01-01 and 2200-12-31")
            return cached(request, daily.word_of_the_day(conn, day))
        # undated: today's word, cached only until Mecca's midnight
        now = datetime.now(daily.TZ)
        left = int(
            (
                datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), daily.TZ) - now
            ).total_seconds()
        )
        return ORJSONResponse(
            daily.word_of_the_day(conn, now.date()),
            headers={"Cache-Control": f"public, max-age={max(60, min(left, 3600))}"},
        )


@router.get(
    "/mushaf-signs", summary="What the signs written in the mushaf mean, in the Madinah Mushaf's own note"
)
def mushaf_signs(request: Request) -> Response:
    with connect() as conn:
        return cached(request, content.mushaf_signs(conn))


@router.get("/recitations", summary="Reciters with word-level timings")
def recitations(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.reciters(conn), "credit": content.AUDIO_CREDIT})


@router.get("/recitations/{reciter_id}/surahs/{number}", summary="Audio URLs and word timings for a surah")
def recitation_surah(request: Request, reciter_id: str, number: int) -> Response:
    if not 1 <= number <= 114:
        raise not_found("surah")
    with connect() as conn:
        out = content.recitation_surah(conn, reciter_id, number)
        if out is None:
            raise not_found("reciter")
        return cached(request, out)


@router.get("/recitations/{reciter_id}/verses/{key}", summary="Audio URL and word timings for one verse")
def recitation_verse(request: Request, reciter_id: str, key: str) -> Response:
    with connect() as conn:
        out = content.recitation_verse(conn, reciter_id, key)
        if out is None:
            raise not_found("recitation")
        return cached(request, out)


@router.get("/lexicon/works", summary="Classical lexicons and gharib works, with editions and licenses")
def lexicon_works(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.lexicon_works(conn)})


@router.get(
    "/lexicon/entries/{entry_id}",
    summary="One classical lexicon article, by its id or its identifier (dict:lane:علم); display only, see license",
)
def lexicon_entry(request: Request, entry_id: Annotated[str, Path(max_length=80)]) -> Response:
    key: int | str | None = (
        int(entry_id)
        if entry_id.isascii() and entry_id.isdigit()
        else entry_id
        if entry_id.startswith("dict:")
        else None
    )
    with connect() as conn:
        e = content.lexicon_entry(conn, key) if key is not None else None
        if e is None:
            raise not_found("lexicon entry")
        return cached(request, e)


@router.get("/lemmas", summary="Lemmas by database id (up to 200), with their stable slugs")
def lemmas(
    request: Request, ids: str = Query(..., max_length=2000, description="comma-separated ids")
) -> Response:
    try:
        wanted = list(dict.fromkeys(int(x) for x in ids.split(",") if x.strip()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="ids must be whole numbers") from exc
    if len(wanted) > 200:
        raise HTTPException(status_code=422, detail="at most 200 lemmas at once")
    with connect() as conn:
        return cached(request, {"data": content.lemmas_by_id(conn, wanted)})


@router.get("/lemmas/{lemma_id}", summary="One lemma with its surface forms")
def lemma(request: Request, lemma_id: int) -> Response:
    with connect() as conn:
        lem = content.lemma_detail(conn, lemma_id)
        if lem is None:
            raise not_found("lemma")
        return cached(request, lem)


@router.get(
    "/search",
    summary="Search verses, surahs, roots, lemmas, patterns, word forms, dictionary entries and the texts beyond the Quran",
)
def search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10000),
    only: str | None = Query(
        None, pattern="^(verses|lemmas|dictionary|texts|books)$", description="page through one kind"
    ),
) -> Response:
    with connect() as conn:
        return cached(request, run_search(conn, q, limit, offset, only))


class _SearchAsk(BaseModel):
    q: str = Field(min_length=1, max_length=200)
    limit: int = Field(20, ge=1, le=100)


@router.post("/search", summary="The same search, asked in a body: for words from a reader's private notes")
def search_private(body: _SearchAsk) -> Response:
    # a note's @-mentions are the reader's: never in a URL, a log line or a cache (P5.6, NTB-28)
    with connect() as conn:
        return ORJSONResponse(
            run_search(conn, body.q, body.limit, 0, None), headers={"Cache-Control": "no-store"}
        )


# ─── rate limiting (per client IP, sliding minute) ─────────────────────────

_hits: dict[str, deque[float]] = defaultdict(deque)
_swept = [0.0]


def _limits(response: Response, limit: int, remaining: int, reset: int) -> Response:
    response.headers["RateLimit-Limit"] = str(limit)
    response.headers["RateLimit-Remaining"] = str(max(0, remaining))
    response.headers["RateLimit-Reset"] = str(reset)
    return response


PUBLIC_EXPOSE = "ETag, X-Dataset-Version, X-Dataset-Release, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After"


def _public(response: Response) -> Response:
    """The public API is read from any site's pages, without a key (a key belongs on a server, not in a page)."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Expose-Headers"] = PUBLIC_EXPOSE
    return response


def _forget_idle(now: float) -> None:
    """An address is kept only while it counts: a minute after its last request it is gone (audit 11 F1)."""
    if now - _swept[0] < 60:
        return
    _swept[0] = now
    for k in [k for k, q in _hits.items() if not q or now - q[-1] > 60]:
        del _hits[k]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Expired sign-in tokens and sessions, replaced versions past 30 days and lookups past their retention are
    removed at start and then daily — what the privacy page promises (P6.1)."""

    async def daily_purge() -> None:
        while True:
            # an account schema not yet migrated must not stop the content API
            with suppress(Exception):
                await asyncio.to_thread(accounts.purge)
            # a lesson's counts, 90 days after its due date (P9)
            with suppress(Exception):
                await asyncio.to_thread(classroom.purge)
            await asyncio.sleep(86_400)

    task = asyncio.create_task(daily_purge())
    try:
        yield
    finally:
        task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Jadhr API",
        version="1.0.0",
        description=(
            "Read-only API over the Quran text (KFGQPC Hafs), its word-by-word morphology (Quranic Arabic Corpus) "
            "and derived root families. Every response is tied to a dataset version; every source and its license "
            "is listed at /api/v1/sources."
        ),
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
        redoc_url=None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "HEAD", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["ETag", "X-Dataset-Version", "X-Dataset-Release", "Retry-After"],
        max_age=86400,
    )

    @app.middleware("http")
    async def rate_limit(request: Request, call_next: Any) -> Response:
        token = settings.internal_token
        if token and request.headers.get("x-jadhr-internal") == token:
            response = await call_next(request)
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            return response
        # a body has a stated length within bounds: a push is sent in chunks well under this (F16)
        if request.method in ("POST", "PUT", "PATCH"):
            length = request.headers.get("content-length")
            if length is None or not length.isdigit():
                return error(411, "length_required", "Send the length of the body.")
            if int(length) > MAX_BODY:
                return error(413, "too_large", "That body is too large.")
        ip = (
            request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")
        ).split(",")[0]
        now = time.monotonic()
        _forget_idle(now)
        # the public API (P10.2b): a key reads at its own limit, an address without one at the public limit; both
        # said in RateLimit-* headers, and readable from any site's pages without a key
        if request.url.path.startswith(f"{API_PREFIX}/public/"):
            # any site's page may read, and send a text to analyse, without a key; a key belongs on a server, so a
            # page is not invited to send one (P10.2b)
            if request.method == "OPTIONS":
                return _public(
                    Response(
                        status_code=204,
                        headers={
                            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                            "Access-Control-Max-Age": "86400",
                        },
                    )
                )
            key = request.headers.get("x-api-key") or request.headers.get("authorization", "").removeprefix(
                "Bearer "
            )
            if key.startswith("jk_"):
                who = await asyncio.to_thread(apikeys.check, key)
                if who is None:
                    return _public(
                        error(401, "invalid_key", "This API key is not valid: revoked, or never issued.")
                    )
                bucket, limit = f"key:{who}", settings.key_rate_per_minute
            else:
                bucket, limit = f"public:{ip}", settings.public_rate_per_minute
            q = _hits[bucket]
            while q and now - q[0] > 60:
                q.popleft()
            reset = int(60 - (now - q[0])) + 1 if q else 60
            if len(q) >= limit:
                resp = error(429, "rate_limited", "Too many requests; slow down, or read with a key.")
                resp.headers["Retry-After"] = str(reset)
                return _public(_limits(resp, limit, 0, reset))
            q.append(now)
            response = await call_next(request)
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            return _public(_limits(response, limit, limit - len(q), reset))
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= settings.rate_limit_per_minute:
            resp = error(429, "rate_limited", "Too many requests; slow down.")
            resp.headers["Retry-After"] = str(int(60 - (now - q[0])) + 1)
            return resp
        q.append(now)
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> ORJSONResponse:
        # a refusal names its reason (refusal.py); the others are named by their status
        code = getattr(exc, "code", None) or {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "bad_request",
            409: "conflict",
            411: "length_required",
            413: "too_large",
            422: "unprocessable",
            429: "rate_limited",
            503: "unavailable",
        }.get(exc.status_code, "server_error")
        return error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> ORJSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        loc = first.get("loc", [])
        return error(422, "unprocessable", first.get("msg", "invalid request"), str(loc[-1]) if loc else None)

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        with connect() as conn:
            return {"status": "ok", "dataset": content.dataset(conn)["version"]}

    app.include_router(router)
    app.include_router(routes_me.router)
    app.include_router(routes_contrib.router)
    app.include_router(routes_editorial.router)
    app.include_router(routes_graphs.router)
    app.include_router(routes_published.router)
    app.include_router(routes_classroom.router)
    app.include_router(routes_releases.router)
    app.include_router(routes_public.router)
    app.include_router(routes_dictionary.router)
    app.include_router(routes_narrators.router)
    return app


app = create_app()
