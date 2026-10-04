"""The API's reference page (security review M3): Swagger UI from the API's own pinned files, never a CDN — the page is
on the site's origin, where a script from elsewhere could read a reader's session — under a policy that lets in its
own files and its one inline script, by hash, and nothing else."""

from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)
SWAGGER = Path(__file__).resolve().parents[1] / "src/jadhr_api/static/swagger"


def test_the_reference_page_loads_nothing_from_elsewhere() -> None:
    r = client.get("/api/v1/docs")
    assert r.status_code == 200
    html = r.text
    addresses = re.findall(r'(?:src|href)="([^"]*)"', html)
    assert addresses and all(a.startswith("/") and not a.startswith("//") for a in addresses), addresses
    assert "cdn.jsdelivr" not in html and "tiangolo" not in html
    policy = r.headers["content-security-policy"]
    inline = re.findall(r"<script>(.*?)</script>", html, re.DOTALL)
    assert len(inline) == 1
    digest = base64.b64encode(hashlib.sha256(inline[0].encode()).digest()).decode()
    assert f"script-src 'self' 'sha256-{digest}';" in policy
    assert (
        "default-src 'none'" in policy and "frame-ancestors 'none'" in policy and "unsafe-eval" not in policy
    )


def test_its_files_are_the_pinned_package_unchanged_and_nothing_else_is_served() -> None:
    recorded = dict(
        reversed(line.split()[1:3])
        for line in (SWAGGER / "SOURCE").read_text().splitlines()
        if line.startswith("sha256 ")
    )
    assert set(recorded) == {"swagger-ui-bundle.js", "swagger-ui.css"}
    for name, digest in recorded.items():
        r = client.get(f"/api/v1/docs/{name}")
        assert r.status_code == 200 and hashlib.sha256(r.content).hexdigest() == digest, name
    assert (
        client.get("/api/v1/docs/swagger-ui-bundle.js").headers["content-type"].startswith("text/javascript")
    )
    for other in ("LICENSE", "SOURCE", "..%2Fmain.py", "swagger-ui.js"):
        assert client.get(f"/api/v1/docs/{other}").status_code == 404, other
