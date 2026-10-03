"""Ibn Fāris's statement of what a root means, cut from the opening of its Maqāyīs article (P3.4).

Maqāyīs opens nearly every article with the letters and a statement of their aṣl or uṣūl: «العين واللام
والميم أصل صحيح واحد، يدل على أثر بالشيء…». The statement is taken as verbatim slices of the stored
article and nothing else (L2):

* the opening sentence, up to its first full stop;
* when that sentence is only the letters («الباء والهاء واللام.»), the sentence after it, if it states
  an aṣl («أصول ثلاثة: …»); if it goes straight to usage («قال الخليل…»), there is no statement;
* when the statement announces two or more uṣūl or words («أصلان: أحدهما…», «كلمتان.») and names fewer
  than it announces, the opening sentence of each later one, found where Ibn Fāris turns to it
  («والأصل الآخر…», «والأخرى…»), up to the number announced. Slices that are not contiguous are joined
  with « … », so the reader sees that words were left out between them.

Every rule is a test on the text's own wording; nothing is paraphrased or reordered.
"""

from __future__ import annotations

import re

GAP = " … "
_MARKS = "[ً-ْٰـ]*"
_PLAIN = re.compile("[ً-ْٰـ]")
_SENTENCE_END = re.compile(r"\.")
# a sentence starts at the text's start, after a full stop or a semicolon, or at a paragraph break
_START = r"(?:^|(?<=[.؛])\s*|(?<=\n)\s*)"


# the typing writes final yāʾ as ى («والثانى») and drops hamza seats at times («الاول»)
_VARIANTS = {"ي": "[يى]", "ى": "[يى]", "أ": "[أا]", "إ": "[إا]"}


def _word(w: str) -> str:
    """A word that may carry harakāt between its letters; a space matches any run of spaces."""
    return "".join(r"\s+" if c == " " else _VARIANTS.get(c, re.escape(c)) + _MARKS for c in w)


def _any(words: list[str]) -> str:
    return "(?:" + "|".join(_word(w) for w in sorted(words, key=len, reverse=True)) + ")"


_LETTERS_ONLY = re.compile(r"^\s*(?:ال\S+\s+(?:و|ثم)\s*)+ال\S+(?:\s+المعتل\S*)?\s*\.\s*$")
_STATES = re.compile(
    _any(
        [
            "أصل",
            "أصول",
            "أصلان",
            "كلمة",
            "كلمات",
            "كلمتان",
            "يدل",
            "تدل",
            "باب",
            "قياس",
            "يقرب",
            "يتقارب",
            "منحوت",
            "معظم",
        ]
    )
)
_USAGE_START = re.compile(r"^\s*" + _any(["قال", "يقال", "يقولون", "أما", "فأما", "ومن ذلك", "من ذلك"]))
_ANNOUNCES: list[tuple[re.Pattern[str], int]] = [
    (re.compile(_any(["خمسة أصول", "أصول خمسة", "خمس كلمات"])), 5),
    (re.compile(_any(["أربعة أصول", "أصول أربعة", "أربع كلمات"])), 4),
    (re.compile(_any(["ثلاثة أصول", "أصول ثلاثة", "ثلاث كلمات", "ثلاثة أبواب"])), 3),
    (re.compile(_any(["أصلان", "أصلين", "كلمتان", "كلمتين", "بابان", "بابين", "معنيان", "معنيين"])), 2),
]
_FIRST = re.compile(
    _START + _any(["أحدهما", "إحداهما", "أحدها", "إحداها", "فالأول", "فالأولى", "الأول", "الأولى"])
)
_FIRST_IN = re.compile(_any(["أحدهما", "إحداهما", "أحدها", "إحداها", "فالأول", "الأول"]))
_LATER_WORDS = [
    "والآخر",
    "والأخرى",
    "والثاني",
    "والثانية",
    "والثالث",
    "والثالثة",
    "والرابع",
    "والرابعة",
    "والخامس",
    "والأصل الآخر",
    "والأصل الثاني",
    "والأصل الثالث",
    "والأصل الرابع",
    "والأصل الخامس",
    "والباب الآخر",
    "والكلمة الأخرى",
    "والمعنى الآخر",
    "وأما الأصل الأول",
    "فأما الأصل الأول",
    "وأما الأصل الآخر",
    "فأما الأصل الآخر",
]
_LATER = re.compile(_START + _any(_LATER_WORDS))
_LATER_IN = re.compile(_any([*_LATER_WORDS, "ويدل الآخر", "يدل الآخر", "وتدل الأخرى"]))
# the first word given by its usage straight after «كلمتان.»: «يقال لكل شيء…», «فالأجل غاية الوقت…»
_FIRST_BY_USAGE = re.compile(r"\s*(?:" + _any(["يقال", "يقولون", "قولهم"]) + r"|ف?ال)")
FIRST_LOOKAHEAD = 800


def _plain(s: str) -> str:
    return _PLAIN.sub("", s)


def _sentence_end(body: str, start: int) -> int:
    m = _SENTENCE_END.search(body, start)
    return m.end() if m else len(body)


# «قال» as a word of its own (not inside «يقال»), a hemistich mark, or a verse line opening with *
_QUOTE = re.compile(r"[،:]?\s*(?<![\u0621-\u0652])" + _word("قال") + r"\s|\s…\s|\n\s*\*")


def _piece(body: str, s: int, e: int, last: bool) -> str:
    """A later aṣl's opening sentence, cut before a quotation it runs into (a verse, «قال الشاعر…»); a cut
    in the last piece is marked with «…», one before another piece is covered by the gap mark."""
    text = body[s:e].strip()
    m = _QUOTE.search(text)
    if not m or m.start() == 0:
        return text
    return text[: m.start()].rstrip(" ،:") + (" …" if last else "")


def _announced(statement: str) -> int:
    for rx, n in _ANNOUNCES:
        if rx.search(statement):
            return n
    return 1


def _continued(body: str, e: int, have: int, want: int) -> tuple[int, int]:
    """A full stop the typing put inside a sentence («يدل على خلاف. الحِدّة، والثاني…»): the next sentence
    belongs to this one when it names a later aṣl and does not turn to usage."""
    if have >= want:
        return e, have
    nxt = _sentence_end(body, e)
    following = body[e:nxt]
    if _LATER_IN.search(following) and not _USAGE_START.match(following) and not _LATER.match(following):
        return nxt, have + len(_LATER_IN.findall(following))
    return e, have


def core_statement(body: str) -> tuple[str | None, str]:
    """The statement and how it was found: "sentence", "after-letters", "later-usul", "partial" (it announces
    more uṣūl than were found where it turns to them; for editors) or "none"."""
    end = _sentence_end(body, 0)
    kind = "sentence"
    if _LETTERS_ONLY.match(_plain(body[:end])):
        nxt = _sentence_end(body, end)
        following = body[end:nxt]
        if not following.strip() or _USAGE_START.match(following) or not _STATES.search(following):
            return None, "none"
        end, kind = nxt, "after-letters"
    pieces = [(0, end)]
    statement = body[:end]
    want = _announced(statement)
    if _FIRST_IN.search(statement):
        have = 1 + len(_LATER_IN.findall(statement))
    else:
        # a statement that lists its uṣūl itself: «أصولٌ ثلاثة: القصد، والغضب، والتنحّي.»
        listed = statement.split(":", 1)[1] if ":" in statement else ""
        items = len([x for x in listed.split("،") if x.strip()])
        have = max(len(_LATER_IN.findall(statement)), items if items >= 2 else 0)
    if want > 1 and have < want:
        if have:
            end, have = _continued(body, end, have, want)
            pieces = [(0, end)]
        cursor = end
        if not _FIRST_IN.search(statement) and have == 0:
            m = _FIRST.search(body, cursor, min(len(body), cursor + FIRST_LOOKAHEAD))
            if m:
                s = m.start() + (len(m.group(0)) - len(m.group(0).lstrip()))
                e = _sentence_end(body, s)
                e, have = _continued(body, e, have + 1 + len(_LATER_IN.findall(body[s:e])), want)
                pieces.append((s, e))
                cursor = e
            elif _LATER.search(body, cursor) and _FIRST_BY_USAGE.match(body, cursor):
                # «كلمتان. يقال لكلّ شيء حال بين شيئين موبِق. … والكلمة الأخرى…»: the first is given by its
                # usage in the very next sentence, which then belongs to the statement
                e = _sentence_end(body, end)
                pieces[0] = (0, e)
                cursor, have = e, 1
        for m in _LATER.finditer(body, cursor):
            if have >= want:
                break
            s = m.start() + (len(m.group(0)) - len(m.group(0).lstrip()))
            if s < cursor:
                continue
            e = _sentence_end(body, s)
            pieces.append((s, e))
            cursor, have = e, have + len(_LATER_IN.findall(body[s:e]))
        if len(pieces) > 1:
            kind = "later-usul"
    # pieces that touch are one slice: no gap mark between them
    merged: list[tuple[int, int]] = []
    for s, e in pieces:
        if merged and not body[merged[-1][1] : s].strip():
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    if len(merged) == 1 and kind == "later-usul":
        kind = "sentence"
    if want > 1 and have < want:
        kind = "partial"
    text = GAP.join(
        body[s:e].strip() if i == 0 else _piece(body, s, e, i == len(merged) - 1)
        for i, (s, e) in enumerate(merged)
    )
    return text, kind
