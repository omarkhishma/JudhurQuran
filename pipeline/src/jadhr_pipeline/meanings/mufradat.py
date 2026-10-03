"""al-Rāghib al-Iṣfahānī, «المفردات في غريب القرآن», cut per word treated and per numbered sense (PLAN P3.1, D6).

Input: the articles the product already shows (``lexicon_entries`` of work ``mufradat`` in a dataset build —
al-Dāwūdī's edition, Shamela typing, editor's notes stripped; registry ``data/lexica.yaml``). Each article is
filed under one root; inside it al-Rāghib treats several words of the root one after another («العِلْمُ: …
والعَلَمُ: … والعالَمُ: …») and often numbers the senses of one of them («وذلك ضربان: أحدهما … والثاني …»).
Nothing is rewritten: every output row is a span of the stored article text, with its offsets, so the panel can
show it and an editor can check it against the article. Status is always ``extracted``.

**Sub-entries** (``mufradat_subentries``). An article is cut where a word of its root is introduced. The cut rules
(``cut_rule``), outside Quran quotations, verse, sayings «…» and readings (…):

* ``article-start`` — the article's opening words of its root («الإثم والأثام:», «طَلَعَ الشمسُ …»); when the
  opening has none («قوله تعالى: …», «يقال: …»), the article's title is the headword (``headword_start`` null);
* ``colon`` — a clause of at most four words that ends with a colon and holds a word of the root: «والعَلَمُ:»،
  «وامرأةٌ طُلَعَةٌ قُبَعَةٌ :»، «يقال: حَدَدْتُ كذا:». Not when the colon opens a quotation (the clause ends with
  «قوله», «قيل», «تعالى» …), announces senses («والعِلْمُ من وجه ضربان:»), or says again the word being treated
  with more after it («فتَعْلِيمُهُ الأسماء:»; said again alone, «والسَّلْقُ: …», it opens a new entry — al-Rāghib's
  way with homonyms). Where a comma is missing («صاروا ثلاثة وحبل مَثْلُوث:») the entry starts at the last phrase
  opened by «و» that is not itself a word of the root;
* ``paragraph-initial`` — a real paragraph (the one before ended a sentence or a verse of poetry) opens with a
  word of the root that maps to a Quranic lemma other than the one being treated («والجاهل تارة يذكر …»);
* ``vocalised-clause-initial`` — a sentence opens (after «.», «،», «؛» or a verse reference) with a vocalised
  word of the root that maps to another Quranic lemma («، والعَالِمُ في وصف الله …»).

A word "of the root" holds the root's letters in order (``has_root``: a weak radical may be written as a long
vowel or, first or last, left out; a shadda doubles its letter; only pattern letters may stand between radicals).
Each sub-entry runs to the next cut. Its headwords are mapped to our lemmas of the article's root (or of its و/ي
twin) by ``lemmamap.LemmaMapper`` — method and confidence stored, unmapped with a reason.

**Senses** (``mufradat_senses``). Inside a sub-entry, numbered senses are cut at their markers: ordinals at the
start of a clause («أحدهما:»، «والثاني:»، «- والثالث:»، «الرابع:» — the pipeline's ``relations.numerals``) or dash
bullets at the start of a line («- ضرب متخصص …»); a list is two or more markers in order, and its announcement
(«وذلك ضربان»، «على أربعة أوجه»، «ثلاثة أضرب») is the closest one before it in the same sub-entry, with its stated
count. Where the announcement ends a paragraph with a colon and is followed by exactly as many paragraphs as it
announces, before anything else, those paragraphs are the senses (``paragraph-items``). Markers and
announcements are matched without vowel marks («الأوّل», «ضَرْبان»). A sense runs to the next marker; the last
one to the end of its paragraph (a paragraph continues across a quotation or a verse reference the typing put
on its own line), or sooner at the next list or sub-entry, or at a later announcement that opens a new sentence
(``end_rule``). A second «فالأوّل … والثاني» after «أحدهما … والثاني» is kept as a second list (``list_no``).

**Quotations** (``mufradat_citations``) are resolved to verse keys by ``quotes.QuoteFinder``; sub-entries and
senses list the verses resolved inside them.

**Pages**: the printed page of each span is found by locating the first line of every printed page of the
article in the stored text (the Shamela pages, the same lines the lexicon import read); ``page_method`` says
whether that worked (``located``) or the article's page range is given (``article-range``).
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from bisect import bisect_left, bisect_right
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jadhr_arabic import strip_marks

from ..lexica.registry import load_registry
from ..lexica.shamela import Counters, load_pages, read_lines
from ..relations.numerals import ordinal_words
from ..relations.quran import QuranIndex
from .lemmamap import LemmaMapper, LemmaMatch
from .quotes import Quote, QuoteFinder

WORK = "mufradat"
STATUS = "extracted"

_WORD = re.compile("[" + chr(0x0621) + "-" + chr(0x0652) + chr(0x0670) + chr(0x0671) + "]+")
_MARK = re.compile("[" + chr(0x064B) + "-" + chr(0x0652) + "]")
_SHADDA = chr(0x0651)
_CLAUSE_END = set(".،؛:?؟!]")  # «]» closes a verse reference
_FOLD = str.maketrans(
    {"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", chr(0x0671): "ا", "ى": "ي", "ة": "ه"}
)
# Words that make up formulas before a colon («قال تعالى:», «قال الشاعر:», «يقال:») — never a headword.
FORMULA = {
    "قال", "وقال", "فقال", "قالوا", "قيل", "وقيل", "فقيل", "يقال", "ويقال", "فيقال", "تقول", "وتقول", "يقول",
    "نحو", "ونحو", "أي", "قوله", "وقوله", "كقوله", "وكقوله", "لقوله", "فقوله", "تعالى", "الله", "عز", "وجل",
    "جل", "ثناؤه", "سبحانه", "الشاعر", "آخر", "بعضهم", "قولهم", "كقولهم", "وقولهم", "ومنه", "منه", "وعلى",
    "هذا", "ذلك", "وذلك", "فذلك", "وهذا", "قراءة", "وقرئ", "قرئ", "قرأ", "ومن", "من", "في", "وفي", "على",
}  # fmt: skip
_ORD_WORDS = sorted(
    {w for k in range(1, 11) for w in ordinal_words(k)[:6] if " " not in w}, key=len, reverse=True
)
_ORD_K = {w: k for k in range(1, 11) for w in ordinal_words(k) if " " not in w}
_ORD_K.update({"الأولى": 1, "الآخر": 2, "الأخرى": 2})
_MARKER = re.compile(
    r"(?P<lead>(?:^|(?<=\n)|(?<=[.،؛:]))[ ]*)(?P<marker>(?P<dash>-[ ]*)?(?:و|ف)?"
    r"(?P<ord>" + "|".join(map(re.escape, [*_ORD_WORDS, "الأولى", "والآخر", "الآخر", "الأخرى"])) + r"))"
    r"(?=[ ]*:|[ ]+\S)"
)
_BULLET = re.compile(r"(?:^|(?<=\n)|(?<=\.)[ ]+)(?P<marker>-[ \n]*)(?=\S)")
_UNITS = {
    "اثنين": 2, "اثنان": 2, "ثلاثة": 3, "ثلاث": 3, "أربعة": 4, "أربع": 4, "خمسة": 5, "خمس": 5, "ستة": 6,
    "ست": 6, "سبعة": 7, "سبع": 7, "ثمانية": 8, "تسعة": 9, "عشرة": 10,
}  # fmt: skip
_DUAL = {"ضربان", "ضربين", "وجهان", "وجهين", "نوعان", "نوعين", "قسمان", "قسمين", "معنيان", "معنيين"}
_ANNOUNCE = re.compile(
    r"(?:على\s+)?(?:(?P<num>" + "|".join(_UNITS) + r")\s+)?"
    r"(?P<word>ضربان|ضربين|أضرب|ضروب|وجهان|وجهين|أوجه|وجوه|نوعان|نوعين|أنواع|قسمان|قسمين|أقسام|معنيان|معنيين|معان)"
    r"(?![ء-ي])"
)
_POEM_NUMBER = re.compile(r"^[٠-٩0-9]{1,4}\s*-\s*$")


# -- text helpers ---------------------------------------------------------------------------------------------
def _letters(word: str) -> list[str]:
    """Folded letters, a shadda doubling its letter (حَدُّ → ح د د)."""
    out: list[str] = []
    for ch in unicodedata.normalize("NFC", word):
        if ch == _SHADDA and out:
            out.append(out[-1])
        elif "ء" <= ch <= "ي" or ch == chr(0x0671):
            out.append(ch.translate(_FOLD))
    return out


_INFIX = set("اويىتطدنء")
_ENDING = set("اويىتهنمكء")
_COUNT_WORDS = {
    "ضربان", "ضربين", "أضرب", "ضروب", "وجهان", "وجهين", "أوجه", "وجوه", "نوعان", "نوعين", "أنواع", "قسمان",
    "قسمين", "أقسام", "معنيان", "معنيين", "معان",
}  # fmt: skip
_SUFFIX = re.compile("(?:هما|هم|هن|ها|ه)$")


def _stem_key(word: str) -> str:
    """The word without conjunction, article and a pronoun suffix, marks off — to tell «فتَعْلِيمُهُ» is the
    «التَّعْلِيمُ» already being treated."""
    w = strip_marks(word).translate(_FOLD)
    if len(w) > 3 and w[0] in "وف":
        w = w[1:]
    if len(w) > 4 and w.startswith("ال"):
        w = w[2:]
    return _SUFFIX.sub("", w) if len(w) > 4 else w


def has_root(word: str, radicals: list[str]) -> bool:
    """The root's radicals in order inside the word. A weak radical (و/ي) may be written ا/و/ي/ى, and when it is
    the first or last radical it may be absent («عِدَة» of وعد); a hamza radical is written on any seat or as ا.
    Between two radicals only pattern letters may stand (ا و ي ى ت ط د ن ء, two at most: «استعلام», «اصطبر»)."""
    letters = _letters(word)
    rad = [r.translate(_FOLD) for r in radicals]
    n = len(rad)

    def ok(i: int, j: int, gap: int) -> bool:
        if j == n:  # after the last radical only endings: «علماء», «معلومات», «تعليمهم» — not «النّهار» of نهي
            return len(letters) - i <= 4 and set(letters[i:]) <= _ENDING
        r = rad[j]
        if r in "وي" and j == n - 1 and j > 0 and len(letters) - i <= 2 and set(letters[i:]) <= set("تهان"):
            return True  # a final weak radical not written, only endings after it («دَعَتْ», «عِدَة»)
        if j == n - 1 and j > 0 and r == rad[j - 1] and (i >= len(letters) or letters[i] != r):
            return True  # a geminate written once, its shadda left out («الرَّسِ»)
        if i >= len(letters) or gap > 2:
            return False
        ch = letters[i]
        same = ch == r or (r == "ء" and ch == "ا") or (r in "وي" and ch in "اويى")
        if same and ok(i + 1, j + 1, 0):
            return True
        # pattern letters between radicals, or the radical just matched written twice (a shadda: «تَعَلُّم»)
        return j > 0 and (ch in _INFIX or ch == rad[j - 1]) and ok(i + 1, j, gap + 1)

    if any(ok(i, 0, 0) for i in range(len(letters))):
        return True
    # a first weak radical not written: «عِدَة», «صِلَة»
    return rad[0] in "وي" and n == 3 and any(ok(i, 1, 0) for i in range(len(letters)))


_CONJ = re.compile("[وف][" + chr(0x064B) + "-" + chr(0x0652) + "]*")


def conjunction_length(word: str, radicals: list[str]) -> int:
    """Length of a leading conjunction و/ف that is not part of the word («والعَلَمُ» → 1, «وَعَدَ» of root وعد →
    0): stripped before the article, or when the root does not begin with that letter and the rest still holds
    the root."""
    m = _CONJ.match(word)
    if not m or len(strip_marks(word)) <= 2:
        return 0
    rest = strip_marks(word[m.end() :])
    if rest.startswith(("ال", "ٱل")):
        return m.end()
    first = radicals[0].translate(_FOLD) if radicals else ""
    if first and first != word[0] and has_root(word[m.end() :], radicals):
        return m.end()
    return 0


def _vowel_count(word: str) -> int:
    return len(_MARK.findall(word))


@dataclass
class _Tok:
    start: int
    end: int
    text: str
    masked: bool
    para_start: bool  # first word of a paragraph
    clause_start: bool  # first word after . ، ؛ : or a paragraph start
    after_colon: bool
    rooted: bool


@dataclass
class _Cut:
    start: int
    heads: list[tuple[int, int]]
    rule: str


@dataclass
class _List:
    markers: list[tuple[int, int, int]]  # (start, end, ordinal or 0 for a bullet)
    kind: str  # ordinal | bullet | paragraph-items
    announcement: tuple[int, int, int | None] | None = None
    ends: list[tuple[int, str]] = field(default_factory=list)


class Article:
    """One article: its tokens, masks, cuts, sub-entries and sense lists."""

    def __init__(self, row: dict[str, Any], radicals: list[str] | None, quotes: list[Quote]) -> None:
        self.row = row
        self.text: str = row["body"]
        self.radicals = radicals
        self.quotes = quotes
        self.masks = self._masks()
        self.toks = self._tokens()
        self.bare = Bare(self.text)

    # -- masks: quotations, verse, sayings and readings are not al-Rāghib's running text --------------------
    def _masks(self) -> list[tuple[int, int]]:
        t = self.text
        spans = [(q.start, q.ref_end or q.end) for q in self.quotes if q.end > q.start or q.ref_end]
        for m in re.finditer(r"«[^«»]*»|\([^()]*\)", t):
            spans.append((m.start(), m.end()))
        pos = 0
        paras = t.split("\n\n")
        self.poems: list[tuple[int, int]] = []
        for i, p in enumerate(paras):
            if _POEM_NUMBER.match(p.strip()) and i + 1 < len(paras):
                nxt = pos + len(p) + 2
                self.poems.append((pos, nxt + len(paras[i + 1])))
            pos += len(p) + 2
        return sorted(spans + self.poems)

    def masked(self, s: int, e: int) -> bool:
        return any(a <= s and e <= b for a, b in self.masks)

    def _tokens(self) -> list[_Tok]:
        t = self.text
        toks: list[_Tok] = []
        for m in _WORD.finditer(t):
            s = m.start()
            j = s - 1
            while j >= 0 and t[j] in " \t-":
                j -= 1
            # the last character before the word, across the typing's line breaks
            k = j
            while k >= 0 and t[k] in " \n\t-":
                k -= 1
            prev = t[k] if k >= 0 else "\n"
            # a paragraph start that is a real one: the paragraph before it ended a sentence (the typing also
            # breaks lines after «وجمعه:» or in mid-sentence)
            after_poem = any(a <= k < b for a, b in self.poems)
            para = j < 0 or (t[j] == "\n" and (k < 0 or t[k] in ".!؟?»)" or after_poem))
            toks.append(
                _Tok(
                    s,
                    m.end(),
                    m.group(0),
                    self.masked(s, m.end()),
                    para,
                    para or prev in _CLAUSE_END,
                    prev == ":",
                    bool(self.radicals) and has_root(m.group(0), self.radicals),  # type: ignore[arg-type]
                )
            )
        return toks

    # -- cuts ------------------------------------------------------------------------------------------------
    def _is_head(self, tk: _Tok) -> bool:
        bare = strip_marks(tk.text)
        return tk.rooted and not tk.masked and bare not in FORMULA and bare.lstrip("وف") not in _ORD_K

    def cuts(self, mapper: LemmaMapper, root_key: str | None) -> list[_Cut]:
        toks = self.toks
        out: list[_Cut] = []
        # article start: the opening words of the root, coordinated («الإثم والأثام:»)
        heads: list[tuple[int, int]] = []
        first_clause_end = next((i for i, tk in enumerate(toks) if i > 0 and toks[i].clause_start), len(toks))
        for tk in toks[: min(first_clause_end, 6)]:
            if self._is_head(tk):
                heads.append((tk.start, tk.end))
            elif heads:
                break
        out.append(_Cut(0, heads, "article-start"))
        current = self._lemmas(heads, mapper, root_key)
        current_words = {_stem_key(self.text[a:z]) for a, z in heads}
        i = 1 if toks and toks[0].start == 0 else 0
        while i < len(toks):
            tk = toks[i]
            if tk.start == 0 or not tk.clause_start or tk.masked:
                i += 1
                continue
            # colon: a short clause ending with «:» that holds a word of the root
            j = i
            while j + 1 < len(toks) and not toks[j + 1].clause_start:
                j += 1
            clause = toks[i : j + 1]
            tail = self.text[clause[-1].end : toks[j + 1].start if j + 1 < len(toks) else len(self.text)]
            announces = any(strip_marks(c.text) in _COUNT_WORDS for c in clause)
            # «فمن التَّعْلِيمُ قوله:», «وتشبيها بالطُّلُوعِ قيل:» — the colon opens a quotation, not a definition
            quoting = strip_marks(clause[-1].text) in FORMULA
            if tail.strip().startswith(":") and len(clause) <= 4 and not announces and not quoting:
                # «… صاروا ثلاثة وحبل مَثْلُوث:» — a missing comma: the entry starts at the last phrase opened by
                # a conjunction that is not itself a word of the root («والحَجْر والتحجير:» stays whole)
                heads_at = [n for n, c in enumerate(clause) if self._is_head(c)]
                if heads_at:
                    k0 = max(
                        (
                            n
                            for n in range(1, heads_at[-1] + 1)
                            if n not in heads_at
                            and clause[n].text[:1] == "و"
                            and len(strip_marks(clause[n].text)) > 3
                        ),
                        default=0,
                    )
                    if k0:
                        clause, tk = clause[k0:], clause[k0]
                hs = [(c.start, c.end) for c in clause if self._is_head(c)]
                if hs:
                    lem = self._lemmas(hs, mapper, root_key)
                    words = {_stem_key(self.text[a:z]) for a, z in hs}
                    same = bool(lem & current) if lem else bool(words & current_words)
                    # the word being treated, said again with more after it («والعِلْمُ من وجه ضربان:»,
                    # «فتَعْلِيمُهُ الأسماء:») goes on; said again on its own («والسَّلْقُ: …») opens a new entry
                    if not (same and clause[-1].start > hs[-1][0]):
                        out.append(_Cut(tk.start, hs, "colon"))
                        current, current_words = lem, words
                        i = j + 1
                        continue
            if self._is_head(tk) and (tk.para_start or (_vowel_count(tk.text) >= 2 and not tk.after_colon)):
                lm = mapper.map(tk.text, root_key)
                if lm.lemma_key and lm.method in ("lemma", "quran-form") and lm.lemma_key not in current:
                    out.append(
                        _Cut(
                            tk.start,
                            [(tk.start, tk.end)],
                            "paragraph-initial" if tk.para_start else "vocalised-clause-initial",
                        )
                    )
                    current, current_words = {lm.lemma_key}, {_stem_key(tk.text)}
            i += 1
        return out

    def _lemmas(self, heads: list[tuple[int, int]], mapper: LemmaMapper, root_key: str | None) -> set[str]:
        """The lemmas the current sub-entry treats (so a later mention of the same word does not cut)."""
        out = set()
        for s, e in heads:
            k = mapper.map(self.text[s:e], root_key).lemma_key
            if k:
                out.add(k)
        return out

    # -- logical paragraphs ----------------------------------------------------------------------------------
    def para_end(self, pos: int, limit: int) -> int:
        """End of the paragraph holding ``pos``: a paragraph goes on across a quotation or a verse reference the
        typing put on its own line, and after a colon that introduces one."""
        t = self.text
        while True:
            k = t.find("\n\n", pos)
            if k < 0 or k >= limit:
                return limit
            nxt = t[k + 2 : k + 200]
            before = t[:k].rstrip()
            quote_line = self.masked(k + 2, k + 3)
            if nxt.startswith("[") or before.endswith(":") or quote_line:
                pos = k + 2
                continue
            return k


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# -- senses ------------------------------------------------------------------------------------------------------
class Bare:
    """The text without vowel marks and tatweel, with a map back to the stored text: markers and announcements
    are matched here, so «الأوّل» and «ضَرْبان» are found as «الأول» and «ضربان»."""

    def __init__(self, text: str) -> None:
        keep = [i for i, ch in enumerate(text) if not (_MARK.match(ch) or ch == "ـ")]
        self.text = text
        self.idx = keep
        self.s = "".join(text[i] for i in keep)

    def pos(self, orig: int) -> int:
        return bisect_left(self.idx, orig)

    def span(self, a: int, b: int) -> tuple[int, int]:
        if b <= a:
            o = self.idx[a] if a < len(self.idx) else len(self.text)
            return o, o
        s, e = self.idx[a], self.idx[b - 1] + 1
        while e < len(self.text) and (_MARK.match(self.text[e]) or self.text[e] == "ـ"):
            e += 1
        return s, e


def _announcements(art: Article, s: int, e: int) -> list[tuple[int, int, int | None]]:
    b = art.bare
    out = []
    for m in _ANNOUNCE.finditer(b.s, b.pos(s), b.pos(e)):
        a, z = b.span(m.start(), m.end())
        if art.masked(a, z):
            continue
        word = m.group("word")
        n = 2 if word in _DUAL else (_UNITS[m.group("num")] if m.group("num") else None)
        out.append((a, z, n))
    return out


def sense_lists(art: Article, s: int, e: int, cut_starts: list[int]) -> list[_List]:
    """The numbered lists inside the sub-entry text[s:e]."""
    t, b = art.text, art.bare
    marks: list[tuple[int, int, int]] = []
    for m in _MARKER.finditer(b.s, b.pos(s), b.pos(e)):
        ms, me = b.span(m.start("marker"), m.end("marker"))
        k = _ORD_K.get(m.group("ord"), 0)
        if k and not art.masked(ms, me):
            marks.append((ms, me, k))
    bullets = []
    for m in _BULLET.finditer(b.s, b.pos(s), b.pos(e)):
        ms, me = b.span(m.start("marker"), m.end("marker"))
        if not art.masked(ms, me):
            bullets.append((ms, me, 0))
    lists: list[_List] = []
    # ordinal lists: 1, 2, 3 … in order; a new «1» starts a new list
    cur: list[tuple[int, int, int]] = []
    for mk in sorted(marks):
        if mk[2] == 1:
            if len(cur) >= 2:
                lists.append(_List(cur, "ordinal"))
            cur = [mk]
        elif cur and mk[2] == cur[-1][2] + 1:
            cur.append(mk)
    if len(cur) >= 2:
        lists.append(_List(cur, "ordinal"))
    # bullet lists: consecutive dashes that do not open an ordinal marker; a cut or an announcement between two
    # dashes ends the list («ضربان: - ضرب … - وضرب … ثم التي للحاجة ضربان: - …» are two lists)
    anns = _announcements(art, s, e)
    taken = {mk[0] for lst in lists for mk in lst.markers}
    run: list[tuple[int, int, int]] = []
    for bl in bullets:
        if bl[0] in taken or any(bl[0] == mk[0] for mk in marks):
            continue
        breaks = [*cut_starts, *(a[0] for a in anns)]
        if run and any(run[-1][0] < c <= bl[0] for c in breaks):
            if len(run) >= 2:
                lists.append(_List(run, "bullet"))
            run = []
        run.append(bl)
    if len(run) >= 2:
        lists.append(_List(run, "bullet"))
    lists.sort(key=lambda lst: lst.markers[0][0])
    used: set[int] = set()
    for li, lst in enumerate(lists):
        first = lst.markers[0][0]
        prev_end = lists[li - 1].markers[-1][1] if li else s
        cands = [a for a in anns if prev_end <= a[0] < first and first - a[1] <= 400]
        if cands:
            lst.announcement = cands[-1]
            used.add(cands[-1][0])
    # paragraph items: «على أربعة أوجه:» ¶ four paragraphs ¶ …
    for a in anns:
        if a[0] in used or not a[2] or a[2] < 2:
            continue
        rest = t[a[1] : e]
        if not rest.lstrip(" ").startswith(":\n\n"):
            continue
        p = a[1] + rest.index("\n\n") + 2
        starts: list[int] = []
        stop = min([x[0] for x in anns if x[0] > a[0]] + [c for c in cut_starts if c > a[0]] + [e])
        while p < stop and len(starts) <= a[2]:
            starts.append(p)
            p = art.para_end(p, stop) + 2
        if len(starts) == a[2] and not any(starts[0] <= mk[0] < stop for lst in lists for mk in lst.markers):
            lists.append(_List([(x, x, i + 1) for i, x in enumerate(starts)], "paragraph-items", a))
    lists.sort(key=lambda lst: lst.markers[0][0])
    # where each sense ends
    for li, lst in enumerate(lists):
        # a later announcement ends the last sense only when a new sentence opens it (after «.» or a paragraph):
        # «والثالث: … والناس في هذا ضربان:» divides the third sense, it does not end it
        later_anns = [
            x[0]
            for x in anns
            if x[0] > lst.markers[-1][1] and re.search(r"[.\n]", t[lst.markers[-1][1] : x[0]])
        ]
        for mi, mk in enumerate(lst.markers):
            if mi + 1 < len(lst.markers):
                lst.ends.append((lst.markers[mi + 1][0], "next-marker"))
                continue
            options = [(art.para_end(mk[1], e), "paragraph-end"), (e, "subentry-end")]
            if li + 1 < len(lists):
                options.append((lists[li + 1].markers[0][0], "next-list"))
            if later_anns:
                options.append((later_anns[0], "next-announcement"))
            lst.ends.append(min(options, key=lambda o: o[0]))
    return lists


# -- pages -------------------------------------------------------------------------------------------------------
class PageLocator:
    """Printed page of an offset in a stored article: the first line of each printed page, found in the text."""

    def __init__(self, lines_by_page: dict[int, list[str]]) -> None:
        self.lines_by_page = lines_by_page

    def breaks(self, body: str, page_ref: str | None) -> tuple[list[tuple[int, int]], bool]:
        if not page_ref:
            return [], False
        nums = [int(x) for x in re.findall(r"\d+", page_ref)]
        first, last = nums[0], nums[-1]
        out = [(0, first)]
        pos = 0
        ok = True
        for p in range(first + 1, last + 1):
            lines = [ln for ln in self.lines_by_page.get(p, []) if ln.strip()]
            probe: list[str] = []
            for ln in lines:
                probe += ln.split()
                if sum(len(x) for x in probe) >= 20:
                    break
            if not probe:
                ok = False
                continue
            rx = re.compile(r"\s+".join(map(re.escape, probe)))
            m = rx.search(body, pos)
            if not m:
                ok = False
                continue
            out.append((m.start(), p))
            pos = m.start()
        return out, ok

    @staticmethod
    def page_of(breaks: list[tuple[int, int]], s: int, e: int, fallback: str | None) -> str | None:
        if not breaks:
            return fallback
        p0 = max((p for off, p in breaks if off <= s), default=breaks[0][1])
        p1 = max((p for off, p in breaks if off < max(e, s + 1)), default=p0)
        return str(p0) if p0 == p1 else f"{p0}-{p1}"


# -- build -------------------------------------------------------------------------------------------------------
def _jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while e > s and text[e - 1] in " \n":
        e -= 1
    while s < e and text[s] in " \n":
        s += 1
    return s, e


def build_mufradat(
    raw: Path, build_dir: Path, registry: Path
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Cut every al-Mufradat article of a dataset build into sub-entries and senses. ``raw`` is data/raw (the
    Shamela pages, for page numbers), ``build_dir`` a dataset build (lexicon_entries, roots, lemmas, words,
    verses, surahs), ``registry`` data/lexica.yaml (the work's pins are verified)."""
    reg = load_registry(raw, registry)
    spec = reg.work(WORK)
    roots = _jsonl(build_dir / "roots.jsonl")
    lemmas = _jsonl(build_dir / "lemmas.jsonl")
    words = _jsonl(build_dir / "words.jsonl")
    verses = _jsonl(build_dir / "verses.jsonl")
    surahs = _jsonl(build_dir / "surahs.jsonl")
    articles = [r for r in _jsonl(build_dir / "lexicon_entries.jsonl") if r["work_id"] == WORK]
    radicals = {r["key"]: list(r["letters"]) for r in roots}
    lemma_by_key = {lm["key"]: lm for lm in lemmas}
    mapper = LemmaMapper(roots, lemmas, words)
    qf = QuoteFinder(QuranIndex(verses, surahs), {int(s["number"]): int(s["verse_count"]) for s in surahs})
    counters = Counters()
    pages = load_pages(spec.dir)
    lines = read_lines(pages, spec.cfg["footnote_marker"], counters)
    by_page: dict[int, list[str]] = {}
    for ln in lines:
        if ln.page.page_num is not None:
            by_page.setdefault(ln.page.page_num, []).append(ln.text)
    loc = PageLocator(by_page)

    subs: list[dict[str, Any]] = []
    senses: list[dict[str, Any]] = []
    cites: list[dict[str, Any]] = []
    rep: Counter[str] = Counter()
    reasons: Counter[str] = Counter()
    methods: Counter[str] = Counter()
    page_methods: Counter[str] = Counter()
    lists_stated: list[tuple[int | None, int]] = []
    for art_row in articles:
        root_key = art_row["root_key"]
        text = art_row["body"]
        quotes = qf.find(text)
        art = Article(art_row, radicals.get(root_key) if root_key else None, quotes)
        cuts = art.cuts(mapper, root_key)
        # merge cuts at the same start; the first cut always starts the article
        uniq: list[_Cut] = []
        for c in sorted(cuts, key=lambda c: c.start):
            if uniq and c.start == uniq[-1].start:
                continue
            uniq.append(c)
        breaks, located = loc.breaks(text, art_row["page_ref"])
        page_method = "located" if located else "article-range"
        eid = art_row["id"]
        sha = _sha(text)
        cut_starts = [c.start for c in uniq]
        first_sub = len(subs)
        for n, c in enumerate(uniq, 1):
            s = c.start
            e = uniq[n].start if n < len(uniq) else len(text)
            s, e = _trim(text, s, e)
            heads = []
            for hs, he in c.heads:
                word = text[hs:he]
                bare_start = hs + conjunction_length(word, art.radicals or [])
                lm: LemmaMatch = mapper.map(word, root_key)
                lk = lm.lemma_key
                heads.append(
                    {
                        "headword_ar": text[bare_start:he],
                        "start": bare_start,
                        "end": he,
                        **lm.as_dict(),
                        "lemma_ar": lemma_by_key[lk]["ar"] if lk else None,
                        "lemma_slug": lemma_by_key[lk]["slug"] if lk else None,
                    }
                )
            for h in heads:
                methods[h["match_method"] or "unmapped"] += 1
                if not h["lemma_key"]:
                    reasons[h["unmapped_reason"] or "unknown"] += 1
            sid = f"{WORK}:{eid}:e{n:02d}"
            verses_in = []
            for q in quotes:
                if s <= q.start < e:
                    for k in q.verse_keys:
                        if k not in verses_in:
                            verses_in.append(k)
            primary = heads[0] if heads else None
            lemma_keys = list(dict.fromkeys(h["lemma_key"] for h in heads if h["lemma_key"]))
            page = loc.page_of(breaks, s, e, art_row["page_ref"])
            page_methods[page_method] += 1
            rep[f"cut:{c.rule}"] += 1
            subs.append(
                {
                    "id": sid,
                    "entry_id": eid,
                    "work_id": WORK,
                    "article_headword_ar": art_row["headword"],
                    "article_root_key": root_key,
                    "seq": n,
                    "start": s,
                    "end": e,
                    "text_ar": text[s:e],
                    "cut_rule": c.rule,
                    "headword_ar": primary["headword_ar"] if primary else art_row["headword"],
                    "headword_start": primary["start"] if primary else None,
                    "headword_end": primary["end"] if primary else None,
                    "headwords": heads,
                    "lemma_keys": lemma_keys,
                    "lemma_key": lemma_keys[0] if lemma_keys else None,
                    "match_method": primary["match_method"] if primary else None,
                    "match_confidence": primary["match_confidence"] if primary else None,
                    "unmapped_reason": None
                    if lemma_keys
                    else (
                        primary["unmapped_reason"]
                        if primary
                        else ("article-not-quranic" if not root_key else "no-headword")
                    ),
                    "verses": verses_in,
                    "page_ref": page,
                    "page_method": page_method,
                    "source_ref": art_row["source_ref"],
                    "article_sha256": sha,
                    "status": STATUS,
                }
            )
            for li, lst in enumerate(sense_lists(art, s, e, cut_starts), 1):
                ann = lst.announcement
                lists_stated.append((ann[2] if ann else None, len(lst.markers)))
                rep[f"list:{lst.kind}"] += 1
                for mi, (mk, (end, end_rule)) in enumerate(zip(lst.markers, lst.ends, strict=True), 1):
                    ss, se = _trim(text, mk[0], end)
                    vs = []
                    for q in quotes:
                        if ss <= q.start < se:
                            for k in q.verse_keys:
                                if k not in vs:
                                    vs.append(k)
                    senses.append(
                        {
                            "id": f"{sid}:l{li}s{mi:02d}",
                            "subentry_id": sid,
                            "entry_id": eid,
                            "work_id": WORK,
                            "list_no": li,
                            "list_kind": lst.kind,
                            "sense_index": mi,
                            "marker_ar": text[mk[0] : mk[1]] if mk[1] > mk[0] else None,
                            "marker_start": mk[0] if mk[1] > mk[0] else None,
                            "marker_end": mk[1] if mk[1] > mk[0] else None,
                            "announcement_ar": text[ann[0] : ann[1]] if ann else None,
                            "announcement_start": ann[0] if ann else None,
                            "announcement_end": ann[1] if ann else None,
                            "stated_count": ann[2] if ann else None,
                            "found_count": len(lst.markers),
                            "start": ss,
                            "end": se,
                            "text_ar": text[ss:se],
                            "end_rule": end_rule,
                            "verses": vs,
                            "page_ref": loc.page_of(breaks, ss, se, art_row["page_ref"]),
                            "status": STATUS,
                        }
                    )
        for qn, q in enumerate(quotes, 1):
            row = q.as_row(text)
            ix = bisect_right(cut_starts, q.start) - 1
            sub = subs[first_sub + ix] if ix >= 0 else None
            cites.append(
                {
                    "id": f"{WORK}:{eid}:q{qn:03d}",
                    "entry_id": eid,
                    "subentry_id": sub["id"] if sub else None,
                    "work_id": WORK,
                    **row,
                }
            )
    report = _report(
        articles, subs, senses, cites, rep, methods, reasons, page_methods, lists_stated, lemmas, words
    )
    return {"mufradat_subentries": subs, "mufradat_senses": senses, "mufradat_citations": cites}, report


def _report(
    articles: list[dict[str, Any]],
    subs: list[dict[str, Any]],
    senses: list[dict[str, Any]],
    cites: list[dict[str, Any]],
    rep: Counter[str],
    methods: Counter[str],
    reasons: Counter[str],
    page_methods: Counter[str],
    lists_stated: list[tuple[int | None, int]],
    lemmas: list[dict[str, Any]],
    words: list[dict[str, Any]],
) -> dict[str, Any]:
    heads = [h for s in subs for h in s["headwords"]]
    covered = {k for s in subs for k in s["lemma_keys"]}
    occ = {lm["key"]: int(lm.get("occurrences") or 0) for lm in lemmas}
    rooted = [lm for lm in lemmas if lm.get("root_id")]
    quotes = [c for c in cites if c["end"] > c["start"]]
    return {
        "articles": len(articles),
        "articles_with_root": sum(1 for a in articles if a["root_key"]),
        "subentries": len(subs),
        "subentries_by_cut_rule": {
            k.split(":", 1)[1]: v for k, v in sorted(rep.items()) if k.startswith("cut:")
        },
        "subentries_per_article": dict(
            sorted(Counter(Counter(s["entry_id"] for s in subs).values()).items())
        ),
        "headwords": len(heads),
        "headwords_mapped": sum(1 for h in heads if h["lemma_key"]),
        "headwords_by_method": dict(methods.most_common()),
        "headwords_by_confidence": dict(
            Counter(h["match_confidence"] or "none" for h in heads).most_common()
        ),
        "unmapped_reasons": dict(reasons.most_common()),
        "subentries_mapped": sum(1 for s in subs if s["lemma_keys"]),
        "lemmas_with_a_subentry": len(covered),
        "rooted_lemmas": len(rooted),
        "rooted_lemma_occurrences_covered_pct": round(
            100 * sum(occ[k] for k in covered) / max(1, sum(occ[lm["key"]] for lm in rooted)), 2
        ),
        "sense_lists": {k.split(":", 1)[1]: v for k, v in sorted(rep.items()) if k.startswith("list:")},
        "senses": len(senses),
        "lists_with_stated_count": sum(1 for st, _ in lists_stated if st),
        "lists_stated_equals_found": sum(1 for st, n in lists_stated if st and st == n),
        "senses_by_end_rule": dict(Counter(s["end_rule"] for s in senses).most_common()),
        "citations": len(cites),
        "quotations": len(quotes),
        "quotations_by_status": dict(Counter(c["status"] for c in quotes).most_common()),
        "quotations_by_method": dict(Counter(c["method"] or "none" for c in quotes).most_common()),
        "quotations_ref_mismatch": sum(1 for c in quotes if c["ref_mismatch"]),
        "references_without_quotation": sum(1 for c in cites if c["end"] == c["start"]),
        "page_method": dict(page_methods),
        "status": dict(Counter(s["status"] for s in subs)),
        "totals": {
            "subentries": len(subs),
            "subentries_mapped": sum(1 for s in subs if s["lemma_keys"]),
            "senses": len(senses),
            "citations": len(cites),
            "quotations_resolved": sum(1 for c in quotes if c["status"] == "resolved"),
            "status": dict(Counter(s["status"] for s in [*subs, *senses])),
        },
    }
