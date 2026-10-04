"""Text intake (PLAN P11.3c, D9a): a reader's own text from a web page or a PDF, read on the server and handed back —
never stored, logged or cached; the text then lives in the reader's browser like a pasted one.

* A web page: fetched by us only at an address on the global internet (no private, loopback, link-local or shared
  address — at every redirect, each name resolved once and the request sent to the address checked; http and https on
  their usual ports; no proxy from the environment), at most ``URL_BYTES`` within ``URL_SECONDS`` in all; its main
  text read by trafilatura, the direction controls taken out, NFC.
* A PDF: each page's text layer read by pypdf and told what it is — ``text`` (a sound layer), ``reversed`` (a layer in
  visual order, turned back: its words, read backwards, are found far more often in our forms), ``broken`` (private-use
  characters standing for letters, letters spaced apart, or words no text holds) or ``scan`` (no text to speak of: an
  image, for OCR). The Arabic presentation forms are folded to letters; no vowel is ever added. The file is read in a
  process of its own under limits of time, CPU and memory (``jadhr_api.pdftext``).

Both hold a thread of the pool every route shares while they wait, so one address reads one at a time and a worker
``AT_ONCE`` in all (security review M2)."""

from __future__ import annotations

import ipaddress
import json
import re
import socket
import subprocess
import sys
import threading
import time
import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx
from jadhr_arabic import normalize
from sqlalchemy import Connection

from .db import rows

URL_BYTES = 3_000_000
URL_SECONDS = 15.0  # the whole fetch: every hop and every byte
URL_READ_SECONDS = 5.0  # one wait on the site: to connect, or for the next bytes
PDF_BYTES = 40_000_000
PDF_PAGES = 1500
PDF_SECONDS = 60.0  # the whole reading, killed after
PDF_CPU_SECONDS = 50
PDF_MEMORY = 1_500_000_000
AT_ONCE = 4  # intakes one API worker reads at the same time
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


_SLOTS = threading.BoundedSemaphore(AT_ONCE)
_READING: set[str] = set()
_READING_LOCK = threading.Lock()


@contextmanager
def slot(address: str) -> Iterator[None]:
    """One intake at a time for an address, ``AT_ONCE`` for the worker: otherwise refused as busy, at once."""
    with _READING_LOCK:
        if address in _READING:
            raise IntakeError("busy")
        _READING.add(address)
    try:
        if not _SLOTS.acquire(blocking=False):
            raise IntakeError("busy")
        try:
            yield
        finally:
            _SLOTS.release()
    finally:
        with _READING_LOCK:
            _READING.discard(address)


def clean(text: str) -> str:
    """No direction controls, NFC, no run of blank lines longer than one."""
    text = unicodedata.normalize("NFC", _BIDI.sub("", text))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# ─── a web page ──────────────────────────────────────────────────────────────


def _is_public(address: str) -> bool:
    """An address on the global internet only: not private, loopback, link-local, shared (100.64.0.0/10 — carrier
    NAT, Tailscale, some clouds' metadata), reserved, multicast or unspecified; an IPv4 address inside IPv6 is judged
    as itself."""
    ip = ipaddress.ip_address(address.split("%")[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def _resolve(host: str, port: int, allow_private: bool) -> str:
    """The one address a host is fetched at: resolved once and checked, and the request sent there — so a name cannot
    answer a public address to the check and a private one to the request (DNS rebinding)."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as e:
        raise IntakeError("unreachable", str(e)) from e
    addresses = [str(info[4][0]) for info in infos]
    if not addresses:
        raise IntakeError("unreachable", host)
    if not allow_private and not all(_is_public(a) for a in addresses):
        raise IntakeError("not_public", host)
    return addresses[0]


@dataclass
class _Target:
    url: str  # the address checked, in the place of the name
    host: str  # the Host header: the name, with its port when not the scheme's own
    sni: str  # the name TLS is asked for and the certificate checked against


def _target(url: str, allow_private: bool) -> _Target:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise IntakeError("bad_url")
    if parts.username or parts.password:
        raise IntakeError("bad_url")
    try:
        given = parts.port
    except ValueError as e:
        raise IntakeError("bad_url") from e
    usual = 443 if parts.scheme == "https" else 80
    port = given or usual
    # an address off the public internet is named as such, whatever its port
    ip = _resolve(parts.hostname, port, allow_private)
    if port not in (80, 443) and not allow_private:
        raise IntakeError("bad_url")
    name = f"[{parts.hostname}]" if ":" in parts.hostname else parts.hostname
    pinned = parts._replace(netloc=f"[{ip}]:{port}" if ":" in ip else f"{ip}:{port}").geturl()
    return _Target(pinned, name if port == usual else f"{name}:{port}", parts.hostname)


def fetch(url: str, allow_private: bool = False) -> tuple[str, str]:
    """The page's HTML and the address it ended at, each hop checked; no cookie kept, nothing stored."""
    url = url.strip()
    deadline = time.monotonic() + URL_SECONDS
    with httpx.Client(
        timeout=URL_READ_SECONDS,
        follow_redirects=False,
        trust_env=False,  # no proxy from the environment: the address checked is the address asked
        headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
    ) as client:
        for _ in range(4):
            if time.monotonic() > deadline:
                raise IntakeError("too_slow")
            t = _target(url, allow_private)
            try:
                with client.stream(
                    "GET", t.url, headers={"Host": t.host}, extensions={"sni_hostname": t.sni}
                ) as r:
                    # the address reached, checked again before a byte is read
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
                        # a site that sends a byte now and then holds a thread for as long as it likes
                        if time.monotonic() > deadline:
                            raise IntakeError("too_slow")
                    return body.decode(r.encoding or "utf-8", errors="replace"), url
            except httpx.TimeoutException as e:
                raise IntakeError("too_slow", type(e).__name__) from e
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
    """Each page of a PDF told what it is, the text of those that hold one; nothing kept. The file is read in a
    process of its own (``jadhr_api.pdftext``), killed at ``PDF_SECONDS``."""
    if len(data) > PDF_BYTES:
        raise IntakeError("too_large")
    try:
        done = subprocess.run(
            [
                sys.executable,
                "-m",
                "jadhr_api.pdftext",
                str(PDF_PAGES),
                str(PDF_CPU_SECONDS),
                str(PDF_MEMORY),
            ],
            input=data,
            capture_output=True,
            timeout=PDF_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as e:
        raise IntakeError("too_slow") from e
    if done.returncode != 0:
        # killed by its CPU limit, or out of the memory it may use
        raise IntakeError("too_heavy", done.stderr.decode(errors="replace")[-300:])
    out = json.loads(done.stdout)
    if out.get("error"):
        raise IntakeError(out["error"], out.get("detail", ""))
    pages = [triage(raw, i, lex) for i, raw in enumerate(out["pages"], start=1)]
    title = clean(out.get("title") or "")
    return {
        "title": title or re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE),
        "pages": [p.__dict__ for p in pages],
        "counts": {s: sum(1 for p in pages if p.status == s) for s in ("text", "reversed", "broken", "scan")},
    }
