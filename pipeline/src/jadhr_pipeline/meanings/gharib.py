"""al-Muyassar fī Gharīb al-Qurʾān al-Karīm (King Fahd Complex): a contextual Arabic meaning for Quranic words,
read from the Complex's own Word file and aligned to our word locations ``surah:ayah:word``.

The file (registry ``data/gharib.yaml``) runs sūra by sūra. A heading paragraph «سورة البقرة» opens a sūra; a
verse paragraph opens with the verse number in brackets and holds one entry per line, each the Quranic phrase
in ﴿…﴾ (Uthmani script, KFGQPC encoding) followed by a colon and its meaning:

    (2) ﴿ٱلۡكِتَٰبُ﴾: القرآنُ.
    ﴿لَا رَيۡبَ فِيهِ﴾: لا شكَّ أنَّه مِنْ عندِ اللهِ.

Every transformation is a registry cleaning rule and is counted in the report:

* ``verse-number`` — «(2)» (or «(1، 2)» for an entry that spans two verses) moves to ``ayah``/``ayah_label``.
* ``phrase-brackets`` — the ornate brackets ﴿﴾ and the colon after them are not part of ``phrase_ar`` or
  ``meaning_ar``; the phrase is the text inside the brackets, the meaning the text after the colon, verbatim
  (ends trimmed). Thirteen entries have no colon after the phrase; their meaning starts after the bracket.
* ``entries-on-one-line`` — where the typist ran two entries into one line («… على طاعتي ﴿فَأَغۡرَيۡنَا﴾:
  فأَلْقَيْنا.»), a bracketed phrase followed by a colon starts a new entry — unless a colon stands right
  before it («وقيل: ﴿بِهِۦ﴾: أي: باللهِ» explains a word of the same entry and stays in it).
* ``continuation-paragraph`` — a paragraph that opens with neither «سورة» nor a verse number nor ﴿ continues
  the previous entry's meaning (the typist broke the paragraph at a bracketed note: «خَمْراً» ¶ «(وهذا امتنانٌ
  قبلَ التحريمِ) .»); it is joined with one space. Its further lines are entries of the same verse.

Alignment of a phrase to word locations (``match_method``), on the display tokens of the KFGQPC text we show
(``tokens.jsonl``) and their words (``word_from``–``word_to``):

* ``exact`` (confidence exact) — every word of the phrase equals a contiguous run of tokens of the verse,
  pause marks aside (the file writes «رَيۡبَ», our text «رَيۡبَۛ»);
* ``letters`` (high) — equal after removing every mark and folding alef/hamza/yā/tā marbūṭa variants: a word
  quoted on its own loses the assimilation shadda it carries in the verse («مِن» ↔ «مِّن»);
* ``clitic`` (high) — the Quran word carries a proclitic the phrase leaves out («ٱلۡفُرۡقَانَ» ↔ «وَٱلۡفُرۡقَانَ»);
* ``skeleton`` (medium) — equal consonantal skeletons (long vowels and hamza dropped: «فَٱدَّٰرَٰٔتُمۡ»);
* ``spacing`` (high) — the same letters with the words joined or split differently («أَوَ لَمۡ» ↔ «أَوَلَمۡ»,
  «كَمَثَلِءَادَمَ»).

A phrase is looked for in the verse it is filed under (both verses for «(1، 2)», part by part where ۞ marks
a verse boundary inside it, and over the end of the verse into the next one when it starts in the filed verse
and runs on); a phrase that occurs more than once in the verse takes the first place after the previous entry
of the same verse (the file follows the order of the words), and is marked so with confidence ``medium``
(``occurrences_in_verse``). Only when the filed verse has no match are the verses up to three before and after
tried, with the two strict tiers: a hit there is kept with ``rekeyed_from`` (the filed verse) and confidence
``medium``. Nothing else is guessed: an entry with no match keeps its filed verse and no word locations.

``mushaf_page`` is the Madinah mushaf page of the first aligned verse, from our verses table; the Complex prints
this book in the margin of that page. ``locator`` points into the Word file (paragraph and line, 1-based).
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize, skeleton

STATUS = "extracted"
_SURAH_HEAD = re.compile(r"^\s*سورة\s+(\S.*?)\s*$")
_NUMBER = re.compile(r"^\(\s*([0-9٠-٩]{1,3}(?:\s*[،,]\s*[0-9٠-٩]{1,3})*)\s*\)\s*")
_OPEN, _CLOSE = chr(0xFD3F), chr(0xFD3E)  # ﴿ ﴾
_PHRASE = re.compile(f"{_OPEN}([^{_CLOSE}]*){_CLOSE}")
_COLON = re.compile(r"\s*:\s*")
_HONORIFIC = re.compile(r"\s*\(?" + chr(0xFDFA) + r"\)?\s*$")  # «(ﷺ)» after a sūra name
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
# Pause marks, rub el-hizb and the sajda sign: in our display tokens, not in the file's phrases.
_PAUSE = re.compile("[" + chr(0x06D6) + "-" + chr(0x06DC) + chr(0x06DE) + chr(0x06E9) + chr(0x0640) + "]")
# A meaning that names the occurrence it explains: «(الثانية) : تَظْهَرْ لكم…» (5:101 has «تُبۡدَ لَكُمۡ» twice)
_ORDINALS = {"الأولى": 1, "الثانية": 2, "الثالثة": 3}
_WHICH = re.compile(r"^\((الأولى|الثانية|الثالثة)\)")
_RUB = chr(0x06DE)  # ۞ inside a phrase separates two verses («ٱللَّٰتَ وَٱلۡعُزَّىٰ ۞ وَمَنَوٰةَ»)
CLITICS = (
    "و",
    "ف",
    "ب",
    "ل",
    "ك",
    "س",
    "وب",
    "ول",
    "فب",
    "فل",
    "وك",
    "فك",
    "ال",
    "وال",
    "فال",
    "بال",
    "كال",
    "لل",
)
TIERS = ("exact", "letters", "clitic", "skeleton", "spacing")
CONFIDENCE = {"exact": "exact", "letters": "high", "clitic": "high", "skeleton": "medium", "spacing": "high"}
_KEY = {"exact": 0, "letters": 1, "skeleton": 2}
# Characters of a phrase that are not Arabic letters or marks (a stray «\», a full stop typed inside ﴿…﴾) are
# ignored for matching; phrase_ar keeps them as written.
_NOT_ARABIC = re.compile("[^\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]")


@dataclass
class Item:
    seq: int
    surah: int
    ayahs: list[int]
    label: str
    phrase: str
    meaning: str
    paragraph: int  # 0-based index of the docx paragraph where the entry starts
    line: int  # 0-based line inside that paragraph
    notes: list[str] = field(default_factory=list)


class ParseError(ValueError):
    pass


def _ayahs(label: str) -> list[int]:
    return sorted({int(x.translate(_DIGITS)) for x in re.split(r"\s*[،,]\s*", label.strip()) if x})


def _entries(line: str) -> list[tuple[int, str, str, list[str]]]:
    """(offset of ﴿, phrase, meaning, notes) for every entry on one line of a verse paragraph."""
    starts: list[re.Match[str]] = []
    for m in _PHRASE.finditer(line):
        before = line[: m.start()].rstrip()
        # the line's first phrase, or a later one followed by a colon and not introduced by one
        if not before or (_COLON.match(line, m.end()) and not before.endswith(":")):
            starts.append(m)
    out = []
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(line)
        rest = line[m.end() : end]
        notes: list[str] = []
        c = _COLON.match(rest)
        if c:
            meaning = rest[c.end() :]
        else:
            meaning = rest
            notes.append("no-colon-after-phrase")
        if i > 0:
            notes.append("entry-on-same-line")
        out.append((m.start(), m.group(1).strip(), meaning.strip(), notes))
    return out


def parse(paras: list[str], surahs: list[dict[str, Any]], counters: Counter[str]) -> list[Item]:
    """The file's paragraphs → entries, in file order."""
    names = [normalize(s["name_ar"]) for s in sorted(surahs, key=lambda s: int(s["number"]))]
    items: list[Item] = []
    surah = 0
    ayahs: list[int] = []
    label = ""
    for pi, text in enumerate(paras):
        if not text.strip():
            counters["empty-paragraph"] += 1
            continue
        head = _SURAH_HEAD.match(text)
        if head and _OPEN not in text:
            surah += 1
            got = normalize(_HONORIFIC.sub("", head.group(1)))  # «سورة محمد (ﷺ)»
            if surah > len(names) or got != names[surah - 1]:
                raise ParseError(
                    f"¶{pi + 1}: heading {head.group(1)!r} is not sūra {surah} {names[surah - 1]!r}"
                )
            counters["surah-heading"] += 1
            ayahs, label = [], ""
            continue
        if not surah:
            raise ParseError(f"¶{pi + 1}: text before the first sūra heading")
        lines = text.split("\n")
        num = _NUMBER.match(lines[0])
        first = 0
        if num:
            label = num.group(1)
            ayahs = _ayahs(label)
            counters["verse-number"] += 1
            if len(ayahs) > 1:
                counters["verse-number:two-verses"] += 1
            lines[0] = lines[0][num.end() :]
        elif not lines[0].lstrip().startswith(_OPEN):
            if not items:
                raise ParseError(f"¶{pi + 1}: continuation before any entry")
            items[-1].meaning = items[-1].meaning + " " + lines[0].strip()
            items[-1].notes.append("continuation-paragraph")
            counters["continuation-paragraph"] += 1
            first = 1
        if not ayahs:
            raise ParseError(f"¶{pi + 1}: entry before any verse number")
        for li in range(first, len(lines)):
            line = lines[li]
            if not line.strip():
                continue
            ents = _entries(line)
            if not ents or line[: ents[0][0]].strip():
                raise ParseError(
                    f"¶{pi + 1} line {li + 1}: does not open with a bracketed phrase: {line[:60]!r}"
                )
            for _, phrase, meaning, notes in ents:
                counters["phrase-brackets"] += 1
                if "entry-on-same-line" in notes:
                    counters["entries-on-one-line"] += 1
                if "no-colon-after-phrase" in notes:
                    counters["phrase-brackets:no-colon"] += 1
                items.append(Item(len(items) + 1, surah, list(ayahs), label, phrase, meaning, pi, li, notes))
    if surah != len(names):
        raise ParseError(f"{surah} sūra headings, expected {len(names)}")
    return items


# -- alignment -------------------------------------------------------------------------------------------------
def _k0(t: str) -> str:
    return _PAUSE.sub("", unicodedata.normalize("NFC", t)).strip()


@dataclass
class _Tok:
    keys: tuple[str, str, str]  # exact, letters, skeleton
    verse: str
    words: tuple[int, int]


def _keys(t: str) -> tuple[str, str, str]:
    return _k0(t), normalize(t), skeleton(t)


class VerseTokens:
    """The display tokens of every verse, with the three comparison keys and the words each token covers."""

    def __init__(self, verses: list[dict[str, Any]], tokens: list[dict[str, Any]]) -> None:
        by_id = {int(v["id"]): v for v in verses}
        self.page = {v["key"]: v["page"] for v in verses}
        self.count: dict[int, int] = Counter(int(v["surah"]) for v in verses)
        self.by_verse: dict[str, list[_Tok]] = {v["key"]: [] for v in verses}
        for t in sorted(tokens, key=lambda t: (int(t["verse_id"]), int(t["position"]))):
            v = by_id[int(t["verse_id"])]
            self.by_verse[v["key"]].append(
                _Tok(_keys(t["text"]), v["key"], (int(t["word_from"]), int(t["word_to"])))
            )

    def stream(self, surah: int, ayahs: list[int]) -> list[_Tok]:
        out: list[_Tok] = []
        for a in ayahs:
            out += self.by_verse.get(f"{surah}:{a}", [])
        return out

    def has(self, surah: int, ayah: int) -> bool:
        return 1 <= ayah <= self.count.get(surah, 0)


def _eq(tier: int, p: tuple[str, str, str], t: _Tok) -> bool:
    name = TIERS[tier]
    if name == "clitic":
        return p[1] == t.keys[1] or any(t.keys[1] == c + p[1] for c in CLITICS)
    k = _KEY[name]
    return bool(p[k]) and p[k] == t.keys[k]


def _hits(stream: list[_Tok], ptoks: list[tuple[str, str, str]], tier: int) -> list[tuple[int, int]]:
    """(start, number of tokens) of every place the phrase matches in the stream at this tier."""
    n = len(ptoks)
    if tier < 4:
        return [
            (i, n)
            for i in range(len(stream) - n + 1)
            if all(_eq(tier, ptoks[j], stream[i + j]) for j in range(n))
        ]
    # spacing: the file joins or splits words differently («كَمَثَلِءَادَمَ», «أَوَ لَمۡ» for «أَوَلَمۡ»)
    target = "".join(p[1] for p in ptoks).replace(" ", "")
    out = []
    for i in range(len(stream)):
        joined = ""
        for j in range(i, len(stream)):
            joined += stream[j].keys[1].replace(" ", "")
            if joined == target:
                out.append((i, j - i + 1))
                break
            if not target.startswith(joined):
                break
    return out


def _locations(toks: list[_Tok]) -> tuple[list[str], list[str]]:
    locs: list[str] = []
    keys: list[str] = []
    for t in toks:
        if t.verse not in keys:
            keys.append(t.verse)
        for w in range(t.words[0], t.words[1] + 1):
            loc = f"{t.verse}:{w}"
            if loc not in locs:
                locs.append(loc)
    return keys, locs


@dataclass
class Placement:
    verse_keys: list[str]
    locations: list[str]
    method: str | None
    confidence: str | None
    occurrences: int = 0
    rekeyed_from: str | None = None
    notes: list[str] = field(default_factory=list)


def phrase_tokens(phrase: str) -> list[list[tuple[str, str, str]]]:
    """The phrase's words as comparison keys, cut into parts at ۞ (a verse boundary inside the phrase)."""
    parts: list[list[tuple[str, str, str]]] = [[]]
    for w in phrase.split():
        if _RUB in w and not normalize(w):
            parts.append([])
            continue
        k = _keys(_NOT_ARABIC.sub("", w))
        if k[1]:
            parts[-1].append(k)
    return [p for p in parts if p]


class Aligner:
    def __init__(self, vt: VerseTokens) -> None:
        self.vt = vt
        self.cursor: dict[tuple[int, str], int] = {}  # (surah, printed label) → stream index after last match

    def _search(
        self,
        surah: int,
        ayahs: list[int],
        ptoks: list[tuple[str, str, str]],
        tiers: range,
        cursor_key: Any,
        nth: int | None = None,
    ) -> tuple[list[_Tok], int, int] | None:
        stream = self.vt.stream(surah, ayahs)
        for tier in tiers:
            hits = _hits(stream, ptoks, tier)
            if hits:
                cur = self.cursor.get(cursor_key, 0) if cursor_key is not None else 0
                if nth is not None and nth <= len(hits):
                    start, n = hits[nth - 1]
                else:
                    start, n = next((h for h in hits if h[0] >= cur), hits[0])
                if cursor_key is not None:
                    self.cursor[cursor_key] = start + n
                return stream[start : start + n], tier, len(hits)
        return None

    def place(self, it: Item) -> Placement:
        parts = phrase_tokens(it.phrase)
        if not parts:
            return Placement([], [], None, None, notes=["empty-phrase"])
        ckey = (it.surah, it.label)
        if len(parts) == 1:
            ptoks = parts[0]
            which = _WHICH.match(it.meaning)
            nth = _ORDINALS[which.group(1)] if which else None
            got = self._search(it.surah, it.ayahs, ptoks, range(5), ckey, nth)
            extra: list[str] = []
            if got is None and self.vt.has(it.surah, it.ayahs[-1] + 1):
                # the phrase runs over the end of the verse into the next one: it must start in the filed
                # verse and end in the next (a phrase wholly in the next verse is a filing slip, below)
                run = self._search(it.surah, [*it.ayahs, it.ayahs[-1] + 1], ptoks, range(3), None)
                filed_keys = {f"{it.surah}:{a}" for a in it.ayahs}
                if run is not None and run[0][0].verse in filed_keys and run[0][-1].verse not in filed_keys:
                    got = run
                    extra = ["runs-into-next-verse"]
            if got is not None:
                toks, tier, occ = got
                keys, locs = _locations(toks)
                conf = CONFIDENCE[TIERS[tier]]
                notes = list(extra)
                if occ > 1 and nth is not None and nth <= occ:
                    notes.append("several-places-in-verse:named-in-meaning")
                elif occ > 1:
                    notes.append("several-places-in-verse:order-chosen")
                    conf = "medium"
                return Placement(keys, locs, TIERS[tier], conf, occ, notes=notes)
        else:
            # «ٱللَّٰتَ وَٱلۡعُزَّىٰ ۞ وَمَنَوٰةَ»: each part in its own verse, in order
            toks_all: list[_Tok] = []
            worst = 0
            a = it.ayahs[0]
            for part in parts:
                got = None
                for cand in (a, a + 1):
                    got = self._search(it.surah, [cand], part, range(3), None)
                    if got is not None:
                        a = cand + 1
                        break
                if got is None:
                    toks_all = []
                    break
                toks_all += got[0]
                worst = max(worst, got[1])
            if toks_all:
                keys, locs = _locations(toks_all)
                return Placement(
                    keys, locs, TIERS[worst], CONFIDENCE[TIERS[worst]], 1, notes=["phrase-across-verses"]
                )
        # not in the filed verse: the neighbouring verses, strict tiers only, and only when unique there
        flat = [k for p in parts for k in p]
        filed = f"{it.surah}:{it.ayahs[0]}"
        for d in (1, -1, 2, -2, 3, -3):
            a = it.ayahs[0] + d
            if not self.vt.has(it.surah, a):
                continue
            got = self._search(it.surah, [a], flat, range(2), None)
            if got is not None:
                toks, tier, occ = got
                keys, locs = _locations(toks)
                return Placement(
                    keys, locs, TIERS[tier], "medium", occ, rekeyed_from=filed, notes=["rekeyed"]
                )
        return Placement([], [], None, None, notes=["unaligned"])


def build_rows(
    work: dict[str, Any], items: list[Item], vt: VerseTokens, file_name: str
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    al = Aligner(vt)
    rows: list[dict[str, Any]] = []
    for it in items:
        pl = al.place(it)
        keys = pl.verse_keys or [f"{it.surah}:{a}" for a in it.ayahs if vt.has(it.surah, a)]
        rows.append(
            {
                "id": f"{work['id']}:{it.seq:05d}",
                "work_id": work["id"],
                "seq": it.seq,
                "surah": it.surah,
                "ayah": int(keys[0].split(":")[1]) if keys else it.ayahs[0],
                "ayah_label": it.label,
                "verse_keys": keys,
                "word_locations": pl.locations,
                "phrase_ar": it.phrase,
                "meaning_ar": it.meaning,
                "locator": f"{file_name} ¶{it.paragraph + 1} l.{it.line + 1}",
                "paragraph": it.paragraph + 1,
                "line": it.line + 1,
                "mushaf_page": vt.page.get(keys[0]) if keys else None,
                "match_method": pl.method,
                "match_confidence": pl.confidence,
                "occurrences_in_verse": pl.occurrences,
                "rekeyed_from": pl.rekeyed_from,
                "notes": [*it.notes, *pl.notes],
                "status": STATUS,
            }
        )
    aligned = [r for r in rows if r["word_locations"]]
    report = {
        "entries": len(rows),
        "aligned": len(aligned),
        "unaligned": len(rows) - len(aligned),
        "by_method": dict(Counter(r["match_method"] or "unaligned" for r in rows).most_common()),
        "by_confidence": dict(Counter(r["match_confidence"] or "none" for r in rows).most_common()),
        "several_places_in_verse": {
            "order_chosen": sum(1 for r in rows if "several-places-in-verse:order-chosen" in r["notes"]),
            "named_in_meaning": sum(
                1 for r in rows if "several-places-in-verse:named-in-meaning" in r["notes"]
            ),
        },
        "runs_into_next_verse": sum(1 for r in rows if "runs-into-next-verse" in r["notes"]),
        "phrase_across_verses": sum(1 for r in rows if "phrase-across-verses" in r["notes"]),
        "rekeyed": [
            {"id": r["id"], "phrase": r["phrase_ar"], "filed": r["rekeyed_from"], "aligned": r["verse_keys"]}
            for r in rows
            if r["rekeyed_from"]
        ],
        "unaligned_entries": [
            {
                "id": r["id"],
                "phrase": r["phrase_ar"],
                "filed": f"{r['surah']}:{r['ayah_label']}",
                "locator": r["locator"],
            }
            for r in rows
            if not r["word_locations"]
        ],
    }
    return rows, report
