"""Lane's Arabic-English Lexicon from the Perseus TEI XML (laneslexicon/lexicon_xml).

One entry per ``<div2 type="root">``. Rules (registry):

* ``lane-markup-removed``  — TEI markup removed, element text kept in document order; each
  ``<entryFree>`` is one paragraph; ``<pb n>`` page breaks only set page_ref.
* ``lane-transliteration`` — Arabic inside ``lang="ar"`` elements is stored by Perseus in a
  Buckwalter variant; it is converted to Arabic script with the Perseus/laneslexicon table.
  Characters outside the table are kept as they are and counted.
"""

from __future__ import annotations

import re
import tarfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from lxml import etree

from .shamela import Counters

# Perseus digraphs first (laneslexicon lexicon_parser/lane.pl: A@→{, A_→I, A^→O, y^→}, w^→W).
_DIGRAPHS = (("A@", "ٱ"), ("A_", "إ"), ("A^", "أ"), ("y^", "ئ"), ("w^", "ؤ"))
_SINGLE = {
    "'": "ء", "|": "آ", "O": "أ", "W": "ؤ", "I": "إ", "}": "ئ", "A": "ا",
    "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ",
    "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "-": "ـ", "f": "ف",
    "q": "ق", "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و",
    "Y": "ى", "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ",
    "i": "ِ", "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "P": "پ", "J": "چ",
    "V": "ڤ", "G": "گ", "^": "ٔ", "=": "ٓ", "_": "ٕ",
}  # fmt: skip
_PASS = set(" \t\n0123456789.,;:()[]?!\"'-–―/\\&#@")

# Root ids in <div2 n="…">: "ktb", "rA^b", "Dbw or DbY", "Quasi $dqm", "ytm &amp;c.", "gwY: see gw".
_ROOT_SPLIT = re.compile(r"[\s,;:()]+|\bor\b|\band\b|\b[Ss]ee\b|accord\.|\bto\b|\bsome\b|art\.")


def translit(text: str, counters: Counters | None = None) -> str:
    for a, b in _DIGRAPHS:
        text = text.replace(a, b)
    out = []
    for ch in text:
        if ch in _SINGLE:
            out.append(_SINGLE[ch])
        else:
            if counters is not None and ch not in _PASS and not ("؀" <= ch <= "ۿ"):
                counters.add("lane-transliteration:unmapped-char")
            out.append(ch)
    return "".join(out)


def root_tokens(n: str) -> list[str]:
    """Arabic-script root candidates from a div2 ``n`` id, in order."""
    n = n.replace("&c.", " ").replace("Quasi", " ")
    toks = []
    for tok in _ROOT_SPLIT.split(n):
        tok = tok.strip()
        if tok and re.fullmatch(r"[A-Za-z$*'`{|^_~@<>}&]+", tok):
            toks.append(translit(tok).replace("ّ", ""))
    return toks


@dataclass
class LaneWord:
    """One word Lane treats inside a root's article: its paragraph (an ``<entryFree>``, counted among the article's
    paragraphs from 0), its headword as Perseus keys it (Buckwalter), whether it is a verb form (``<itype>``, the
    form's number), and the page the paragraph starts on."""

    para: int
    key: str
    itype: str | None
    page: str | None


@dataclass
class LaneEntry:
    root_n: str
    headword: str
    body: str
    page_ref: str | None
    source_ref: str
    tokens: list[str]
    words: list[LaneWord]


_LETTER_ORDER = "AbtvjHxd*rzs$SDTZEgfqklmnhwy"


def _file_order(name: str) -> tuple[int, int]:
    stem = Path(name).stem  # "_A0", "b0", "$0", "_0"
    letter = stem[:-1]
    letter = (
        letter[1:].upper()
        if letter.startswith("_") and len(letter) > 1
        else ("A" if letter == "_" else letter)
    )
    return (_LETTER_ORDER.find(letter) if letter in _LETTER_ORDER else 99, int(stem[-1]))


def _xml_members(tar_path: Path) -> Iterator[tuple[str, bytes]]:
    with tarfile.open(tar_path, "r:gz") as tf:
        members = [m for m in tf.getmembers() if m.isfile() and m.name.endswith(".xml")]
        members.sort(key=lambda m: _file_order(m.name))
        for m in members:
            fh = tf.extractfile(m)
            assert fh is not None
            yield m.name, fh.read()


def _text(el: etree._Element, counters: Counters, page: list[str | None]) -> str:
    """Text of an element in document order, Arabic transliteration converted, <pb> → page."""
    parts: list[str] = []

    def walk(e: etree._Element) -> None:
        tag = e.tag if isinstance(e.tag, str) else ""
        if tag == "pb":
            page[0] = e.get("n") or page[0]
        else:
            ar = e.get("lang") == "ar" and tag in ("foreign", "orth")
            if ar and (e.text or "").strip() == "*":
                ar = False  # Lane's asterisk sign, not the Buckwalter letter ذ
            if e.text:
                parts.append(translit(e.text, counters) if ar else e.text)
                if ar:
                    counters.add("lane-transliteration")
            for child in e:
                walk(child)
        if e.tail:
            parts.append(e.tail)

    walk(el)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def read_lane(tar_path: Path, counters: Counters) -> list[LaneEntry]:
    entries: list[LaneEntry] = []
    for name, data in _xml_members(tar_path):
        root = etree.fromstring(data, parser=etree.XMLParser(recover=False, resolve_entities=False))
        page: list[str | None] = [None]
        for el in root.iter():
            tag = el.tag if isinstance(el.tag, str) else ""
            if tag == "pb":
                page[0] = el.get("n") or page[0]
                continue
            if tag != "div2" or el.get("type") != "root":
                continue
            start_page = page[0]
            head_el = el.find("head")
            headword = (
                _text(head_el, counters, [None]) if head_el is not None else translit(el.get("n") or "")
            )
            paras: list[str] = []
            words: list[LaneWord] = []
            first_id = None
            for child in el:
                ctag = child.tag if isinstance(child.tag, str) else ""
                if ctag == "head":
                    continue
                if ctag == "entryFree" and first_id is None:
                    first_id = child.get("id")
                at = page[0]
                t = _text(child, counters, page)
                if t:
                    if ctag == "entryFree" and child.get("key"):
                        it = child.find(".//itype")
                        words.append(
                            LaneWord(
                                len(paras),
                                child.get("key") or "",
                                (it.text or "").strip() if it is not None else None,
                                at,
                            )
                        )
                    paras.append(t)
                    counters.add("lane-markup-removed")
            end_page = page[0]
            ref = start_page if start_page == end_page or end_page is None else f"{start_page}-{end_page}"
            n = el.get("n") or ""
            entries.append(
                LaneEntry(
                    root_n=n,
                    headword=headword,
                    body="\n\n".join(paras),
                    page_ref=ref,
                    source_ref=f"perseus:lane:{Path(name).name}:{first_id or n}",
                    tokens=root_tokens(n),
                    words=words,
                )
            )
    return entries
