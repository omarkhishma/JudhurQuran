"""The Arabic dictionary's routes (PLAN P11.1): the letters, the roots, a root with every lexicon's articles, one
article whole. Content, so cached like the rest of a release."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import Response

from . import dictionary
from .db import connect

router = APIRouter(prefix="/api/v1/dictionary", tags=["dictionary"])


def _cached(request: Request, payload: object) -> Response:
    from .main import cached

    return cached(request, payload)


def _missing(what: str) -> Exception:
    from .main import not_found

    return not_found(what)


@router.get("/letters", summary="How many roots begin with each letter, and how many are the Quran's")
def letters(request: Request) -> Response:
    with connect() as conn:
        return _cached(request, {"data": dictionary.letters(conn)})


@router.get("/roots", summary="The dictionary's roots in alphabetical order, by first letter and size, paged")
def roots(
    request: Request,
    first: Annotated[str | None, Query(max_length=2)] = None,
    letters: Annotated[int | None, Query(ge=2, le=5)] = None,
    quranic: bool | None = None,
    after: Annotated[str | None, Query(max_length=12)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> Response:
    with connect() as conn:
        return _cached(request, dictionary.roots(conn, first, letters, quranic, after, limit))


@router.get("/roots/{root}", summary="A root with every lexicon's articles on it, and the Quran as one layer")
def root(request: Request, root: Annotated[str, Path(max_length=40)]) -> Response:
    with connect() as conn:
        r = dictionary.root(conn, root)
        if r is None:
            raise _missing("root")
        return _cached(request, r)


@router.get("/entries/{entry_id}", summary="One article whole")
def entry(request: Request, entry_id: int) -> Response:
    with connect() as conn:
        e = dictionary.entry(conn, entry_id)
        if e is None:
            raise _missing("entry")
        return _cached(request, e)
