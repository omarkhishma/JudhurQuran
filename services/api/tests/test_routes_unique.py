"""No two routes answer the same method and path: FastAPI lets the first one registered win silently, which once hid
the verse's tafsir route behind a new one of the same address."""

from __future__ import annotations

from collections import Counter

from fastapi.routing import APIRoute
from jadhr_api.main import app


def _routes(routes: list) -> list[APIRoute]:
    """Every route, the included routers' too (FastAPI wraps an included router; its own routes carry the prefix)."""
    out: list[APIRoute] = []
    for r in routes:
        if isinstance(r, APIRoute):
            out.append(r)
        elif hasattr(r, "original_router"):
            out += _routes(r.original_router.routes)
    return out


def test_every_method_and_path_has_one_route() -> None:
    seen = Counter((m, r.path) for r in _routes(app.routes) for m in r.methods)
    assert len(seen) > 100
    assert [k for k, n in seen.items() if n > 1] == []
