"""Text intake (P11.3c): a web page's main text and a PDF's pages, read on the server and handed back, never stored —
a page fetched only at a public address; each PDF page told what it is: a sound text layer, one in visual order
(turned back), a broken one, or a scan."""

from __future__ import annotations

import io
import os
import threading
import time
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jadhr_api import intake
from jadhr_api.db import connect
from jadhr_api.main import app
from jadhr_api.settings import get_settings

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]
FONT = REPO / "data/raw/fonts/amiri-quran/Amiri-1.003/Amiri-Regular.ttf"
SENTENCE = "قال الشافعي والبيان اسم جامع لمعان مجتمعة الأصول متشعبة الفروع"
ARTICLE = (
    "<html><head><title>الرسالة للشافعي</title></head><body>"
    "<nav><a href='/'>الرئيسية</a> <a href='/x'>اتصل بنا</a> <a href='/y'>سياسة الخصوصية</a></nav>"
    "<article><h1>الرسالة للشافعي</h1>"
    + "".join(f"<p>‏{SENTENCE} في الفقرة رقم {i} من الباب الأول.</p>" for i in range(1, 9))
    + "</article><footer>جميع الحقوق محفوظة للموقع</footer></body></html>"
)


def lex() -> frozenset[str]:
    with connect() as conn:
        return intake.lexicon(conn)


def test_a_page_is_told_what_its_text_layer_is() -> None:
    lx = lex()
    sound = intake.triage(SENTENCE, 1, lx)
    assert sound.status == "text" and sound.text == SENTENCE and sound.hits > 0.6
    # visual order: the line read from its end, then turned back whole
    backwards = intake.triage(SENTENCE[::-1], 2, lx)
    assert backwards.status == "reversed" and backwards.text == SENTENCE
    assert intake.triage("", 3, lx).status == "scan"
    assert intake.triage("12 34", 4, lx).status == "scan"
    # glyphs mapped to private-use code points, letters spaced apart, words no text holds
    pua = intake.triage(SENTENCE + " " + "" * 10, 5, lx)
    assert (pua.status, pua.reason) == ("broken", "private_use")
    apart = intake.triage(" ".join(SENTENCE.replace(" ", "")), 6, lx)
    assert (apart.status, apart.reason) == ("broken", "letters_apart")
    noise = intake.triage("ظغضذ ثخشص قفغظ ضصذث غظخش " * 3, 7, lx)
    assert (noise.status, noise.reason) == ("broken", "few_known_words")
    # presentation forms (a lam-alif ligature, final forms) folded to their letters; no vowel added
    folded = intake.triage("ﻻ" + "مر " + SENTENCE, 8, lx)
    assert folded.text.startswith("لامر ") and folded.status == "text"


@pytest.mark.skipif(not FONT.exists() and os.environ.get("JADHR_REQUIRE_DATA") != "1", reason="no font")
def test_a_pdf_comes_back_page_by_page() -> None:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    pdfmetrics.registerFont(TTFont("Amiri", str(FONT)))
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.setTitle("كتاب للتجربة")
    # pypdf reads a right-to-left run backwards: drawn reversed, the layer is sound; drawn as typed, it is in
    # visual order
    for text in (SENTENCE[::-1], SENTENCE, ""):
        c.setFont("Amiri", 14)
        for k in range(3):
            c.drawString(40, 760 - 24 * k, text)
        c.showPage()
    c.save()
    r = client.post("/api/v1/intake/pdf", files={"file": ("test.pdf", buf.getvalue(), "application/pdf")})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    d = r.json()
    assert d["title"] == "كتاب للتجربة"
    assert [p["status"] for p in d["pages"]] == ["text", "reversed", "scan"]
    assert d["pages"][0]["text"].split("\n")[0] == SENTENCE == d["pages"][1]["text"].split("\n")[0]
    assert d["counts"] == {"text": 1, "reversed": 1, "broken": 0, "scan": 1}
    bad = client.post("/api/v1/intake/pdf", files={"file": ("x.pdf", b"not a pdf at all", "application/pdf")})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "not_pdf"


@pytest.fixture
def site() -> Iterator[str]:
    class Page(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/slow":
                # a byte now and then, for as long as it is let: each read waits less than its timeout
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                for _ in range(40):
                    try:
                        self.wfile.write(b"<p>")
                        self.wfile.flush()
                    except OSError:
                        return
                    time.sleep(0.25)
                return
            if self.path == "/moved":
                self.send_response(302)
                self.send_header("Location", "/article")
                self.end_headers()
                return
            body = ARTICLE.encode() if self.path == "/article" else b"%PDF"
            self.send_response(200)
            self.send_header(
                "Content-Type", "text/html; charset=utf-8" if self.path == "/article" else "application/pdf"
            )
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args: object) -> None:  # the test's own server keeps no log either
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Page)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def test_a_web_pages_main_text_without_its_menus(site: str, monkeypatch: pytest.MonkeyPatch) -> None:
    # only a public address is fetched: the test's own page, on loopback, is refused until allowed
    r = client.post("/api/v1/intake/url", json={"url": f"{site}/article"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "not_public"
    monkeypatch.setattr(get_settings(), "intake_allow_private", True)
    r = client.post("/api/v1/intake/url", json={"url": f"{site}/moved"})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    d = r.json()
    assert d["url"] == f"{site}/article" and d["title"] == "الرسالة للشافعي"
    assert SENTENCE in d["text"] and "اتصل بنا" not in d["text"] and "‏" not in d["text"]
    r = client.post("/api/v1/intake/url", json={"url": f"{site}/file.pdf"})
    assert r.json()["error"]["code"] == "not_html"


def test_an_address_off_the_public_internet_is_refused() -> None:
    for url, code in (
        ("ftp://example.com/x", "bad_url"),
        ("http://user:secret@example.com/", "bad_url"),
        ("http://1.1.1.1:8080/", "bad_url"),
        ("http://10.0.0.1/", "not_public"),
        ("http://169.254.169.254/latest/meta-data", "not_public"),
        ("http://[::1]/", "not_public"),
        # shared address space (carrier NAT, Tailscale, a cloud's metadata at 100.100.100.200), IPv4 inside IPv6,
        # the documentation ranges: none of them the global internet (security review L1)
        ("http://100.100.100.200/", "not_public"),
        ("http://[::ffff:127.0.0.1]/", "not_public"),
        ("http://[::ffff:10.0.0.1]/", "not_public"),
        ("http://192.0.2.1/", "not_public"),
        ("http://198.18.0.1/", "not_public"),
    ):
        r = client.post("/api/v1/intake/url", json={"url": url})
        assert r.status_code == 422 and r.json()["error"]["code"] == code, url


def test_the_request_goes_to_the_address_checked() -> None:
    """Security review L2: the name is resolved once, checked, and the request sent to that address with the name as
    its Host and its TLS name — never resolved again by the client (DNS rebinding), never through a proxy."""
    t = intake._target("http://localhost:8080/a?b=1", allow_private=True)
    assert t.url in ("http://127.0.0.1:8080/a?b=1", "http://[::1]:8080/a?b=1")
    assert (t.host, t.sni) == ("localhost:8080", "localhost")
    t = intake._target("https://localhost/x", allow_private=True)
    assert t.url.split("/x")[0] in ("https://127.0.0.1:443", "https://[::1]:443") and t.host == "localhost"
    try:
        intake._target("http://localhost/x", allow_private=False)
        raise AssertionError("loopback fetched")
    except intake.IntakeError as e:
        assert e.code == "not_public"


def test_a_slow_site_is_given_up_on_in_time(site: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Security review M2: a site sending a byte every few seconds no longer holds a thread for hours."""
    monkeypatch.setattr(get_settings(), "intake_allow_private", True)
    monkeypatch.setattr(intake, "URL_SECONDS", 1.0)
    began = time.monotonic()
    r = client.post("/api/v1/intake/url", json={"url": f"{site}/slow"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "too_slow"
    assert time.monotonic() - began < 3


def test_one_intake_at_a_time_per_address_and_a_few_per_worker(
    site: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "intake_allow_private", True)
    # the test client's requests come from "testclient": one of its intakes still being read
    with intake.slot("testclient"):
        r = client.post("/api/v1/intake/url", json={"url": f"{site}/article"})
        assert r.status_code == 429 and r.json()["error"]["code"] == "busy"
    assert client.post("/api/v1/intake/url", json={"url": f"{site}/article"}).status_code == 200
    # the worker's slots all taken by others
    monkeypatch.setattr(intake, "_SLOTS", threading.BoundedSemaphore(1))
    with intake.slot("another reader"):
        r = client.post("/api/v1/intake/url", json={"url": f"{site}/article"})
        assert r.status_code == 429 and r.json()["error"]["code"] == "busy"


def test_a_pdf_is_read_apart_and_within_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    """Security review M2: the PDF is read in a process of its own, killed at its deadline; one that dies under its
    limits of CPU or memory is refused as too heavy."""
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    monkeypatch.setattr(intake, "PDF_SECONDS", 0.001)
    r = client.post("/api/v1/intake/pdf", files={"file": ("x.pdf", pdf, "application/pdf")})
    assert r.status_code == 422 and r.json()["error"]["code"] == "too_slow"
    monkeypatch.setattr(intake, "PDF_SECONDS", 60.0)
    monkeypatch.setattr(
        intake, "PDF_CPU_SECONDS", "not a number"
    )  # the process ends in an error, as a killed one
    r = client.post("/api/v1/intake/pdf", files={"file": ("x.pdf", pdf, "application/pdf")})
    assert r.status_code == 422 and r.json()["error"]["code"] == "too_heavy"


def test_the_pdf_process_reads_and_refuses_as_the_api_did() -> None:
    from jadhr_api import pdftext

    assert pdftext.read(b"not a pdf at all", 10)["error"] == "not_pdf"
