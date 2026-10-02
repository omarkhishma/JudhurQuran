"""Quran text sources: Tanzil (Uthmani + simple) and the KFGQPC Hafs text (QPC).

Texts are opaque verified data. Parsers split structure (surah | ayah | text,
tokens on U+0020) and never transform letters or marks. Every split is checked
to be lossless against the original string.
"""

from __future__ import annotations

import json
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
        return [
            (int(e.get("index", "0")), int(e.get("sura", "0")), int(e.get("aya", "0")))
            for e in node.iter(tag)
        ]

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
    text: str  # verbatim verse text as published, including the ayah-end mark
    tokens: list[str]  # words, split on spaces; the ayah mark is NOT a token
    number_text: str  # Arabic-Indic digits, e.g. '٢٥٥' — the font draws them as the ayah medallion
    number_sep: str  # separator before the ayah mark, verbatim (U+00A0 in all but one verse)
    page: int | None = None  # Madinah mushaf page (official KFGQPC data)
    line_start: int | None = None
    line_end: int | None = None
    juz: int | None = None
    imlaei: str | None = None  # KFGQPC's own imlāʾī text "used for search purpose"
    hizb_mark: bool = False  # ۞ printed before this verse (start of a rub' al-hizb)


def tanzil_tokens(text: str, surah: int, ayah: int) -> tuple[list[str], list[str]]:
    """Split a Tanzil verse into (basmala tokens, verse tokens). Lossless."""
    tokens = text.split(" ")
    if any(t == "" for t in tokens):
        raise TextError(f"Tanzil {surah}:{ayah}: empty token")
    if has_embedded_basmala(surah, ayah):
        return tokens[:BASMALA_TOKENS], tokens[BASMALA_TOKENS:]
    return [], tokens


_DIGITS_AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def parse_kfgqpc_official(path: Path) -> dict[tuple[int, int], QpcVerse]:
    """The official KFGQPC Hafs data (hafsData_v2-0.json, 2022-09-07).

    Each ``aya_text`` ends with a separator and one ayah-mark code point (U+FC00 + ayah − 1) that
    only the KFGQPC font draws as a medallion. The verbatim text is kept; for display the number is
    rendered from Arabic-Indic digits, which the same font draws identically and which degrade safely
    if the font is unavailable. Word tokens split on spaces; the official 2:6 contains one double space,
    which is recorded, not "fixed".
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[tuple[int, int], QpcVerse] = {}
    for v in data:
        key = (int(v["sura_no"]), int(v["aya_no"]))
        text: str = v["aya_text"]
        mark = text[-1]
        if ord(mark) != 0xFC00 + key[1] - 1:
            raise TextError(f"KFGQPC {key}: unexpected ayah mark U+{ord(mark):04X}")
        sep = text[-2]
        if sep not in ("\u00a0", " "):
            raise TextError(f"KFGQPC {key}: unexpected separator before the ayah mark")
        body = text[:-2]
        hizb = body.startswith("\u06de\u00a0")  # ۞ rub' al-hizb sign, printed before the first word
        if hizb:
            body = body[2:]
        if "\u06de" in body or "\u00a0" in body:
            raise TextError(f"KFGQPC {key}: unexpected rub' sign or NBSP inside the verse body")
        # Split on U+0020 only; the official 2:6 opens with one stray space, which yields an empty
        # leading token that is dropped here (the stored verse text keeps it verbatim).
        tokens = [t for t in body.split(" ") if t]
        if not tokens or " ".join(tokens) != body.strip(" ") or "  " in body:
            raise TextError(f"KFGQPC {key}: unexpected whitespace")
        out[key] = QpcVerse(
            surah=key[0],
            ayah=key[1],
            text=text,
            tokens=tokens,
            number_text=str(key[1]).translate(_DIGITS_AR),
            number_sep=sep,
            page=int(v["page"]),
            line_start=int(v["line_start"]),
            line_end=int(v["line_end"]),
            juz=int(v["jozz"]),
            imlaei=v["aya_text_emlaey"],
            hizb_mark=hizb,
        )
    if len(out) != TOTAL_VERSES:
        raise TextError(f"KFGQPC: {len(out)} verses, expected {TOTAL_VERSES}")
    return out
