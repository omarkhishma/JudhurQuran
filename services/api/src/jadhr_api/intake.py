"""Text intake (PLAN P11.3c, D9a): a reader's own text from a web page or a PDF, read on the server and handed back —
never stored, logged or cached; the text then lives in the reader's browser like a pasted one.

* A web page: fetched by us only at a public address (no private, loopback or link-local address, at every redirect
  and again at the address actually reached; http and https on their usual ports), at most ``URL_BYTES`` in
  ``URL_SECONDS``; its main text read by trafilatura, the direction controls taken out, NFC.
* A PDF: each page's text layer read by pypdf and told what it is — ``text`` (a sound layer), ``reversed`` (a layer in
  visual order, turned back: its words, read backwards, are found far more often in our forms), ``broken`` (private-use
  characters standing for letters, letters spaced apart, or words no text holds) or ``scan`` (no text to speak of: an
  image, for OCR). The Arabic presentation forms are folded to letters; no vowel is ever added."""

from __future__ import annotations

import io
import ipaddress
import re
import socket
import unicodedata
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx
from jadhr_arabic import normalize
from sqlalchemy import Connection

from .db import rows

URL_BYTES = 3_000_000
URL_SECONDS = 10.0
PDF_BYTES = 40_000_000
PDF_PAGES = 1500
USER_AGENT = "Jadhr/1.0 (text intake; a reader's own request)"

# direction controls: a page's markup, never its words
_BIDI = re.compile("[‎‏‪-‮⁦-⁩؜]")
_ARABIC_LETTER = re.compile(r"[ء-غف-ي]")
_WORD = re.compile(r"[ء-غف-ي]+")
_PRIVATE = re.compile("[-]")
_PRESENTATION = re.compile("[ﭐ-﷿ﹰ-﻿]+")


class IntakeError(Exception):
    """A refusal with a stable code the web says in the reader's language."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code


def clean(text: str) -> str:
    """No direction controls, NFC, no run of blank lines longer than one."""
    text = unicodedata.normalize("NFC", _BIDI.sub("", text))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# ─── a web page ──────────────────────────────────────────────────────────────


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _public(host: str, allow_private: bool) -> None:
    """Refuse a host that resolves to an address not on the public internet (SSRF)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise IntakeError("unreachable", str(e)) from e
    if not allow_private and not all(_is_public(info[4][0]) for info in infos):
        raise IntakeError("not_public", host)


def _check(url: str, allow_private: bool) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise IntakeError("bad_url")
    if parts.username or parts.password:
        raise IntakeError("bad_url")
    _public(parts.hostname, allow_private)
    if parts.port not in (None, 80, 443) and not allow_private:
        raise IntakeError("bad_url")


def fetch(url: str, allow_private: bool = False) -> tuple[str, str]:
    """The page's HTML and the address it ended at, each hop checked; no cookie kept, nothing stored."""
    url = url.strip()
    with httpx.Client(
        timeout=URL_SECONDS, follow_redirects=False, headers={"User-Agent": USER_AGENT, "Accept": "text/html"}
    ) as client:
        for _ in range(4):
            _check(url, allow_private)
            try:
                with client.stream("GET", url) as r:
                    # the address actually reached, checked again before a byte is read: a name that resolved to a
                    # public address for the check and to a private one for the request (DNS rebinding) is refused
                    stream = r.extensions.get("network_stream")
                    peer = stream.get_extra_info("server_addr") if stream else None
                    if peer and not allow_private and not _is_public(peer[0]):
                        raise IntakeError("not_public", str(peer[0]))
                    if r.is_redirect and r.headers.get("location"):
                        url = urljoin(url, r.headers["location"])
                        continue
                    if r.status_code != 200:
                        raise IntakeError("fetch_failed", str(r.status_code))
                    kind = r.headers.get("content-type", "")
                    if kind and "html" not in kind and "xml" not in kind:
                        raise IntakeError("not_html", kind)
                    body = b""
                    for chunk in r.iter_bytes():
                        body += chunk
                        if len(body) > URL_BYTES:
                            raise IntakeError("too_large")
                    return body.decode(r.encoding or "utf-8", errors="replace"), url
            except httpx.HTTPError as e:
                raise IntakeError("fetch_failed", type(e).__name__) from e
        raise IntakeError("fetch_failed", "too many redirects")


def from_url(url: str, allow_private: bool = False) -> dict[str, Any]:
    """A web page's main text: its title, its words without the page's menus and notes, where it came from."""
    import trafilatura

    html, final = fetch(url, allow_private)
    text = trafilatura.extract(
        html, url=final, include_comments=False, include_tables=False, favor_precision=True
    )
    meta = trafilatura.extract_metadata(html, default_url=final)
    text = clean(text or "")
    if len(_ARABIC_LETTER.findall(text)) < 20:
        raise IntakeError("no_text")
    return {
        "title": clean(meta.title or "") if meta else "",
        "text": text,
        "url": final,
        "site": (meta.sitename if meta else None) or urlsplit(final).hostname,
    }


# ─── a PDF ───────────────────────────────────────────────────────────────────

# read once per process: a new release is loaded with a restart of the API
_LEX: dict[str, frozenset[str]] = {}


def lexicon(conn: Connection) -> frozenset[str]:
    """Every written form our texts and the Quran hold, as their matching keys: what a page's words are looked up
    in, to tell a sound layer from one in visual order or one of noise."""
    if "forms" not in _LEX:
        found = rows(conn, "select norm from content.text_forms union select norm from content.words")
        _LEX["forms"] = frozenset(r["norm"] for r in found if r["norm"])
    return _LEX["forms"]


def _fold(text: str) -> str:
    """Arabic presentation forms (a ligature, a final or medial glyph) to their letters."""
    return _PRESENTATION.sub(lambda m: unicodedata.normalize("NFKC", m.group(0)), text)


def _hits(words: list[str], lex: frozenset[str]) -> float:
    if not words:
        return 0.0
    return sum(1 for w in words if normalize(w) in lex) / len(words)


@dataclass
class Page:
    n: int
    status: str  # text | reversed | broken | scan
    reason: str | None
    text: str
    hits: float


def triage(raw: str, n: int, lex: frozenset[str]) -> Page:
    """One page's text layer told what it is (module docstring)."""
    text = clean(_fold(raw or ""))
    letters = len(_ARABIC_LETTER.findall(text))
    if letters < 20:
        return Page(n, "scan", "no_text_layer", "", 0.0)
    private = len(_PRIVATE.findall(text))
    if private > 0.02 * letters:
        return Page(n, "broken", "private_use", "", 0.0)
    words = _WORD.findall(text)
    single = sum(1 for w in words if len(w) == 1)
    if words and single > 0.4 * len(words):
        return Page(n, "broken", "letters_apart", "", 0.0)
    ahead = _hits(words, lex)
    behind = _hits([w[::-1] for w in words], lex)
    if behind > max(0.3, 1.5 * ahead):
        # visual order: each line read from its end
        turned = "\n".join(line[::-1] for line in text.split("\n"))
        return Page(n, "reversed", None, turned, behind)
    if ahead < 0.3:
        return Page(n, "broken", "few_known_words", "", ahead)
    return Page(n, "text", None, text, ahead)


def from_pdf(data: bytes, name: str, lex: frozenset[str]) -> dict[str, Any]:
    """Each page of a PDF told what it is, the text of those that hold one; nothing kept."""
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    if len(data) > PDF_BYTES:
        raise IntakeError("too_large")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise IntakeError("encrypted")
        count = len(reader.pages)
    except PdfReadError as e:
        raise IntakeError("not_pdf", str(e)) from e
    if count > PDF_PAGES:
        raise IntakeError("too_many_pages", str(count))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception:  # a page pypdf cannot read is a page for OCR, not a failed upload
            raw = ""
        pages.append(triage(raw, i, lex))
    try:
        title = clean(str((reader.metadata or {}).get("/Title") or ""))
    except Exception:
        title = ""
    return {
        "title": title or re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE),
        "pages": [p.__dict__ for p in pages],
        "counts": {s: sum(1 for p in pages if p.status == s) for s in ("text", "reversed", "broken", "scan")},
    }
