"""Resolve the Quran quotations a classical work cites to verse keys.

The works quote the Quran from memory and in their own spelling, mark quotes inconsistently (OpenITI
``@QB@`` tags, parentheses, double quotes, or nothing after «قوله تعالى»), and name the sūra loosely («في
آل عمران»، «وفيها»، «في حم المؤمن»). Matching is therefore done on the consonantal skeleton of each word
(``jadhr_arabic.skeleton``: marks, long-vowel letters and hamza dropped), which makes «يبدؤ» meet «يبدأ»
and «الصلوة» meet «الصلاة», against one token stream per sūra built from the KFGQPC imlāʾī text, so a
quotation that runs across a verse boundary resolves to every verse it covers.

A quotation resolves (``method``) only when
* ``text`` — the longest run of its words found contiguously in the Quran stands in one place, and covers
  enough of the quotation (``_accept``: stricter for bare brackets, strictest after «قوله تعالى»);
* ``text+surah`` — that run, or a run of two words or more, stands in one place within the sūra the author
  names («في آل عمران», «وفيها» = the sūra of the previous quotation);
* ``text-coverage`` — the author's wording parts from the verse in a word or two («ماله» for «ما له»), and
  one of the places of the longest run holds three quarters of the quoted words.
Everything else is kept with ``status`` ``ambiguous`` (with its candidate verses: «ولا هم يحزنون» stands in
thirteen) or ``unresolved`` — never guessed. A sūra named with «سورة X» and no quotation after it is kept
as a sūra-level citation (``kind`` ``surah``).
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from jadhr_arabic import normalize, skeleton

_WORD_CHARS = "".join(f"{chr(a)}-{chr(b)}" for a, b in ((0x621, 0x63A), (0x640, 0x65F), (0x670, 0x671)))
_WORD = re.compile(f"[{_WORD_CHARS}]+")  # Arabic letters with any marks and tatweel

# Classical and alternative names under which these works cite a sūra. Names only — no content. The
# canonical names come from the dataset's surahs table; these are the other names the four works use.
SURAH_ALIASES: dict[int, tuple[str, ...]] = {
    1: ("الحمد", "أم الكتاب", "فاتحة الكتاب"),
    7: ("المص",),
    9: ("براءة", "التوبة"),
    13: ("الرعد",),
    16: ("النحل",),
    17: ("بني إسرائيل", "سبحان"),
    20: ("طه",),
    23: ("المؤمنين", "المؤمنون", "قد أفلح"),
    26: ("طسم الشعراء",),
    27: ("طس", "النمل"),
    28: ("طسم القصص",),
    32: ("تنزيل السجدة", "الم تنزيل", "ألم تنزيل", "الم السجدة", "ألم السجدة", "السجدة", "المضاجع"),
    34: ("سبأ",),
    35: ("الملائكة", "فاطر"),
    36: ("يس", "يسين", "يس والقرآن"),
    38: ("ص",),
    40: ("حم المؤمن", "المؤمن", "غافر", "الطول"),
    41: ("حم السجدة", "فصلت", "السجدة حم"),
    42: ("حم عسق", "عسق", "الشورى"),
    43: ("حم الزخرف", "الزخرف"),
    44: ("حم الدخان", "الدخان"),
    45: ("الشريعة", "الجاثية"),
    46: ("الأحقاف",),
    47: ("القتال", "محمد صلى الله عليه وسلم"),
    50: ("ق",),
    54: ("اقتربت الساعة", "اقتربت", "القمر"),
    58: ("المجادلة", "قد سمع"),
    60: ("الممتحنة", "الامتحان"),
    61: ("الصف",),
    63: ("المنافقين", "المنافقون"),
    66: ("التحريم", "لم تحرم"),
    67: ("تبارك", "الملك"),
    68: ("ن والقلم", "ن", "القلم"),
    70: ("سأل سائل", "المعارج"),
    73: ("المزمل",),
    74: ("المدثر",),
    75: ("القيامة", "لا أقسم بيوم القيامة"),
    76: ("هل أتى", "الدهر", "الإنسان", "هل أتى على الإنسان"),
    77: ("المرسلات",),
    78: ("عم يتساءلون", "النبأ", "عم"),
    79: ("النازعات",),
    81: ("التكوير", "إذا الشمس كورت", "كورت"),
    82: ("الانفطار", "انفطرت", "إذا السماء انفطرت"),
    83: ("المطففين", "ويل للمطففين", "التطفيف"),
    84: ("الانشقاق", "انشقت", "إذا السماء انشقت"),
    87: ("سبح", "سبح اسم ربك", "الأعلى"),
    88: ("الغاشية", "هل أتاك حديث الغاشية"),
    94: ("ألم نشرح", "الانشراح", "الشرح"),
    96: ("اقرأ", "العلق", "اقرأ باسم ربك"),
    97: ("القدر", "إنا أنزلناه"),
    98: ("لم يكن", "البينة"),
    99: ("إذا زلزلت", "الزلزلة"),
    102: ("ألهاكم", "التكاثر"),
    107: ("أرأيت", "الماعون"),
    109: ("قل يا أيها الكافرون", "الكافرون", "الكافرين"),
    110: ("إذا جاء نصر الله", "النصر"),
    111: ("تبت", "أبي لهب", "المسد"),
    112: ("الإخلاص", "قل هو الله أحد"),
}
# One-letter and very common names are trusted only right after «سورة».
_NEEDS_SURA_WORD = {
    "ص",
    "ق",
    "ن",
    "عم",
    "سبح",
    "تبارك",
    "طس",
    "اقرأ",
    "أرأيت",
    "الحمد",
    "الملك",
    "النصر",
    "القدر",
}


@lru_cache(maxsize=200_000)
def _skel(word: str) -> str:
    """Matching key of one word: its consonantal skeleton. (Also folding a leading «ف» or a final open taa
    was measured on the four works and resolved fewer quotations, so the key stays the plain skeleton.)"""
    return skeleton(word)


def words_with_spans(text: str) -> list[tuple[int, int, str]]:
    """Arabic words in ``text`` with their character spans; the skeleton is computed per word."""
    return [(m.start(), m.end(), _skel(m.group(0))) for m in _WORD.finditer(text)]


@dataclass
class Match:
    length: int  # contiguous skeleton words matched
    weight: int  # letters in the matched skeletons
    q_from: int  # first matched word (index into the quote's non-empty words)
    q_to: int
    candidates: list[tuple[str, ...]]  # verse-key tuples, one per distinct place it matches


@dataclass
class Citation:
    start: int  # span in the text the finder searched
    end: int
    kind: str  # quote | surah
    marked_by: str  # markup | brackets | dquotes | trigger | surah-name
    surah_hint: int | None = None
    verse_keys: list[str] = field(default_factory=list)
    status: str = "unresolved"  # resolved | ambiguous | unresolved | surah
    method: str | None = None  # text | text+surah
    score: float | None = None  # matched words / quoted words
    exact: float | None = None  # share of matched words equal after normalisation (not only skeleton)
    candidates: list[list[str]] = field(default_factory=list)
    hint_mismatch: bool = False

    def as_row(self, text: str, offset: int = 0) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "marked_by": self.marked_by,
            "quote": text[self.start : self.end] if self.kind == "quote" else None,
            "start": self.start - offset,
            "end": self.end - offset,
            "surah_hint": self.surah_hint,
            "verse_keys": self.verse_keys,
            "status": self.status,
            "method": self.method,
            "score": self.score,
            "exact": self.exact,
            "candidates": self.candidates[:12],
            "hint_mismatch": self.hint_mismatch,
        }


class QuranIndex:
    def __init__(self, verses: list[dict[str, Any]], surahs: list[dict[str, Any]]) -> None:
        self.stream: list[str | None] = []
        self.norm: list[str] = []
        self.vkey: list[str] = []
        self.surah_of: list[int] = []
        by_surah: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for v in verses:
            by_surah[int(v["surah"])].append(v)
        for s in sorted(by_surah):
            for v in sorted(by_surah[s], key=lambda x: int(x["ayah"])):
                for w in v["text_imlaei"].split():
                    sk = _skel(w)
                    if sk:
                        self.stream.append(sk)
                        self.norm.append(normalize(w))
                        self.vkey.append(v["key"])
                        self.surah_of.append(s)
            self.stream.append(None)  # no match runs across a sūra boundary
            self.norm.append("")
            self.vkey.append("")
            self.surah_of.append(0)
        self.idx3: dict[tuple[str, ...], list[int]] = defaultdict(list)
        self.idx2: dict[tuple[str, ...], list[int]] = defaultdict(list)
        n = len(self.stream)
        for p in range(n):
            a = self.stream[p]
            if a is None:
                continue
            if p + 1 < n and self.stream[p + 1] is not None:
                self.idx2[(a, self.stream[p + 1])].append(p)  # type: ignore[arg-type]
                if p + 2 < n and self.stream[p + 2] is not None:
                    self.idx3[(a, self.stream[p + 1], self.stream[p + 2])].append(p)  # type: ignore[arg-type]
        self.verse_words: dict[str, set[str]] = defaultdict(set)
        self.verse_keys_sk: dict[str, set[str]] = defaultdict(set)
        for k, w, sk in zip(self.vkey, self.norm, self.stream, strict=True):
            if k:
                self.verse_words[k].add(w)
                self.verse_keys_sk[k].add(sk)  # type: ignore[arg-type]
        self.surah_names = _surah_lexicon(surahs)
        self._needs_sura = {normalize_keep_length(x) for x in _NEEDS_SURA_WORD}
        self._surah_rx = re.compile(
            r"(?:(?P<sura>سورة|سوره)\s+|(?<![^\s(،:.؛\[])(?P<fi>في|وفي|فى)\s+)(?P<name>"
            + "|".join(re.escape(k) for k in sorted(self.surah_names, key=len, reverse=True))
            + r")(?![ء-ي])"
        )

    # -- matching ---------------------------------------------------------------------------------
    def best(self, sk: list[str], surah: int | None = None) -> Match | None:
        """The longest run of ``sk`` found contiguously in the Quran (only in ``surah`` when given)."""
        n = len(sk)
        if n >= 3 and surah is None:
            k, idx = 3, self.idx3
        elif n >= 2:
            k, idx = 2, self.idx2
        else:
            return None
        best_len = 0
        hits: list[tuple[int, int]] = []
        stream = self.stream
        for i in range(n - k + 1):
            for p in idx.get(tuple(sk[i : i + k]), ()):
                if surah is not None and self.surah_of[p] != surah:
                    continue
                if i > 0 and p > 0 and stream[p - 1] == sk[i - 1]:
                    continue  # not the start of a maximal run
                length = k
                while i + length < n and stream[p + length] == sk[i + length]:
                    length += 1
                if length > best_len:
                    best_len, hits = length, [(i, p)]
                elif length == best_len:
                    hits.append((i, p))
        if not hits:
            return None
        # prefer the earliest run in the quote when the same length occurs at two places in it
        q0 = min(i for i, _ in hits)
        hits = [(i, p) for i, p in hits if i == q0]
        cands: list[tuple[str, ...]] = []
        for _, p in hits:
            keys = tuple(dict.fromkeys(self.vkey[p : p + best_len]))
            if keys not in cands:
                cands.append(keys)
        weight = sum(len(x) for x in sk[q0 : q0 + best_len])
        return Match(best_len, weight, q0, q0 + best_len, cands)

    def resolve(self, text: str, start: int, end: int, hint: int | None, marked_by: str) -> Citation | None:
        """Resolve the quotation ``text[start:end]``. Returns None when a span that was not explicitly
        marked as Quran does not look like the Quran at all."""
        words = [(s, e, sk) for s, e, sk in words_with_spans(text[start:end]) if sk]
        sk = [w[2] for w in words]
        m = self.best(sk)
        explicit = marked_by in ("markup", "dquotes")
        method = "text"
        if (m is None or not _accept(m, len(sk), marked_by)) and hint is not None:
            # a short quotation, or one with a slip, is accepted when it is unique in the sūra the author names
            ms = self.best(sk, surah=hint)
            if ms is not None and len(ms.candidates) == 1 and _accept_in_surah(ms, len(sk), marked_by):
                m, method = ms, "text+surah"
        if (
            m is not None
            and method == "text"
            and not _accept(m, len(sk), marked_by)
            and marked_by != "trigger"
        ):
            # the longest run is short because the author's wording parts from the verse in a word or two
            # («ماله» for «ما له», «عليهن» for «عليكم»): accept the one place holding most of the quotation
            covered = [c for c in m.candidates if m.length >= 3 and self._coverage(c, sk) >= 0.75]
            if len(covered) == 1:
                m = Match(m.length, m.weight, m.q_from, m.q_to, covered)
                method = "text-coverage"
        if m is None or (method == "text" and not _accept(m, len(sk), marked_by)):
            if not explicit:
                return None
            return Citation(start, end, "quote", marked_by, hint, status="unresolved")
        cands = m.candidates
        mismatch = False
        if len(cands) > 1 and hint is not None:
            narrowed = [c for c in cands if any(_surah(k) == hint for k in c)]
            if narrowed:
                cands = narrowed
                method = "text+surah"
        elif len(cands) == 1 and hint is not None and all(_surah(k) != hint for k in cands[0]):
            mismatch = True
        if marked_by == "trigger":
            # an unmarked quotation is the matched run itself, not the rest of the sentence
            start, end = start + words[m.q_from][0], start + words[m.q_to - 1][1]
        span_norm = [normalize(text[start:end][a:b]) for a, b, _ in words_with_spans(text[start:end])]
        # share of the quoted words found contiguously (a trigger window is cut to the run, so none)
        score = None if marked_by == "trigger" else round(m.length / len(sk), 3)
        c = Citation(start, end, "quote", marked_by, hint, score=score, hint_mismatch=mismatch, method=method)
        if len(cands) == 1:
            c.status = "resolved"
            c.verse_keys = list(cands[0])
            c.exact = self._exact(cands[0], span_norm)
        else:
            c.status = "ambiguous"
            c.method = None
            c.candidates = [list(x) for x in cands]
        return c

    def _coverage(self, keys: tuple[str, ...], sk: list[str]) -> float:
        bag = set().union(*(self.verse_keys_sk[k] for k in keys))
        return sum(1 for x in sk if x in bag) / len(sk) if sk else 0.0

    def _looks_quoted(self, text: str, s: int, e: int, relaxed: bool = False) -> bool:
        """Does ``text[s:e]`` read as Quran? ``relaxed``: two contiguous words with five letters will do
        (a bracketed two-word quotation such as «(وتذهب ريحكم)»; the sūra hint decides it later)."""
        sk = [x for _, _, x in words_with_spans(text[s:e]) if x]
        m = self.best(sk)
        if m is None:
            return False
        if relaxed:
            return m.length >= 2 and m.weight >= 5 and m.length >= 0.5 * len(sk)
        return _accept(m, len(sk), "brackets")

    def _exact(self, keys: tuple[str, ...], span_norm: list[str]) -> float:
        verse_words = set().union(*(self.verse_words[k] for k in keys))
        if not span_norm:
            return 0.0
        return round(sum(1 for w in span_norm if w in verse_words) / len(span_norm), 3)

    # -- sūra names -------------------------------------------------------------------------------
    def surah_mentions(self, text: str) -> list[tuple[int, int, int, bool, int]]:
        """(name start, end, sūra number, written with «سورة», start of «في سورة …») for every sūra named."""
        out = []
        for m in self._surah_rx.finditer(normalize_keep_length(text)):
            name = m.group("name")
            has_sura = m.group("sura") is not None
            if name in self._needs_sura and not has_sura:
                continue
            out.append((m.start("name"), m.end(), self.surah_names[name], has_sura, m.start()))
        return out

    # -- finding quotations in a passage ----------------------------------------------------------
    def find(self, text: str, styles: frozenset[str], markup: list[tuple[int, int]] = ()) -> list[Citation]:  # type: ignore[assignment]
        """Every Quran citation in ``text`` (one row's text). ``styles`` says how this work marks quotes:
        ``brackets`` — (…) ; ``dquotes`` — "…" ; ``triggers`` — unmarked, after «قوله تعالى» and the like.
        ``markup`` are OpenITI @QB@…@QE@ spans, relative to ``text``."""
        spans: list[tuple[int, int, str]] = []
        taken: list[tuple[int, int]] = []

        def free(s: int, e: int) -> bool:
            return not any(s < te and ts < e for ts, te in taken)

        for s, e in markup:
            s, e = _trim(text, s, e)
            if e > s and not _CONNECTOR.fullmatch(text[s:e]):
                spans.append((s, e, "markup"))
                taken.append((s, e))
        if "dquotes" in styles:
            # A dropped quote mark flips which segments are quotations; take the pairing under which more
            # segments read as Quran, and still try the other segments (kept only if they match).
            q = [i for i, ch in enumerate(text) if ch == '"']
            pairings = [[(q[i], q[i + 1]) for i in range(par, len(q) - 1, 2)] for par in (0, 1)]
            hits = [sum(1 for a, b in pr if self._looks_quoted(text, a + 1, b)) for pr in pairings]
            main = 0 if hits[0] >= hits[1] else 1
            for par in (main, 1 - main):
                for a, b in pairings[par]:
                    s, e = _trim(text, a + 1, b)
                    if e > s and "\n" not in text[s:e] and free(s, e):
                        if par == main:
                            spans.append((s, e, "dquotes"))
                            taken.append((s, e))
                        elif self._looks_quoted(text, s, e):
                            spans.append((s, e, "dquotes-alt"))
                            taken.append((s, e))
        if "brackets" in styles:
            # only brackets that read as Quran: «(في المائدة)» or «(رضي الله عنه)» are not quotations
            for m in _BRACKETS.finditer(text):
                s, e = _trim(text, m.start(1), m.end(1))
                if e > s and free(s, e) and self._looks_quoted(text, s, e, relaxed=True):
                    spans.append((s, e, "brackets"))
                    taken.append((s, e))
        if "triggers" in styles:
            for m in _TRIGGER.finditer(text):
                s = m.end()
                stop = _WINDOW_END.search(text, s)
                e = min(stop.start() if stop else len(text), s + 220)
                if e > s and free(s, e):
                    spans.append((s, e, "trigger"))
        spans.sort()

        mentions = self.surah_mentions(text)
        used_mentions: set[int] = set()
        out: list[Citation] = []
        prev_end = 0
        prev_surah: int | None = None
        claimed: list[tuple[int, int]] = []
        for s, e, how in spans:
            if any(s < ce and cs < e for cs, ce in claimed):
                continue  # inside a quotation already resolved (a bracket within a quote, two triggers)
            hint = None
            # a sūra named inside an unmarked window ("تعالى في سورة مريم فاتت به …") is a hint, not text
            if how == "trigger":
                for j, (_, me, n, _, full) in enumerate(mentions):
                    if s <= full and me <= e and _LEAD_IN.fullmatch(text[s:full]):
                        hint, s = n, me
                        used_mentions.add(j)
                        while s < e and text[s] in " :،":
                            s += 1
                        break
            if hint is None:
                last = None
                for j, (_, me, _, _, full) in enumerate(mentions):
                    if prev_end <= full and me <= s:
                        last = j
                if last is not None:
                    hint = mentions[last][2]
                    used_mentions.add(last)
            if (
                hint is None
                and prev_surah is not None
                and (_SAME_SURA.search(text, prev_end, s) or not text[prev_end:s].strip(" ()،.:"))
            ):
                # «وفيها»: the same sūra; or the quotation simply goes on after a bracket — «… ألا خوف عليهم
                # (ولا هم يحزنون)» continues the verse just cited
                hint = prev_surah
            c = self.resolve(text, s, e, hint, how)
            if c is None:
                continue
            parts = [c]
            if c.status == "unresolved" and _SPLIT.search(text, s, e):
                # one tag around two quotations: «@QB@ فمن خاف من موص … ) وفيها ( فإن خفتم … @QE@»
                pieces = []
                pos = s
                for m in _SPLIT.finditer(text, s, e):
                    pieces.append((pos, m.start()))
                    pos = m.end()
                pieces.append((pos, e))
                found = []
                h = hint
                for a, b in pieces:
                    a, b = _trim(text, a, b)
                    if b <= a:
                        continue
                    if _SAME_SURA.search(text, a, b) and not words_with_spans(text[a:b])[1:]:
                        continue
                    x = self.resolve(text, a, b, h, "brackets")
                    if x is not None:
                        x.marked_by = f"{how}-part"
                        found.append(x)
                        h = _surah(x.verse_keys[0]) if x.verse_keys else h
                if found:
                    parts = found
            for c in parts:
                out.append(c)
                claimed.append((c.start, c.end))
                prev_end = c.end
                prev_surah = _surah(c.verse_keys[0]) if c.verse_keys else hint
        for j, (ms, me, n, has_sura, _) in enumerate(mentions):
            if has_sura and j not in used_mentions:
                out.append(Citation(ms, me, "surah", "surah-name", n, status="surah"))
        out.sort(key=lambda c: c.start)
        return out


def _surah(key: str) -> int:
    return int(key.split(":", 1)[0])


def _accept_in_surah(m: Match, n: int, marked_by: str) -> bool:
    """Within the named sūra two contiguous words suffice, if they carry five letters and lead the span."""
    if m.length < 2 or m.weight < 5:
        return False
    if marked_by == "trigger":
        return m.q_from <= 1
    return m.length >= 0.5 * n


def _accept(m: Match, n: int, marked_by: str) -> bool:
    """Enough of the quotation must be found contiguously. Explicit quote marks need less evidence than
    brackets, which in turn need less than a span merely following «قوله تعالى»."""
    if n == 2:
        return m.length == 2 and m.weight >= 5 and marked_by in ("markup", "dquotes", "brackets")
    if marked_by == "trigger":
        return m.length >= 3 and m.weight >= 9 and m.q_from <= 1
    if marked_by in ("brackets", "dquotes-alt"):
        return m.length >= 3 and m.weight >= 7 and m.length >= 0.6 * n
    return m.length >= 3 and m.weight >= 6 and m.length >= 0.5 * n


_FOLD_SAME_LENGTH = str.maketrans(
    {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"}
)
_MARKS = re.compile(
    "[" + chr(0x64B) + "-" + chr(0x65F) + chr(0x670) + chr(0x640) + "]"
)  # harakat, dagger alef, tatweel


def normalize_keep_length(text: str) -> str:
    """Fold alef, hamza-carrier, alef-maksura and taa-marbuta variants one character for one, so offsets
    into the original text stay valid. Used only to find sūra names."""
    return text.translate(_FOLD_SAME_LENGTH)


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n:،.([":
        s += 1
    while e > s and text[e - 1] in " \n:،.)]":
        e -= 1
    return s, e


# (…) with at most one level of nesting inside: «(فمن خاف من موص جنفا [أو إثما])», «(باب (مع))».
_BRACKETS = re.compile(r"\(((?:[^()]|\([^()]*\))*)\)")
# Words after which an unmarked quotation follows.
_TRIGGER = re.compile(
    r"(?:قوله|وقوله|كقوله|لقوله|قول الله|قال الله|وقال الله|تعالى|عز وجل|جل وعز|عز وعلا|جل وعلا|تبارك وتعالى"
    r"|سبحانه(?: وتعالى)?|جل (?:اسمه|ثناؤه|ذكره|جلاله)|تبارك اسمه|وفي القرآن|في التنزيل)\s*:?\s*"
)
_WINDOW_END = re.compile(r"[.؛\n]|،\s*(?:أي|يعني|يريد|معناه|وقال|وقوله|قال)\b|\s(?:معناه|يعني|أي|يريد)\s")
# What may stand between a trigger and the sūra it names: «تعالى في سورة …», «تعالى: في …».
_LEAD_IN = re.compile(r"[\s:،]*(?:(?:و|ف)?(?:في|فى|من)[\s:،]*)?")
# A quote tag around a connective only («@QB@ وفيها @QE@», a slip of the tagging): not a quotation.
_CONNECTOR = re.compile(r"\s*(?:و|ف)?(?:فيها|في|ومنه|منه|ونحوه|ومثله|مثله|وقوله|قوله|و)\s*")
# Where one quote tag may hold two quotations: a bracket boundary, or «وفيها» between them.
_SPLIT = re.compile(r"\)\s*(?:،\s*)?(?:و?فيها\s*:?\s*)?\(|\s(?:و?فيها)\s")
# «وفيها»: the same sūra as the previous quotation.
_SAME_SURA = re.compile(r"(?:^|[\s،:])(?:و|ف)?(?:فيها|ومثلها فيها|ونحوه فيها)(?:[\s:،]|$)")


def _surah_lexicon(surahs: list[dict[str, Any]]) -> dict[str, int]:
    names: dict[str, int] = {}

    def add(name: str, n: int) -> None:
        k = normalize_keep_length(_MARKS.sub("", name))
        names.setdefault(k, n)

    for s in surahs:
        n = int(s["number"])
        name = s["name_ar"]
        add(name, n)
        if name.startswith("ال") and len(name) > 4:
            add(name[2:], n)
    for n, aliases in SURAH_ALIASES.items():
        for a in aliases:
            add(a, n)
    return names
