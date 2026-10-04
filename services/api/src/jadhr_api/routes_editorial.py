"""The editorial workbench's endpoints (PLAN P3.0, research 14): the editorial board only, never cached."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import accounts, editorial
from .responses import ORJSONResponse

router = APIRouter(prefix="/api/v1/editorial")
NO_STORE = {"Cache-Control": "no-store"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]


def ok(payload: Any, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=NO_STORE)


class _Save(BaseModel):
    value: dict[str, Any]
    sources: list[dict[str, Any]] = Field(default_factory=list, max_length=20)


class _Decide(BaseModel):
    decision: str = Field(max_length=10)
    note: str | None = Field(None, max_length=2000)


class _Verdicts(BaseModel):
    layer: str = Field(max_length=40)
    items: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    submit: bool = False


class _DecideMany(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    decision: str = Field(max_length=10)
    note: str | None = Field(None, max_length=2000)


@router.get(
    "/worklists",
    summary="Each worklist with its counts, the editor's open work and what waits on their review",
)
def worklists(u: User) -> ORJSONResponse:
    return ok(editorial.worklists(u))


@router.get("/works", summary="The works a source may name, with their titles")
def works(u: User) -> ORJSONResponse:
    return ok({"data": editorial.works(u)})


@router.get("/awaiting", summary="Work in review that waits on this editor")
def awaiting(u: User, limit: int = Query(100, ge=1, le=200)) -> ORJSONResponse:
    return ok(editorial.awaiting(u, limit))


@router.post("/verdicts", summary="Verdicts on many rows of a layer, saved and, if asked, submitted")
def verdicts(u: User, body: _Verdicts) -> ORJSONResponse:
    return ok(editorial.save_verdicts(u, body.layer, body.items, body.submit), status=201)


@router.post("/decide", summary="One decision on many entries in review")
def decide_many(u: User, body: _DecideMany) -> ORJSONResponse:
    return ok(editorial.decide_many(u, body.ids, body.decision, body.note))


@router.post("/entries/{entry_id}/submit", summary="Send a draft to review")
def submit(u: User, entry_id: str) -> ORJSONResponse:
    return ok(editorial.submit(u, entry_id))


@router.post("/entries/{entry_id}/withdraw", summary="Take work in review back to draft")
def withdraw(u: User, entry_id: str) -> ORJSONResponse:
    return ok(editorial.withdraw(u, entry_id))


@router.post("/entries/{entry_id}/decide", summary="Approve the revision in review, or ask for changes")
def decide(u: User, entry_id: str, body: _Decide) -> ORJSONResponse:
    return ok(editorial.decide(u, entry_id, body.decision, body.note))


@router.delete("/entries/{entry_id}", summary="Discard a draft")
def discard(u: User, entry_id: str) -> Response:
    editorial.discard(u, entry_id)
    return Response(status_code=204, headers=NO_STORE)


@router.get(
    "/{kind}", summary="A worklist's targets, the most used first, with the state of the board's work"
)
def targets(
    u: User,
    kind: str,
    state: str = Query("all", max_length=10),
    q: str = Query("", max_length=80),
    layer: str | None = Query(None, max_length=40),
    offset: int = Query(0, ge=0, le=1_000_000),
    limit: int = Query(50, ge=1, le=200),
) -> ORJSONResponse:
    return ok(editorial.targets(u, kind, state, q.strip(), offset, limit, layer))


@router.get(
    "/{kind}/{target:path}", summary="A target: what is in force, the open work, its candidates and history"
)
def entry(u: User, kind: str, target: Annotated[str, Path(max_length=200)]) -> ORJSONResponse:
    return ok(editorial.entry(u, kind, target))


@router.put("/{kind}/{target:path}", summary="Save the board's draft on a target")
def save(u: User, kind: str, target: Annotated[str, Path(max_length=200)], body: _Save) -> ORJSONResponse:
    return ok(editorial.save(u, kind, target, body.value, body.sources))
