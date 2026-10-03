"""Read the text of a Word (.docx) file, paragraph by paragraph, exactly as typed.

Only the main document part (``word/document.xml``) is read. Each ``<w:p>`` becomes one paragraph; its text is
the concatenation of its runs' ``<w:t>`` text, with ``<w:tab/>`` read as a tab and ``<w:br/>``/``<w:cr/>`` as a
line break (the KFGQPC gharib file puts each further entry of a verse on a new line inside the verse's
paragraph). Formatting (colours, fonts, the run styles that mark Quranic text) is not text and is not kept.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

from lxml import etree

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as z:
        root = etree.fromstring(z.read("word/document.xml"))
    body = root.find(_W + "body")
    if body is None:
        raise ValueError(f"{path}: no document body")
    out: list[str] = []
    for p in body.iter(_W + "p"):
        parts: list[str] = []
        for r in p.iter(_W + "r"):
            for ch in r:
                tag = etree.QName(ch).localname
                if tag == "t":
                    parts.append(ch.text or "")
                elif tag == "tab":
                    parts.append("\t")
                elif tag in ("br", "cr"):
                    parts.append("\n")
        out.append("".join(parts))
    return out
