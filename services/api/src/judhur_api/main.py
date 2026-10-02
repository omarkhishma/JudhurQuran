"""Judhur public API — Quran text, morphology, roots and search, read-only and cited.

Run: ``uv run uvicorn judhur_api.main:app --port 8000``  ·  Docs: ``/api/v1/docs``
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from typing import Any

import orjson
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import content
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


_DATASET_VERSION: dict[str, str] = {}


def dataset_version() -> str:
    if "v" not in _DATASET_VERSION:
        with connect() as conn:
            _DATASET_VERSION["v"] = content.dataset(conn)["version"]
    return _DATASET_VERSION["v"]


def cached(request: Request, payload: Any) -> Response:
    """Content is immutable within a dataset release: strong ETag over version + URL, long cache."""
    version = dataset_version()
    etag = (
        '"'
        + hashlib.sha256(f"{version}|{request.url.path}?{request.url.query}".encode()).hexdigest()[:32]
        + '"'
    )
    headers = {"ETag": etag, "Cache-Control": CONTENT_CACHE, "X-Dataset-Version": version}
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


@router.get("/sources", summary="Every data source with its license and required attribution")
def sources(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.sources(conn)})


@router.get("/surahs", summary="The 114 surahs")
def surahs(request: Request) -> Response:
    with connect() as conn:
        return cached(request, {"data": content.surahs(conn)})


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


@router.get("/pages/{page}", summary="All verses on one Madinah-mushaf page (1–604)")
def page(request: Request, page: int) -> Response:
    if not 1 <= page <= 604:
        raise not_found("page")
    with connect() as conn:
        return cached(request, {"page": page, "verses": content.verses_by_page(conn, page)})


@router.get(
    "/words/{location}", summary="Everything about one word (e.g. 2:255:1): morphology, lemma, root family"
)
def word(request: Request, location: str) -> Response:
    with connect() as conn:
        w = content.word(conn, location)
        if w is None:
            raise not_found("word")
        return cached(request, w)


@router.get("/roots", summary="Roots, optionally filtered by letter position (the root builder)")
def roots(
    request: Request,
    l1: str | None = Query(None, max_length=1),
    l2: str | None = Query(None, max_length=1),
    l3: str | None = Query(None, max_length=1),
    l4: str | None = Query(None, max_length=1),
    order: str = Query("frequency", pattern="^(frequency|alphabetical)$"),
    limit: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> Response:
    with connect() as conn:
        data, total = content.roots_list(conn, [l1, l2, l3, l4], order, limit, offset)
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


@router.get("/roots/{root}/occurrences", summary="Concordance (KWIC) rows for a root")
def root_occurrences(
    request: Request,
    root: str,
    lemma: int | None = Query(None, description="restrict to one lemma id"),
    form: str | None = Query(None, max_length=60, description="restrict to one surface form (imlaei spelling)"),
    limit: int = Query(50, ge=1, le=500),
    cursor: str | None = Query(None),
) -> Response:
    after = int(cursor) if cursor and cursor.isdigit() else 0
    with connect() as conn:
        r = content.root_occurrences(conn, root, lemma, limit, after, form)
        if r is None:
            raise not_found("root")
        return cached(request, r)


@router.get("/roots/{root}/graph", summary="Root-family graph document: root → lemmas → word forms (with first verse)")
def root_graph(request: Request, root: str) -> Response:
    with connect() as conn:
        g = content.root_graph(conn, root)
        if g is None:
            raise not_found("root")
        return cached(request, g)


@router.get("/lexicon/entries/{entry_id}", summary="One classical lexicon article (display only; see license)")
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
        title="Judhur API",
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
        expose_headers=["ETag", "X-Dataset-Version", "Retry-After"],
        max_age=86400,
    )

    @app.middleware("http")
    async def rate_limit(request: Request, call_next: Any) -> Response:
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
