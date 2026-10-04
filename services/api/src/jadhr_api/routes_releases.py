"""Dataset releases (PLAN P10.1b): every recorded release, its manifest as built, and its files — each file served
only once the release is published and when no hold covers it, with its sha256, cached for ever (a version never
changes)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Path
from fastapi.responses import FileResponse, Response

from . import releases
from .responses import ORJSONResponse

router = APIRouter(prefix="/api/v1")
FOREVER = "public, max-age=31536000, immutable"
Version = Annotated[str, Path(max_length=20)]


def ok(payload: Any) -> ORJSONResponse:
    # the list grows as releases are recorded; one release's record changes only when it is published or given a DOI
    return ORJSONResponse(payload, headers={"Cache-Control": "public, max-age=300"})


@router.get("/releases", summary="Every recorded dataset release, newest first")
def all_releases() -> ORJSONResponse:
    return ok(releases.releases())


@router.get(
    "/releases/{version}", summary="One release: its files with their hashes and holds, sources, notices"
)
def one_release(version: Version) -> ORJSONResponse:
    return ok(releases.release(version))


@router.get(
    "/releases/{version}/manifest", summary="The release's MANIFEST.json, byte for byte as it was built"
)
def release_manifest(version: Version) -> Response:
    data, digest = releases.manifest(version)
    return Response(
        data,
        media_type="application/json; charset=utf-8",
        headers={"Cache-Control": FOREVER, "ETag": f'"{digest}"', "X-Content-SHA256": digest},
    )


@router.get("/releases/{version}/files/{path}", summary="A release's file — published, and under no hold")
def release_file(version: Version, path: Annotated[str, Path(max_length=60)]) -> Response:
    full, f = releases.file(version, path)
    return FileResponse(
        full,
        media_type=f["content_type"],
        filename=f"jadhr-{version}-{path}",
        headers={"Cache-Control": FOREVER, "ETag": f'"{f["sha256"]}"', "X-Content-SHA256": f["sha256"]},
    )
