"""Separating a modern editor's apparatus from the text it annotates — losslessly.

The Tafsir Center database prints its editors' footnotes inline between ``¬`` and ``¥`` (sources,
takhrīj, manuscript variants with their sigla such as «ف، خ: …»), and the edited counting works carry
manuscript folio marks in the body (``/ 86 و/``, ``/ ظ 157/``). Displayed text must be the text, so
these are taken out — but nothing is thrown away: every removed piece is kept, verbatim, with the
offset in the clean text where it stood, so the original can be rebuilt exactly
(``rebuild(clean, apparatus) == original`` is tested on every field).

A footnote runs from ``¬`` to the next ``¥``. A second ``¬`` before that ``¥`` is a stray marker inside
the note and stays in the note's text; a ``¥`` with no open note is a stray closer; a note still open at
the end of a field (the field was cut short at the source) runs to the end. Each case is counted.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

FOOT_OPEN, FOOT_CLOSE = "¬", "¥"
# a folio mark always names the leaf side (و recto, ظ verso); «1/ 66/ 75» is a citation, not a folio
_FOLIO = re.compile(r"/\s*(?:[وظ]\s*[0-9٠-٩]{1,4}|[0-9٠-٩]{1,4}\s*[وظ])\s*/")
_CLOSING_PUNCT = ".،,:؛)]»!؟?\n"


def split_tc(text: str | None) -> tuple[str, list[dict[str, Any]], Counter[str]]:
    """(clean text, apparatus items, counts). Item: {at, kind, text, raw}; ``raw`` is exactly what was
    removed (a space before the marker is removed with it when punctuation follows the note)."""
    counts: Counter[str] = Counter()
    if not text:
        return text or "", [], counts
    out: list[str] = []
    out_len = 0
    items: list[dict[str, Any]] = []

    def body(seg: str) -> None:
        nonlocal out_len
        pos = 0
        for m in _FOLIO.finditer(seg):
            piece = seg[pos : m.start()]
            out.append(piece)
            out_len += len(piece)
            items.append({"at": out_len, "kind": "folio", "text": m.group(0), "raw": m.group(0)})
            counts["folio_marks"] += 1
            pos = m.end()
        piece = seg[pos:]
        out.append(piece)
        out_len += len(piece)

    i, n = 0, len(text)
    while i < n:
        j = text.find(FOOT_OPEN, i)
        k = text.find(FOOT_CLOSE, i)
        if j == -1 and k == -1:
            body(text[i:])
            break
        if k != -1 and (j == -1 or k < j):
            body(text[i:k])
            items.append({"at": out_len, "kind": "stray-close", "text": "", "raw": FOOT_CLOSE})
            counts["stray_close_markers"] += 1
            i = k + 1
            continue
        body(text[i:j])
        end = text.find(FOOT_CLOSE, j + 1)
        closed = end != -1
        note = text[j + 1 : end] if closed else text[j + 1 :]
        raw = FOOT_OPEN + note + (FOOT_CLOSE if closed else "")
        nxt = text[end + 1] if closed and end + 1 < n else "\n"
        if out and out[-1].endswith(" ") and nxt in _CLOSING_PUNCT:
            out[-1] = out[-1][:-1]
            out_len -= 1
            raw = " " + raw
        inner = note.count(FOOT_OPEN)
        counts["footnotes"] += 1
        counts["stray_open_markers_inside_notes"] += inner
        if not closed:
            counts["footnotes_unclosed_at_end"] += 1
        items.append(
            {
                "at": out_len,
                "kind": "footnote" if closed else "footnote-unclosed",
                "text": note.strip(),
                "raw": raw,
            }
        )
        i = end + 1 if closed else n
    return "".join(out), items, counts


def rebuild(clean: str, items: list[dict[str, Any]]) -> str:
    """The original field from the clean text and its apparatus (inverse of ``split_tc``)."""
    out: list[str] = []
    pos = 0
    for it in items:
        out.append(clean[pos : it["at"]])
        out.append(it["raw"])
        pos = it["at"]
    out.append(clean[pos:])
    return "".join(out)


def notes_only(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The apparatus as stored on a row: offset, kind and verbatim text (``raw`` is derivable)."""
    return [{"at": it["at"], "kind": it["kind"], "text": it["raw"]} for it in items]


# ── OpenITI mARkdown ────────────────────────────────────────────────────────────────────────────
_PAGE = re.compile(r"PageV(\d+)P(\d+)")
_MS = re.compile(r"ms(\d+)")


def openiti_plain(segment: str) -> str:
    """Display text of an OpenITI mARkdown segment: ``# `` paragraph marks become paragraph breaks,
    ``~~`` line continuations are joined with a space, page and milestone tags are removed, ``@QB@`` /
    ``@QE@`` Quran-quote tags become ﴿ ﴾. Words are untouched (cleaning rule ``openiti-markup``)."""
    t = segment.replace("@QB@", "﴿").replace("@QE@", "﴾")
    t = _PAGE.sub(" ", t)
    t = re.sub(r"(?<![\w])ms\d+(?![\w])", " ", t)
    t = re.sub(r"\n~~", " ", t)
    t = re.sub(r"^#+\s?", "", t, flags=re.M)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{2,}", "\n", t)
    t = re.sub(r"﴿\s+", "﴿", t)
    t = re.sub(r"\s+﴾", "﴾", t)
    return "\n\n".join(p.strip() for p in t.split("\n") if p.strip())


def next_tag(text: str, pos: int, pattern: re.Pattern[str]) -> re.Match[str] | None:
    return pattern.search(text, pos)


PAGE_TAG = _PAGE
MS_TAG = _MS
