"""Shared maps and their comments (PLAN P8.1-E; the handoff's 08 §8.6, EDT-342 and EDT-347). Never cached: a
reader of a shared map sees its owner's last save, and comments as they are written."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import accounts, presence, shared_maps
from .responses import ORJSONResponse

router = APIRouter(prefix="/api/v1")
NO_STORE = {"Cache-Control": "no-store"}
User = Annotated[dict[str, Any], Depends(accounts.current_user)]
Viewer = Annotated[dict[str, Any] | None, Depends(accounts.optional_user)]
GraphId = Annotated[str, Path(max_length=40)]


def ok(payload: Any, status: int = 200) -> ORJSONResponse:
    return ORJSONResponse(payload, status_code=status, headers=NO_STORE)


class _Share(BaseModel):
    local_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    title: str = Field("", max_length=200)
    kind: str = Field("free", max_length=10)
    doc: dict[str, Any]


class _Save(BaseModel):
    title: str | None = Field(None, max_length=200)
    kind: str | None = Field(None, max_length=10)
    doc: dict[str, Any]
    base: int = Field(ge=1)


class _Comment(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    node_id: str | None = Field(None, max_length=200)
    anchor: str = Field("", max_length=400)
    parent_id: str | None = Field(None, max_length=40)
    mentions: list[str] = Field(default_factory=list, max_length=20)
    # what the comment quotes (B41): {"kind": "verse", "key": "2:255"} or {"kind": "entry", "id": "dict:lane:علم"}
    quote: dict[str, Any] | None = None


class _Resolve(BaseModel):
    resolved: bool


@router.get(
    "/graphs", summary="The maps this reader shares, and those shared with them where they have spoken"
)
def graphs(u: User) -> ORJSONResponse:
    return ok(shared_maps.mine(u))


@router.post("/graphs", summary="Share a map for comments: its document, from now on saved here by its owner")
def share(u: User, body: _Share) -> ORJSONResponse:
    return ok(shared_maps.share(u, body.local_id, body.title, body.kind, body.doc), status=201)


@router.get("/graphs/{graph_id}", summary="A shared map as its owner last saved it (anyone with the link)")
def read(v: Viewer, graph_id: GraphId) -> ORJSONResponse:
    return ok(shared_maps.read(v, graph_id))


@router.put("/graphs/{graph_id}", summary="The owner's save: the whole map, made from revision `base`")
def save(u: User, graph_id: GraphId, body: _Save) -> ORJSONResponse:
    return ok(shared_maps.save(u, graph_id, body.title, body.kind, body.doc, body.base))


@router.delete("/graphs/{graph_id}", summary="Stop sharing: the document, its history and its comments go")
def stop(u: User, graph_id: GraphId) -> Response:
    shared_maps.stop(u, graph_id)
    return Response(status_code=204, headers=NO_STORE)


@router.get("/graphs/{graph_id}/revisions", summary="The map's history (its owner)")
def revisions(u: User, graph_id: GraphId) -> ORJSONResponse:
    return ok({"data": shared_maps.revisions(u, graph_id)})


@router.get("/graphs/{graph_id}/revisions/{revision}", summary="One version of the map (its owner)")
def revision(u: User, graph_id: GraphId, revision: int) -> ORJSONResponse:
    return ok(shared_maps.revision(u, graph_id, revision))


@router.get("/graphs/{graph_id}/comments", summary="A map's comments and who may be mentioned")
def comments(u: User, graph_id: GraphId) -> ORJSONResponse:
    return ok(shared_maps.comments(u, graph_id))


@router.post(
    "/graphs/{graph_id}/read", summary="The reader has the map's comments in front of them: marked read"
)
def mark_read(u: User, graph_id: GraphId) -> ORJSONResponse:
    return ok(shared_maps.mark_read(u, graph_id))


@router.post(
    "/graphs/{graph_id}/comments", summary="Comment on a card or the whole map, or reply to a comment"
)
def comment(u: User, graph_id: GraphId, body: _Comment) -> ORJSONResponse:
    return ok(
        shared_maps.comment(
            u, graph_id, body.body, body.node_id, body.anchor, body.parent_id, body.mentions, body.quote
        ),
        status=201,
    )


@router.patch("/comments/{comment_id}", summary="Resolve a thread, or open it again")
def resolve(u: User, comment_id: Annotated[str, Path(max_length=40)], body: _Resolve) -> ORJSONResponse:
    return ok(shared_maps.resolve(u, comment_id, body.resolved))


@router.delete("/comments/{comment_id}", summary="Delete a comment (its author or the map's owner)")
def delete_comment(u: User, comment_id: Annotated[str, Path(max_length=40)]) -> Response:
    shared_maps.delete_comment(u, comment_id)
    return Response(status_code=204, headers=NO_STORE)


@router.websocket("/graphs/{gid}/presence")
async def graph_presence(ws: WebSocket, gid: GraphId) -> None:
    """Who is on a shared map now, and which of its owner's windows edits it (P8.6): a hello, then the presence as it
    changes."""
    await presence.serve(ws, gid)
