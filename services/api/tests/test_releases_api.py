"""Dataset releases (P10.1b): recorded once with every file checked, never changed (the database refuses it too),
read by anyone, a file served only once the release is published and when no hold covers it — its bytes those the
manifest names."""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api import accounts, releases
from jadhr_api.main import app
from jadhr_api.refusal import Refusal
from jadhr_api.settings import get_settings
from sqlalchemy.exc import DBAPIError

client = TestClient(app)


def _write(folder: Path, version: str) -> dict:
    """A small release: three files, one under a hold."""
    files = {
        "roots.csv": "key,spaced\r\nعلم,ع ل م\r\n",
        "words.jsonl": '{"location": "1:1:1"}\n',
        "lexicon_lane.tei.xml": '<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"/>\n',
    }
    out = []
    for path, body in files.items():
        data = body.encode("utf-8")
        (folder / path).write_bytes(data)
        out.append(
            {
                "path": path,
                "table": path.split(".")[0],
                "format": path.split(".")[1],  # tei for lexicon_lane.tei.xml
                "held": "qac" if path.startswith("words") else None,
                "rows": 1,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "notice": "test",
            }
        )
    m = {
        "dataset": "jadhr-quran",
        "version": version,
        "created": "2026-10-04T00:00:00Z",
        "files": out,
        "sources": [{"id": "qac", "license": "GPL"}],
        "copyright_notices": {},
        "publication_hold": [
            {"id": "qac", "tables": ["words"], "why": "asked of the corpus", "decision": "D19"}
        ],
        "excluded": [],
    }
    (folder / "MANIFEST.json").write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
    return m


@pytest.fixture
def release(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[str, Path]]:
    version = f"2099.{uuid.uuid4().int % 12 + 1}.{uuid.uuid4().int % 900 + 100}"
    folder = tmp_path / version
    folder.mkdir()
    _write(folder, version)
    # the cached settings patched, not rebuilt: a rebuilt one would drop conftest's test-wide overrides
    monkeypatch.setattr(get_settings(), "release_dir", str(tmp_path))
    yield version, folder
    with accounts.tx() as conn:
        conn.exec_driver_sql(
            "alter table releases.dataset_releases disable trigger dataset_releases_immutable"
        )
        accounts.q(
            conn, "delete from releases.dataset_releases where version = :v returning version", {"v": version}
        )
        conn.exec_driver_sql(
            "alter table releases.dataset_releases enable trigger dataset_releases_immutable"
        )


def test_a_release_is_recorded_once_read_by_anyone_and_its_files_served_once_published(
    release: tuple[str, Path],
) -> None:
    version, folder = release
    assert releases.record(folder) == {"version": version, "recorded": True}
    assert releases.record(folder) == {
        "version": version,
        "recorded": False,
    }  # the same manifest again: nothing
    listed = client.get("/api/v1/releases").json()["data"]
    mine = next(r for r in listed if r["version"] == version)
    assert mine["counts"] == {"files": 3, "available": 0, "held": 1} and mine["published_at"] is None
    one = client.get(f"/api/v1/releases/{version}").json()
    assert [(f["path"], f["held"], f["available"]) for f in one["files"]] == [
        ("roots.csv", None, False),
        ("words.jsonl", "qac", False),
        ("lexicon_lane.tei.xml", None, False),
    ]
    assert one["publication_hold"][0]["decision"] == "D19" and one["doi"] is None
    # the manifest, byte for byte, with the hash the record keeps
    man = client.get(f"/api/v1/releases/{version}/manifest")
    assert man.content == (folder / "MANIFEST.json").read_bytes()
    assert (
        man.headers["x-content-sha256"] == hashlib.sha256(man.content).hexdigest() == one["manifest_sha256"]
    )
    # not published: no file; published: the unheld file with its hash, never the held one
    r = client.get(f"/api/v1/releases/{version}/files/roots.csv")
    assert r.status_code == 403 and r.json()["error"]["code"] == "unpublished"
    releases.publish(version)
    r = client.get(f"/api/v1/releases/{version}/files/roots.csv")
    assert r.status_code == 200 and r.content == (folder / "roots.csv").read_bytes()
    assert r.headers["x-content-sha256"] == hashlib.sha256(r.content).hexdigest()
    assert "immutable" in r.headers["cache-control"] and r.headers["content-type"].startswith("text/csv")
    # the lexicon as XML (TEI Lex-0, LMF): served as XML under its two-part name
    x = client.get(f"/api/v1/releases/{version}/files/lexicon_lane.tei.xml")
    assert x.status_code == 200 and x.content == (folder / "lexicon_lane.tei.xml").read_bytes()
    assert x.headers["content-type"].startswith("application/xml")
    assert f"jadhr-{version}-lexicon_lane.tei.xml" in x.headers["content-disposition"]
    assert client.get(f"/api/v1/releases/{version}/files/lexicon_lane.x.xml").status_code == 404
    held = client.get(f"/api/v1/releases/{version}/files/words.jsonl")
    assert held.status_code == 403 and held.json()["error"]["code"] == "held"
    # nothing outside the manifest, nothing outside the folder
    assert client.get(f"/api/v1/releases/{version}/files/..%2F..%2Fsecret.csv").status_code == 404
    assert client.get(f"/api/v1/releases/{version}/files/other.csv").status_code == 404
    assert client.get("/api/v1/releases/9999.1.1").status_code == 404
    # a file changed on disk is not served as the release's
    (folder / "roots.csv").write_bytes(b"key\r\nx\r\n")
    assert client.get(f"/api/v1/releases/{version}/files/roots.csv").status_code == 410


def test_a_release_never_changes(release: tuple[str, Path]) -> None:
    version, folder = release
    releases.record(folder)
    # rebuilt with another manifest under the same version: refused
    m = json.loads((folder / "MANIFEST.json").read_text(encoding="utf-8"))
    m["created"] = "2026-10-05T00:00:00Z"
    (folder / "MANIFEST.json").write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(Refusal) as e:
        releases.record(folder)
    assert e.value.code == "changed"
    # a file that is not what the manifest names is not recorded
    other = folder.parent / "2099.1.1"
    other.mkdir()
    _write(other, "2099.1.1")
    (other / "roots.csv").write_bytes(b"changed")
    with pytest.raises(Refusal) as e:
        releases.record(other)
    assert e.value.code == "bad_file"
    # the database refuses a change to what was recorded, and a deletion; a DOI is set once
    for sql in (
        "update releases.dataset_releases set manifest = '{}'::jsonb where version = :v",
        "delete from releases.dataset_releases where version = :v",
    ):
        with pytest.raises(DBAPIError), accounts.tx() as conn:
            conn.exec_driver_sql(sql.replace(":v", f"'{version}'"))
    releases.set_doi(version, "10.5281/zenodo.123")
    with pytest.raises(DBAPIError):
        releases.set_doi(version, "10.5281/zenodo.456")
