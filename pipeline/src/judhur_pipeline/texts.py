"""Quran text sources: Tanzil (Uthmani + simple) and the KFGQPC Hafs text (QPC).

Texts are opaque verified data. Parsers split structure (surah | ayah | text,
tokens on U+0020) and never transform letters or marks. Every split is checked
to be lossless against the original string.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree

TOTAL_SURAHS = 114
TOTAL_VERSES = 6236
BASMALA_TOKENS = 4

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


class TextError(ValueError):
    pass


def has_embedded_basmala(surah: int, ayah: int) -> bool:
    """Tanzil prefixes ayah 1 with the basmala in every surah except al-Fātiḥa (where it IS ayah 1) and at-Tawba (none)."""
    return ayah == 1 and surah not in (1, 9)


@dataclass(frozen=True)
class TanzilText:
    verses: dict[tuple[int, int], str]
    notice: str  # the copyright block, reproduced verbatim in derived files per the license


def parse_tanzil_txt(path: Path) -> TanzilText:
    raw = path.read_bytes()
    if b"\r" in raw:
        raise TextError(f"{path.name}: CR bytes present — refusing to parse (CRLF corrupts tokens)")
    verses: dict[tuple[int, int], str] = {}
    notice: list[str] = []
    for line in raw.decode("utf-8").split("\n"):
        if not line:
            continue
        if line.startswith("#"):
            notice.append(line)
            continue
        parts = line.split("|", 2)
        if len(parts) != 3 or not parts[0].isdigit() or not parts[1].isdigit() or not parts[2]:
            raise TextError(f"{path.name}: malformed line {line[:60]!r}")
        key = (int(parts[0]), int(parts[1]))
        if key in verses:
            raise TextError(f"{path.name}: duplicate verse {key}")
        verses[key] = parts[2]
    if len(verses) != TOTAL_VERSES:
        raise TextError(f"{path.name}: {len(verses)} verses, expected {TOTAL_VERSES}")
    return TanzilText(verses=verses, notice="\n".join(notice))


@dataclass(frozen=True)
class SurahMeta:
    number: int
    verse_count: int
    start_index: int  # 0-based index of its first verse in the 6236 sequence
    name_ar: str
    name_translit: str
    name_en: str
    revelation_place: str  # 'meccan' | 'medinan'
    revelation_order: int
    rukus: int


@dataclass(frozen=True)
class QuranMeta:
    surahs: list[SurahMeta]
    juz: list[tuple[int, int, int]]  # (juz, surah, ayah) starts
    hizb_quarters: list[tuple[int, int, int]]  # (quarter 1..240, surah, ayah) starts
    manzils: list[tuple[int, int, int]]
    rukus: list[tuple[int, int, int]]
    pages: list[tuple[int, int, int]]  # (page 1..604, surah, ayah) starts — Madani mushaf
    sajdas: list[tuple[int, int, str]]  # (surah, ayah, 'recommended' | 'obligatory')
    notice: str = field(default="")


def parse_tanzil_meta(path: Path) -> QuranMeta:
    tree = ElementTree.parse(path)
    root = tree.getroot()

    def starts(group: str, tag: str) -> list[tuple[int, int, int]]:
        node = root.find(group)
        if node is None:
            raise TextError(f"quran-data.xml: missing <{group}>")
        return [(int(e.get("index", "0")), int(e.get("sura", "0")), int(e.get("aya", "0"))) for e in node.iter(tag)]

    surahs = []
    for e in root.find("suras").iter("sura"):  # type: ignore[union-attr]
        place = e.get("type", "")
        if place not in ("Meccan", "Medinan"):
            raise TextError(f"quran-data.xml: unknown revelation type {place!r}")
        surahs.append(
            SurahMeta(
                number=int(e.get("index", "0")),
                verse_count=int(e.get("ayas", "0")),
                start_index=int(e.get("start", "0")),
                name_ar=e.get("name", ""),
                name_translit=e.get("tname", ""),
                name_en=e.get("ename", ""),
                revelation_place=place.lower(),
                revelation_order=int(e.get("order", "0")),
                rukus=int(e.get("rukus", "0")),
            )
        )
    sajdas = [
        (int(e.get("sura", "0")), int(e.get("aya", "0")), e.get("type", ""))
        for e in root.find("sajdas").iter("sajda")  # type: ignore[union-attr]
    ]
    meta = QuranMeta(
        surahs=surahs,
        juz=starts("juzs", "juz"),
        hizb_quarters=starts("hizbs", "quarter"),
        manzils=starts("manzils", "manzil"),
        rukus=starts("rukus", "ruku"),
        pages=starts("pages", "page"),
        sajdas=sajdas,
    )
    if len(meta.surahs) != TOTAL_SURAHS or sum(s.verse_count for s in meta.surahs) != TOTAL_VERSES:
        raise TextError("quran-data.xml: surah table does not sum to 114 / 6236")
    if len(meta.juz) != 30 or len(meta.pages) != 604 or len(meta.hizb_quarters) != 240:
        raise TextError(
            f"quran-data.xml: juz={len(meta.juz)} pages={len(meta.pages)} quarters={len(meta.hizb_quarters)}"
        )
    return meta


@dataclass(frozen=True)
class QpcVerse:
    surah: int
    ayah: int
    text: str  # verbatim, including the separator and the verse-number digits
    tokens: list[str]  # words, split on U+0020; the number is NOT a token
    number_text: str  # e.g. '٢٥٥' — rendered by the font as an ayah medallion
    number_sep: str  # U+00A0 in all but one verse (verbatim)


_QPC_NUMBER = re.compile("([  ])([٠-٩]+)$")


def parse_qpc_json(path: Path) -> dict[tuple[int, int], QpcVerse]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[tuple[int, int], QpcVerse] = {}
    for v in data["verses"]:
        key = (int(v["surah"]), int(v["ayah"]))
        text: str = v["text"]
        m = _QPC_NUMBER.search(text)
        if not m:
            raise TextError(f"QPC {key}: no trailing verse number")
        if int(m.group(2).translate(_ARABIC_DIGITS)) != key[1]:
            raise TextError(f"QPC {key}: trailing number {m.group(2)} ≠ ayah")
        body = text[: m.start()]
        tokens = body.split(" ")
        if any(t == "" for t in tokens):
            raise TextError(f"QPC {key}: empty token (double space)")
        if " ".join(tokens) + m.group(1) + m.group(2) != text:
            raise TextError(f"QPC {key}: token split is not lossless")
        out[key] = QpcVerse(key[0], key[1], text, tokens, m.group(2), m.group(1))
    if len(out) != TOTAL_VERSES:
        raise TextError(f"QPC: {len(out)} verses, expected {TOTAL_VERSES}")
    return out


def tanzil_tokens(text: str, surah: int, ayah: int) -> tuple[list[str], list[str]]:
    """Split a Tanzil verse into (basmala tokens, verse tokens). Lossless."""
    tokens = text.split(" ")
    if any(t == "" for t in tokens):
        raise TextError(f"Tanzil {surah}:{ayah}: empty token")
    if has_embedded_basmala(surah, ayah):
        return tokens[:BASMALA_TOKENS], tokens[BASMALA_TOKENS:]
    return [], tokens
