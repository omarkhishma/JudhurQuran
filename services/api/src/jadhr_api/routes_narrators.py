"""The narrators' routes (PLAN P11.2b): search by name, a narrator's profile from Ibn Ḥajar's Taqrīb, the records he is
linked in. Content, so cached like the rest of a release."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import Response

from . import narrators
from .db import connect

router = APIRouter(prefix="/api/v1/narrators", tags=["narrators"])


def _cached(request: Request, payload: object) -> Response:
    from .main import cached

    return cached(request, payload)


def _missing(what: str) -> Exception:
    from .main import not_found

    return not_found(what)


@router.get("", summary="Narrators by name, those whose names begin with it first, the most linked first")
def search(
    request: Request,
    q: Annotated[str, Query(min_length=1, max_length=80)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> Response:
    with connect() as conn:
        return _cached(request, {"data": narrators.search(conn, q, limit)})


@router.get(
    "/{nid}", summary="A narrator: Ibn Ḥajar's entry verbatim, what is read from it, the chains he stands in"
)
def profile(request: Request, nid: Annotated[int, Path(ge=1)]) -> Response:
    with connect() as conn:
        p = narrators.profile(conn, nid)
        if p is None:
            raise _missing("narrator")
        return _cached(request, p)


@router.get("/{nid}/hadith", summary="The records a narrator's name is linked in, paged")
def hadith(
    request: Request,
    nid: Annotated[int, Path(ge=1)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Response:
    with connect() as conn:
        h = narrators.hadith(conn, nid, offset, limit)
        if h is None:
            raise _missing("narrator")
        return _cached(request, h)
