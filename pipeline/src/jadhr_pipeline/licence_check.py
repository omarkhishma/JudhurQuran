"""Re-check the licence register against the pages it quotes (PLAN P1.8, research 07).

    uv run python -m jadhr_pipeline.licence_check            # every entry
    uv run python -m jadhr_pipeline.licence_check qac lane   # some entries

For every clause in data/licences.yaml the page it quotes is fetched again (once per URL), its sha256 is
compared with the one recorded when it was read, and the quote is looked for in the page (whitespace
normalised, HTML entities decoded). A page that changed but still carries every quote is reported, not
failed; a quote that is gone, or a page that cannot be fetched, fails the run — that is the signal to
re-read the terms before a release. Requests carry a generic User-Agent and nothing else about anyone.
"""

from __future__ import annotations

import contextlib
import hashlib
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[3]
REGISTER = REPO / "data/licences.yaml"
USER_AGENT = "jadhr-research/1.0"
_SPACE = re.compile(r"\s+")
_TAG = re.compile(r"<[^>]+>")
_COMMENT = re.compile(r"(?m)^[ \t]*#+[ \t]?")


def _norm(s: str) -> str:
    return _SPACE.sub(" ", html.unescape(s)).strip()


def _text(body: bytes) -> str:
    """The page as text; a release archive is read through its small text members (LICENSE, README)."""
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            return "\n".join(
                z.read(i).decode("utf-8", errors="replace")
                for i in z.infolist()
                if i.file_size < 1_000_000 and not i.is_dir()
            )
    return body.decode("utf-8", errors="replace")


def _views(body: bytes) -> list[str]:
    """Readings of a page a quote may sit in: as served, without markup (a linked licence name or a quote
    that is itself markup), without comment markers (a licence header in a data file), JSON-decoded."""
    raw = _text(body)
    views = [raw, _TAG.sub(" ", raw), _TAG.sub("", raw), _COMMENT.sub(" ", raw)]
    with contextlib.suppress(ValueError):
        views.append(json.dumps(json.loads(raw), ensure_ascii=False))
    return [_norm(v) for v in views]


def _quote_in(quote: str, body: bytes) -> bool:
    q = _norm(quote)
    if any(q in v for v in _views(body)):
        return True
    # an audio file's tags may hold the text as UTF-16 or Latin-1
    return any(quote.encode(enc, errors="ignore") in body for enc in ("utf-16-le", "utf-16-be", "latin-1"))


def _fetch(url: str, timeout: float) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def check(ids: list[str] | None = None, timeout: float = 40.0, pause: float = 1.0) -> dict[str, Any]:
    entries = yaml.safe_load(REGISTER.read_text(encoding="utf-8"))["licences"]
    if ids:
        entries = [e for e in entries if e["id"] in ids]
    pages: dict[str, tuple[bytes | None, str | None]] = {}
    results: list[dict[str, Any]] = []
    for e in entries:
        recorded: dict[str, str] = e.get("page_sha256") or {}
        for c in e.get("clauses", []):
            url = c["url"]
            if url not in pages:
                try:
                    pages[url] = (_fetch(url, timeout), None)
                except (urllib.error.URLError, TimeoutError, OSError) as err:
                    pages[url] = (None, str(err))
                time.sleep(pause)
            body, error = pages[url]
            row: dict[str, Any] = {"id": e["id"], "url": url, "topic": c.get("topic")}
            if body is None:
                row.update(status="fetch-failed", error=error)
            else:
                sha = hashlib.sha256(body).hexdigest()
                present = _quote_in(str(c["quote"]), body)
                row.update(
                    page="same"
                    if recorded.get(url) == sha
                    else ("changed" if url in recorded else "unrecorded"),
                    status="ok" if present else "quote-missing",
                    sha256=sha,
                )
                if not present:
                    row["quote"] = c["quote"]
            results.append(row)
    summary: dict[str, int] = {}
    for r in results:
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    changed = sorted({r["url"] for r in results if r.get("page") == "changed"})
    return {
        "entries": len(entries),
        "clauses": len(results),
        "summary": summary,
        "pages_changed": changed,
        "problems": [r for r in results if r["status"] != "ok"],
    }


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    report = check(args or None)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0 if not report["problems"] else 1


if __name__ == "__main__":
    sys.exit(main())
