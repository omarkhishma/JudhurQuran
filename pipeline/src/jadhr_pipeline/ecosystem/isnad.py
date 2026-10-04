"""The isnād and the matn told apart by rule (PLAN P11.2b, research 21 §3): a record's text read as a chain —
a transmission formula, a narrator's name, the next formula — up to where the report begins.

The convention (proposed in research 21 §3.2, the owner's or the board's to settle): the isnād holds every
transmission formula and narrator up to the Companion's name, honorific and introducing verb, and the Prophet's mention
with its verb when his words follow in quotation marks; the matn is everything reported; the collector's own comments
(«قال أبو عيسى …») are a third part. A record that only points to another chain («بهذا الإسناد مثله») has no matn of its
own.

Every split is positions in the verbatim text, never a change to it, with the rule that made it; a record the rules
cannot read is left whole (``None``) rather than guessed. Shown as «تقسيم آلي» until a person checks it. The names
are the spans the parse found between formulas, for the narrator linking.

Two passes: the chains the rules read without any knowledge of names give the names the corpus uses (``known_names``);
the second pass reads «قال أنس كان …» as a narrator and his report only when «أنس» is such a name."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field

from jadhr_arabic import normalize

# a word (letters and their marks), or a mark the parse reads: comma, colon, full stop, quote, dash, bracket, brace
_TOKEN = re.compile(r"[ء-غف-يً-ٰٟٱ-ۓ]+|[،,؛:.\"«»\-–ـ(){}]")


def _words(s: str) -> frozenset[str]:
    return frozenset(normalize(w) for w in s.split())


FORMULAS = _words(
    """حدثنا حدثني حدثه حدثهم حدثها حدثتني حدثتنا حدثته حدثتهم حدثاه حدثوه حدثناه حدثنيه يحدث يحدثه تحدث حدث
    أخبرنا أخبرني أخبره أخبرهم أخبرها أخبرتني أخبرتنا أخبرته أخبراه أخبرناه أخبرنيه يخبر أخبر أنبأنا أنبأني أنبأه
    نبأنا ثنا نا أنا عن سمعت سمع سمعنا سمعا سمعه سمعها سمعته سمعتها سمعتهم سمعناه يسمع رواه يرويه يرفعه رفعه قرأت
    قرئ"""
)
INTRO = _words("قال قالت قالا قالوا يقول تقول يقولان يقولون فقال فقالت")
THAT = _words("أن أنه أنها أنهم أنهما")
NAME_LINKS = _words("بن ابن بنت ابنة أبو أبي أبا أم عبد مولى")
# words that join narrators rather than name one: «كلاهما عن أيوب», «جميعا عن …»
COLLECTIVE = _words("كلاهما كلهم كلاهم جميعا")
# an aside without dashes: «وهو ابن زيد», «يعني ابن الحارث»
ASIDE = _words("وهو يعني هو وهي")
# what a narrator is described as after his name: «أم سلمة، زوج النبي ﷺ»
EPITHETS = _words("زوج صاحب خادم حليف مولى")
REFERENCE = _words("مثله نحوه بمعناه بنحوه بمثله معناه نحوا مثل نحو بمعنى")
CHAIN_REF = _words("بإسناد بإسناده بإسنادهما بإسنادهم وبإسناده")
# words a chain may put where a name stands («عن من سمع …») that never name a narrator of their own
WAS = _words("كان كانا كانت كانوا")
# a short phrase of place between a narrator and his verb («على المنبر», «وهو على المنبر», «في المسجد»)
PLACE = _words("على وهو في بمنى بمكة بالمدينة")
NOT_NAMES = _words("من ما لا إن إذا لم لن قد كل هل أو ثم بل في على إلى كان كانت هذا هذه ذلك رجل رجلا امرأة")
PUNCT = frozenset("،,؛:.")
QUOTES = frozenset('"«{')
DASHES = frozenset("-–ـ")
# the collector's own voice after the report, per book
COMMENTS: dict[str, list[tuple[str, ...]]] = {
    "tirmidhi": [("قال", "ابو", "عيسي")],
    "abudawud": [("قال", "ابو", "داود")],
    "nasai": [("قال", "ابو", "عبد", "الرحمن")],
    "bukhari": [("قال", "ابو", "عبد", "الله")],
    "ibnmajah": [("قال", "ابو", "الحسن")],
    "muslim": [("قال", "ابو", "اسحاق")],
    "malik": [("قال", "مالك"), ("قال", "يحيي")],
}


@dataclass
class Tok:
    raw: str
    norm: str
    start: int
    end: int


@dataclass
class Split:
    isnad: tuple[int, int]  # [start, end) in the text
    matn: tuple[int, int] | None  # None: the record points to another chain
    comment: tuple[int, int] | None
    rule: str
    names: list[tuple[int, int]] = field(default_factory=list)  # the narrators' names, in chain order

    def as_meta(self) -> dict[str, object]:
        return {
            "method": "rules-v1",
            "rule": self.rule,
            "status": "auto",
            "isnad": list(self.isnad),
            "matn": list(self.matn) if self.matn else None,
            "comment": list(self.comment) if self.comment else None,
            "names": [list(n) for n in self.names],
        }


def tokens(text: str) -> list[Tok]:
    out = []
    for m in _TOKEN.finditer(text):
        raw = m.group()
        mark = raw in PUNCT or raw in QUOTES or raw in DASHES or raw in "»()}"
        out.append(Tok(raw, "" if mark else normalize(raw), m.start(), m.end()))
    return out


def _formula(t: Tok) -> bool:
    n = t.norm
    return n in FORMULAS or (n[:1] in ("و", "ف") and n[1:] in FORMULAS)


def _prophet(ts: list[Tok], i: int) -> int:
    """How many tokens the Prophet's mention at ``i`` takes (0 if none): رسول الله، النبي، نبي الله, and the
    honorific and dashes after it."""
    n = [t.norm for t in ts[i : i + 2]]
    if n[:2] in (["رسول", "الله"], ["نبي", "الله"]):
        j = i + 2
    elif n[:1] == ["النبي"]:
        j = i + 1
    else:
        return 0
    return _honorific(ts, j) - i


def _honorific(ts: list[Tok], j: int) -> int:
    """Past «صلى الله عليه وسلم», «عليه السلام», «رضي الله عنه» and the dashes or brackets around them."""
    while True:
        k = j
        while k < len(ts) and ts[k].raw in DASHES | {"(", ")"}:
            k += 1
        n = [t.norm for t in ts[k : k + 4]]
        if n == ["صلي", "الله", "عليه", "وسلم"]:
            k += 4
        elif n[:2] in (["عليه", "السلام"], ["عليهما", "السلام"]):
            k += 2
        elif n[:2] == ["رضي", "الله"]:
            k += 3
        else:
            return j
        while k < len(ts) and ts[k].raw in DASHES | {"(", ")"}:
            k += 1
        j = k


def _skip_marks(ts: list[Tok], i: int) -> int:
    while i < len(ts) and ts[i].raw in PUNCT:
        i += 1
    return i


def _quote_at(ts: list[Tok], i: int) -> bool:
    i = _skip_marks(ts, i)
    return i < len(ts) and ts[i].raw in QUOTES


def _seq(ts: list[Tok], i: int, words: tuple[str, ...]) -> bool:
    return [t.norm for t in ts[i : i + len(words)]] == list(words)


def _comment(ts: list[Tok], start: int, book: str) -> int | None:
    for i in range(max(start, 0), len(ts)):
        for phrase in COMMENTS.get(book, []):
            if _seq(ts, i, phrase) or (ts[i].norm == "و" + phrase[0] and _seq(ts, i + 1, phrase[1:])):
                return i
    return None


def _part_start(text: str, at: int) -> int:
    """A part begins with the marks the source puts before its first word (its RLM, its quote)."""
    while at > 0 and text[at - 1] in "‏‎":
        at -= 1
    return at


def split(text: str, book: str, known: frozenset[str] = frozenset()) -> Split | None:
    """The record's parts by rule, or None where its chain does not read as the rules know it."""
    return _Parse(text, book, known).run()


NAME_RATIO = 0.02


def known_names(splits: Iterable[tuple[str, Split | None]], least: int = 3) -> frozenset[str]:
    """The names the corpus's chains use at least ``least`` times right after a transmission formula («عن أنس»,
    «حدثنا قتيبة»), normalised, from a first pass — so a word the parse once took for a name («أنه كان يقول») does not
    become one."""
    seen: Counter[str] = Counter()
    reported: Counter[str] = Counter()
    for text, s in splits:
        if s is None:
            continue
        ts = tokens(text)
        starts = {t.start: k for k, t in enumerate(ts)}
        for a, b in s.names:
            k = starts.get(a)
            if k is None or k == 0 or not _formula(ts[k - 1]):
                continue
            seen[" ".join(normalize(w) for w in text[a:b].split())] += 1
        if s.matn:
            reported.update(t.norm for t in ts if t.norm and s.matn[0] <= t.start < s.matn[1])
    # a one-word name must stand after a formula often enough beside its uses in reports: «عمر» does (104 times as a
    # narrator to 3,374 in reports, 0.031 — he is mostly «عمر بن الخطاب»); «الصلاة», put after «عن» by a misread
    # chain or two (3 to 2,026, 0.001), does not
    return frozenset(
        n
        for n, c in seen.items()
        if c >= least and n not in NOT_NAMES and (" " in n or c >= NAME_RATIO * reported[n])
    )


class _Parse:
    def __init__(self, text: str, book: str, known: frozenset[str]) -> None:
        self.text = text
        self.book = book
        self.known = known
        self.known_first = frozenset(n.split()[0] for n in known)
        self.ts = tokens(text)
        self.names: list[tuple[int, int]] = []

    # ─── the tokens ─────────────────────────────────────────────────────────

    def norm(self, i: int) -> str:
        return self.ts[i].norm if 0 <= i < len(self.ts) else ""

    def marks(self, i: int) -> int:
        return _skip_marks(self.ts, i)

    def formula(self, i: int) -> bool:
        return 0 <= i < len(self.ts) and _formula(self.ts[i])

    def plain(self, i: int) -> bool:
        """A word that is no formula, verb of saying, «أن», reference, taḥwīl or mention of the Prophet."""
        n = self.norm(i)
        return bool(
            n
            and not _formula(self.ts[i])
            and n not in INTRO
            and n not in THAT
            and n not in REFERENCE
            and n not in COLLECTIVE
            and n not in CHAIN_REF
            and n not in ("ح", "و", "بهذا", "وبهذا")
            and not _prophet(self.ts, i)
        )

    def link(self, i: int) -> bool:
        n = self.norm(i)
        return n in NAME_LINKS or (n[:1] == "و" and n[1:] in NAME_LINKS)

    def name_end(self, i: int) -> int:
        """A name runs until a mark, a formula, a verb of saying, «أن», the Prophet's mention or an honorific; a
        name the typing broke with a comma («محمد، بن بكر», «إسماعيل بن أبي، خالد عن») runs on past it."""
        j = i
        while j < len(self.ts) and j - i < 12:
            n = self.norm(j)
            if not self.plain(j) or n == "رضي" or (j > i and (n in EPITHETS or n in WAS or self.joins(j))):
                break
            j += 1
        k = self.marks(j)
        if j > i and k > j and self.plain(k):
            if self.link(j - 1) or self.norm(k) in ("بن", "ابن", "بنت"):
                return self.name_end(k) if self.name_end(k) > k else j
            e = k
            while e < len(self.ts) and self.plain(e) and e - k < 2:
                e += 1
            if e > k and self.formula(e):
                return e
        return j

    def joins(self, j: int) -> bool:
        """«و» joining another narrator («وزيد بن ثابت», «وأبي سلمة»), not a name that begins with و (وهب، وكيع)."""
        n = self.norm(j)
        return n[:1] == "و" and (n[1:] in NAME_LINKS or n[1:] in self.known_first)

    def add_name(self, a: int, b: int) -> None:
        """Tokens a..b-1 as a narrator's name; a «و» joining a co-narrator is not part of it."""
        start = self.ts[a].start
        n = self.ts[a].norm
        if n[:1] == "و" and (
            n[1:] in NAME_LINKS or " ".join([n[1:]]) in self.known or self.norm(a - 1) == ""
        ):
            j = start + 1
            while j < self.ts[a].end and "ً" <= self.text[j] <= "ٟ":
                j += 1
            start = j
        self.names.append((start, self.ts[b - 1].end))

    def extras(self, i: int) -> int:
        """Past honorifics, asides (in dashes or not), epithets and marks after a name."""
        while True:
            j = self.marks(_honorific(self.ts, self.marks(i)))
            if j < len(self.ts) and self.ts[j].raw in "-–":
                for k in range(j + 1, min(j + 14, len(self.ts))):
                    if self.ts[k].raw in "-–":
                        j = k + 1
                        break
            elif self.norm(j) in ASIDE:
                k = j + 1
                while k < len(self.ts) and self.plain(k) and k - j < 8:
                    k += 1
                j = k
            elif self.norm(j) in EPITHETS:
                k = j + 1
                if _prophet(self.ts, k):
                    k += _prophet(self.ts, k)
                else:
                    k = self.name_end(k)
                j = k
            j = self.marks(j)
            if j == i:
                return i
            i = j

    def known_at(self, i: int) -> int:
        """The end of the longest known name starting at ``i`` (``i`` if none), carried on through its links
        («عبد الله» known, «عبد الله بن قيس» read whole)."""
        best = i
        words: list[str] = []
        for j in range(i, min(i + 6, len(self.ts))):
            if not self.plain(j):
                break
            words.append(self.norm(j))
            if " ".join(words) in self.known:
                best = j + 1
        while best > i and self.link(best) and self.plain(best + 1):
            best += 2
        return best

    def done(self, matn: int | None, rule: str, tail: int) -> Split:
        """The parts tile the text: the isnād up to the matn (or the comment, or the end), the matn up to the
        comment, the comment to the end."""
        ts, text = self.ts, self.text
        if matn is None or matn >= len(ts):
            c = _comment(ts, tail, self.book)
            end = _part_start(text, ts[c].start) if c is not None else len(text)
            return Split((0, end), None, (end, len(text)) if c is not None else None, rule, self.names)
        m = _part_start(text, ts[matn].start)
        c = _comment(ts, matn + 1, self.book)
        if c is not None:
            cs = _part_start(text, ts[c].start)
            return Split((0, m), (m, cs), (cs, len(text)), rule, self.names)
        return Split((0, m), (m, len(text)), None, rule, self.names)

    # ─── the chain ──────────────────────────────────────────────────────────

    def run(self) -> Split | None:
        ts = self.ts
        if not ts:
            return None
        i = self.marks(0)
        if _comment(ts, i, self.book) == i:
            return Split((0, 0), None, (_part_start(self.text, ts[i].start), len(self.text)), "comment-only")
        if self.norm(i) in INTRO or self.norm(i) in ("وقال",):
            # a chain the collector opens with «وقال الليث حدثني …» (a taʿlīq)
            e = self.name_end(i + 1)
            if e > i + 1 and self.formula(self.marks(e)):
                self.add_name(i + 1, e)
                i = self.marks(e)
            else:
                return None
        elif not (self.formula(i) or self.norm(i) in ("بهذا", "وبهذا") or self.norm(i) in CHAIN_REF):
            return None
        for _ in range(60):
            i = self.marks(i)
            r = self.unit(i)
            if isinstance(r, Split) or r is None:
                return r
            i = r
        return None

    def unit(self, i: int) -> Split | int | None:
        """One link of the chain from ``i``: formulas, then a name and what follows it."""
        ts = self.ts
        if self.norm(i) in ("بهذا", "وبهذا") and self.norm(i + 1) == "الاسناد":
            return self.after_reference(i + 2)
        if self.norm(i) in CHAIN_REF:
            return self.after_reference(self.name_end(i + 1))
        f = i
        while i < len(ts) and (
            self.formula(i) or self.norm(i) in ("ح", "و") or self.norm(i) in COLLECTIVE or ts[i].raw in PUNCT
        ):
            i += 1
        if i >= len(ts):
            return self.done(None, "chain-only", i)
        if _prophet(ts, i):
            return self.prophet_end(i)
        if f < i and self.norm(i) in INTRO:
            # «أنه سمعه يقول …»: heard, and the report follows the verb
            return self.after_name(i)
        if f == i and not self.names:
            return None
        if self.norm(i) in ("بهذا", "وبهذا") or self.norm(i) in CHAIN_REF:
            return i
        if not self.plain(i):
            return None
        e = self.name_end(i)
        self.add_name(i, e)
        return self.after_name(e)

    def after_reference(self, k: int) -> Split | int | None:
        """After «بهذا الإسناد» or «بإسناد فلان»: a pointer («مثله»), the Prophet's words, or more chain."""
        k = self.marks(k)
        n = self.norm(k)
        if n in REFERENCE:
            return self.done(None, "chain-reference", k + 1)
        if n in INTRO:
            k2 = self.marks(k + 1)
            if _prophet(self.ts, k2):
                return self.prophet_end(k2)
            if self.norm(k2) in INTRO and _prophet(self.ts, self.marks(k2 + 1)):
                return self.prophet_end(self.marks(k2 + 1))
            return self.done(k2, "companion-said", k + 1)
        if _prophet(self.ts, k):
            return self.prophet_end(k)
        return k

    def after_name(self, i: int) -> Split | int | None:
        """What follows a narrator's name: the next link (its index), the report (a Split), or a form the rules
        do not know (None)."""
        ts = self.ts
        for _ in range(12):
            i = self.extras(i)
            if i >= len(ts):
                return self.done(None, "chain-only", i)
            n = self.norm(i)
            if self.formula(i) or n == "ح" or n in COLLECTIVE:
                return i
            if (n in ("بهذا", "وبهذا") and self.norm(i + 1) == "الاسناد") or n in CHAIN_REF:
                return i
            if n in REFERENCE:
                return self.done(None, "chain-reference", i + 1)
            if n[:1] == "و" and self.plain(i):
                # a co-narrator joined with «و» («وزهير بن حرب»)
                e = self.name_end(i)
                self.add_name(i, e)
                i = e
                continue
            if n in INTRO:
                return self.after_verb(i)
            if n in PLACE:
                # «سمعت عمر بن الخطاب على المنبر قال …»: where he said it, then his verb
                k = i + 1
                while k < len(ts) and self.plain(k) and k - i < 4:
                    k += 1
                if self.norm(self.marks(k)) in INTRO:
                    i = self.marks(k)
                    continue
                return None
            if n in THAT:
                r = self.after_that(i)
                if isinstance(r, tuple):
                    i = r[0]
                    continue
                return r
            return None
        return None

    def after_verb(self, i: int) -> Split | int | None:
        """After a narrator's «قال»/«يقول»: the next formula, a narrator named before his own verb, the Prophet,
        or the report."""
        ts = self.ts
        k = self.marks(i + 1)
        if self.formula(k) or self.norm(k) == "ح":
            return k
        if _prophet(ts, k):
            return self.prophet_end(k)
        if self.norm(k) in INTRO:
            k2 = self.marks(k + 1)
            if _prophet(ts, k2):
                return self.prophet_end(k2)
            if self.formula(k2):
                return k2
            # «قال قال إسحاق قال أنس …»: a narrator named after the verb — unless he speaks inside the story
            e = self.known_at(k2)
            if e > k2:
                if self.character(e):
                    return self.done(k, "character-said", k)
                self.add_name(k2, e)
                return self.after_named(e)
            return self.done(k2, "companion-said", k + 1)
        # «قال زهير حدثنا»: whose wording follows, the chain going on
        e = self.name_end(k)
        if self.plain(k) and e - k <= 6 and self.formula(self.marks(e)):
            return self.marks(e)
        e = self.known_at(k)
        if e > k:
            if self.character(e):
                # «سمعت جابر بن سمرة قال عمر لسعد …»: the verb is the speaker's in the story
                return self.done(i, "character-said", i)
            self.add_name(k, e)
            return self.after_named(e)
        return self.done(k, "companion-said", i + 1)

    def character(self, e: int) -> bool:
        """A named speaker who talks to someone inside the report («… لسعد», «… يا رسول الله»), not a narrator."""
        k = self.extras(e)
        n = self.norm(k)
        return n == "يا" or (n[:1] == "ل" and n not in ("لا", "لم", "لن", "لقد", "لما") and len(n) > 1)

    def after_named(self, e: int) -> Split | int | None:
        """After «قال أنس»: his verb again and more chain («قال أبو بكر ووكيع عن إسرائيل»), or his report."""
        k = self.extras(e)
        while self.joins(k):
            e2 = self.name_end(k)
            self.add_name(k, e2)
            k = self.extras(e2)
        if self.norm(k) in INTRO:
            return self.after_verb(k)
        if self.formula(k):
            return k
        if _prophet(self.ts, k):
            return self.prophet_end(k)
        if self.norm(k) in THAT:
            r = self.after_that(k)
            return self.after_name(r[0]) if isinstance(r, tuple) else r
        return self.done(k, "named-said", k)

    def after_that(self, i: int) -> Split | int | tuple[int] | None:
        """After «أن»/«أنه»: a narrator's verb (the chain goes on), Mālik's «بلغه», the Prophet, a narrator
        introduced by «أن», or the report itself. A tuple is an index to go on reading a name's followers from."""
        ts = self.ts
        k = self.marks(i + 1)
        nk = self.norm(k)
        if self.formula(k):
            # «أنه سمع …», «أنهما سمعا …», «أنه حدثه …»: the chain goes on
            return k
        if nk in ("بلغه", "بلغني"):
            # Mālik's balāgh: «أنه بلغه أن عبد الله بن عمر كان يقول …» names its source as «أن» does
            k2 = self.marks(k + 1)
            if self.norm(k2) in THAT:
                r = self.after_that(k2)
                if isinstance(r, Split) and r.rule == "companion-that":
                    r.rule = "balagh"
                return r
            return self.done(k2, "balagh", k2)
        if _prophet(ts, k):
            kk = self.marks(k + _prophet(ts, k))
            if self.norm(kk) in INTRO and _quote_at(ts, kk + 1):
                return self.done(self.marks(kk + 1), "prophet-speech", kk + 1)
            return self.done(i, "that-prophet", i)
        # «أن عبد الله بن عتبة، قال سمعت …», «أن ابن أبان، أخبره قال …»: a narrator introduced by «أن» — a name
        # with its links, or one the chains use («أن عائشة قالت»), never a verb («أنه كان يقول»)
        e = self.name_end(k) if self.plain(k) else k
        if e > k and (any(self.link(j) for j in range(k, e)) or self.known_at(k) == e):
            names = [(k, e)]
            after = self.extras(e)
            # «أن عبد الله بن عمر وزيد بن ثابت كانا يقولان»: the co-narrators, and «كان» before the verb
            while self.joins(after):
                e2 = self.name_end(after)
                names.append((after, e2))
                after = self.extras(e2)
            if self.norm(after) in WAS and self.norm(self.marks(after + 1)) in INTRO:
                after = self.marks(after + 1)
            na = self.norm(after)
            if na in INTRO:
                for a, b in names:
                    self.add_name(a, b)
                return (after,)
            if self.formula(after) and na not in ("عن", "وعن"):
                # «أن أبا يونس حدثه عن …», «أن ربيع بنت معوذ أخبرته قالت …»
                for a, b in names:
                    self.add_name(a, b)
                return (after + 1,) if na not in ("سمع", "سمعت") else after
        # «عن عائشة أنها …»: the report begins at «أن»
        return self.done(i, "companion-that", i)

    def prophet_end(self, p: int) -> Split:
        """At the Prophet's mention: his words in quotes begin the matn; else the report after the mention."""
        ts = self.ts
        k = self.marks(p + _prophet(ts, p))
        if self.norm(k) in REFERENCE or self.norm(k) in ("بهذا", "وبهذا"):
            # «عن النبي ﷺ مثله», «… بهذا الحديث»: the words are another record's
            return self.done(None, "chain-reference", k + 1)
        that = k if self.norm(k) in THAT else None
        if that is not None:
            k += 1
        if self.norm(k) in INTRO:
            k += 1
            if _quote_at(ts, k):
                return self.done(self.marks(k), "prophet-speech", k)
            return self.done(self.marks(k), "prophet-said", k)
        if _quote_at(ts, k):
            return self.done(self.marks(k), "prophet-speech", k)
        # «عن النبي ﷺ أنه صلى …»: the report begins at «أنه», as «عن عائشة أنها …» does
        return self.done(that if that is not None else k, "prophet-report", k)


STRONG = _words("حدثنا حدثني أخبرنا أخبرني أنبأنا أنبأني ثنا نا سمعت")
# words that name who else reported a hadith, a known name after them: «تابعه الزبيدي», «حفظناه من الزهري»
WEAK = _words("تابعه تابعهم وتابعه من عند")
# fixed formulas of blessing and praise, in normalised words: they say nothing of what a hadith is about
FORMULAIC = [
    tuple(normalize(w) for w in f.split())
    for f in (
        "صلى الله عليه وسلم",
        "رضي الله عنه",
        "رضي الله عنها",
        "رضي الله عنهما",
        "رضي الله عنهم",
        "عليه السلام",
        "عليها السلام",
        "عليهما السلام",
        "عليهم السلام",
        "عز وجل",
        "جل وعز",
        "تبارك وتعالى",
        "سبحانه وتعالى",
    )
]


def chain_words(
    text: str, s: Split | None, known: frozenset[str]
) -> tuple[list[tuple[int, int]], list[tuple[int, int]], list[tuple[int, int]]]:
    """Every narrator's name in the record, its isnād's and those of the chains elsewhere in it (Muslim's further
    chains after a report, a collector's comment, a record the rules could not split); the formulas that introduce
    them; and the fixed formulas of blessing («صلى الله عليه وسلم») — the words a root's life must not count
    («الزهري» is a narrator, not the root زهر; «صلى» there is a blessing, not the root صلو of prayer).

    After «حدثنا»-like formulas any name; after «عن», «تابعه», «من» only a name the chains use, or one with its links
    («عن أبي هريرة», never «عن الصلاة»); after «قال» only a known name that does not speak inside the story."""
    p = _Parse(text, "", known)
    ts = p.ts
    p.names = names = list(s.names) if s else []
    formulas: list[tuple[int, int]] = []
    blessings: list[tuple[int, int]] = []

    def with_co_narrators(e: int) -> None:
        """«رواه يونس وصالح ومعمر», «قال إسرائيل وزهير»: the names joined to the one just read."""
        k = p.marks(e)
        while p.joins(k):
            e2 = p.name_end(k)
            p.add_name(k, e2)
            k = p.marks(e2)

    def inside(pos: int) -> bool:
        return any(a <= pos < b for a, b in names)

    for i, t in enumerate(ts):
        if not t.norm:
            continue
        for f in FORMULAIC:
            if _seq(ts, i, f):
                blessings.append((t.start, ts[i + len(f) - 1].end))
        if inside(t.start):
            continue
        j = p.marks(i + 1)
        if j >= len(ts):
            break
        weak = t.norm in WEAK
        if p.formula(i) or weak:
            if inside(ts[j].start):
                if not weak:
                    formulas.append((t.start, t.end))
                continue
            if not p.plain(j):
                continue
            strong = t.norm in STRONG or (t.norm[:1] in ("و", "ف") and t.norm[1:] in STRONG)
            known_end = p.known_at(j)
            if strong:
                e = p.name_end(j)
            elif known_end > j:
                # a known name ends where it ends («عن الزهري في الجهر»)
                e = known_end
            else:
                e = p.name_end(j)
                if weak or not any(p.link(x) for x in range(j, e)):
                    continue
            names.append((ts[j].start, ts[e - 1].end))
            if not weak or t.norm[:3] in ("تاب", "وتا"):
                formulas.append((t.start, t.end))
            with_co_narrators(e)
        elif t.norm in INTRO or t.norm == "وقال":
            e = p.known_at(j)
            if e > j and not p.character(e) and not inside(ts[j].start):
                names.append((ts[j].start, ts[e - 1].end))
                with_co_narrators(e)
    return sorted(names), formulas, blessings
