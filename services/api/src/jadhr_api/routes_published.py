"""Published maps (PLAN P8.5; the handoff's 08 §8.6, EDT-343…346). Never cached: a map's counts and its latest
version change, and a withdrawn map must stop showing at once."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import ORJSONResponse, Response
from pydantic import BaseModel, Field

from . import accounts, published

router = APIRouter(prefix="/api/v1")
NO_STORE = {"Cache-Control": "no-store"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]
Viewer = Annotated[dict[str, Any] | None, Depends(accounts.optional_user)]
Slug = Annotated[str, Path(min_length=1, max_length=240)]


def ok(payload: Any, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=NO_STORE)


def _address(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(
        ","
    )[0]


class _Origin(BaseModel):
    slug: str = Field(max_length=240)
    version: int = Field(ge=1)


class _Publish(BaseModel):
    local_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    slug: str = Field(min_length=1, max_length=240)
    title: str = Field(max_length=400)
    description: str = Field("", max_length=1000)
    kind: str = Field("free", max_length=10)
    doc: dict[str, Any]
    forked_from: _Origin | None = None


class _Version(BaseModel):
    title: str = Field(max_length=400)
    description: str = Field("", max_length=1000)
    kind: str = Field("free", max_length=10)
    doc: dict[str, Any]


class _Report(BaseModel):
    version: int = Field(1, ge=1)
    reason: str = Field(min_length=1, max_length=1000)


class _Resolve(BaseModel):
    outcome: str = Field(max_length=12)


@router.get(
    "/published", summary="Published maps, the latest first; with `by`, the other maps of that map's author"
)
def gallery(
    offset: int = Query(0, ge=0, le=100_000),
    limit: int = Query(published.PAGE, ge=1, le=100),
    by: str | None = Query(None, max_length=240),
) -> ORJSONResponse:
    return ok(published.gallery(offset, limit, by))


@router.get("/published/check", summary="Whether an address is free for a map, and a free one near it")
def check(slug: str = Query(..., min_length=1, max_length=240)) -> ORJSONResponse:
    return ok(published.check(slug))


@router.get("/published/reports", summary="Open reports on published maps (the editorial board)")
def reports(u: User) -> ORJSONResponse:
    return ok(published.open_reports(u))


@router.post("/published/reports/{rid}/resolve", summary="Dismiss a report, or withdraw the map (the board)")
def resolve(u: User, rid: int, body: _Resolve) -> ORJSONResponse:
    return ok(published.resolve_report(u, rid, body.outcome))


@router.post("/published", summary="Publish a map: its address taken for good, its first version")
def publish(u: User, body: _Publish) -> ORJSONResponse:
    return ok(
        published.publish(
            u,
            body.local_id,
            body.slug,
            body.title,
            body.description,
            body.kind,
            body.doc,
            body.forked_from.model_dump() if body.forked_from else None,
        ),
        status=201,
    )


@router.get(
    "/published/{slug}", summary="A published map: its latest version, or `v`, with its versions and counts"
)
def read(v: Viewer, slug: Slug, version: int | None = Query(None, alias="v", ge=1)) -> ORJSONResponse:
    return ok(published.read(slug, version, v))


@router.post(
    "/published/{slug}/versions", summary="Publish the map as it is now as its next version (its owner)"
)
def add_version(u: User, slug: Slug, body: _Version) -> ORJSONResponse:
    return ok(published.add_version(u, slug, body.title, body.description, body.kind, body.doc), status=201)


@router.delete("/published/{slug}", summary="Withdraw a map: every version goes, its address stays reserved")
def withdraw(u: User, slug: Slug) -> Response:
    published.withdraw(u, slug)
    return Response(status_code=204, headers=NO_STORE)


@router.post("/published/{slug}/fork", summary="A fork made: the map's count, once per reader an hour")
def fork(v: Viewer, slug: Slug, request: Request) -> ORJSONResponse:
    return ok(published.count(slug, "fork", v, _address(request)))


@router.post("/published/{slug}/cite", summary="A citation copied: the map's count, once per reader an hour")
def cite(v: Viewer, slug: Slug, request: Request) -> ORJSONResponse:
    return ok(published.count(slug, "cite", v, _address(request)))


@router.post("/published/{slug}/report", summary="Report a map to the editorial board")
def report(u: User, slug: Slug, body: _Report) -> ORJSONResponse:
    return ok(published.report(u, slug, body.version, body.reason), status=201)


@router.get("/me/published", summary="The maps this reader has published")
def mine(u: User) -> ORJSONResponse:
    return ok(published.mine(u))
