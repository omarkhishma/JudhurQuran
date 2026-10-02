"""Verse-keyed gharib glosses (Ibn Qutaybah, Gharib al-Qur'an) and their alignment to words.

The book runs surah by surah ("سورة البقرة" headings). An item opens a line, either with the
ayah number(s) and a dash, or — for a further word of the same ayah — directly with the quoted
phrase:

    ٤١- ﴿انْفِرُوا خِفَافًا وَثِقَالا﴾ أي: لينفر منكم من كان مخفا ومثقلا…
    ٢- و (العالَمُونَ): أصناف الخلق…               (connective and parenthesised phrase)
    ٣٠ و٣١- ﴿يُضَاعَفْ لَهَا الْعَذَابُ ضِعْفَيْنِ﴾ …   (one item for two ayahs)
    ﴿الشُّقَّةُ﴾ السَّفَر.                          (no number: same ayah as the previous item)

Rule ``gharib-item-number``: the number prefix moves to ``ayah`` and is not part of the gloss;
the gloss is the item's printed text after it, verbatim — connective and quoted phrase
included. ``phrase`` repeats the first quoted words (﴿…﴾, (…) or "…") and is used for
alignment. An item that names several ayahs gives one gloss row for every listed ayah in which
the phrase occurs (the same text). Continuation lines (verse, further explanation) belong to
the open item; "* * *" lines are decorative separators (rule ``separator-lines-dropped``).

Alignment: the phrase is normalised (judhur_arabic.normalize) and matched as a contiguous run
of words of the verse, comparing match keys, then the consonant skeleton, then allowing a
leading clitic on the Quran word. When the printed ayah has no match, ayahs ±1…±3 of the same
surah are tried; a hit there re-keys the gloss to that ayah and is listed in the report.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from judhur_arabic import normalize, skeleton

from .registry import WorkSpec
from .shamela import ARABIC_DIGITS, Counters, Line, TocEntry, assemble

_NUMBERED = re.compile(
    r"^\s*([\u0660-\u06690-9]{1,3}(?:\s*(?:\u0648|\u060c|,|-|\u2013)\s*[\u0660-\u06690-9]{1,3})*)\s*[-\u2013]\s*(.*)$",
    re.S,
)
_RANGE = re.compile(r"([\u0660-\u06690-9]{1,3})\s*[-\u2013]\s*([\u0660-\u06690-9]{1,3})")
_NUMBERS = re.compile(r"[\u0660-\u06690-9]{1,3}")
_PHRASE = re.compile(r"\ufd3f([^\ufd3e]+)\ufd3e|\(([^()]+)\)|\"([^\"]+)\"")
_SEPARATOR = re.compile(r"^[\s*]+$")
_NON_LETTER = re.compile(r"[^\u0621-\u064a\u064b-\u065f\u0670\u0671\s]")


def _ayah_list(prefix: str) -> list[int]:
    """«٤١» → [41]; «٣٠ و٣١» / «١٦، ١٨، ٢١، ٣٠» → listed ayahs; «١٧-١٨» → the inclusive range."""
    out: list[int] = []
    for part in re.split(r"\s*(?:\u0648|\u060c|,)\s*", prefix.strip()):
        r = _RANGE.fullmatch(part.strip())
        if r:
            lo, hi = (int(x.translate(ARABIC_DIGITS)) for x in r.groups())
            out.extend(range(lo, hi + 1) if lo <= hi else [lo, hi])
        else:
            out.extend(int(x.translate(ARABIC_DIGITS)) for x in _NUMBERS.findall(part))
    return out


@dataclass
class _Item:
    surah: int
    ayahs: list[int]  # printed ayah number(s); empty before the first numbered item of a surah
    phrase: str
    lines: list[Line] = field(default_factory=list)
    first_text: str = ""
    source_ref: str = ""
    numbered: bool = False


def _surah_number(title: str, surahs: list[dict], aliases: dict[str, int]) -> int | None:
    name = title.strip()
    if name.startswith("سورة"):
        name = name[len("سورة") :].strip()
    if name in aliases:
        return int(aliases[name])
    target = normalize(name)
    for s in surahs:
        if normalize(s["name_ar"]) == target:
            return int(s["number"])
    return None


def parse_items(
    spec: WorkSpec, lines: list[Line], toc: dict[int, TocEntry], surahs: list[dict], counters: Counters
) -> list[_Item]:
    aliases = spec.cfg.get("surah_aliases") or {}
    sid = spec.cfg["shamela_id"]
    items: list[_Item] = []
    surah: int | None = None
    last_surah = 0
    last_ayahs: list[int] = []
    current: _Item | None = None
    for n, line in enumerate(lines):
        sl = line.span_line
        lead = line.leading_span
        # "سورة محمد ﷺ": a surah heading followed by an honorific outside the TOC span.
        if (
            sl is None
            and lead is not None
            and lead.toc_id in toc
            and toc[lead.toc_id].title.strip().startswith("سورة")
            and len(line.text.strip()) - len(lead.text.strip()) <= 3
        ):
            sl = lead
        if sl is not None and sl.toc_id in toc:
            title = toc[sl.toc_id].title
            current = None
            if title.strip().startswith("سورة"):
                num = _surah_number(title, surahs, aliases)
                if num is None or num <= last_surah:
                    raise ValueError(f"{spec.id}: cannot place surah heading {title!r} (after {last_surah})")
                surah, last_surah, last_ayahs = num, num, []
            else:
                surah = None
            continue
        if surah is None:
            counters.add("front-matter-skipped:chars", len(line.text))
            continue
        if _SEPARATOR.match(line.text) and "*" in line.text:
            counters.add("separator-lines-dropped")
            continue
        text = line.text
        nm = _NUMBERED.match(text)
        if nm:
            ayahs = _ayah_list(nm.group(1))
            rest = nm.group(2)
            counters.add("gharib-item-number")
            if len(ayahs) > 1:
                counters.add("gharib-item-number:range")
        elif text.lstrip().startswith("\ufd3f"):
            ayahs = list(last_ayahs[:1])
            rest = text.lstrip()
        else:
            ayahs = []
            rest = ""
        if nm or rest:
            pm = _PHRASE.search(rest)
            phrase = next((g for g in pm.groups() if g), "").strip() if pm else ""
            if not phrase:
                counters.add("gharib:items-without-quoted-phrase")
            if nm:
                last_ayahs = ayahs
            current = _Item(
                surah,
                ayahs,
                phrase,
                [line],
                rest,
                f"shamela:{sid}:page-{line.page.shamela_page_id}:line-{n}",
                bool(nm),
            )
            items.append(current)
            continue
        if current is not None:
            current.lines.append(line)
        else:
            counters.add("front-matter-skipped:chars", len(line.text))
    return items


_CLITICS = ("و", "ف", "ب", "ل", "ك", "ال", "وال", "فال", "بال", "كال", "لل", "ول", "فل", "وب", "فب")


class WordIndex:
    """Words of each verse, with three comparison tiers: match keys, consonant skeleton, and a
    leading clitic on the Quran word (phrase "بَكَّة" ↔ word "بِبَكَّةَ")."""

    def __init__(self, words: list[dict]) -> None:
        self.by_verse: dict[tuple[int, int], list[dict]] = {}
        self.by_token: dict[str, set[tuple[int, int]]] = {}
        for w in words:
            v = (int(w["surah"]), int(w["ayah"]))
            self.by_verse.setdefault(v, []).append(w)
            for k in (w.get("norm"), w.get("norm_uthmani")):
                if k:
                    self.by_token.setdefault(k, set()).add(v)
        for ws in self.by_verse.values():
            ws.sort(key=lambda w: int(str(w["location"]).split(":")[2]))
        self._skel: dict[str, str] = {}

    def _wskel(self, w: dict) -> str:
        loc = w["location"]
        if loc not in self._skel:
            self._skel[loc] = skeleton(w.get("text_imlaei") or w.get("norm") or "")
        return self._skel[loc]

    def _eq(self, tier: int, t: str, w: dict) -> bool:
        if tier == 0:
            return t in (w.get("norm"), w.get("norm_uthmani"))
        if tier == 1:
            return bool(t) and self._wskel(w) == skeleton(t)
        norm = w.get("norm") or ""
        return t == norm or any(norm == c + t for c in _CLITICS)

    def find(self, surah: int, ayah: int, tokens: list[str], loose: bool = False) -> list[str]:
        """Word locations of the phrase in the verse. Tiers 0–2 compare token by token; with
        ``loose`` (used only for the printed ayah, never to re-key) two more tiers apply:
        3) the phrase and a run of words compared as one string without alifs ("يا أيها" ↔
        "يَٰٓأَيُّهَا", "ها أنتم" ↔ "هَٰٓأَنتُمۡ"); 4) a one-word phrase cited in dictionary form
        ("الصَّيِّبُ" ↔ "كَصَيِّبٖ", "الفوم" ↔ "وَفُومِهَا"): article and clitics dropped, at most
        three trailing letters (pronoun, tanwin alif) allowed on the Quran word."""
        ws = self.by_verse.get((surah, ayah), [])
        if not tokens or not ws:
            return []
        if len(tokens) <= len(ws):
            for tier in (0, 1, 2):
                for i in range(len(ws) - len(tokens) + 1):
                    if all(self._eq(tier, t, ws[i + j]) for j, t in enumerate(tokens)):
                        return [ws[i + j]["location"] for j in range(len(tokens))]
        if not loose:
            return []
        target = "".join(tokens).replace("\u0627", "")
        for i in range(len(ws)):
            joined = ""
            for j in range(i, min(len(ws), i + len(tokens) + 2)):
                joined += (ws[j].get("norm") or "").replace("\u0627", "")
                if joined == target:
                    return [ws[k]["location"] for k in range(i, j + 1)]
                if len(joined) > len(target):
                    break
        if len(tokens) == 1:
            stem = tokens[0]
            for c in ("\u0648", "\u0641"):  # و / ف before the article: "والفوم"
                if stem.startswith(c + "\u0627\u0644") and len(stem) > 4:
                    stem = stem[1:]
            if stem.startswith("\u0627\u0644") and len(stem) > 3:
                stem = stem[2:]
            stem = stem.replace("\u0627", "")
            if len(stem) >= 2:
                for w in ws:
                    core = w.get("norm") or ""
                    for c in sorted(_CLITICS, key=len, reverse=True):
                        if core.startswith(c) and len(core) - len(c) >= len(stem):
                            core = core[len(c) :]
                            break
                    core = core.replace("\u0627", "")
                    extra = len(core) - len(stem)
                    if core.startswith(stem) and 0 <= extra <= (3 if len(stem) >= 3 else 1):
                        return [w["location"]]
        return []

    def find_anywhere(self, tokens: list[str]) -> tuple[int, int] | None:
        """First verse (in mushaf order) that contains the phrase, by the strict tier only."""
        if not tokens:
            return None
        cands = self.by_token.get(tokens[0], set())
        for v in sorted(cands):
            ws = self.by_verse[v]
            for i in range(len(ws) - len(tokens) + 1):
                if all(self._eq(0, t, ws[i + j]) for j, t in enumerate(tokens)):
                    return v
        return None


def phrase_tokens(phrase: str) -> list[str]:
    return normalize(_NON_LETTER.sub(" ", phrase)).split()


def build_glosses(
    spec: WorkSpec,
    items: list[_Item],
    index: WordIndex,
    verse_counts: dict[int, int],
    counters: Counters,
    id_base: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    rekeyed: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    # A line that opens with ﴿…﴾ but has no ayah number, does not occur in its ayah (±3) and
    # does occur elsewhere in the Quran is a verse CITED inside the previous gloss, not a new
    # gloss item: it is folded back into the previous item, verbatim.
    kept: list[_Item] = []
    citations: list[dict[str, Any]] = []
    count = verse_counts.get
    for it in items:
        if kept and not it.numbered and it.ayahs:
            toks = phrase_tokens(it.phrase)
            a0 = it.ayahs[0]
            near = any(
                index.find(it.surah, a0 + d, toks)
                for d in (0, 1, -1, 2, -2, 3, -3)
                if 1 <= a0 + d <= count(it.surah, 0)
            )
            elsewhere = None if near else index.find_anywhere(toks)
            if not near and elsewhere is not None:
                kept[-1].lines.extend(it.lines)
                counters.add("gharib:cited-verse-kept-in-previous-gloss")
                citations.append(
                    {
                        "surah": it.surah,
                        "ayah": a0,
                        "phrase": it.phrase,
                        "cited_verse": f"{elsewhere[0]}:{elsewhere[1]}",
                    }
                )
                continue
        kept.append(it)
    items = kept
    next_id = id_base
    for it in items:
        tokens = phrase_tokens(it.phrase)
        placed: list[tuple[int, list[str]]] = []  # (ayah, word locations)
        for a in it.ayahs:
            locs = index.find(it.surah, a, tokens, loose=True)
            if locs:
                placed.append((a, locs))
        if not placed and "*" in it.phrase and it.ayahs:
            # A phrase quoted across consecutive ayahs ("… رَجِيمٍ * إِلا مَنِ …"): each part is
            # aligned in its own ayah, starting from the first printed one.
            a = it.ayahs[0]
            for part in it.phrase.split("*"):
                toks = phrase_tokens(part)
                if not toks:
                    continue
                for cand in (a, a + 1):
                    locs = index.find(it.surah, cand, toks, loose=True)
                    if locs:
                        placed.append((cand, locs))
                        a = cand + 1
                        break
            if placed:
                counters.add("gharib:phrase-across-ayahs")
        if not placed:
            first = it.ayahs[0] if it.ayahs else None
            tried = (
                [first + d for d in (1, -1, 2, -2, 3, -3)]
                if first is not None
                else list(range(1, count(it.surah, 0) + 1))
            )
            for a in tried:
                if 1 <= a <= count(it.surah, 0):
                    found = index.find(it.surah, a, tokens)
                    if found:
                        rekeyed.append(
                            {"surah": it.surah, "printed_ayah": first, "ayah": a, "phrase": it.phrase}
                        )
                        placed = [(a, found)]
                        break
        if not placed:
            if not it.ayahs:
                counters.add("gharib:items-without-ayah")
                unmatched.append(
                    {"surah": it.surah, "ayah": None, "phrase": it.phrase, "source_ref": it.source_ref}
                )
                continue
            unmatched.append(
                {"surah": it.surah, "ayah": it.ayahs[0], "phrase": it.phrase, "source_ref": it.source_ref}
            )
            placed = [(it.ayahs[0], [])]
        gloss, ref = assemble(it.lines, counters, it.first_text)
        for a, locs in placed:
            next_id += 1
            rows.append(
                {
                    "id": next_id,
                    "work_id": spec.id,
                    "surah": it.surah,
                    "ayah": a,
                    "phrase": it.phrase,
                    "gloss": gloss,
                    "word_locations": locs,
                    "page_ref": ref,
                    "source_ref": it.source_ref,
                }
            )
    report = {
        "items": len(items),
        "glosses": len(rows),
        "aligned": sum(1 for r in rows if r["word_locations"]),
        "unaligned": len(unmatched),
        "rekeyed_to_neighbouring_ayah": rekeyed,
        "cited_verses_folded_into_previous_gloss": citations,
        "unaligned_items": unmatched,
    }
    return rows, report
