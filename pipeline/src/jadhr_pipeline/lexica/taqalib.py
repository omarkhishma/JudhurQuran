"""Kitāb al-ʿAyn (al-Khalīl, d. 170) and Tahdhīb al-Lugha (al-Azharī, d. 370): the permutation-group
dictionaries, from their Shamela typings (books 1682 and 7031).

Both works file every root under a GROUP of letters and treat all its permutations (تقاليب) there:

    باب العين والهاء والقاف (ع هـ ق، هـ ق ع مستعملان) (ع ق هـ، ق ع هـ مهملان)
    هقع: الهَقْعَة دائرة …
    عهق: العَوْهَقُ: الغُرابُ …

Splitting (rule ``taqalib-article-split``, every case counted under it):

* A group starts at its title — a TOC heading, or a line the typist did not tag: spaced letters
  ("ق ص د", "ح ص ن حصن، حنص…: مستعملة."), "(باب الزاي والراء)", "كتاب الحروف الجوف". The title gives
  the group's letters (letter names, spelled letters, "(وا يء)" for a weak radical, or the letters its
  list shares) and its «مستعمل/مهمل» lists; Tahdhīb repeats the list on a line of its own ("عقش، عشق،
  قشع…: مستعملة.", "نزر. رزن… (مستعملة)", "استعمل من وجوهه: (طسوج)"). al-ʿAyn's section titles
  (الثنائي، الثلاثي الصحيح، المعتل، اللفيف، الرباعي، الخماسي) set how many radicals a root has; Tahdhīb
  rarely names them (``section_kinds: false``), so there each group's own letters decide. A TOC title
  that is neither (a poem line, "﷽") stays in the text.
* An article starts at a line that opens with its permutation header — "هقع:", "عق، قع:", "(سخن) :",
  "خول _ خيل:", "سَهْو (سَهَا) :", or a word with the article ("الحرقوص:"). A header is accepted when it
  is one of the group's listed permutations, or when its letters fit the group (the named letters, the
  kind's number of radicals, و ي ا ء for a weak radical; a written hamza counts as a radical, a long
  vowel does not). Everything else that looks like "word:" at a line start — "قال:", "الليث:", a gloss
  ("والخؤولة:", "الخلابيس:"), a word of a root that already has its article ("الدعموص:" after "دعمص:")
  — stays in the text. Tahdhīb also files quadriliterals and weak roots where its typing gives no title
  ("ثرمل" after the لفيف of ث, "ليل: الليث:" after ل م): there the section's first letter suffices.
* A list line directly followed by text ("غش، شغ: مستعملان:" / "روي عن النبي ﷺ…") heads the article
  of its first permutation.
* 65 pages of Tahdhīb vol. 4 were typed without line breaks: they are cut back into lines before
  headers, group titles and spaced letters that follow a sentence end (counted).
* The article runs to the next header or group title; text between a group title and its first
  header (al-Khalīl's or al-Azharī's remarks on the group) is not imported, nor al-Azharī's closing
  chapters on the letters (باب الألفات، الياآت، الواوات، الهمز), which are grammar, not root articles. The
  body keeps its printed header ("هقع: الهقعة…"), as Lisān's do.

The list of permutations in use is the checklist: the report lists the listed permutations never
found as a header and counts the headers found outside their group's list.

Editors' bracketed supplements (``editor_supplements`` in the registry) are kept as printed: the
edition of al-ʿAyn defines its square brackets as the editors' additions "required by the context"
(منهجنا في التحقيق، 7), so the brackets are the reader's only sign of them.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field, replace
from typing import Any

from jadhr_arabic import strip_marks

from .registry import WorkSpec
from .shamela import Counters, Line, TocEntry, assemble
from .tocworks import RawArticle

LETTER_NAMES = {
    "الهمزه": "ء", "الالف": "ء", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج", "الحاء": "ح",
    "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر", "الزاي": "ز", "الزاء": "ز", "السين": "س",
    "الشين": "ش", "الصاد": "ص", "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ",
    "الفاء": "ف", "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه",
    "الواو": "و", "الياء": "ي", "الهاب": "ه", "باء": "ب",
}  # fmt: skip
WEAK = set("اويء")
# al-Khalīl's alif is the hamza: "أسل", "اسل" and "ءسل" are one permutation.
_FOLD = str.maketrans(
    {"أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ى": "ي", "ة": "ه", "ٱ": "ء", "ا": "ء"}
)
# Section titles: how many radicals a root has in the groups that follow.
KINDS = (
    ("الخماسي", 5),
    ("الرباعي", 4),
    ("اللفيف", -3),  # one strong radical + two weak
    ("المعتل", -2),  # two strong radicals + one weak
    ("الثلاثي", 3),
    ("الثنائي", 2),
    ("المضاعف", 2),
)
# A permutation header: one to four words of 2–9 letters, each perhaps in parentheses, separated by
# a comma, a dash (typed "-" or "_": "خول _ خيل") or a space — "هقع:", "عق، قع:", "(سخن) :",
# "سَهْو (سَهَا) :", "روب رأب:". A stray "." or "،" can open the line where a removed note marker stood
# (". طلع: المطلع…").
_WORD = r"\(?\s*(?:[\u0621-\u064a][\u064b-\u0652\u0670]*){2,9}\s*\)?"
_HEADER = re.compile(rf"^\s*[.\u060c]?\s*({_WORD}(?:\s*[\u060c,\-_]?\s*{_WORD}){{0,3}})\s*:")
_SPACED = re.compile(  # "ق ص د", "(ه ت)", "ع ض ت: مهمل" — single letters, not a poem line "ن كمشي…"
    r"^\s*[(\[]?\s*((?:[ء-ي]ـ?\s+){1,4}[ء-ي]ـ?)(?![ء-ي])\s*[)\]]?\s*[.:،]?\s*(.*)$"
)
# «مستعمل/مهمل» keywords; "أهمله الليث" (al-Layth left it out, al-Azharī then cites others) is not one
_LIST_WORD = re.compile(r"^(?:مستعمل|يستعمل|تستعمل|استعمل|مهمل|اهمل(?!ه))")
# The scholars al-Azharī quotes, with the article ("الليث: ناقة ذات لوث…"): never a header (the root
# ليث is headed "ليث:").
_NARRATORS = {
    "الليث",
    "الأصمعي",
    "اللحياني",
    "الفراء",
    "الكسائي",
    "المنذري",
    "الأموي",
    "الأحمر",
    "الباهلي",
    "الحراني",
    "الإيادي",
}
_NOT_WORDS = (
    "قال",
    "قيل",
    "قلت",
    "قوله",
    "يقال",
    "ويقال",
    "وقال",
    "وقيل",
    "انشد",
    "وانشد",
    "يعني",
    "اي",
    "ويروي",
    "يروي",
    "روي",
)


def _fold(text: str) -> str:
    return "".join(ch for ch in strip_marks(text).translate(_FOLD) if "ء" <= ch <= "ي")


_NOT_HEADERS = {_fold(w) for w in _NOT_WORDS}  # speech verbs that open quoted lines
_NARRATOR_KEYS = {_fold(w) for w in _NARRATORS}
_OPENING = re.compile(
    r"^(?:و?قال|و?روى|أبو|ابو|ابن|عمرو|شمر|ثعلب|اللحياني|الليث|الأصمعي|الاصمعي|الفراء|أهمله|اهمله|سلمة|المنذري|أخبرني)"
)


def _bare(token: str) -> str:
    """A header is sometimes a word with the article ("الحرقوص", "الشّرّ"): drop it (not from a root
    that starts with ءل: ألف، ألم)."""
    return token[2:] if token.startswith("ءل") and len(token) > 3 else token


def _letters(text: str) -> str:
    """The letters ``_fold`` keeps, before folding (the same length)."""
    return "".join(ch for ch in strip_marks(text) if "ء" <= ch.translate(_FOLD) <= "ي")


def _strong(token: str) -> Counter[str]:
    return Counter(ch for ch in token if ch not in WEAK)


@dataclass
class Group:
    title: str
    letters: Counter[str]  # named strong letters
    weak: bool  # the title admits weak radicals ("و (واي)")
    radicals: int  # from the section: 2, 3, -2 (معتل), -3 (لفيف), 4, 5; 0 unknown
    used: set[str] = field(default_factory=set)
    unused: set[str] = field(default_factory=set)
    found: set[str] = field(default_factory=set)
    complete: bool = True  # the title names every strong radical
    # Tahdhīb: a quadriliteral may close any group ("ثرمل", "ثرمد" after the لفيف of ث)
    loose_quadri: bool = False

    def accepts(
        self, token: str, opens_article: bool = True, raw: str = "", paren: bool = False
    ) -> str | None:
        """'listed' | 'letters' | None for a candidate permutation header (folded letters; ``raw`` the
        same letters before folding, ``paren`` when the header is in parentheses)."""
        t = _bare(token)
        if token in _NARRATOR_KEYS:
            return None
        if token in _NOT_HEADERS and not opens_article:
            return None  # "قلت: الأصل في…" is al-Azharī speaking, not the root قلت
        bare_raw = (raw or token)[len(token) - len(t) :]
        if (
            token in self.used
            or t in self.used
            or "".join(f for f, r in zip(t, bare_raw, strict=False) if r != "ا") in self.used
        ):
            return "listed"  # also a header spelled with a long alif: "ثادق" for the listed ثدق
        if token in self.unused or (token in _NOT_HEADERS and not opens_article) or t in self.found:
            return None
        strong = _strong(t)
        weak = sum(1 for ch in t if ch in WEAK)
        size = len(t)
        # radicals counted on the unfolded letters: a written hamza is one ("حنطأ"), a long vowel is
        # not ("أراد" folds to ءرءد but has three)
        rad = sum(1 for ch in bare_raw if ch not in "اويىة")
        skeleton = "".join(f for f, r in zip(t, bare_raw, strict=False) if r not in "اويىة")
        if skeleton != t and skeleton in self.found:
            return None  # "دعمص:" then "الدعموص: الرجل الدخال…" — a word of the same root, not a new article
        # a quadriliteral or longer root: at most one long vowel ("حرقوص"), not a plural ("الخلابيس")
        # and not a word with the conjunction ("وخنزر") or a verb with its suffix ("فزعنا")
        quadri = (
            4 <= size <= 6
            and rad >= 4
            and size - rad <= 1
            and not t.startswith("و")
            and not bare_raw.endswith("ا")
        )
        lead = next(iter(self.letters), None)
        if self.loose_quadri and lead is not None and strong[lead]:
            # Tahdhīb files quadriliterals and weak roots where its typing gives no title ("ثرمل" after
            # the لفيف of ث; "ليل: الليث: …" after ل م): they need only the section's first letter —
            # a weak root also a narrator right after its header
            if quadri and size == rad:
                return "letters"
            if opens_article and size in (2, 3) and weak >= 1 and token not in _NOT_HEADERS:
                return "letters"
        if (
            paren
            and 4 <= size <= 6
            and rad >= 3
            and not t.startswith("و")
            and not bare_raw.endswith("ا")
            and (not self.letters or any(strong[ch] for ch in self.letters))
        ):
            return "letters"  # "(حدرق) :", "(فرنب) :", "(حيقط) :", "(ثنجر) :" — al-Azharī's quadriliterals
        if self.radicals in (4, 5) and len(self.letters) > 1:
            if not any(strong[ch] for ch in self.letters):
                return (
                    None  # al-Khalīl's quadri-/quinqueliteral groups ("السين واللام") hold words with either
                )
        elif any(strong[ch] < k for ch, k in self.letters.items()):
            return None  # a named letter is missing
        # a group that admits a weak radical is المعتل, whatever the section said ("باب الجيم والميم و (وا يء)")
        n = -2 if (self.radicals in (2, 3) and self.weak) else self.radicals
        if not self.letters and n not in (-3, 4, 5):
            return None  # a title with no letters ("من الثلاثي الصحيح") takes only its listed headers
        doubled = size == 4 and t[:2] == t[2:]  # reduplicated: عقعق، نأنأ
        if n == 2:  # الثنائي: the two letters (doubled: عقّ، غمم), or reduplicated (عقعق)
            ok = weak == 0 and size in (2, 3, 4) and (not self.letters or set(strong) == set(self.letters))
        elif n == 3:  # الثلاثي الصحيح: exactly the group's three letters
            ok = weak == 0 and size == 3 and (strong == self.letters if self.complete else True)
        elif n == -2:  # المعتل: two strong radicals and a weak one (و ي ا ء); "وأجل" is و + أجل
            ok = (size in (2, 3) or doubled) and sum(strong.values()) == 2 and weak >= (1 if size >= 3 else 0)
        elif n == -3:  # اللفيف: one strong radical (perhaps doubled: "دد"، "دود") and weak ones
            ok = (size in (2, 3) or doubled) and len(set(strong)) <= 1 and (weak >= 1 or size == 2)
        elif n in (4, 5):  # الرباعي، الخماسي (headers are often words: "الحرقوص")
            ok = n - 1 <= size <= n + 2 and sum(strong.values()) >= n - 1
        else:  # kind unknown (Tahdhīb): a two- or three-letter root, or a quadriliteral or longer one
            ok = 2 <= size <= 3 or doubled or quadri
        return "letters" if ok else None


def _names(title: str) -> tuple[Counter[str], bool]:
    t = strip_marks(title).replace("أ", "ا").replace("إ", "ا").replace("ة", "ه")
    letters: Counter[str] = Counter()
    for w in re.findall(r"(?:و|ب)?(?:ال)[ء-ي]{2,5}|باء", t):
        w = re.sub(r"^(?:و|ب)(?=ال)", "", w)
        if w in LETTER_NAMES:
            letters[LETTER_NAMES[w]] += 1
    weak = bool(re.search(r"\(\s*و\s*ا\s*[يى]\s*ء?\s*\)|\(\s*واي\s*\)|وا\s*[يى]ء|المعتل|اللفيف|المعتله", t))
    for ch in list(letters):
        if ch in WEAK:
            del letters[ch]
            weak = True
    return letters, weak


_USED = re.compile(r"(?:مستعمل|يستعمل|تستعمل|استعمل)\S*")
_UNUSED = re.compile(r"(?:مهمل|[أا]همل(?!ه))\S*")
_FILLER = re.compile(r"(?:فقط|معهما|كلهن|وجوهه\S*|من)(?=\s|$)")
# A permutation written with spaced letters ("هـ ل س", "د أث", "وء ر") ending a part — starting at a
# word boundary, so that "والباء ع ز ب" gives عزب — or a compact one ("عقش").
_SPACED_RUN = re.compile(r"(?:^|(?<=\s))((?:[ء-ي]{1,2}\s+){1,4}[ء-ي]{1,2})\s*$")
_LIST_END = re.compile(r"(?:مستعمل|مهمل)\S*\s*\)?\s*[.:]?\s*$")
_PLACEHOLDER = re.compile(r"و\s*ا\s*[يى]\s*ء?|واي")
_TITLE_WORDS = {"باب", "أبواب", "ابواب", "حرف", "من", "مع", "في", "كتاب", "بقية"}


def _perm_lists(text: str) -> tuple[set[str], set[str]]:
    """Permutations named in a title or list line. Read left to right: a «مستعمل…» keyword marks the
    permutations before it as used, a «مهمل…» keyword as unused («ع ز ب - ز ع ب مستعملات ع ب ز - ب ع ز
    مهملان»); permutations after the last keyword are used. The weak-letter placeholder of a title
    ("و (وا يء)") is not a permutation."""
    used: set[str] = set()
    unused: set[str] = set()
    t = strip_marks(text).replace("ـ", "")
    t = _USED.sub(" ,<U>, ", t)
    t = _UNUSED.sub(" ,<N>, ", t)
    buffer: list[str] = []
    for part in re.split(r"[،,\-().]", t):
        part = _FILLER.sub(" ", part).strip()
        if part in ("<U>", "<N>"):
            (used if part == "<U>" else unused).update(buffer)
            buffer = []
            continue
        if _PLACEHOLDER.fullmatch(part):
            continue  # "(وا يء)": the weak radical, not a permutation
        words = part.split()
        run = _SPACED_RUN.search(part)
        if run:
            buffer.append(_fold("".join(run.group(1).split())))
        elif len(words) == 1 and not part.startswith("ال"):
            buffer.append(_fold(part))
        elif (
            len(words) > 1
            and all(2 <= len(w) <= 5 and not w.startswith(("ال", "وال")) for w in words)
            and not set(words) & _TITLE_WORDS
        ):
            buffer.extend(_fold(w) for w in words)  # "خشى وخش خيش خاش شاخ خشا مستعملة"
    used.update(p for p in buffer if 2 <= len(p) <= 6)
    return used, unused


def _spelled_letters(title: str) -> Counter[str] | None:
    """'الكاف والجيم ك س ب ج' → the spelled-out root, when a title gives one; also a title that is
    only letters ("خ ق", "خ ك وا يء") and a compact one ("بقية باب كت")."""
    t = strip_marks(title).replace("ـ", "")
    t = re.sub(r"\(?\s*(?:و\s*ا\s*[يى]\s*ء?|واي)\s*\)?\s*$", "", t).strip()
    m = re.fullmatch(r"\(?\s*((?:[ء-ي]\s+){1,4}[ء-ي])\s*\)?", t) or re.search(
        r"((?:[ء-ي]\s+){2,5}[ء-ي])\s*$", t
    )
    if m:
        return _strong(_fold(m.group(1)))
    m = re.search(r"باب\s+([ء-ي]{2,3})$", t)
    return _strong(_fold(m.group(1))) if m else None


_FLAT_NARRATORS = ("قال", "الليث", "أبو", "ابو", "ابن", "ثعلب", "شمر", "عمرو", "سلمة")
# Where a page typed without its line breaks is cut back into lines: after a sentence end, before a
# header ("قرح:"), a group title ("باب …") or a group's spaced letters ("ح ص ن حصن، حنص…"); and before
# a short header followed by its narrator even without a stop ("… ألحا صلح: الليث: …").
_FLAT_CUT = re.compile(
    r"(?<=[.!؟])\s+(?=\(?\s*[ء-ي][^\s:()]{1,14}(?:\s*[،,\-_]?\s*\(?[ء-ي][^\s:()]{1,14}\)?){0,2}\s*\)?\s*:"
    r"|\(?\s*(?:باب|أبواب|ابواب)\s+ال"
    r"|(?:[ء-ي]\s+){2,3}(?:[ء-ي]{2,}|\(|$))"
    r"|\s+(?=[ء-ي][^\s:()]{2,10}:\s*(?:"
    + "|".join("".join(ch + "[\u064b-\u0652\u0670]*" for ch in w) for w in _FLAT_NARRATORS)
    + "))"
)


def _unflatten(lines: list[Line], counters: Counters) -> tuple[list[Line], set[int], list[str]]:
    """Cut the lines of pages typed without line breaks (Tahdhīb vol. 4, pp. 17–53 and 134–161) at
    ``_FLAT_CUT``. Returns the lines, the ids of the pieces that continue the previous one (put back
    with a space when they turn out to be text) and each line's reference suffix."""
    on_page = Counter(id(ln.page) for ln in lines)
    out: list[Line] = []
    glued: set[int] = set()
    refs: list[str] = []
    for i, ln in enumerate(lines):
        if on_page[id(ln.page)] != 1 or len(ln.text) <= 800:
            out.append(ln)
            refs.append(f"line-{i}")
            continue
        for k, piece in enumerate(x for x in _FLAT_CUT.split(ln.text) if x):
            if k == 0:
                out.append(replace(ln, text=piece))
            else:
                out.append(replace(ln, text=piece, first_on_page=False, spans=[]))
                glued.add(id(out[-1]))
                counters.add("taqalib-article-split:flat-page-cut")
            refs.append(f"line-{i}" + (f":{k}" if k else ""))
    return out, glued, refs


_ORPHAN_STOP = re.compile(r"^\s*([.\u060c])\s+(?=\S)")


def _rejoin_stops(lines: list[Line], counters: Counters) -> list[Line]:
    """al-ʿAyn's typist broke the line between a note marker and the full stop after it
    ("… وتَعَظْعَظْ «٢»" / ". أي اتَّعْظْ…"): with the marker removed, the stop goes back to the end of
    the line it closes — only when that line has no stop of its own, so no character is dropped."""
    out = list(lines)
    prev: int | None = None
    for i, ln in enumerate(out):
        if not ln.text.strip():
            continue
        m = _ORPHAN_STOP.match(ln.text)
        if m and prev is not None and not ln.spans and out[prev].text.rstrip()[-1:] not in ".\u060c:؟!":
            out[prev] = replace(out[prev], text=out[prev].text.rstrip() + m.group(1))
            out[i] = replace(ln, text=ln.text[m.end() :])
            counters.add("footnote-markers-removed:stop-after-marker-rejoined")
        prev = i
    return out


_SUPPLEMENT = re.compile(r"[ \t]?\[([^\[\]\n]*)\]")


def apply_supplements(body: str, mode: str, counters: Counters) -> str:
    """The editors' bracketed supplements of a work whose edition marks them «[…]» (registry
    ``editor_supplements``): ``keep`` shows them as printed, brackets and all; ``unwrap`` keeps the
    words without the brackets; ``drop`` removes them. Counted under ``editor-supplements``."""
    if mode == "keep":
        return body

    def one(m: re.Match[str]) -> str:
        return (m.group(0)[: len(m.group(0)) - len(m.group(1)) - 2] + m.group(1)) if mode == "unwrap" else ""

    out, n = _SUPPLEMENT.subn(one, body)
    if n:
        counters.add(f"editor-supplements:{mode}", n)
    return re.sub(r"[ \t]{2,}", " ", out) if mode == "drop" else out


_BARE_LIST = re.compile(r"(?:[ء-ي]{2,3}\s+){2,}[ء-ي]{2,3}")
_GROUPISH = re.compile(r"^\(?\s*(?:باب|أبواب|ابواب|حرف|كتاب|بقية|من|في|مقدمة|أبنية|ال)")


def _is_group_title(title: str) -> bool:
    """A TOC title that opens a group or section: "باب …", "من الثلاثي الصحيح", one that names letters,
    a kind or a list. A poem line or "﷽" tagged as a title is text."""
    t = strip_marks(title).strip()
    if _GROUPISH.match(t) or _names(t)[0] or _spelled_letters(t):
        return True
    used, unused = _perm_lists(t)
    return bool(used or unused) or any(word in t.replace("ة", "ه") for word, _ in KINDS)


def split_taqalib(
    spec: WorkSpec, lines: list[Line], toc: dict[int, TocEntry], counters: Counters
) -> tuple[list[RawArticle], dict[str, Any]]:
    sid = spec.cfg["shamela_id"]
    supplements = spec.cfg.get("editor_supplements", "keep")
    lines = _rejoin_stops(lines, counters)
    lines, glued, line_refs = _unflatten(lines, counters)
    start_title = spec.cfg["start_title"]
    entries = sorted(toc.values(), key=lambda e: e.order)
    start_id = next(e.shamela_title_id for e in entries if e.title.strip() == start_title)
    kinds_known = bool(spec.cfg.get("section_kinds", True))  # Tahdhīb rarely names its sections
    radicals = 2
    group: Group | None = None  # the group of the last title
    subs: list[Group] = []  # Tahdhīb: spaced-letter lines since that title ("ع ض ص", "ق س ر")
    started = False
    arts: list[RawArticle] = []
    groups: list[Group] = []
    cur: tuple[str, list[str], str, list[Line]] | None = None  # headword, match tokens, ref, lines
    skipped = 0

    def close() -> None:
        nonlocal cur
        if cur is None:
            return
        head, toks, ref, body_lines = cur
        body, page_ref = assemble(body_lines, counters)
        body = apply_supplements(body, supplements, counters)
        arts.append(RawArticle(head, body, page_ref, ref, match_heads=toks))
        cur = None

    first_letter: str | None = None
    list_next = False  # a letterless title may be followed by its permutations as a bare word list

    def new_group(title: str) -> None:
        nonlocal group, radicals, subs, first_letter
        t = strip_marks(title)
        kind_named = False
        for word, n in KINDS:
            if word in t.replace("ة", "ه"):
                radicals, kind_named = n, True
                if not re.search(r"باب\s+ال\S+\s+و", t):  # a section title, not a group
                    break
        letters, weak = _names(title)
        if any(k > 1 for k in letters.values()):
            # "باب السين والراء والسين واللام": two pairs in one title — only the first letter is shared
            letters = Counter({next(iter(letters)): 1})
        spelled = _spelled_letters(title)
        used, unused = _perm_lists(title)
        if spelled and (not letters or sum(spelled.values()) >= sum(letters.values())):
            letters = spelled
        named = re.findall(r"(?:ال)\S+", t)
        lead = _names(named[0])[0] if named else Counter()
        lead_letter = next(iter(lead), None)
        if (
            not kind_named
            and lead_letter
            and lead_letter != first_letter
            and re.match(r"^\(?\s*(?:باب|أبواب|ابواب|حرف)", t)
        ):
            radicals = 2  # every letter (حرف) opens with its two-letter (الثنائي / المضاعف) groups
        if lead_letter and re.match(r"^\(?\s*(?:باب|أبواب|ابواب|حرف)", t):
            first_letter = lead_letter
        if not kind_named and radicals == 2 and sum(letters.values()) == 3 and not weak:
            radicals = 3  # "باب العين والقاف مع الشين": the title names three radicals
        if not letters and used:  # "خشى وخش خيش خاش شاخ خشا مستعملة": the letters all its words share
            shared = [_strong(p) for p in used]
            letters = shared[0]
            for c in shared[1:]:
                letters &= c
            weak = weak or any(set(p) & WEAK for p in used)
        group_radicals = radicals
        if not kinds_known:  # Tahdhīb: the group's own title, else its letters, decide
            n_strong = sum(letters.values())
            if not kind_named:
                group_radicals = {2: -2, 1: -3}.get(n_strong, 0) if weak else (3 if n_strong == 3 else 0)
        complete = group_radicals in (2, 3) and sum(letters.values()) == group_radicals
        group = Group(
            title,
            letters,
            weak or group_radicals < 0,
            group_radicals,
            used,
            unused,
            complete=complete,
            loose_quadri=not kinds_known,
        )
        subs = []
        groups.append(group)
        counters.add("taqalib-article-split:groups")

    def spaced_group(line: str, spaced: str, rest: str) -> None:
        """A line of spaced letters is a group of exactly those letters (or, followed by «مهمل», a
        permutation nobody used); it does not replace the titled group above it."""
        letters = _strong(_fold(spaced))
        weak = bool(re.search(r"و\s*ا\s*ي|وايء|واي", rest)) or len(_fold(spaced)) > sum(letters.values())
        n = sum(letters.values())
        # three letters fix the root; two letters may head binary, weak or quadriliteral roots
        radicals_here = 3 if (n == 3 and not weak) else ({2: -2, 1: -3}.get(n, 0) if weak else 0)
        g = Group(line, letters, weak, radicals_here, complete=n == 3, loose_quadri=not kinds_known)
        if re.match(r"(?:مهمل|[أا]همل(?!ه))", rest):
            g.unused.add(_fold(spaced))
        elif _USED.search(rest) or _UNUSED.search(rest):  # "ح ص ن حصن، حنص، صحن، نحص، نصح: مستعملة."
            used_here, unused_here = _perm_lists(rest)
            g.used.update(used_here)
            g.unused.update(unused_here)
        subs.append(g)
        groups.append(g)

    def candidates() -> list[Group]:
        return [*reversed(subs), *([group] if group is not None else [])]

    def judge(text: str) -> tuple[str, Any] | None:
        """("list", (group, is_unused, tokens)) for a list line, ("article", (group, tokens, verdicts,
        raw tokens)) for an accepted header, None for text."""
        hm = _HEADER.match(text)
        if not hm or group is None:
            return None
        after = strip_marks(text[hm.end() :]).strip().lstrip("( ")
        raw_tokens = [x for x in re.split(r"[\s\u060c,\-_()]+", hm.group(1)) if x.strip()]
        # spaced letters are one word: "عزو، ع ز ي:", "ك ود:"
        merged: list[str] = []
        for x in raw_tokens:
            if (
                merged
                and (len(_letters(x)) == 1 or len(_letters(merged[-1])) == 1)
                and len(_letters(merged[-1])) <= 2
            ):
                merged[-1] += x
            else:
                merged.append(x)
        raw_tokens = merged
        tokens = [_fold(x) for x in raw_tokens]
        raws = [_letters(x) for x in raw_tokens]
        listed = bool(re.search("[\u060c,\\-_]", hm.group(1)))
        quoted = {_fold(x) for x in re.findall(r"\(([^)]*)\)", hm.group(1))}
        spelled = [x for k, x in enumerate(tokens) if k == 0 or x not in quoted]
        roots = [set(_strong(_bare(x))) for x in spelled]
        if (
            len(spelled) > 1
            and not listed
            and any(len(r & roots[0]) < min(len(r), len(roots[0])) - 1 for r in roots)
        ):
            # words separated by spaces only ("أبو عبيد عن الأصمعي:", "وفي حديث:") are one header
            # only when they spell the same root or roots one letter apart ("سَهْو (سَهَا)", "روب رأب",
            # "خق خقخق", "كرزم كرزن"); a word in parentheses after the header is a quoted form ("عدا (عندأوة) :")
            tokens = []
        if tokens and _LIST_WORD.match(after.replace("أ", "ا")) and len(after) < 40:
            target = subs[-1] if subs else group
            return ("list", (target, after.replace("أ", "ا").startswith(("مهمل", "اهمل")), tokens))
        lead = strip_marks(hm.group(1)).replace("أ", "ا").strip("( ")
        if _LIST_WORD.match(lead) and len(after) < 60:  # "استعمل من وجوهه: (طسوج)"
            words = [_fold(w) for w in re.split(r"[\s\u060c,\-_()]+", after) if 2 <= len(_fold(w)) <= 6]
            target = subs[-1] if subs else group
            return ("list", (target, lead.startswith(("مهمل", "اهمل")), words)) if words else None
        if not tokens:
            return None
        # A speech word heads an article only when an article's opening follows ("قلت: قال الليث").
        opens = bool(_OPENING.match(after))
        paren = "(" in hm.group(1)
        first_root = frozenset(_strong(_bare(tokens[0])))
        for cand in candidates():
            verdicts = []
            for k, (tok, raw) in enumerate(zip(tokens, raws, strict=True)):
                v = cand.accepts(tok, opens, raw, paren)
                if v is None and k > 0 and tok.startswith("و") and len(tok) >= 4:
                    v = cand.accepts(tok[1:], opens, raw[1:], paren)  # "خدنق، وخدرنق"
                    if v is not None:
                        tokens[k] = tok[1:]
                if v is None and k > 0 and (frozenset(_strong(_bare(tok))) == first_root or tok in quoted):
                    v = "variant"  # "أزب (أزيب)": a spelling of the same root; "عدا (عندأوة)": a quoted form
                if v is None:
                    break
                verdicts.append(v)
            if len(verdicts) == len(tokens):
                return ("article", (cand, tokens, verdicts, raw_tokens))
        return None

    def start_article(found: tuple[Group, list[str], list[str], list[str]], ln: Line, ref: str) -> None:
        nonlocal cur
        close()
        owner, tokens, verdicts, raw_tokens = found
        for tok, v in zip(tokens, verdicts, strict=True):
            owner.found.add(_bare(tok))
            counters.add(f"taqalib-article-split:header-{v}")
        cur = ("، ".join(x.strip() for x in raw_tokens), [_bare(tok) for tok in tokens], ref, [ln])

    after_list: tuple[Line, str] | None = None  # the last list line, while no header has followed it

    def list_opens_article(ln: Line, ref: str) -> bool:
        """ "غش، شغ: مستعملان:" then "روي عن النبي ﷺ…": the list line heads the article of its first
        permutation, and stays its first line."""
        nonlocal cur, after_list
        if after_list is None or group is None:
            return False
        list_ln, first = after_list
        after_list = None
        head = _fold(first)
        owner = next((g for g in candidates() if head in g.used and head not in g.found), None)
        if owner is None or re.search(r"[أا]همل|مستعمل|مهمل", strip_marks(ln.text)):
            return False  # "وقد أهمل الليث: حتل ولحت وهما مستعملان." is a remark on the list
        counters.add("taqalib-article-split:list-line-opens-article")
        cur = (first, [head], ref, [list_ln, ln])
        return True

    for i, ln in enumerate(lines):
        sp = ln.span_line or ln.leading_span
        title = toc[sp.toc_id].title if sp is not None and sp.toc_id in toc else None
        if title is not None and sp is not None and sp.toc_id == start_id:
            started = True
        if not started:
            skipped += len(ln.text)
            continue
        text = ln.text
        plain = strip_marks(text).strip()
        # a title line: the span alone, or with only a stop after it ("<span>(والزاي قد أهملت…</span>.")
        lead = ln.leading_span
        whole = ln.span_line is not None or (
            lead is not None and not re.sub(r"[\s.:\u060c()]", "", ln.text[lead.start + len(lead.text) :])
        )
        if title is not None and whole and _is_group_title(title):
            after_list = None
            close()
            counters.add("front-matter-skipped:section-headings")
            new_group(title)
            list_next = group is not None and not group.letters and not group.used
            continue
        if title is not None and whole:
            counters.add("taqalib-article-split:toc-title-kept-in-text")
        if list_next and plain and group is not None:
            list_next = False
            if _BARE_LIST.fullmatch(plain):  # "(أبنية أفعالها وأسمائها)" → "أوى وأى وي أي أي أو أو وا"
                group.used.update(_fold(w) for w in plain.split())
                counters.add("taqalib-article-split:list-line")
                continue
        if group is not None and len(plain) < 100 and ":" not in plain and _LIST_END.search(plain):
            used_here, unused_here = _perm_lists(plain)  # "نزر. رزن. زنر. رنز. نرز (مستعملة) ."
            if used_here or unused_here:
                close()
                target = subs[-1] if subs else group
                target.used.update(used_here)
                target.unused.update(unused_here)
                counters.add("taqalib-article-split:list-line")
                first = re.match(r"[\u0621-\u064a]+", plain)
                after_list = (ln, first.group(0)) if first and used_here and not unused_here else None
                continue
        # Tahdhīb: group lines the typist did not tag — spaced letters, «باب/أبواب …», list lines.
        sm = _SPACED.match(plain) if plain and len(plain) < 60 else None
        if sm and not _HEADER.match(text):
            after_list = None
            close()
            spaced_group(plain, sm.group(1), sm.group(2))
            counters.add("taqalib-article-split:untagged-group-line")
            continue
        if re.match(r"^[.،]?\s*\(?\s*(?:باب|أبواب|ابواب|كتاب)\s+ال", plain) and len(plain) < 80:
            close()
            new_group(plain)
            list_next = group is not None and not group.letters and not group.used
            counters.add("taqalib-article-split:untagged-group-line")
            continue
        ref = f"shamela:{sid}:page-{ln.page.shamela_page_id}:{line_refs[i]}"
        verdict = judge(text)
        if verdict is not None and verdict[0] == "list":
            close()  # "عقش، عشق، قشع…: مستعملة." — the group's list, not an article
            target, is_unused, tokens = verdict[1]
            (target.unused if is_unused else target.used).update(tokens)
            counters.add("taqalib-article-split:list-line")
            first = re.match(r"[\u0621-\u064a]+", plain.strip(" ("))
            after_list = (ln, first.group(0)) if first and not is_unused else None
            continue
        if verdict is None and cur is None and plain and list_opens_article(ln, ref):
            continue
        if plain:
            after_list = None
        if verdict is not None:
            if id(ln) in glued:
                counters.add("taqalib-article-split:header-inside-a-flat-page")
            start_article(verdict[1], ln, ref)
            continue
        if _HEADER.match(text):
            counters.add("taqalib-article-split:line-start-word-kept-in-text")
        if cur is None:
            skipped += len(text)
        elif id(ln) in glued:  # the rest of a flat line stays one paragraph with what precedes it
            last = cur[3][-1]
            cur[3][-1] = replace(last, text=last.text.rstrip() + " " + text.lstrip())
        else:
            cur[3].append(ln)
    close()
    counters.add("front-matter-skipped:chars", skipped)
    counters.add("taqalib-article-split", len(arts))

    found_anywhere = {p for g in groups for p in g.found}
    missing = sorted(
        {p for g in groups for p in g.used if p not in found_anywhere and _bare(p) not in found_anywhere}
    )
    unlisted = sum(1 for g in groups for p in g.found if g.used and p not in g.used)
    counters.add("taqalib-article-split:listed-permutation-not-found", len(missing))
    counters.add("taqalib-article-split:header-outside-a-group-list", unlisted)
    return arts, {
        "groups": len(groups),
        "groups_with_list": sum(1 for g in groups if g.used),
        "listed_permutations": len({p for g in groups for p in g.used}),
        "listed_permutations_not_found": missing,
    }
