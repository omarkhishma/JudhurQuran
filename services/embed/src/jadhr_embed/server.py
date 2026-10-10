"""The embedding service (P17.2, D34): one process beside the API, reachable only from it, turning a reader's search
into a vector on our own server. It keeps nothing: no request log, no cache of what was asked.

    POST /embed   {"texts": ["…"], "kind": "query"}  →  {"model": "e5-base@…", "dim": 768, "vectors": "<base64 float32>"}
    GET  /healthz                                     →  {"model": "e5-base@…", "dim": 768}
"""

from __future__ import annotations

import base64
import os
from contextlib import asynccontextmanager
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .encoder import Encoder

MAX_TEXTS = 32
MAX_CHARS = 2000

state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(_app: Starlette):
    state["enc"] = Encoder.load(threads=int(os.environ.get("JADHR_EMBED_THREADS", "2")))
    yield
    state.clear()


def _encode(texts: list[str], kind: str) -> dict[str, Any]:
    enc: Encoder = state["enc"]
    vec = enc.encode(texts, "query" if kind == "query" else "passage")
    return {"model": enc.spec.tag, "dim": enc.spec.dim, "vectors": base64.b64encode(vec.tobytes()).decode()}


async def embed(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"error": "a JSON body"}, status_code=400)
    texts = body.get("texts") if isinstance(body, dict) else None
    kind = body.get("kind", "query") if isinstance(body, dict) else None
    if (
        not isinstance(texts, list)
        or not 0 < len(texts) <= MAX_TEXTS
        or not all(isinstance(t, str) and 0 < len(t) <= MAX_CHARS for t in texts)
        or kind not in ("query", "passage")
    ):
        return JSONResponse(
            {"error": f"texts: 1–{MAX_TEXTS} strings of 1–{MAX_CHARS} characters; kind: query or passage"},
            status_code=422,
        )
    # the model's arithmetic runs in a worker thread: the event loop keeps answering health checks
    from starlette.concurrency import run_in_threadpool

    return JSONResponse(await run_in_threadpool(_encode, texts, kind))


async def healthz(_request: Request) -> JSONResponse:
    enc: Encoder = state["enc"]
    return JSONResponse({"model": enc.spec.tag, "dim": enc.spec.dim})


app = Starlette(
    routes=[Route("/embed", embed, methods=["POST"]), Route("/healthz", healthz)], lifespan=lifespan
)
