"""Where a row names a pattern and where it gives example words — spans into the row text, never copies.

The sarf books cite a pattern with the scale letters ف ع ل and the augment letters (الميزان الصرفي: فاعل،
مفعول، استفعل), unvowelled in these digital texts. A token is a *pattern word* when, marks stripped, it
holds ف once, ع and ل once or twice (فعلل، فعيعل), in that order, its other letters are augments (سألتمونيها,
the alef and hamza forms, ى ة), what stands before its ف is a prefix augment (أ ا إ آ ت م ن س ي), and it
does not start with the article. One proclitic (و ف ب ك ل) is peeled off when what remains is a pattern
word («ففعل»، «وفاعل»، «بيفعل»); a final accusative alef is dropped («فعلا» → فعل) and noted. «فعلى»
before «لفظ / زنة / وزن» is «فـ + على» («فعلى لفظ المفعول»), not the pattern fu'laa.

Example words follow a cue: «نحو» (and the edition's slip «محو»), «مثل», «ك» written apart or joined to
its word, «و منه», and in noun chapters «جاء / جاءت» and an «على» that follows an example or «جاء»
(«نحو ركع على ركوع»، «و جاءت على خشن»). A list runs over items joined by «و» or «،» and stops at a word
that closes it (``STOP``), at a word with the article when the list's first item had none, or at a line
or sentence end. Items are one word in noun chapters, at most two in verb chapters («أغد البعير»،
«كسرته فتكسر»); a parenthesised group (al-Kāfiya: «(زيد أفضل الناس)») is one item.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from jadhr_arabic import display_bare

TOKEN = re.compile(f"[{chr(0x0621)}-{chr(0x063A)}{chr(0x0641)}-{chr(0x0652)}{chr(0x0670)}{chr(0x0671)}]+")
SCALE = "فعل"
AUGMENT = set("اأإآتسمنويىةءئؤ")
PREFIX_AUGMENT = set("اأإآتمنسي")
PATTERN_LETTERS = set(SCALE) | AUGMENT
CLITICS = "وفبكل"
PREPOSITION_AFTER = {"لفظ", "زنة", "وزن"}

STOP = {
    "أي", "إلا", "الا", "بخلاف", "فإنه", "فانه", "ليس", "شاذ", "قليل", "قليلا", "فقليل", "أقل", "اقل",
    "فنادران", "نادر", "على", "في", "فيهما", "بالكسر", "بالضم", "بالفتح", "فتحا", "غالبا", "كثيرا",
    "حتى", "لا", "فمن", "ومن", "من", "وقد", "قد", "وهي", "هي", "وأما", "أما", "واما", "وقال", "قال",
    "وكذلك", "كذلك", "والباقي", "للتكثير", "فهذا", "وهو", "هو", "ثم", "إما", "أو", "او", "مثله",
    "ونحو", "نحو", "محو", "مثل", "ك", "فما", "لتقليل", "فلا", "ولا", "ليتميز", "كما", "لأنه", "لانه",
    "وما", "ما", "مما", "منه", "ومنه", "جاء", "وجاء", "جاءت", "وجاءت", "مختص", "فإن", "فان", "قياسا",
    "مطردا", "أصله", "اصله", "فيجيء", "يجيء", "تجيء", "وتجيء", "لازما", "متعديا",
}  # fmt: skip


@dataclass
class Tok:
    text: str
    start: int
    end: int


@dataclass
class Mention:
    """A pattern named in a row (``written`` as printed, ``norm`` after peeling clitics / the alef)."""

    written: str
    norm: str
    start: int
    end: int
    role: str = "target"  # head | target | source | reference | inventory | example-only
    examples: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


@dataclass
class Examples:
    cue: int  # token index of the cue
    first: int  # token index of the first item
    items: list[str]
    end: int = 0  # token index where the list stopped


def tokens(text: str) -> list[Tok]:
    return [Tok(m.group(0), m.start(), m.end()) for m in TOKEN.finditer(text)]


def is_pattern_word(word: str) -> bool:
    t = display_bare(word)
    if len(t) < 3 or t.startswith("ال") or any(ch not in PATTERN_LETTERS for ch in t):
        return False
    if t.count("ف") != 1 or not 1 <= t.count("ع") <= 2 or not 1 <= t.count("ل") <= 2:
        return False
    f, a = t.index("ف"), t.index("ع")
    return f <= 3 and all(ch in PREFIX_AUGMENT for ch in t[:f]) and f < a < t.index("ل")


def pattern_norm(word: str) -> tuple[str, list[str]] | None:
    """The pattern a token cites (clitic peeled, accusative alef dropped), or None if it cites none."""
    t = display_bare(word)
    notes: list[str] = []
    if not is_pattern_word(t) and len(t) > 3 and t[0] in CLITICS and is_pattern_word(t[1:]):
        t = t[1:]
        notes.append("proclitic-peeled")
    if not is_pattern_word(t):
        return None
    if t.endswith("ا") and len(t) > 3 and is_pattern_word(t[:-1]):
        t = t[:-1]
        notes.append("accusative-alef-dropped")
    return t, notes


def mention_at(toks: list[Tok], i: int) -> tuple[str, list[str]] | None:
    """``pattern_norm`` of token i, except «فعلى» used as «فـ + على» before «لفظ / زنة / وزن»."""
    pn = pattern_norm(toks[i].text)
    after = display_bare(toks[i + 1].text) if i + 1 < len(toks) else ""
    if pn and display_bare(toks[i].text) == "فعلى" and after in PREPOSITION_AFTER:
        return None
    return pn


def _bare(t: Tok) -> str:
    return display_bare(t.text)


def example_items(text: str, toks: list[Tok], i: int, limit: int, max_words: int) -> tuple[list[str], int]:
    """The list of example items starting at token i (just after its cue), up to token index ``limit``.
    Returns the items as written and the index where the list stopped."""
    items: list[str] = []
    cur: list[tuple[int, int]] = []  # (start, end) of the words of the current item
    first_has_article: bool | None = None

    def flush() -> None:
        if cur:
            items.append(text[cur[0][0] : cur[-1][1]])
            cur.clear()

    j = i
    after_joiner = False
    while j < limit:
        tk = toks[j]
        w = _bare(tk)
        gap = text[toks[j - 1].end : tk.start] if j > i else text[: tk.start][-2:]
        if j > i and ("\n" in gap or "." in gap or ":" in gap or "؛" in gap):
            break
        if "(" in gap:
            # a parenthesised group is one item
            close = text.find(")", tk.start)
            stop = len(text) if close < 0 else close
            flush()
            k = j
            while k < limit and toks[k].start < stop:
                k += 1
            items.append(text[tk.start : toks[k - 1].end])
            j = k
            continue
        if w in STOP or (mention_at(toks, j) and not items and not cur):
            break
        if mention_at(toks, j):
            break
        if j > i and ("،" in gap or "," in gap):
            flush()
        if w == "و":
            flush()
            after_joiner = True
            j += 1
            continue
        start = tk.start
        if cur and not after_joiner and len(w) > 2 and w[0] == "و":
            flush()  # «فرح ووثق»: a joined conjunction starts the next item
        if not cur and not after_joiner and len(w) > 2 and w[0] == "و" and (items or j > i):
            start += 1  # «وبريء»: a joined conjunction is not part of the example
            w = w[1:]
            if w in STOP:
                break
        after_joiner = False
        if not cur:
            has_article = w.startswith("ال")
            if first_has_article is None:
                first_has_article = has_article
            elif has_article and not first_has_article:
                break  # «كارمته و شاعرته و المتعدي …»: a new clause, not another example
        elif len(cur) >= max_words:
            break
        cur.append((start, tk.end))
        j += 1
    flush()
    return [x for x in items if x.strip()], j


_CAME = ("جاء", "وجاء", "جاءت", "وجاءت")


def _is_cue(toks: list[Tok], j: int, start: int, end: int, noun: bool, last_example_end: int) -> bool:
    """True when token j opens an example list (the list starts at j + 1)."""
    if j + 1 >= end:
        return False
    w, nxt = _bare(toks[j]), _bare(toks[j + 1])
    if w in ("نحو", "محو", "مثل", "ك"):
        return True
    if not noun:
        return w in ("ومنه", "منه") and not mention_at(toks, j + 1)
    if w in _CAME:
        return nxt not in ("على", "معه", "في") and not nxt.startswith(("لل", "ب"))
    if w == "على" and nxt not in PREPOSITION_AFTER and not mention_at(toks, j + 1):
        prev = _bare(toks[j - 1]) if j > start else ""
        return last_example_end == j or prev in _CAME
    return False


def find_examples(text: str, toks: list[Tok], start: int, end: int, noun: bool) -> list[Examples]:
    """Example lists between token indices [start, end)."""
    out: list[Examples] = []
    max_words = 1 if noun else 2
    j = start
    last_example_end = -1
    while j < end:
        w = _bare(toks[j])
        nxt = _bare(toks[j + 1]) if j + 1 < end else None
        cue_at = j + 1 if _is_cue(toks, j, start, end, noun, last_example_end) else None
        if cue_at is None and len(w) > 2 and w[0] == "ك" and w not in STOP:
            # «كسقم و مرض»: ك joined to the first of a list; «كمضروب» right after a pattern
            joined_list = nxt == "و"
            after_pattern = j > start and mention_at(toks, j - 1) is not None
            if joined_list or after_pattern:
                items, k = example_items(text, toks, j, end, max_words)
                if items and (len(items) >= 2 or after_pattern):
                    items[0] = items[0][1:] if items[0].startswith("ك") else items[0]
                    out.append(Examples(j, j, items, k))
                    last_example_end = k
                    j = max(k, j + 1)
                    continue
        if cue_at is not None and cue_at < end:
            items, k = example_items(text, toks, cue_at, end, max_words)
            if items:
                out.append(Examples(j, cue_at, items, k))
                last_example_end = k
            j = max(k, j + 1)
            continue
        j += 1
    return out


__all__ = [
    "PREPOSITION_AFTER",
    "STOP",
    "Examples",
    "Mention",
    "Tok",
    "example_items",
    "find_examples",
    "is_pattern_word",
    "mention_at",
    "pattern_norm",
    "tokens",
]
