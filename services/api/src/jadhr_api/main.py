"""Jadhr public API — Quran text, morphology, roots and search, read-only and cited.

Run: ``uv run uvicorn jadhr_api.main:app --port 8000``  ·  Docs: ``/api/v1/docs``
"""

from __future__ import annotations

import hashlib
import re
import time
from collections import defaultdict, deque
from typing import Annotated, Any

import orjson
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import analyse, concordance, content, knowledge, lexicon
from .db import connect
from .search import search as run_search
from .settings import get_settings

API_PREFIX = "/api/v1"
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
    """Content is immutable within a dataset release: strong ETag over release + URL, long cache."""
    version, release = dataset_release()
    etag = (
        '"'
        + hashlib.sha256(f"{release}|{request.url.path}?{request.url.query}".encode()).hexdigest()[:32]
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
        return cached(request, payload)


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


@router.get("/texts/{slug}", summary="One text with its chapters")
def text(request: Request, slug: str) -> Response:
    with connect() as conn:
        t = lexicon.text_detail(conn, slug)
        if t is None:
            raise not_found("text")
        return cached(request, t)


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


class _ConcordanceFilters:
    """The filters every concordance endpoint takes (CON-14…18, CON-Q03, CON-Q05)."""

    def __init__(
        self,
        lemma: str | None = Query(None, max_length=80, description="a lemma slug"),
        pattern: str | None = Query(None, max_length=40, description="a pattern slug"),
        surah: int | None = Query(None, ge=1, le=114),
        place: str | None = Query(None, pattern="^(meccan|medinan)$"),
        juz: int | None = Query(None, ge=1, le=30),
        pos: str | None = Query(None, max_length=8, pattern="^[A-Z]+$", description="a part-of-speech tag"),
        form: str | None = Query(None, max_length=60, description="a surface form in standard spelling"),
        near: str | None = Query(None, max_length=80, description="a lemma slug found within two words"),
    ) -> None:
        self.values = {
            "lemma": lemma,
            "pattern": pattern,
            "surah": surah,
            "place": place,
            "juz": juz,
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


@router.get(
    "/analyse", summary="A phrase word by word: corpus analysis for Quranic text, ranked candidates otherwise"
)
def analyse_phrase(request: Request, q: str = Query("", max_length=600)) -> Response:
    with connect() as conn:
        return cached(request, analyse.analyse(conn, q))


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
    "/lexicon/entries/{entry_id}", summary="One classical lexicon article (display only; see license)"
)
def lexicon_entry(request: Request, entry_id: int) -> Response:
    with connect() as conn:
        e = content.lexicon_entry(conn, entry_id)
        if e is None:
            raise not_found("lexicon entry")
        return cached(request, e)


@router.get("/lemmas/{lemma_id}", summary="One lemma with its surface forms")
def lemma(request: Request, lemma_id: int) -> Response:
    with connect() as conn:
        lem = content.lemma_detail(conn, lemma_id)
        if lem is None:
            raise not_found("lemma")
        return cached(request, lem)


@router.get("/search", summary="Search verses, surahs, roots, lemmas and word forms")
def search(
    request: Request, q: str = Query(..., min_length=1, max_length=200), limit: int = Query(20, ge=1, le=100)
) -> Response:
    with connect() as conn:
        return cached(request, run_search(conn, q, limit))


# ─── rate limiting (per client IP, sliding minute) ─────────────────────────

_hits: dict[str, deque[float]] = defaultdict(deque)


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
        ip = (
            request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")
        ).split(",")[0]
        now = time.monotonic()
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
        code = {400: "bad_request", 404: "not_found", 405: "bad_request", 429: "rate_limited"}.get(
            exc.status_code, "server_error"
        )
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
    return app


app = create_app()
