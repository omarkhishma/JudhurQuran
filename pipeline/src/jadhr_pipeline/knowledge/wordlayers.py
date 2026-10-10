"""The Tafsir Center's layers for each word of the Quran (PLAN P13, D33): the meaning of the word in its
place, its sarf statement, its iʿrāb, its qirāʾāt note with what the difference means, and its rasm note — and each verse's iʿrāb — read
verbatim from the pinned ``quran.db`` (source ``tafsircenter-quran-db``, CC BY 4.0).

The Center numbers 77,432 words; our display text has 77,430 tokens (KFGQPC's word split). A verse's
words are tied to our tokens by their letters, never by position alone:

* where a verse has as many words as tokens, each pair must share its consonantal skeleton (alef, waw,
  yaa and hamza dropped, so the Center's imlāʾī «السماوات» meets the mushaf's «ٱلسَّمَٰوَٰتِ»);
* a verse that spells the same throughout but moves a boundary (25:7 «ما لهذا», the mushaf's «مَالِ
  هَٰذَا») is paired by position;
* a word the mushaf spells otherwise (its «بَصۜۡطَةٗ» with a small sīn, «فَإِلَّمۡ», «لَنَسۡفَعَۢا») is paired by
  position only when the words on both sides of it agree, at most two in a verse, and listed;
* otherwise consecutive words of the Center are joined when together they spell one token — the Center
  writes «ما لي» where the mushaf writes «مَالِيَ» (27:20, 36:22) — and both rows stay on that token,
  in order (``part``).

A verse none of these ties is not guessed: its rows are left out and the verse is listed in the report.
Nothing is edited: every text is the Center's own, byte for byte; only empty values («-») are skipped.

The qirāʾāt note is kept only where the Center records a difference between the readers, alone or joined
to the next word: its other rows say «لا خلاف بين القراء في هذا الموضع» for both, which the API states
from the absence of a row (counted in the report).
"""

from __future__ import annotations

import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from jadhr_arabic import skeleton

from .quran import read_jsonl

SOURCE = "tafsircenter-quran-db"
NO_DIFFERENCE = "لا خلاف بين القراء في هذا الموضع"
JOINED = "---{عند الوصل}---"
# kind → (table, column); the order is the order rows are written in
WORD_TABLES = {
    "meaning": ("word_content_meaning", "meaning"),
    "sarf": ("word_content_sarf", "sarf"),
    "irab": ("word_content_irab", "irabMushakkal"),
    "qiraat": ("qeraat_info", "content"),
    "qiraat_note": ("qeraat_info", "note"),  # what the readings' difference means («توجيه»), where given
    "rasm": ("word_content_rasm", "rasm"),
}


_NOT_LETTER = re.compile("[^\u0621-\u064a]")
_FINAL_TAA = re.compile("\u062a$")
_RUN = re.compile(r"(.)\1+")


def _skel(text: str) -> str:
    """Letters to compare the two spellings by: the consonantal skeleton with the Center's «/» (it writes
    the vocative apart, «يا/أيها») and other non-letters dropped, a final open tāʾ read as hāʾ (the mushaf's
    «نِعۡمَتَ», the Center's «نعمة»), and a doubled letter read once (the imlāʾī «الليل», the mushaf's
    «ٱلَّيۡلِ»). For comparing two spellings of the same place only; nothing here is displayed."""
    s = _FINAL_TAA.sub("\u0647", skeleton(_NOT_LETTER.sub("", text)))
    return _RUN.sub(r"\1", s)


def _is_empty(text: str | None) -> bool:
    return text is None or text.strip() in ("", "-")


def _no_difference(content: str) -> bool:
    """«لا خلاف…» for the word alone and, after the separator, for the word joined to the next."""
    parts = [p.strip() for p in content.split(JOINED)]
    return all(p == NO_DIFFERENCE for p in parts)


def anchored(tc_s: list[str], tk_s: list[str]) -> list[int] | None:
    """Indexes of the pairs that differ in letters when every one of them has agreeing neighbours (a
    verse edge counts as one), at most two; None otherwise."""
    bad = [i for i, (a, b) in enumerate(zip(tc_s, tk_s, strict=True)) if a != b]
    if not bad or len(bad) > 2:
        return None
    ok = set(range(len(tc_s))) - set(bad)
    for i in bad:
        left = i == 0 or (i - 1) in ok
        right = i == len(tc_s) - 1 or (i + 1) in ok
        if not (left and right) or len(tc_s) < 3:
            return None
    return bad


def align_verse(tc_words: list[str], tokens: list[str]) -> list[tuple[int, int]] | None:
    """Pairs (index of the Center's word, index of our token), or None when the letters do not tie.

    Equal counts: position by position, each pair's skeleton equal. Otherwise a walk that joins up to
    three consecutive words of the Center into one token when their skeletons spelt together equal it.
    """
    tc_s = [_skel(w) for w in tc_words]
    tk_s = [_skel(t) for t in tokens]
    if len(tc_s) == len(tk_s):
        # equal counts: every pair agrees, or the verse spells the same and only a boundary moved
        # (25:7 «ما لهذا» against the mushaf's «مَالِ هَٰذَا») — the caller counts the second kind
        if (
            all(a == b for a, b in zip(tc_s, tk_s, strict=True))
            or "".join(tc_s) == "".join(tk_s)
            or anchored(tc_s, tk_s) is not None
        ):
            return list(zip(range(len(tc_s)), range(len(tk_s)), strict=True))
        return None
    pairs: list[tuple[int, int]] = []
    i = 0
    for j, tk in enumerate(tk_s):
        for k in (1, 2, 3):
            if i + k <= len(tc_s) and "".join(tc_s[i : i + k]) == tk:
                pairs.extend((i + n, j) for n in range(k))
                i += k
                break
        else:
            return None
    return pairs if i == len(tc_s) else None


def build_word_layers(db: Path, build_dir: Path) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    verses = {v["id"]: v for v in read_jsonl(build_dir / "verses.jsonl")}
    vid = {(v["surah"], v["ayah"]): v["id"] for v in verses.values()}
    tokens: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for t in read_jsonl(build_dir / "tokens.jsonl"):
        v = verses[t["verse_id"]]
        tokens[(v["surah"], v["ayah"])].append(t)
    for ts in tokens.values():
        ts.sort(key=lambda t: t["position"])

    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        words: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
        for s, a, n, w in con.execute(
            "select surahNo, ayahNo, wordNo, word from word_content_rasm order by surahNo, ayahNo, wordNo"
        ):
            words[(s, a)].append((n, w))
        texts: dict[str, dict[tuple[int, int, int], str]] = {}
        for kind, (table, col) in WORD_TABLES.items():
            texts[kind] = {
                (s, a, n): v
                for s, a, n, v in con.execute(f'select surahNo, ayahNo, wordNo, "{col}" from {table}')
            }
        verse_irab = list(
            con.execute("select surahNo, ayahNo, irabAyah1 from ayah_content_irab order by surahNo, ayahNo")
        )
    finally:
        con.close()

    rows: list[dict[str, Any]] = []
    unaligned: list[str] = []
    joined: list[str] = []
    by_position: list[str] = []
    moved: list[str] = []
    counts: Counter[str] = Counter()
    no_difference = 0
    aligned_words = 0
    for key in sorted(words):
        tc = words[key]
        ts = tokens.get(key, [])
        pairs = align_verse([w for _, w in tc], [t["text"] for t in ts])
        if pairs is None:
            unaligned.append(f"{key[0]}:{key[1]}")
            continue
        if len(tc) != len(ts):
            joined.append(f"{key[0]}:{key[1]}")
        else:
            a, b = [_skel(w) for _, w in tc], [_skel(x["text"]) for x in ts]
            if a != b and "".join(a) == "".join(b):
                moved.append(f"{key[0]}:{key[1]}")
            elif a != b:
                by_position.extend(f"{key[0]}:{key[1]}:{ts[i]['position']}" for i in anchored(a, b) or [])
        part: Counter[int] = Counter()
        for i, j in pairs:
            n = tc[i][0]
            tok = ts[j]
            part[j] += 1
            aligned_words += 1
            for kind in WORD_TABLES:
                text = texts[kind].get((key[0], key[1], n))
                if _is_empty(text):
                    counts[f"{kind}_empty"] += 1
                    continue
                if kind == "qiraat" and _no_difference(text):
                    no_difference += 1
                    continue
                counts[kind] += 1
                rows.append(
                    {
                        "token_id": tok["id"],
                        "verse_id": tok["verse_id"],
                        "position": tok["position"],
                        "part": part[j],
                        "kind": kind,
                        "text": text,
                        "source_id": SOURCE,
                    }
                )
    irab_rows = []
    for s, a, text in verse_irab:
        if (s, a) not in vid:
            unaligned.append(f"verse_irab {s}:{a}")
            continue
        if _is_empty(text):
            counts["verse_irab_empty"] += 1
            continue
        irab_rows.append({"verse_id": vid[(s, a)], "text": text, "source_id": SOURCE})

    total_tc = sum(len(v) for v in words.values())
    report = {
        "center_words": total_tc,
        "our_tokens": sum(len(v) for v in tokens.values()),
        "aligned_words": aligned_words,
        "aligned_share": round(aligned_words / total_tc, 6) if total_tc else 0.0,
        "verses_joined": joined,
        "verses_boundary_moved": moved,
        "words_by_position": by_position,
        "verses_unaligned": unaligned,
        "rows": dict(sorted(counts.items())),
        "qiraat_no_difference": no_difference,
        "verse_irab": len(irab_rows),
    }
    return {"word_layers": rows, "verse_irab": irab_rows}, report
