"""The licence re-check finds a quote however the page carries it, and nothing that is not there (no network)."""

from __future__ import annotations

import io
import json
import zipfile

from jadhr_pipeline.licence_check import _quote_in

Q = "This annotation can be used in any website or application"


def test_quote_found_in_every_form_a_page_holds_it() -> None:
    assert _quote_in(Q, f"<p>{Q}</p>".encode())
    assert _quote_in(
        "licensed under a Creative Commons Attribution",
        b'licensed under a <a href="x">Creative Commons</a> Attribution',
    )
    assert _quote_in(Q, b"#  This annotation can be used in any website\n#    or application\n")
    assert _quote_in(
        Q, b"<pre>\n*  - This annotation can be used in any website\n*    or application,\n</pre>"
    )
    assert _quote_in("In the name of Allāh", json.dumps({"t": "In the name of Allāh"}).encode())
    assert _quote_in(
        "VerseByVerseQuran Abdulbasit", b"ID3\x00\x00" + "VerseByVerseQuran Abdulbasit".encode("utf-16-le")
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("LICENSE", "Copyright (c) 2016 Collin Fair")
    assert _quote_in("Copyright (c) 2016 Collin Fair", buf.getvalue())


def test_a_changed_or_absent_quote_is_reported() -> None:
    assert not _quote_in(Q, b"<p>This annotation may be used in websites</p>")
    assert not _quote_in("CHANGING IT IS NOT ALLOWED", b"changing it is allowed")
    assert not _quote_in(Q, b"*  This annotation can be used in any website\n*    or service\n")
