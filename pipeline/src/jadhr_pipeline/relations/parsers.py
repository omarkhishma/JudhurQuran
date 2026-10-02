"""Structure parsers: where each entry, heading, stated sense count and sense lies in a cleaned text.

They return spans into ``Clean.text``; nothing here copies or edits text. One parser per printed layout:

* ``nuzha`` — Ibn al-Jawzī: «( N - باب X )» headings (numbered by the edition; a few printed numbers are
  typos and kept as printed), grouped under «كتاب …» / «أبواب …» headings; «وذكر أهل التفسير أن X في القرآن
  على N أوجه», then «أحدها: … والثاني: …».
* ``damghani`` — al-Dāmaghānī: «ب ر ه ن على وجهين» — the root's letters, spaced, and the count, often run
  into the previous sense's last line; a list of the senses; then «فوجه منها: … الثاني: …».
* ``furuq`` — al-ʿAskarī: paragraphs opening «الفرق بين X وY» (also with the typist's slips «القرق»،
  «الفقرق»، «الفرق ين»…), the explanation after it, usually opening «أن …».
* ``addad`` — Ibn al-Anbārī: entries numbered by the edition «N - …», the headword printed bold (OpenITI
  ``AUTO`` heading, put back inline by the cleaner).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from jadhr_arabic import normalize, skeleton

from .numerals import COUNT, count_value, ordinal_rx
from .openiti import Clean


@dataclass
class Part:
    start: int
    end: int
    index: int | None = None  # sense number as printed (its ordinal)
    marker: str | None = None  # the ordinal as printed («والثاني»)
    list_no: int = 1  # a second numbered list in the same entry («وأما المكسورة فهي على …»)


@dataclass
class Entry:
    seq: int
    start: int
    end: int
    heading: tuple[int, int]
    headword: str
    printed_number: str | None = None
    terms: list[str] = field(default_factory=list)
    letters: str | None = None  # root letters as printed, spaced (al-Dāmaghānī «ب ر ه ن»)
    stated_count: int | None = None
    stated_count_span: tuple[int, int] | None = None
    intro: tuple[int, int] | None = None
    parts: list[Part] = field(default_factory=list)
    section: str | None = None
    notes: list[str] = field(default_factory=list)


def _trim(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s] in " \n":
        s += 1
    while e > s and text[e - 1] in " \n":
        e -= 1
    return s, e


def _senses(
    text: str, start: int, end: int, first_from: int | None = None, loose: bool = False
) -> tuple[list[Part], list[str]]:
    """Sequential sense markers in [start, end): the first, then the second after it, and so on.

    Two printed irregularities are followed rather than guessed around: a missing ordinal (the text
    jumps from «والثاني» to «والرابع») is skipped and noted, and a new count statement followed by a new
    «أحدها» starts a second list. Returns the parts and notes."""
    parts: list[Part] = []
    notes: list[str] = []
    k, list_no = 1, 1
    pos = first_from if first_from is not None else start
    while k <= 30:
        m = ordinal_rx(k, loose).search(text, pos, end)
        limit = m.start() if m else end
        choice: tuple[re.Match[str], int] | None = (m, k) if m else None
        if k == 1 and not m and loose:
            second = ordinal_rx(2, loose).search(text, pos, end)
            if second:
                choice = (second, 2)
                notes.append("sense 1 has no marker in the text")
        if k > 1:
            cm = COUNT.search(text, pos, limit)
            r = ordinal_rx(1, loose).search(text, cm.end(), limit) if cm else None
            if r:
                choice = (r, 1)
                list_no += 1
                notes.append(f"a second numbered list starts at sense {k}")
            elif not m:
                skip = ordinal_rx(k + 1, loose).search(text, pos, end)
                if skip:
                    choice = (skip, k + 1)
                    notes.append(f"sense {k} has no marker in the text")
        if choice is None:
            break
        mm, k = choice
        if parts:
            parts[-1].end = mm.start()
        parts.append(Part(mm.start(), end, k, mm.group(0).strip(), list_no))
        pos = mm.end()
        k += 1
    for p in parts:
        p.start, p.end = _trim(text, p.start, p.end)
    return parts, notes


# --- Ibn al-Jawzī ---------------------------------------------------------------------------------
_NUZHA_HEAD = re.compile(r"\(?(?P<num>\d{1,3})\s*-\s*(?P<title>(?:[^()\n]|\([^()\n]*\))+?)\)")
_NUZHA_UNNUMBERED = re.compile(r"(?:^|(?<=\n))\((?P<title>باب\s+[^()\n]{1,30})\)")
_GROUP = re.compile(r"أبواب|كتاب|باب ما فوق|آخر الكتاب")


def parse_nuzha(c: Clean) -> list[Entry]:
    t = c.text
    heads: list[tuple[int, int, str | None, str]] = []
    for m in _NUZHA_HEAD.finditer(t):
        title = m.group("title").strip()
        at_para = m.start() == 0 or t[m.start() - 1] == "\n"
        if _GROUP.search(title) or not (title.startswith("باب") or at_para):
            continue
        heads.append((m.start(), m.end(), m.group("num"), title))
    for m in _NUZHA_UNNUMBERED.finditer(t):
        title = m.group("title").strip()
        if not _GROUP.search(title):
            heads.append((m.start(), m.end(), None, title))
    heads.sort()
    bounds = sorted({h[0] for h in heads} | {s for s, e in c.headings if _GROUP.search(t[s:e])})
    sections = sorted((s, t[s:e]) for s, e in c.headings if _GROUP.search(t[s:e]))
    entries = []
    for seq, (s, e, num, title) in enumerate(heads, 1):
        nxt = next((b for b in bounds if b > s), len(t))
        headword = re.sub(r"^باب\s+", "", title).strip(" '\"")
        if headword.startswith("(") and headword.endswith(")"):
            headword = headword[1:-1].strip(" '")
        section = next((x for b, x in reversed(sections) if b < s), None)
        ent = Entry(seq, s, nxt, (s, e), headword, printed_number=num, terms=[headword], section=section)
        # «وذكر أهل التفسير أن X في القرآن على N أوجه» is the statement the senses follow; an earlier
        # lexical «يقال على وجهين: أحدهما … والثاني …» is part of the introduction.
        counts = list(COUNT.finditer(t, e, nxt))
        quranic = [m for m in counts if "القرآن" in t[max(e, m.start() - 60) : m.start()]]
        cm = quranic[0] if quranic else (counts[0] if counts else None)
        ent.parts, notes = _senses(t, e, nxt, first_from=cm.end() if cm else None)
        ent.notes += notes
        if cm and (not ent.parts or cm.start() < ent.parts[0].start):
            ent.stated_count, ent.stated_count_span = count_value(cm), (cm.start(), cm.end())
            _check_lists(t, ent, cm)
        intro_end = ent.parts[0].start if ent.parts else nxt
        ent.intro = _trim(t, e, intro_end)
        if ent.parts and ordinal_rx(1).search(t, e, ent.parts[0].start):
            ent.notes.append("a numbered list in the introduction is left in the introduction")
        if num is None:
            ent.notes.append("heading printed without a number")
        entries.append(ent)
    return entries


_SUBJECT = re.compile(r"أن\s+(\S+)(?:\s+\[?في القرآن\]?|\s+\S+\s+في القرآن)")


def _same_word(a: str, b: str) -> bool:
    """Loosely the same word: one consonantal skeleton (article off) is a subsequence of the other
    («الأسفل»/«السفل», «العالم»/«العالمين»); «المحصنات»/«المثل» are not."""

    def sk(x: str) -> str:
        x = normalize(x.strip("[]()'\""))
        return skeleton(x[2:] if x.startswith("ال") else x)

    def subseq(x: str, y: str) -> bool:
        it = iter(y)
        return all(ch in it for ch in x)

    a, b = sk(a), sk(b)
    return subseq(a, b) or subseq(b, a)


def _check_lists(t: str, ent: Entry, first: re.Match[str]) -> None:
    """Sum the count statements of every numbered list, and flag a statement that names another word
    than the heading («أن المحصنات في القرآن» under «باب المثل»: a heading lost in the typing)."""
    total = 0
    prev = ent.heading[1]
    for no in sorted({p.list_no for p in ent.parts}):
        first_part = next(p for p in ent.parts if p.list_no == no)
        stmts = list(COUNT.finditer(t, prev, first_part.start))
        if not stmts:
            return
        st = stmts[-1]
        total += count_value(st) or 0
        subj = _SUBJECT.search(t, max(prev, st.start() - 60), st.start())
        if subj and not _same_word(subj.group(1), ent.headword.split()[0] if ent.headword else ""):
            ent.notes.append(f"the count statement of list {no} names «{subj.group(1)}», not the heading")
        prev = first_part.start
    ent.stated_count = total


# --- al-Dāmaghānī ---------------------------------------------------------------------------------
_LETTER_GROUP = re.compile(r"^[ء-ي]{1,2}$")
_WORD_TOKEN = re.compile(r"^[ء-ي]{1,10}$")
_NUMBERING = re.compile(r"^\(?\d+\)?-?$")


@dataclass
class _DamHead:
    start: int
    end: int
    letters: str  # root letters as printed, joined («برهن»); the word itself for an unspaced headword
    printed: str  # as printed («ب ر ه ن», «ج ن ح الجناح», «أرض»)
    spaced: bool
    word: str | None  # a headword form printed between the letters and the count («الجناح»)
    count: re.Match[str]

    @property
    def spaced_letters(self) -> str:
        """The letter groups alone, spaced as printed («ج ن ح» of «ج ن ح الجناح»)."""
        return self.printed[: -len(self.word)].strip() if self.word else self.printed


def _damghani_head(t: str, m: re.Match[str]) -> _DamHead | None:
    """Read the heading that ends with the count statement ``m`` backwards, token by token."""
    line_start = t.rfind("\n", 0, m.start()) + 1
    if not t[line_start : m.start()].strip():
        line_start = t.rfind("\n", 0, max(0, line_start - 1)) + 1  # «ن د ى⏎على سبعة أوجه»
    lo = max(line_start, m.start() - 90)
    pre = t[lo : m.start()]
    gloss = re.search(r"\(\s*[^()]{1,20}\)\s*$", pre)  # «س وي ( الاستواء ) على»: the editor's gloss
    if gloss:
        pre = pre[: gloss.start()]
    toks = [(lo + x.start(), lo + x.end(), x.group(0)) for x in re.finditer(r"\S+", pre)]
    tail = ""
    if toks and not pre.endswith((" ", "\n")):
        # «أوعلى», «ج ث وعلى», «خ ط أعلى»: the last letters run into «على»
        tail_start, _, tail = toks.pop()
    if tail and len(tail) > 3:
        return None

    def groups_before(i: int) -> list[tuple[int, int, str]]:
        out: list[tuple[int, int, str]] = []
        while (
            i >= 0 and _LETTER_GROUP.match(toks[i][2]) and sum(len(g[2]) for g in out) + len(toks[i][2]) <= 5
        ):
            out.insert(0, toks[i])
            i -= 1
        return out

    groups = groups_before(len(toks) - 1)
    if tail:
        letters_tokens = [*(g[2] for g in groups), tail]
        first = groups[0][0] if groups else tail_start
        if len("".join(letters_tokens)) <= 5:
            letters = "".join(letters_tokens)
            spaced = len(letters_tokens) >= 2
            return _DamHead(first, m.end(), letters, " ".join(letters_tokens), spaced, None, m)
        return None
    if len(groups) >= 2 and 2 <= len("".join(g[2] for g in groups)) <= 5:
        letters = "".join(g[2] for g in groups)
        return _DamHead(groups[0][0], m.end(), letters, " ".join(g[2] for g in groups), True, None, m)
    if not toks:
        return None
    # «ج ن ح الجناح على خمسة أوجه», «ط غ ى الطاغوت على …»: the letters, then a headword form
    word = toks[-1]
    groups = groups_before(len(toks) - 2)
    if len(groups) >= 2 and 2 <= len("".join(g[2] for g in groups)) <= 5 and _WORD_TOKEN.match(word[2]):
        letters = "".join(g[2] for g in groups)
        printed = t[groups[0][0] : word[1]]
        return _DamHead(groups[0][0], m.end(), letters, printed, True, word[2], m)
    # an unspaced headword: «أرض على ثلاثة عشر وجها», «روح على ستة أوجه», «لولا على وجهين»
    if not _WORD_TOKEN.match(word[2]):
        return None
    before = toks[-2][2] if len(toks) > 1 else ""
    if before == "باب" or (len(toks) > 2 and toks[-3][2] == "باب"):
        return None  # «باب الثاء على خمسة أوجه ث ب ت»: a chapter heading, letters after the count
    at_start = len(toks) == 1 or bool(_NUMBERING.match(before)) or bool(re.search(r'[".:)]$', before))
    if not at_start and len(word[2]) > 6:
        return None
    return _DamHead(word[0], m.end(), word[2], word[2], False, None, m)


def parse_damghani(c: Clean) -> list[Entry]:
    t = c.text
    heads: list[_DamHead] = []
    unread: list[re.Match[str]] = []
    for m in COUNT.finditer(t):
        h = _damghani_head(t, m)
        if h is None:
            # «باب الثاء على خمسة أوجه ث ب ت»: the letters printed after the count
            after = re.match(r"\s*((?:[ء-ي]{1,2}\s+){1,4}[ء-ي]{1,2})(?=\s)", t[m.end() : m.end() + 20])
            before = t[max(0, m.start() - 20) : m.start()].split()
            if after and before and (before[-1].startswith("ال") and "باب" in before[-2:-1]):
                letters = "".join(after.group(1).split())
                h = _DamHead(
                    m.start() - len(" ".join(before[-2:])) - 1,
                    m.end() + after.end(),
                    letters,
                    after.group(1),
                    True,
                    None,
                    m,
                )
            else:
                unread.append(m)
                continue
        heads.append(h)
    entries: list[Entry] = []
    for seq, h in enumerate(heads, 1):
        nxt = heads[seq].start if seq < len(heads) else len(t)
        ent = Entry(
            seq,
            h.start,
            nxt,
            (h.start, h.end),
            h.printed,
            terms=[h.word or h.printed],
            letters=h.spaced_letters if h.spaced else None,
        )
        ent.stated_count, ent.stated_count_span = count_value(h.count), (h.count.start(), h.count.end())
        ent.parts, notes = _senses(t, h.end, nxt, loose=True)
        ent.notes += notes
        ent.intro = _trim(t, h.end, ent.parts[0].start if ent.parts else nxt)
        if ent.parts and ent.parts[0].index == 2:
            # «فوجه منها» lost in the typing: the first sense is the text before «الثاني», together with
            # the list of senses that heads the entry — kept whole rather than cut by guesswork
            s0, e0 = _trim(t, h.end, ent.parts[0].start)
            ent.parts.insert(0, Part(s0, e0, 1, None))
            ent.intro = None
            ent.notes.append("sense 1 has no marker; its text includes the entry's list of senses")
        if not h.spaced:
            ent.notes.append("headword printed as a word, not as spaced root letters")
        if any(ent.start < u.start() < nxt for u in unread):
            ent.notes.append("a count statement inside the entry was not read as a heading")
        entries.append(ent)
    return entries


# --- al-ʿAskarī, al-Furūq -------------------------------------------------------------------------
# The typist's slips for «الفرق بين» in this file, read off the text (each occurs once to four times).
_FARQ_WORDS = {"الفرق", "الفروق", "والفرق", "القرق", "الفقرق", "الغرق", "الفرقت", "الفر"}
_BAYN_WORDS = {"بين", "ين", "يبن", "قين", "بينهما"}
_SECTION = re.compile(r"^(?:الباب|البابع|مقدمة|ومن |ومما |مما |وما |وخلاف )")
_GROUP_TAIL = re.compile(
    r"\s+و(?:في\s+)?(?:ما|مما)\s+(?:يقرب|يجري|يجرى|بسبيل|أشبه|يخالف|يضاد|يناقض|هو\s+من)\b.*$"
)


def split_terms(rest: str) -> list[str]:
    """«الخوف والحذر والخشية والفزع» → the terms as written; «X وبين Y» too."""
    rest = _GROUP_TAIL.sub("", rest).strip()
    parts = re.split(r"\s+و(?:بين\s+)?(?=\S)", rest)
    return [p.strip() for p in parts if p.strip()]


def parse_furuq(c: Clean) -> list[Entry]:
    t = c.text
    heads: list[tuple[int, int, int, str]] = []  # para start, heading end, text start, rest
    sections: list[int] = []
    pos = 0
    for para in t.split("\n"):
        s, e = pos, pos + len(para)
        pos = e + 1
        words = para.split(maxsplit=2)
        is_head = c.is_heading(s)
        if (
            len(words) >= 2
            and normalize(words[0]) in {normalize(w) for w in _FARQ_WORDS}
            and words[1] in _BAYN_WORDS
        ):
            rest = words[2] if len(words) > 2 else ""
        elif is_head and words and words[0] == "بين":
            rest = para.split(maxsplit=1)[1] if len(words) > 1 else ""
        else:
            if is_head and _SECTION.match(para):
                sections.append(s)
            continue
        # the explanation opens with «أن»; a heading run into it is cut there: «الفرق بين الحد والحقيقة أن …»
        m = re.search(r"\s(?:أن|ان)\s", para)
        cut = s + m.start() if m else e
        words_h = t[s:cut].split()
        head_rest = " ".join(words_h[2:])
        heads.append((s, cut, cut if m else (e if is_head else cut), head_rest))
    bounds = sorted({h[0] for h in heads} | set(sections))
    entries = []
    for seq, (s, he, ts, rest) in enumerate(heads, 1):
        nxt = next((b for b in bounds if b > s), len(t))
        terms = split_terms(rest)
        ent = Entry(seq, s, nxt, _trim(t, s, he), terms[0] if terms else "", terms=terms)
        if len(rest.split()) > 10:
            ent.notes.append("heading runs into the text without «أن»; terms read from its first words")
            ent.terms = [x.split()[0] for x in terms[:2]]
            ent.headword = ent.terms[0] if ent.terms else ""
        body = _trim(t, ts, nxt)
        if body[1] > body[0]:
            ent.parts = [Part(body[0], body[1])]
        else:
            ent.notes.append("group heading: no text of its own")
        if len(terms) < 2:
            ent.notes.append("fewer than two terms in the heading")
        entries.append(ent)
    return entries


# --- Ibn al-Anbārī, al-Aḍdād ----------------------------------------------------------------------
_ADDAD_NUM = re.compile(r"(?:^|(?<=\n))(?P<num>\d{1,3}(?:\s*-\s*\d{1,3})?)\s*-\s*")


def parse_addad(c: Clean) -> list[Entry]:
    t = c.text
    starts = [(m.start(), m.end(), re.sub(r"\s*-\s*", "-", m.group("num"))) for m in _ADDAD_NUM.finditer(t)]
    entries = []
    for seq, (s, after_num, num) in enumerate(starts, 1):
        nxt = starts[seq][0] if seq < len(starts) else len(t)
        auto = next(((a, b) for a, b in c.auto_spans if after_num <= a < nxt), None)
        if auto is None:
            headword, heading = "", (s, after_num)
        else:
            headword, heading = t[auto[0] : auto[1]], (auto[0], auto[1])
        ent = Entry(seq, s, nxt, heading, headword, printed_number=num, terms=[headword] if headword else [])
        body = _trim(t, after_num, nxt)
        ent.parts = [Part(body[0], body[1])] if body[1] > body[0] else []
        if auto is None:
            ent.notes.append("no bold headword in the entry")
        elif auto[0] - after_num > 120:
            ent.notes.append("bold headword far from the entry number")
        if "-" in num:
            ent.notes.append("two entry numbers printed together")
        entries.append(ent)
    return entries


PARSERS = {"nuzha": parse_nuzha, "damghani": parse_damghani, "furuq": parse_furuq, "addad": parse_addad}
