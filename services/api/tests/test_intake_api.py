"""Text intake (P11.3c): a web page's main text and a PDF's pages, read on the server and handed back, never stored —
a page fetched only at a public address; each PDF page told what it is: a sound text layer, one in visual order
(turned back), a broken one, or a scan."""

from __future__ import annotations

import io
import os
import threading
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
    ):
        r = client.post("/api/v1/intake/url", json={"url": url})
        assert r.status_code == 422 and r.json()["error"]["code"] == code, url
