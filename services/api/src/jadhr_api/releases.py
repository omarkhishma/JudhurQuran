"""Dataset releases (PLAN P10.1b, research 18): a built release recorded once, served by version and file.

    uv run python -m jadhr_api.releases record data/release/2026.10.0   # once, after it is built
    uv run python -m jadhr_api.releases publish 2026.10.0               # the owner's go: its unheld files are served
    uv run python -m jadhr_api.releases doi 2026.10.0 10.5281/zenodo.N   # once a DOI is minted (D14)

Recording reads the release's MANIFEST.json, checks every file it lists against its size and sha256, and keeps the
manifest as it is: the same version recorded again with another manifest is refused (the database refuses it too).
A release is read by anyone — its manifest, sources, notices and holds; a file is served only once the release is
published and only if no hold covers it, with its sha256 beside it, so a citation that names a version and a file
names the same bytes for ever.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .accounts import q, q1, tx
from .refusal import Refusal
from .settings import get_settings

REPO = Path(__file__).resolve().parents[4]
VERSION = re.compile(r"^\d{4}\.\d{1,2}\.\d{1,3}$")
FILE = re.compile(r"^[a-z0-9_]+\.(jsonl|csv|xml|txt)$")
TYPES = {
    "jsonl": "application/x-ndjson; charset=utf-8",
    "csv": "text/csv; charset=utf-8; header=present",
    "xml": "application/xml; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
}


def release_dir() -> Path:
    d = Path(get_settings().release_dir)
    return d if d.is_absolute() else REPO / d


def _digest(manifest_bytes: bytes) -> str:
    return hashlib.sha256(manifest_bytes).hexdigest()


def record(folder: Path) -> dict[str, Any]:
    """Record a built release: every file checked against its manifest, the manifest kept as it is."""
    raw = (folder / "MANIFEST.json").read_bytes()
    m = json.loads(raw)
    version = m.get("version")
    if not isinstance(version, str) or not VERSION.match(version) or folder.name != version:
        raise Refusal(422, "bad_version", "The manifest's version is not the folder's.")
    for f in m.get("files", []):
        path = folder / f["path"]
        if not FILE.match(f["path"]) or not path.is_file():
            raise Refusal(422, "missing_file", f"{f['path']} is not in the release folder.")
        data = path.read_bytes()
        if len(data) != f["bytes"] or hashlib.sha256(data).hexdigest() != f["sha256"]:
            raise Refusal(422, "bad_file", f"{f['path']} is not the file the manifest names.")
    digest = _digest(raw)
    with tx() as conn:
        had = q1(
            conn, "select manifest_sha256 from releases.dataset_releases where version = :v", {"v": version}
        )
        if had:
            if had["manifest_sha256"] != digest:
                raise Refusal(
                    409,
                    "changed",
                    f"Release {version} is recorded with another manifest: build a new version.",
                )
            return {"version": version, "recorded": False}
        q(
            conn,
            """insert into releases.dataset_releases (version, dataset, built_at, manifest, manifest_sha256)
               values (:v, :d, :b, cast(:m as jsonb), :h) returning version""",
            {
                "v": version,
                "d": m.get("dataset", ""),
                "b": m.get("created") or datetime.now(UTC).isoformat(),
                "m": raw.decode("utf-8"),
                "h": digest,
            },
        )
    return {"version": version, "recorded": True}


def publish(version: str) -> dict[str, Any]:
    """The owner's go: from now on the release's unheld files are served."""
    with tx() as conn:
        r = q1(
            conn,
            "update releases.dataset_releases set published_at = coalesce(published_at, now()) where version = :v returning version",
            {"v": version},
        )
    if r is None:
        raise Refusal(404, "not_found", "No such release.")
    return {"version": version, "published": True}


def set_doi(version: str, doi: str) -> dict[str, Any]:
    with tx() as conn:
        r = q1(
            conn,
            "update releases.dataset_releases set doi = :d where version = :v returning version",
            {"d": doi, "v": version},
        )
    if r is None:
        raise Refusal(404, "not_found", "No such release.")
    return {"version": version, "doi": doi}


def _iso(v: Any) -> str | None:
    return v.isoformat() if isinstance(v, datetime) else None


def _file_out(f: dict[str, Any], version: str, published: bool) -> dict[str, Any]:
    return {
        "path": f["path"],
        "table": f.get("table"),
        "format": f.get("format"),
        "rows": f["rows"],
        "bytes": f["bytes"],
        "sha256": f["sha256"],
        "notice": f.get("notice"),
        "held": f.get("held"),
        # served only once published and when no hold covers it
        "available": published and not f.get("held"),
        "url": f"/api/v1/releases/{version}/files/{f['path']}",
    }


def _out(r: dict[str, Any], full: bool) -> dict[str, Any]:
    m = r["manifest"]
    published = r["published_at"] is not None
    files = [_file_out(f, r["version"], published) for f in m.get("files", [])]
    out: dict[str, Any] = {
        "version": r["version"],
        "dataset": r["dataset"],
        "built_at": _iso(r["built_at"]),
        "recorded_at": _iso(r["recorded_at"]),
        "published_at": _iso(r["published_at"]),
        "doi": r["doi"],
        "manifest_sha256": r["manifest_sha256"],
        "counts": {
            "files": len(files),
            "available": sum(1 for f in files if f["available"]),
            "held": sum(1 for f in files if f["held"]),
        },
        "url": f"/api/v1/releases/{r['version']}",
    }
    if full:
        out |= {
            "text_sha256": m.get("text_sha256"),
            "data_counts": m.get("counts"),
            "files": files,
            "sources": m.get("sources", []),
            "copyright_notices": m.get("copyright_notices", {}),
            "publication_hold": m.get("publication_hold", []),
            "excluded": m.get("excluded", []),
            "manifest_url": f"/api/v1/releases/{r['version']}/manifest",
        }
    return out


def recorded(version: str) -> dict[str, Any] | None:
    """The recorded release of a dataset version, as a citation names it — or None until it is recorded."""
    with tx() as conn:
        r = q1(
            conn,
            "select version, manifest_sha256, published_at, doi from releases.dataset_releases where version = :v",
            {"v": version},
        )
    if r is None:
        return None
    return {
        "version": r["version"],
        "manifest_sha256": r["manifest_sha256"],
        "published": r["published_at"] is not None,
        "doi": r["doi"],
        "url": f"/api/v1/releases/{r['version']}",
    }


def releases() -> dict[str, Any]:
    """Every recorded release, newest first."""
    with tx() as conn:
        rows = q(conn, "select * from releases.dataset_releases order by recorded_at desc, version desc")
    return {"data": [_out(r, full=False) for r in rows]}


def _row(version: str) -> dict[str, Any]:
    if not VERSION.match(version):
        raise Refusal(404, "not_found", "No such release.")
    with tx() as conn:
        r = q1(conn, "select * from releases.dataset_releases where version = :v", {"v": version})
    if r is None:
        raise Refusal(404, "not_found", "No such release.")
    return r


def release(version: str) -> dict[str, Any]:
    return _out(_row(version), full=True)


def manifest(version: str) -> tuple[bytes, str]:
    """The manifest as it was built — the bytes whose hash the record keeps."""
    r = _row(version)
    path = release_dir() / version / "MANIFEST.json"
    data = path.read_bytes() if path.is_file() else b""
    if _digest(data) != r["manifest_sha256"]:
        raise Refusal(410, "missing", "This release's manifest is not on this server.")
    return data, r["manifest_sha256"]


def file(version: str, path: str) -> tuple[Path, dict[str, Any]]:
    """A release's file: only a file its manifest lists, once published, when no hold covers it, and only the bytes
    the manifest names."""
    r = _row(version)
    f = next((x for x in r["manifest"].get("files", []) if x["path"] == path), None)
    if f is None or not FILE.match(path):
        raise Refusal(404, "not_found", "No such file in this release.")
    if r["published_at"] is None:
        raise Refusal(403, "unpublished", "This release is not published yet.")
    if f.get("held"):
        hold: dict[str, Any] = next(
            (h for h in r["manifest"].get("publication_hold", []) if h.get("id") == f["held"]), {}
        )
        raise Refusal(403, "held", f"Held: {hold.get('why', f['held'])}")
    full = release_dir() / version / path
    if not full.is_file() or full.stat().st_size != f["bytes"]:
        raise Refusal(410, "missing", "This file is not on this server.")
    return full, {**f, "content_type": TYPES[path.rsplit(".", 1)[1]]}


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    try:
        if len(args) == 2 and args[0] == "record":
            out = record(Path(args[1]).resolve())
        elif len(args) == 2 and args[0] == "publish":
            out = publish(args[1])
        elif len(args) == 3 and args[0] == "doi":
            out = set_doi(args[1], args[2])
        else:
            print(__doc__, file=sys.stderr)
            return 2
    except Refusal as e:
        print(f"refused: {e.detail}", file=sys.stderr)
        return 1
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
