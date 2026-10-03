"""Quran quotations in al-Mufradat (al-Dāwūdī's edition, Shamela typing) resolved to verse keys.

The edition follows each quotation with the sūra and verse in brackets — «لا تَعْلَمُونَهُمُ اللَّهُ يَعْلَمُهُمْ
[الأنفال/ ٦٠]» — but does not mark where the quotation begins (the ornate brackets were lost in the typing), and
the bracketed reference belongs to the edition, not to al-Rāghib. So:

* the quotation is the run of words right before the reference that read as Quran: words carrying vowel
  marks (the typing vocalises the Quran fully and the prose lightly), with short unvocalised words («لا»،
  «ما») allowed inside the run; it stops at a colon, comma, full stop or an earlier reference, and at prose;
* the text decides, as everywhere in the pipeline (``relations.quran.QuranIndex.resolve``), with the
  reference's sūra as the hint: ``text`` / ``text+surah`` / ``text-coverage``;
* when the text alone does not decide, the reference may: if three quarters of the quoted words stand in the
  referenced verse(s), the quotation resolves there (``reference+coverage``);
* a resolution that disagrees with the reference keeps the text's verse and is flagged ``ref_mismatch``.

Quotations with no reference (introduced only by «قوله تعالى» and the like) are found with the pipeline's
trigger rule (``QuranIndex.find``, style ``triggers``) and kept only where they resolve.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import strip_marks

from ..relations.quran import Citation, QuranIndex, normalize_keep_length, words_with_spans

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
REF = re.compile(r"\[(?P<name>[^\[\]/\n]{1,40})/\s*(?P<nums>[0-9٠-٩][0-9٠-٩\s\-–،,و]{0,24})\]")
_MARK = re.compile("[" + chr(0x064B) + "-" + chr(0x0652) + "]")  # tanwin, short vowels, shadda, sukun
_WORD = re.compile("[" + chr(0x0621) + "-" + chr(0x0652) + chr(0x0670) + chr(0x0671) + "]+")
_STOP = set(':،.؛]»«"')
# Short prose words that open a sentence before a quotation and are never its first word
_PROSE_HEADS = {"أي", "اي", "نحو", "قال", "كما", "ثم", "قيل", "وقال", "فقال"}


@dataclass
class Quote:
    start: int
    end: int
    ref_start: int | None
    ref_end: int | None
    ref_text: str | None
    ref_surah: int | None
    ref_ayahs: list[int] = field(default_factory=list)
    citation: Citation | None = None
    method: str | None = None
    ref_mismatch: bool = False
    marked_by: str = "reference"

    @property
    def verse_keys(self) -> list[str]:
        return self.citation.verse_keys if self.citation and self.citation.status == "resolved" else []

    def as_row(self, text: str) -> dict[str, Any]:
        c = self.citation
        return {
            "quote_ar": text[self.start : self.end],
            "start": self.start,
            "end": self.end,
            "marked_by": self.marked_by,
            "reference_ar": self.ref_text,
            "reference_start": self.ref_start,
            "reference_end": self.ref_end,
            "reference_surah": self.ref_surah,
            "reference_ayahs": self.ref_ayahs,
            "verse_keys": self.verse_keys,
            "status": c.status if c else "unresolved",
            "method": self.method,
            "score": c.score if c else None,
            "exact": c.exact if c else None,
            "candidates": c.candidates[:12] if c else [],
            "ref_mismatch": self.ref_mismatch,
        }


def _ayahs(nums: str) -> list[int]:
    vals = [int(x) for x in re.findall(r"\d+", nums.translate(_DIGITS))]
    if len(vals) >= 2 and ("-" in nums or "–" in nums):
        return list(range(min(vals), max(vals) + 1)) if max(vals) - min(vals) < 40 else vals
    return vals


def _vocalised(word: str) -> bool:
    return bool(_MARK.search(word))


class QuoteFinder:
    def __init__(self, qi: QuranIndex, verse_count: dict[int, int]) -> None:
        self.qi = qi
        self.verse_count = verse_count

    def surah(self, name: str) -> int | None:
        n = strip_marks(name).strip()
        n = re.sub(r"^سورة\s+", "", n)
        return self.qi.surah_names.get(normalize_keep_length(n))

    @staticmethod
    def _quote_end(text: str, end: int) -> int:
        """Where the quotation ends before a reference: past «الآية», an ellipsis and stray punctuation
        («… الآية [التوبة/ ١١١]», «سَدًّا، [الكهف/ ٩٤]», «الْحَيَوانُ] [العنكبوت/ ٦٤]»)."""
        e = end
        while True:
            e0 = e
            while e > 0 and text[e - 1] in " \n.،:)]…":
                e -= 1
            if text[max(0, e - 5) : e] == "الآية":
                e -= 5
            if e == e0:
                return e

    def _span_before(self, text: str, end: int) -> tuple[int, int] | None:
        """The quotation that ends right before a reference starting at ``end``: the vocalised words before it,
        with short unvocalised words («لا», «ما») inside the run or at its head; prose or punctuation stops it."""
        e = self._quote_end(text, end)
        start: int | None = None
        pending: list[int] = []  # short unvocalised words seen since the last vocalised one
        boundary = e
        for m in reversed(list(_WORD.finditer(text, max(0, e - 600), e))):
            if any(ch in _STOP for ch in text[m.end() : boundary]):
                break
            w = m.group(0)
            bare = strip_marks(w)
            if _vocalised(w):
                start, pending = m.start(), []
            elif len(bare) <= 3 and bare not in _PROSE_HEADS:
                pending.append(m.start())
            else:
                break
            boundary = m.start()
        if start is None:
            return None
        if pending:
            start = min(start, *pending)
        return start, e

    def _plain_span_before(self, text: str, end: int) -> tuple[int, int] | None:
        """An unvocalised quotation («هنالك تتلوا كلّ نفس ما أسلفت [يونس/ ٣٠]»): the words back to the nearest
        punctuation, at most twelve; kept only if the text resolves it."""
        e = self._quote_end(text, end)
        start = None
        boundary = e
        for n, m in enumerate(reversed(list(_WORD.finditer(text, max(0, e - 300), e)))):
            if n >= 12 or any(ch in _STOP for ch in text[m.end() : boundary]):
                break
            start = boundary = m.start()
        return (start, e) if start is not None else None

    def find(self, text: str) -> list[Quote]:
        out: list[Quote] = []
        claimed: list[tuple[int, int]] = []
        for m in REF.finditer(text):
            sur = self.surah(m.group("name"))
            ayahs = _ayahs(m.group("nums"))
            q = Quote(m.start(), m.start(), m.start(), m.end(), m.group(0), sur, ayahs)
            span = self._span_before(text, m.start())
            if span:
                q.start, q.end = span
                self._resolve(text, q)
            else:
                plain = self._plain_span_before(text, m.start())
                if plain:
                    q.start, q.end = plain
                    q.marked_by = "reference-unvocalised"
                    self._resolve(text, q)
                    if not q.verse_keys:  # not Quran after all: keep the reference alone
                        q.start = q.end = m.start()
                        q.citation, q.method, q.marked_by = None, None, "reference"
            if q.end > q.start:
                claimed.append((q.start, m.end()))
            out.append(q)
        # quotations with no reference, after «قوله تعالى» and the like
        for c in self.qi.find(text, frozenset({"triggers"})):
            if c.kind != "quote" or c.status != "resolved":
                continue
            if any(c.start < ce and cs < c.end for cs, ce in claimed):
                continue
            out.append(Quote(c.start, c.end, None, None, None, None, [], c, c.method, False, "trigger"))
        out.sort(key=lambda q: q.start)
        return out

    def _resolve(self, text: str, q: Quote) -> None:
        c = self.qi.resolve(text, q.start, q.end, q.ref_surah, "markup")
        ref_keys = {f"{q.ref_surah}:{a}" for a in q.ref_ayahs} if q.ref_surah else set()
        if c is not None and c.status == "resolved":
            q.citation = c
            q.method = c.method
            q.ref_mismatch = bool(ref_keys) and not (set(c.verse_keys) & ref_keys)
            return
        # the reference decides when most of the quoted words stand in the referenced verse(s)
        sk = [x for _, _, x in words_with_spans(text[q.start : q.end]) if x]
        valid = [k for k in sorted(ref_keys) if k in self.qi.verse_keys_sk]
        if sk and valid:
            bag = set().union(*(self.qi.verse_keys_sk[k] for k in valid))
            cover = sum(1 for x in sk if x in bag) / len(sk)
            if cover >= 0.75 and len(sk) >= 1:
                q.citation = Citation(
                    q.start,
                    q.end,
                    "quote",
                    "reference",
                    q.ref_surah,
                    valid,
                    "resolved",
                    "reference+coverage",
                    round(cover, 3),
                )
                q.method = "reference+coverage"
                return
        q.citation = c or Citation(q.start, q.end, "quote", "reference", q.ref_surah, status="unresolved")
        q.method = None
