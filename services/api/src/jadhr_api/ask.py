"""Questions in natural language (PLAN P18, D35): a question is read, never answered by a model.

A question is read as an intent and its terms — by rules first (Arabic and English patterns), else by the nearest of
a set of example questions (embedded by the embedding service, P17), else as a search by meaning. Each term is
resolved to what the data holds: a word (lemma), a root, a sūra, a person or a place. The answer is computed from the
data or quoted from the sources, as numbers and lists our UI puts into its own sentences; "understood as" goes back
with it, and the same endpoint takes that reading itself, so a reader corrects a field instead of rephrasing.

    read(conn, "كم مرة ذكرت كلمة الرحمة في سورة البقرة")
      → {"intent": "count", "a": {"text": "الرحمة", "subject": {lemma رَحْمَة}}, "surah": 2, "how": "rule", …}
"""

from __future__ import annotations

import re
import threading
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from jadhr_arabic import has_arabic, normalize, parse_root_input
from sqlalchemy import Connection

from .db import one, rows, scalar

INTENTS = (
    "count",
    "where",
    "distribution",
    "meaning",
    "root",
    "compare",
    "together",
    "theme",
    "surah",
    "superlative",
)
TWO_TERMS = ("compare", "together")
NO_TERMS = ("superlative",)

_PUNCT = re.compile(r"[؟?!.,،؛;:«»\"'“”‘’()\[\]{}]")

# ─── the rules ─────────────────────────────────────────────────────────────────
# Written over the normalised question (no marks; أإآ → ا, ة → ه, ى → ي) and over lower-case English. A term group
# captures whole words; ``scope`` takes "في سورة البقرة", "في السور المكية", "in Meccan surahs"…

_W = r"(?:كلمه |كلمة |لفظ |لفظه |لفظة |اسم |the word |word |the name )?"
_VERB_AR = r"(?:وردت|ورد|ذكرت|ذكر|جاءت|جاء|تكررت|تكرر|تذكر|يذكر|ترد|يرد|استعملت|استعمل)"
_SCOPE_AR = r"(?: في (?P<scope>(?:سوره|السور|القران)[^؟]*))?"
_SCOPE_EN = r"(?: in (?P<scope>(?:surah|sura|the quran|the qur'an|meccan|medinan|makki|madani)[^?]*))?"

# fmt: off
_RULES: list[tuple[str, str, str]] = [
    # superlatives before counts: «ما أطول سورة» is not a count of a word
    ("superlative", "ar", r"^(?:ما |ما هي |ماهي )?(?P<sup>اطول|اقصر|اكبر|اصغر|اكثر|اقل) (?P<what>.+)$"),
    ("superlative", "en", r"^(?:what|which) (?:is|are) the (?P<sup>longest|shortest|largest|smallest|most frequent|most common|least frequent|rarest) (?P<what>.+)$"),
    ("superlative", "en", r"^(?:the )?(?P<sup>longest|shortest|largest|smallest|most frequent|most common) (?P<what>.+)$"),
    # a sūra's figures
    ("surah", "ar", r"^كم (?:عدد )?(?P<focus>ايه|ايات|اية|كلمه|كلمات|كلمة|جذرا|جذر|جذور)(?: في)? سوره (?P<surah>.+)$"),
    ("surah", "ar", r"^(?:احصاءات|احصائيات|ارقام|معلومات عن|بيانات) سوره (?P<surah>.+)$"),
    ("surah", "ar", r"^هل سوره (?P<surah>.+?) (?:مكيه|مدنيه)(?: ام (?:مكيه|مدنيه))?$"),
    ("surah", "en", r"^how many (?P<focus>verses|ayat|ayahs|words|roots) (?:are |does )?(?:there )?(?:in )?(?:surah|sura|surat) (?P<surah>.+?)(?: have| contain)?$"),
    ("surah", "en", r"^(?:statistics|stats|numbers|figures|facts) (?:of|for|about|on) (?:surah|sura|surat) (?P<surah>.+)$"),
    ("surah", "en", r"^is (?:surah|sura|surat) (?P<surah>.+?) (?:meccan|medinan|makki|madani)(?: or (?:meccan|medinan|makki|madani))?$"),
    # two terms
    ("compare", "ar", r"^(?:ما |ما هو |ماهو )?(?:الفرق|الفروق|الفرق في المعني) بين (?P<pair>.+)$"),
    ("compare", "ar", r"^قارن بين (?P<pair>.+)$"),
    ("compare", "ar", r"^هل (?P<pair>.+?) بمعني واحد$"),
    ("compare", "en", r"^(?:what is )?(?:the )?difference between (?P<pair>.+)$"),
    ("compare", "en", r"^compare (?P<pair>.+)$"),
    ("together", "ar", r"^(?:ما |ما هي )?(?:الايات|ايات|اي الايات) (?:التي )?(?:تجمع(?: بين)?|اجتمع فيها|اجتمعت فيها|ذكر فيها|ذكرت فيها|ورد فيها|وردت فيها|فيها) (?P<pair>.+)$"),
    ("together", "ar", r"^(?:اين|متي) (?:اجتمع|اجتمعت|اقترن|اقترنت|ذكر|ذكرت) (?P<pair>.+?)(?: معا| في ايه واحده| في اية واحدة)?$"),
    ("together", "en", r"^(?:which |the )?verses (?:that )?(?:mention|contain|have|with|containing|mentioning) (?:both )?(?P<pair>.+?)(?: together)?$"),
    ("together", "en", r"^where (?:are|do|does) (?P<pair>.+?) (?:appear|occur|come|mentioned) together$"),
    # a theme named as such, before "where" (whose «ما الآيات التي …» it would otherwise take)
    ("theme", "ar", r"^(?:ما |ما هي )?(?:الايات|ايات) (?:التي )?(?:تتحدث|تتكلم|نزلت) (?:عن|في) (?P<a>.+)$"),
    # one term
    ("count", "ar", r"^كم (?:مره|عدد مرات|مرات) " + _VERB_AR + r"(?: في القران| في القران الكريم)? " + _W + r"(?P<a>.+?)" + _SCOPE_AR + r"$"),
    ("count", "ar", r"^(?:ما )?عدد (?:مرات )?(?:ورود|ذكر|تكرار|تكرر) " + _W + r"(?P<a>.+?)" + _SCOPE_AR + r"$"),
    ("count", "ar", r"^كم " + _VERB_AR + r" " + _W + r"(?P<a>.+?)" + _SCOPE_AR + r"$"),
    ("count", "en", r"^how (?:many times|often) (?:is|are|does|do|was|were)? ?" + _W + r"(?P<a>.+?) (?:mentioned|used|appear|appears|occur|occurs|found|repeated|cited)" + _SCOPE_EN + r"$"),
    ("count", "en", r"^(?:the )?(?:number of times|count of|frequency of|occurrences of) " + _W + r"(?P<a>.+?)" + _SCOPE_EN + r"$"),
    ("where", "ar", r"^(?:اين|في اي سوره|في اي السور|في اي الايات|في اي موضع|ما السور التي|ما الايات التي|ما المواضع التي|اي السور) (?:" + _VERB_AR + r" )?(?:فيها )?" + _W + r"(?P<a>.+?)" + _SCOPE_AR + r"$"),
    ("where", "ar", r"^(?:مواضع|مواطن|اماكن) (?:ورود |ذكر )?" + _W + r"(?P<a>.+?)" + _SCOPE_AR + r"$"),
    ("where", "en", r"^(?:where|in which surahs?|which surahs?|in which verses|which verses) (?:is|are|does|do)? ?(?:the quran )?(?:mention |talk about |speak of )?" + _W + r"(?P<a>.+?)(?: mentioned| appear| occur| found| used)?" + _SCOPE_EN + r"$"),
    ("distribution", "ar", r"^(?:كيف )?(?:يتوزع|تتوزع|توزيع|توزع|انتشار) " + _W + r"(?P<a>.+?)(?: في (?:القران|السور|المصحف)| بين (?:المكي|السور).*)?$"),
    ("distribution", "en", r"^(?:the )?(?:distribution|spread) of " + _W + r"(?P<a>.+?)(?: (?:in|across|over) (?:the quran|surahs|the surahs))?$"),
    ("distribution", "en", r"^how is " + _W + r"(?P<a>.+?) (?:distributed|spread)(?: .*)?$"),
    ("root", "ar", r"^(?:ما |ما هو |ماهو )?جذر " + _W + r"(?P<a>.+)$"),
    ("root", "ar", r"^(?:من اي جذر|من اي اصل|ما اصل) " + _W + r"(?P<a>.+)$"),
    ("root", "ar", r"^(?:الي|الى) اي (?:جذر|اصل) (?:ترجع|يرجع|تعود|يعود) " + _W + r"(?P<a>.+)$"),
    ("root", "en", r"^(?:what is )?(?:the )?root of " + _W + r"(?P<a>.+)$"),
    ("root", "en", r"^(?:which|what) root (?:does|do|is) " + _W + r"(?P<a>.+?) (?:come from|from|belong to)$"),
    ("meaning", "ar", r"^(?:ما |ماذا )?(?:معني|تعني|يعني|تفسير) " + _W + r"(?P<a>.+?)(?: في (?:القران|سوره .*))?$"),
    ("meaning", "ar", r"^(?:ما |ماذا )(?:يعني|تعني) " + _W + r"(?P<a>.+)$"),
    ("meaning", "ar", r"^(?:ما )?(?:المقصود|المراد) (?:من |ب)?(?P<a>.+)$"),
    ("meaning", "ar", r"^(?:اشرح|وضح|فسر)(?: لي)? (?:معني )?" + _W + r"(?P<a>.+)$"),
    ("meaning", "en", r"^what (?:does|do) " + _W + r"(?P<a>.+?) mean(?: in the quran)?$"),
    ("meaning", "en", r"^(?:what is )?(?:the )?meaning of " + _W + r"(?P<a>.+?)(?: in the quran)?$"),
    ("meaning", "en", r"^(?:explain|tell me) (?:the )?meaning of " + _W + r"(?P<a>.+)$"),
    ("meaning", "en", r"^define " + _W + r"(?P<a>.+)$"),
    ("theme", "ar", r"^(?:ماذا|ما الذي|ما) (?:قال|يقول|ذكر|تقول) (?:القران|الله) (?:عن|في) (?P<a>.+)$"),
    ("theme", "ar", r"^(?:ايات|الايات) (?:عن|حول|في) (?P<a>.+)$"),
    ("theme", "ar", r"^(?:كيف )?(?:تحدث|يتحدث) القران عن (?P<a>.+)$"),
    ("theme", "en", r"^what (?:does|did) (?:the quran|allah|god) say (?:about|on) (?P<a>.+)$"),
    ("theme", "en", r"^(?:verses|ayat|ayahs) (?:about|on|regarding|concerning) (?P<a>.+)$"),
    ("theme", "en", r"^(?:what are )?(?:the )?verses (?:that )?(?:talk|speak) (?:about|of) (?P<a>.+)$"),
]
# fmt: on
RULES: list[tuple[str, str, re.Pattern[str]]] = [(i, lang, re.compile(p)) for i, lang, p in _RULES]

# the example questions each intent is known by when no rule reads a question: the embedding service's nearest one
# names the intent. They are not the test bank (services/api/tests/data/ask_bank.yaml), so the bank's score is a measure.
EXAMPLES: dict[str, list[str]] = {
    "count": [
        "كم مرة جاءت هذه الكلمة في القرآن",
        "ما عدد مرات ذكر هذا اللفظ",
        "هل تكررت هذه الكلمة كثيرا في القرآن",
        "إحصاء ورود الكلمة في المصحف",
        "how many times is this word in the Quran",
        "how often does the Quran use this word",
        "count the occurrences of this word",
        "is this word frequent in the Quran",
    ],
    "where": [
        "في أي السور جاءت هذه الكلمة",
        "أريد مواضع هذه الكلمة في القرآن",
        "أين أجد هذه الكلمة في المصحف",
        "اعرض الآيات التي فيها هذه الكلمة",
        "where can I find this word in the Quran",
        "show me where this word is used",
        "list the places this word occurs",
        "which chapters contain this word",
    ],
    "distribution": [
        "كيف تنتشر الكلمة بين السور المكية والمدنية",
        "توزع الكلمة على سور القرآن",
        "how is this word spread over the chapters",
        "distribution of the word between Meccan and Medinan surahs",
    ],
    "meaning": [
        "ما المقصود بهذه الكلمة",
        "اشرح لي معنى هذه الكلمة",
        "ماذا تعني هذه اللفظة في القرآن",
        "معنى الكلمة في اللغة",
        "explain the meaning of this word",
        "what is meant by this word",
        "what does this term signify",
        "translate this word",
    ],
    "root": [
        "إلى أي جذر ترجع هذه الكلمة",
        "ما الأصل اللغوي لهذه الكلمة",
        "اشتقاق هذه الكلمة",
        "which root does this word come from",
        "what is the origin of this word",
        "the root letters of this word",
    ],
    "compare": [
        "ما الفرق بين الكلمتين",
        "هل هناك فرق بين هاتين الكلمتين",
        "أيهما أكثر ورودا في القرآن",
        "how are these two words different",
        "which of the two words is used more",
        "contrast these two words",
    ],
    "together": [
        "آيات ذكرت فيها الكلمتان معا",
        "متى تأتي الكلمتان في آية واحدة",
        "verses where both words appear",
        "find verses mentioning the two words in one verse",
    ],
    "theme": [
        "ما موقف القرآن من هذا الموضوع",
        "الآيات التي تتحدث عن هذا الموضوع",
        "ماذا يعلمنا القرآن عن هذا",
        "حدثني عن هذا الموضوع في القرآن",
        "what does the Quran teach about this",
        "verses on this subject",
        "tell me about this topic in the Quran",
        "the Quran's guidance about this",
    ],
    "surah": [
        "معلومات عن هذه السورة",
        "كم عدد آيات هذه السورة",
        "هل هذه السورة مكية",
        "tell me about this surah",
        "how long is this surah",
        "facts about this chapter",
    ],
    "superlative": [
        "ما أطول آية في القرآن",
        "أكثر الكلمات ورودا في القرآن",
        "أقصر سورة",
        "what is the longest surah",
        "the most frequent word in the Quran",
        "the shortest verse",
    ],
}
EXAMPLE_FLOOR = 0.86  # the nearest example's cosine below which a question is searched by meaning instead

# words that carry the question, not its term, when the reading came from an example
_CUES_AR = set(
    normalize(w)
    for w in [
        "كم",
        "مرة",
        "مرات",
        "عدد",
        "ما",
        "ماذا",
        "هل",
        "أين",
        "اين",
        "في",
        "أي",
        "اي",
        "التي",
        "الذي",
        "هذه",
        "هذا",
        "كلمة",
        "الكلمة",
        "لفظ",
        "اللفظ",
        "وردت",
        "ورد",
        "ذكرت",
        "ذكر",
        "جاءت",
        "جاء",
        "القرآن",
        "القران",
        "الكريم",
        "المصحف",
        "سورة",
        "السور",
        "الآيات",
        "آيات",
        "معنى",
        "يعني",
        "تعني",
        "المقصود",
        "ب",
        "عن",
        "من",
        "إلى",
        "على",
        "تكررت",
        "تكرر",
        "كثيرا",
        "أريد",
        "اعرض",
        "أجد",
        "مواضع",
        "حدثني",
        "أعطني",
        "لي",
        "ماهو",
        "هو",
        "هي",
    ]
)
_CUES_EN = set(
    [
        "how",
        "many",
        "times",
        "often",
        "is",
        "are",
        "was",
        "were",
        "does",
        "do",
        "did",
        "the",
        "a",
        "an",
        "of",
        "in",
        "on",
        "about",
        "what",
        "which",
        "where",
        "word",
        "words",
        "term",
        "quran",
        "qur'an",
        "koran",
        "mentioned",
        "used",
        "use",
        "appear",
        "appears",
        "occur",
        "occurs",
        "found",
        "mean",
        "means",
        "meaning",
        "show",
        "me",
        "tell",
        "list",
        "find",
        "verses",
        "verse",
        "ayat",
        "surah",
        "surahs",
        "chapter",
        "chapters",
        "say",
        "says",
        "said",
        "uses",
        "using",
        "come",
        "comes",
        "from",
        "root",
        "give",
        "gives",
        "all",
        "there",
        "please",
        "know",
        "want",
        "would",
        "like",
        "can",
        "you",
        "i",
        "explain",
    ]
)


@dataclass
class Term:
    text: str
    subject: dict[str, Any] | None = None


@dataclass
class Reading:
    intent: str
    a: Term | None = None
    b: Term | None = None
    surah: int | None = None
    place: str | None = None  # meccan | medinan
    focus: str | None = None  # a sūra question's figure, a superlative's kind
    how: str = "rule"  # rule | example | search | given
    rule: str | None = None
    example: str | None = None
    score: float | None = None
    notes: list[str] = field(default_factory=list)


# ─── terms ──────────────────────────────────────────────────────────────────────

_ARTICLE = ("وال", "فال", "بال", "كال", "لل", "ال")
_MARKS = re.compile("[\u064b-\u065f\u0640\u06d6-\u06ed]")


def _light(s: str) -> str:
    """Letters as typed, the hamza's seat kept: «إيمان» (faith) is not «أيمان» (oaths). The marks go; the mushaf's
    dagger alef, its ءا and its wasla are written as a reader types them."""
    s = s.replace("\u0670", "ا").replace("ءا", "آ").replace("ٱ", "ا")
    s = _MARKS.sub("", s)
    return s.replace("اا", "ا")


def _light_candidates(s: str) -> list[str]:
    s = _light(s)
    out = [s]
    for c in ("وال", "فال", "بال", "كال", "لل", "ال", "و", "ف"):
        if s.startswith(c) and len(s) - len(c) >= 2:
            out.append(s[len(c) :])
            break
    return out


def _strip_term(text: str) -> str:
    t = _PUNCT.sub(" ", text).strip()
    # «لفظ الجلالة» is how a reader names the word الله
    if re.match(r"^(?:لفظ )?ال[جح]لال[ةه](?:\s+الله)?$", t):
        return "الله"
    # «ذكر موسى», «اسم يوسف»: the mention of a name is the name
    t = re.sub(r"^(?:ذكر|اسم|لفظ|كلمة|كلمه)\s+(?=\S)", "", t)
    # «بالصراط», «للصبر»: a preposition joined to the word
    if re.match(r"^(?:بال|كال)\S{2,}$", t):
        t = t[1:]
    elif re.match(r"^لل\S{2,}$", t):
        t = "ال" + t[2:]
    for p in ("كلمة ", "كلمه ", "لفظة ", "لفظه ", "لفظ ", "اسم ", "the word ", "word ", "the name ", "the "):
        if t.lower().startswith(p):
            t = t[len(p) :]
    return t.strip()


def _surah(conn: Connection, text: str) -> dict[str, Any] | None:
    from .search import _surah_by_name

    t = _strip_term(text)
    t = re.sub(r"^(?:سورة|سوره|surah|sura|surat)\s+", "", t, flags=re.I).strip()
    if t.isdigit() and 1 <= int(t) <= 114:
        return one(
            conn, "select number, name_ar, name_translit from content.surahs where number = :n", {"n": int(t)}
        )
    s = _surah_by_name(conn, t) or _surah_by_name(
        conn, "ال" + t if has_arabic(t) and not t.startswith("ال") else t
    )
    if not s and not has_arabic(t):
        s = _surah_latin(conn, t)
    return {k: s[k] for k in ("number", "name_ar", "name_translit")} if s else None


def _latin_key(s: str) -> str:
    """A sūra's name as readers spell it: Al-Baqarah, al baqara, Ar-Rahmaan and al-rahman meet."""
    s = re.sub(r"^a[a-z]?[-\s']", "", s.lower().strip())
    s = re.sub(r"[^a-z]", "", s)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s.removesuffix("h")


def _surah_latin(conn: Connection, t: str) -> dict[str, Any] | None:
    surahs = rows(conn, "select number, name_ar, name_translit, name_en from content.surahs")
    k = _latin_key(t)
    if len(k) < 2:
        return None
    hit = [s for s in surahs if k in (_latin_key(s["name_translit"]), _latin_key(s["name_en"] or ""))]
    if not hit:
        # vowels as spelt differ (Yasin, Yaseen): the consonants, when they name one sūra only
        sk = re.sub(r"[aeiouy]", "", k)
        hit = [s for s in surahs if re.sub(r"[aeiouy]", "", _latin_key(s["name_translit"])) == sk]
    return hit[0] if len(hit) == 1 else None


def _root(conn: Connection, letters: str) -> dict[str, Any] | None:
    from jadhr_arabic import key as root_key

    parsed = parse_root_input(letters) if has_arabic(letters) else None
    key = root_key("".join(parsed)) if parsed else None
    if not key:
        return None
    r = one(
        conn,
        "select key, spaced, translit, occurrences, lemma_count, verse_count from content.roots where key = :k",
        {"k": key},
    )
    return {"kind": "root", **r} if r else None


def _lemma_subject(conn: Connection, lem: dict[str, Any]) -> dict[str, Any]:
    r = one(
        conn,
        """select l.id, l.slug, l.ar, l.pos, l.occurrences, l.gloss_en, r.key as root_key, r.spaced as root_spaced,
                  (select min(w.location) from content.words w where w.lemma_id = l.id) as first
             from content.lemmas l left join content.roots r on r.id = l.root_id where l.slug = :s""",
        {"s": lem["slug"]},
    )
    assert r is not None
    from .content import lemma_display

    return {"kind": "lemma", **r, "ar": lemma_display(r["ar"])}


def resolve(conn: Connection, text: str) -> dict[str, Any] | None:
    """What a term names in the data: a root («جذر …», letters), a word (its lemma), a person or a place."""
    from .search import _lemma_candidates, search

    t = _strip_term(text)
    if not t:
        return None
    m = re.match(r"^(?:جذر|الجذر|root|the root)\s+(.+)$", t, flags=re.I)
    if m:
        return _root(conn, m.group(1))
    if has_arabic(t):
        toks = t.split()
        if 2 <= len(toks) <= 4 and all(len(normalize(x)) == 1 for x in toks):
            return _root(conn, t)
        lemmas = search(conn, t, 8, 0, "lemmas")["results"].get("lemmas", [])
        if not lemmas:
            return None
        # a word typed with its vowels names that word (عِلْم the noun, عَلِمَ the verb)
        from .search import _HARAKAT, _vowelled

        if _HARAKAT.search(t):
            voweled = [x for x in lemmas if _vowelled(str(x["ar"])) == _vowelled(t)]
            if voweled:
                return _lemma_subject(conn, voweled[0])
        # the same letters with the hamza's seat first, then the same letters folded
        light = _light_candidates(t)
        exact = [x for x in lemmas if _light(str(x["ar"])) in light] or [
            x for x in lemmas if normalize(str(x["ar"])) in _lemma_candidates(normalize(t))
        ]
        # a word written with its article is a noun, never a verb («الحق» is حَقّ, not أَلْحَقَ)
        if normalize(t).startswith(_ARTICLE) and any(x.get("pos") != "V" for x in exact):
            exact = [x for x in exact if x.get("pos") != "V"]
        # a typed word without its article names the same word; a phrase of several words, its first word's lemma
        pick = (
            max(exact, key=lambda x: int(x.get("occurrences") or 0))
            if exact
            else (lemmas[0] if len(toks) == 1 else None)
        )
        return _lemma_subject(conn, pick) if pick else None
    # English: the word whose occurrences the corpus glosses so most often (three at least), else a transliteration
    # typed exactly, else the search's first word, else a person or a place by its name in Wikidata
    low = re.sub(r"^(?:the|a|an)\s+", "", t.lower().strip())
    glossed = _glosses(conn).get(low)
    if glossed and glossed.most_common(1)[0][1] >= 3:
        return _lemma_subject(conn, {"slug": glossed.most_common(1)[0][0]})
    by_translit = _translits(conn).get(_fold(t))
    if by_translit:
        return _lemma_subject(conn, {"slug": by_translit[0]})
    lemmas = search(conn, t, 8, 0, "lemmas")["results"].get("lemmas", [])
    if glossed:
        return _lemma_subject(conn, {"slug": glossed.most_common(1)[0][0]})
    if lemmas:
        return _lemma_subject(conn, lemmas[0])
    e = one(
        conn,
        """select l.slug from content.entity_candidates e join content.lemmas l on l.id = e.lemma_id
            where e.wikidata_label_en ilike :p or e.wikidata_label_en ilike :q
            order by e.occurrences desc limit 1""",
        {"p": t, "q": f"{t} in Isl%"},
    )
    return _lemma_subject(conn, e) if e else None


_GLOSS_LOCK = threading.Lock()
_GLOSS: dict[str, Any] = {}
_GLOSS_DROP = re.compile(
    r"^(?:(?:the|a|an|and|so|then|of|to|in|for|with|by|is|are|was|were|o|from|on|at)\s+)+"
)


def _glosses(conn: Connection) -> dict[str, Counter[str]]:
    """Each English gloss the corpus gives a word, cleaned («(of) the Book,» → book), with the words it glosses."""
    rel = scalar(conn, "select loaded_at::text from content.dataset limit 1")
    with _GLOSS_LOCK:
        if _GLOSS.get("release") == rel:
            return _GLOSS["index"]
        index: dict[str, Counter[str]] = {}
        for r in rows(
            conn,
            """select lower(w.gloss_en) as g, l.slug from content.words w join content.lemmas l on l.id = w.lemma_id
                where w.gloss_en is not null""",
        ):
            g = re.sub(r"\([^)]*\)|[^a-z ]", " ", r["g"])
            g = _GLOSS_DROP.sub("", " ".join(g.split()))
            if g:
                index.setdefault(g, Counter())[r["slug"]] += 1
        _GLOSS.update(release=rel, index=index)
        return index


def _fold(s: str) -> str:
    """A transliteration as typed or stored: no marks, no ʿ or ʾ, doubled letters single (ribāā, riba)."""
    from .search import fold_latin

    return re.sub(r"(.)\1+", r"\1", re.sub(r"[^a-z]", "", fold_latin(s)))


def _translits(conn: Connection) -> dict[str, list[str]]:
    """Each lemma's transliteration, folded, with its lemmas, the most frequent first."""
    rel = scalar(conn, "select loaded_at::text from content.dataset limit 1")
    with _GLOSS_LOCK:
        if _GLOSS.get("translit_release") == rel:
            return _GLOSS["translits"]
        out: dict[str, list[str]] = {}
        for r in rows(
            conn,
            "select slug, translit from content.lemmas where translit is not null order by occurrences desc",
        ):
            out.setdefault(_fold(r["translit"]), []).append(r["slug"])
        _GLOSS.update(translit_release=rel, translits=out)
        return out


def _split_pair(text: str) -> tuple[str, str] | None:
    """Two terms joined by «و» (as its own word or on the second: «الصبر والشكر») or "and"."""
    toks = _strip_term(text).split()
    for i, x in enumerate(toks):
        if i and x in ("و", "and", "&"):
            return " ".join(toks[:i]), " ".join(toks[i + 1 :])
    for i, x in enumerate(toks):
        if i and x.startswith("و") and len(normalize(x)) >= 3:
            return " ".join(toks[:i]), " ".join([x[1:], *toks[i + 1 :]])
    return None


# ─── reading a question ───────────────────────────────────────────────────────────


def _scope(conn: Connection, scope: str | None, r: Reading) -> None:
    if not scope:
        return
    s = normalize(scope).lower()
    if re.search(r"مكي|meccan|makki", s):
        r.place = "meccan"
    elif re.search(r"مدني|medinan|madani", s):
        r.place = "medinan"
    elif re.search(r"سوره|surah|sura", s):
        found = _surah(conn, scope)
        if found:
            r.surah = found["number"]
        else:
            r.notes.append("surah_unknown")


def _tokens(q: str) -> tuple[list[str], str]:
    q = re.sub(r"\b(what|where|which|who|how)['’]s\b", r"\1 is", q, flags=re.I)
    toks = _PUNCT.sub(" ", q).split()
    norm = [normalize(t).lower() if has_arabic(t) else t.lower() for t in toks]
    return toks, " ".join(norm)


def _original(toks: list[str], norm: str, span: tuple[int, int]) -> str:
    """The reader's own words for a span of the normalised question (marks and spelling as typed)."""
    start = norm[: span[0]].count(" ")
    end = norm[: span[1]].count(" ") + 1
    return " ".join(toks[start:end])


def _by_rule(conn: Connection, q: str) -> Reading | None:
    toks, norm = _tokens(q)
    lang = "ar" if has_arabic(q) else "en"
    for i, (intent, rl, pat) in enumerate(RULES):
        if rl != lang:
            continue
        m = pat.match(norm)
        if not m:
            continue
        g = m.groupdict()
        r = Reading(intent=intent, rule=f"{intent}.{lang}.{i}")
        if intent == "superlative":
            r.focus = _superlative(g["sup"], g["what"])
            if r.focus is None:
                continue
        elif intent == "surah":
            s = _surah(conn, _original(toks, norm, m.span("surah")))
            if not s:
                continue
            r.surah = s["number"]
            r.focus = _surah_focus(g.get("focus"))
        elif intent in TWO_TERMS:
            pair = _split_pair(_original(toks, norm, m.span("pair")))
            if not pair:
                continue
            r.a, r.b = Term(pair[0]), Term(pair[1])
        else:
            r.a = Term(_original(toks, norm, m.span("a")))
            if g.get("scope"):
                _scope(conn, _original(toks, norm, m.span("scope")), r)
        return r
    return None


def _superlative(sup: str, what: str) -> str | None:
    sup, what = sup.lower(), normalize(what).lower()
    longest = sup in ("اطول", "اكبر", "longest", "largest")
    shortest = sup in ("اقصر", "اصغر", "shortest", "smallest")
    most = sup in ("اكثر", "most frequent", "most common")
    least = sup in ("اقل", "least frequent", "rarest")
    if re.search(r"سوره|سور|surah|sura|chapter", what):
        return "longest_surah" if longest else "shortest_surah" if shortest else None
    if re.search(r"ايه|اية|ايات|verse|ayah", what):
        return "longest_verse" if longest else "shortest_verse" if shortest else None
    if re.search(r"جذر|جذور|root", what):
        return "most_frequent_root" if most else "least_frequent_root" if least else None
    if re.search(r"فعل|افعال|verb", what):
        return "most_frequent_verb" if most else None
    if re.search(r"اسم|اسماء|noun", what):
        return "most_frequent_noun" if most else None
    if re.search(r"كلم|لفظ|word", what):
        return "most_frequent_word" if most else "least_frequent_word" if least else None
    return None


def _surah_focus(f: str | None) -> str | None:
    if not f:
        return None
    f = normalize(f).lower()
    return (
        "verses" if re.search(r"اي|verse|ayah|ayat", f) else "words" if re.search(r"كلم|word", f) else "roots"
    )


# the example questions as vectors, once per model
_EX_LOCK = threading.Lock()
_EX: dict[str, tuple[np.ndarray, list[tuple[str, str]]]] = {}


def _examples() -> tuple[np.ndarray, list[tuple[str, str]], str] | None:
    from . import semantic

    with _EX_LOCK:
        if _EX:
            model, (mat, labels) = next(iter(_EX.items()))
            return mat, labels, model
        labels = [(intent, q) for intent, qs in EXAMPLES.items() for q in qs]
        vecs: list[np.ndarray] = []
        model = None
        for _, q in labels:
            got = semantic.embed(q)
            if got is None:
                return None
            vecs.append(got[0])
            model = got[1]
        assert model is not None
        _EX[model] = (np.stack(vecs), labels)
        return _EX[model][0], labels, model


def _by_example(conn: Connection, q: str) -> Reading | None:
    from . import semantic

    ex = _examples()
    got = semantic.embed(q)
    if ex is None or got is None or got[1] != ex[2]:
        return None
    mat, labels, _ = ex
    sims = mat @ got[0]
    i = int(np.argmax(sims))
    if float(sims[i]) < EXAMPLE_FLOOR:
        return None
    intent = labels[i][0]
    r = Reading(intent=intent, how="example", example=labels[i][1], score=round(float(sims[i]), 4))
    toks = _PUNCT.sub(" ", q).split()
    cues = _CUES_AR if has_arabic(q) else _CUES_EN
    rest = [t for t in toks if (normalize(t) if has_arabic(t) else t.lower()) not in cues]
    if intent in NO_TERMS or intent == "surah":
        return None  # their terms are read by rules only: an example names no sūra or superlative
    if intent in TWO_TERMS:
        pair = _split_pair(" ".join(rest))
        if not pair:
            return None
        r.a, r.b = Term(pair[0]), Term(pair[1])
        return r
    # the term is the last word left that names something in the data («اعرض لي مواضع الصبر» → الصبر)
    for tok in reversed(rest):
        sub = resolve(conn, tok)
        if sub:
            r.a = Term(tok, sub)
            return r
    return None


def read(conn: Connection, q: str) -> Reading:
    """The question's reading: by rule, else by the nearest example, else a search by meaning of the whole."""
    q = q.strip()
    r = _by_rule(conn, q) or _by_example(conn, q) or Reading(intent="theme", a=Term(q), how="search")
    for t in (r.a, r.b):
        if t and t.subject is None:
            t.subject = resolve(conn, t.text) if r.intent != "theme" else None
    # a word the data cannot name, asked of by a one-term intent, is searched by meaning instead
    if r.intent not in ("theme", "surah", "superlative", *TWO_TERMS) and r.a and r.a.subject is None:
        r.notes.append("term_unresolved")
    return r


def given(
    conn: Connection, intent: str, a: str | None, b: str | None, surah: int | None, place: str | None
) -> Reading:
    """The reading as the reader set it ("understood as", edited)."""
    r = Reading(intent=intent, how="given", surah=surah, place=place)
    if a:
        r.a = Term(a, resolve(conn, a) if intent != "theme" else None)
    if b:
        r.b = Term(b, resolve(conn, b))
    if intent == "superlative" and a:
        r.focus = a if a in _SUPERLATIVES else None
    if intent == "surah":
        r.focus = a if a in ("verses", "words", "roots") else None
    return r


# ─── answers ────────────────────────────────────────────────────────────────────

_SUPERLATIVES = (
    "longest_surah",
    "shortest_surah",
    "longest_verse",
    "shortest_verse",
    "most_frequent_word",
    "least_frequent_word",
    "most_frequent_root",
    "least_frequent_root",
    "most_frequent_noun",
    "most_frequent_verb",
)
_COUNTED = "the words of the Quranic Arabic Corpus (77,429), each counted once where it stands"


def _where(sub: dict[str, Any], alias: str = "w") -> tuple[str, dict[str, Any]]:
    if sub["kind"] == "root":
        return f"{alias}.root_id = (select id from content.roots where key = :rk)", {"rk": sub["key"]}
    return f"{alias}.lemma_id = :lid", {"lid": sub["id"]}


def _scope_sql(r: Reading) -> tuple[str, dict[str, Any]]:
    out, p = "", {}
    if r.surah:
        out += " and w.surah = :sn"
        p["sn"] = r.surah
    if r.place:
        out += " and w.surah in (select number from content.surahs where revelation_place = :pl)"
        p["pl"] = r.place
    return out, p


def _verses(
    conn: Connection, keys_sql: str, params: dict[str, Any], limit: int, offset: int = 0
) -> list[dict]:
    return rows(
        conn,
        f"""select v.key, v.surah, v.ayah, v.text_qpc, s.name_ar, s.name_translit
              from content.verses v join content.surahs s on s.number = v.surah
             where v.id in ({keys_sql}) order by v.id limit :lim offset :off""",
        {**params, "lim": limit, "off": offset},
    )


def _count(conn: Connection, r: Reading) -> dict[str, Any]:
    sub = r.a.subject  # type: ignore[union-attr]
    w, p = _where(sub)
    sc, sp = _scope_sql(r)
    c = one(
        conn,
        f"select count(*)::int as n, count(distinct w.verse_id)::int as v from content.words w where {w}{sc}",
        {**p, **sp},
    )
    out: dict[str, Any] = {
        "kind": "count",
        "subject": sub,
        "count": c["n"],
        "verses": c["v"],
        "counted": _COUNTED,
    }
    if sub["kind"] == "lemma" and sub.get("root_key"):
        # the word's root beside it: «الشكر» is one word, its root many
        rr = one(
            conn,
            f"""select count(*)::int as n, count(distinct w.lemma_id)::int as lemmas from content.words w
                 where w.root_id = (select id from content.roots where key = :rk){sc}""",
            {"rk": sub["root_key"], **sp},
        )
        out["root"] = {
            "key": sub["root_key"],
            "spaced": sub["root_spaced"],
            "count": rr["n"],
            "lemmas": rr["lemmas"],
        }
    if sub["kind"] == "lemma":
        out["entity"] = one(
            conn,
            """select wikidata_id, wikidata_label_ar, wikidata_label_en from content.entity_candidates
                where lemma_id = :l and wikidata_id is not null""",
            {"l": sub["id"]},
        )
    return out


def _distribution(conn: Connection, r: Reading, kind: str) -> dict[str, Any]:
    from . import stats

    sub = r.a.subject  # type: ignore[union-attr]
    d = stats.distribution(conn, sub["key"] if sub["kind"] == "root" else None, sub.get("slug"))
    assert d is not None
    surahs = [s for s in d["surahs"] if s["count"]]
    place = {
        "meccan": sum(s["count"] for s in surahs if s["place"] == "meccan"),
        "medinan": sum(s["count"] for s in surahs if s["place"] == "medinan"),
    }
    out: dict[str, Any] = {
        "kind": kind,
        "subject": sub,
        "count": d["total"],
        "verses": d["verses"],
        "surah_count": len(surahs),
        "place": place,
        "counted": _COUNTED,
    }
    if kind == "where":
        out["surahs"] = sorted(surahs, key=lambda s: (-s["count"], s["surah"]))
        w, p = _where(sub, "x")
        out["first"] = _verses(conn, f"select x.verse_id from content.words x where {w}", p, 10)
    else:
        out["surahs"] = d["surahs"]
    return out


def _meaning(conn: Connection, r: Reading) -> dict[str, Any]:
    sub = r.a.subject  # type: ignore[union-attr]
    if sub["kind"] == "root":
        return {"kind": "meaning", "subject": sub, "gharib": [], "root_page": f"/roots/{sub['key']}"}
    # what the books of gharīb say of the word where it stands, verbatim and credited; one line per meaning
    seen: set[str] = set()
    meanings = []
    for g in rows(
        conn,
        """select g.meaning_ar, g.phrase_ar, g.verse_keys[1] as verse_key, w.title_ar, w.title_en, w.id as work_id
             from content.gharib_meanings g join content.gharib_works w on w.id = g.work_id
            where g.word_locations && (select array_agg(location) from content.words where lemma_id = :l)
            order by g.surah, g.ayah limit 60""",
        {"l": sub["id"]},
    ):
        k = normalize(g["meaning_ar"])
        if k in seen:
            continue
        seen.add(k)
        meanings.append(g)
        if len(meanings) == 6:
            break
    return {"kind": "meaning", "subject": sub, "gharib": meanings, "word_page": f"/word/{sub['first']}"}


def _root_answer(conn: Connection, r: Reading) -> dict[str, Any]:
    sub = r.a.subject  # type: ignore[union-attr]
    key = sub["key"] if sub["kind"] == "root" else sub.get("root_key")
    if not key:
        # a particle or a name the corpus gives no root: said, never a pseudo-root (product law)
        return {"kind": "root", "subject": sub, "root": None}
    root = one(
        conn,
        """select key, spaced, translit, occurrences, lemma_count, verse_count, gist_ar, gloss_en
             from content.roots where key = :k""",
        {"k": key},
    )
    family = rows(
        conn,
        """select l.slug, l.ar, l.pos, l.occurrences from content.lemmas l
             join content.roots r on r.id = l.root_id where r.key = :k order by l.occurrences desc limit 8""",
        {"k": key},
    )
    from .content import lemma_display

    for f in family:
        f["ar"] = lemma_display(f["ar"])
    return {"kind": "root", "subject": sub, "root": root, "family": family}


def _pair(conn: Connection, r: Reading, kind: str, limit: int, offset: int) -> dict[str, Any]:
    a, b = r.a.subject, r.b.subject  # type: ignore[union-attr]
    wa, pa = _where(a, "x")
    wb, pb = _where(b, "y")
    pb = {k + "2": v for k, v in pb.items()}
    wb = wb.replace(":rk", ":rk2").replace(":lid", ":lid2")
    both = f"select x.verse_id from content.words x where {wa} intersect select y.verse_id from content.words y where {wb}"
    shared = int(scalar(conn, f"select count(*) from ({both}) z", {**pa, **pb}) or 0)
    out: dict[str, Any] = {"kind": kind, "a": a, "b": b, "shared_verses": shared}
    out["verses"] = _verses(conn, both, {**pa, **pb}, limit if kind == "together" else 5, offset)
    if kind == "compare":
        counts = {}
        for name, s in (("a", a), ("b", b)):
            w, p = _where(s)
            c = one(
                conn,
                f"""select count(*)::int as n, count(distinct w.verse_id)::int as v,
                           count(*) filter (where s.revelation_place = 'meccan')::int as meccan,
                           count(*) filter (where s.revelation_place = 'medinan')::int as medinan
                      from content.words w join content.surahs s on s.number = w.surah where {w}""",
                p,
            )
            # a word's root beside it: «الصبر» and «الشكر» are one word each, their roots many
            if s["kind"] == "lemma" and s.get("root_key"):
                rc = one(
                    conn,
                    """select count(*)::int as n, count(distinct w.verse_id)::int as v from content.words w
                        where w.root_id = (select id from content.roots where key = :rk)""",
                    {"rk": s["root_key"]},
                )
                c = {**c, "root": {"key": s["root_key"], "spaced": s["root_spaced"], **rc}}
            counts[name] = c
        out["counts"] = counts
        out["same_root"] = bool(a.get("root_key") or a.get("key")) and (
            a.get("root_key") or a.get("key")
        ) == (b.get("root_key") or b.get("key"))
        # what the administration set between the two words (P14), read both ways
        rel = []
        if a["kind"] == "lemma" and b["kind"] == "lemma":
            from .context import word_relations

            for kind_, items in word_relations(conn, a["slug"]).items():
                rel += [{"relation": kind_, **x} for x in items if x.get("slug") == b["slug"]]
        out["relations"] = rel
    return out


def _theme(conn: Connection, r: Reading, limit: int) -> dict[str, Any]:
    from . import semantic
    from .search import detect

    text = r.a.text if r.a else ""
    kind, _ = detect(conn, text)
    sem_kind = kind if kind in semantic.ELIGIBLE else ("arabic_phrase" if has_arabic(text) else "latin")
    sem = semantic.search(conn, text, sem_kind, limit, 0)
    topics = rows(
        conn,
        """select t.id, coalesce(t.name_ar, t.name_en) as name, t.source_id, t.verse_count
             from content.topics t
            where t.verse_count > 0 and (t.name_norm like :p or lower(t.name_en) like :e)
            order by t.verse_count desc limit 6""",
        {"p": f"%{normalize(_strip_term(text))}%", "e": f"%{_strip_term(text).lower()}%"},
    )
    return {"kind": "theme", "text": text, "semantic": sem, "topics": topics}


def _surah_answer(conn: Connection, r: Reading) -> dict[str, Any]:
    from . import stats

    d = stats.surah_detail(conn, r.surah)  # type: ignore[arg-type]
    assert d is not None
    keep = (
        "name_ar", "name_translit", "place", "revelation_order", "verses", "words", "words_per_verse", "lemmas",
        "roots", "hapax", "unique_roots", "top_roots",
    )  # fmt: skip
    return {
        "kind": "surah",
        "focus": r.focus,
        "surah": {"number": r.surah, **{k: d[k] for k in keep}},
        "counted": _COUNTED,
    }


def _superlative_answer(conn: Connection, r: Reading) -> dict[str, Any]:
    f = r.focus
    if f in ("longest_surah", "shortest_surah"):
        items = rows(
            conn,
            f"""select number, name_ar, name_translit, verse_count, word_count from content.surahs
                 order by verse_count {"desc" if f == "longest_surah" else "asc"}, word_count
                 {"desc" if f == "longest_surah" else "asc"} limit 5""",
        )
        return {"kind": "superlative", "focus": f, "items": items, "measure": "verses, then words"}
    if f in ("longest_verse", "shortest_verse"):
        items = rows(
            conn,
            f"""select v.key, v.surah, v.ayah, v.text_qpc, s.name_ar, s.name_translit, count(w.id)::int as words
                  from content.verses v join content.surahs s on s.number = v.surah
                  join content.words w on w.verse_id = v.id
                 group by v.id, s.name_ar, s.name_translit order by words {"desc" if f == "longest_verse" else "asc"}, v.id
                 limit 5""",
        )
        return {"kind": "superlative", "focus": f, "items": items, "measure": "words of the corpus"}
    if f in ("most_frequent_root", "least_frequent_root"):
        items = rows(
            conn,
            f"""select key, spaced, translit, occurrences, lemma_count from content.roots where occurrences > 0
                 order by occurrences {"desc" if f == "most_frequent_root" else "asc"}, key limit 5""",
        )
        return {"kind": "superlative", "focus": f, "items": items, "measure": "words of the corpus"}
    pos = {"most_frequent_noun": "N", "most_frequent_verb": "V"}.get(f or "")
    from .concordance import _FUNCTION_TAGS
    from .content import lemma_display

    items = rows(
        conn,
        f"""select slug, ar, pos, occurrences, gloss_en from content.lemmas
             where occurrences > 0 {"and pos = :pos" if pos else "and not (pos = any(:fn))"}
             order by occurrences {"asc" if f == "least_frequent_word" else "desc"}, slug limit 5""",
        {"pos": pos} if pos else {"fn": list(_FUNCTION_TAGS)},
    )
    for x in items:
        x["ar"] = lemma_display(x["ar"])
    return {
        "kind": "superlative",
        "focus": f,
        "items": items,
        "measure": "words of the corpus; particles and pronouns left out"
        if not pos
        else "words of the corpus",
    }


def answer(conn: Connection, r: Reading, limit: int = 20, offset: int = 0) -> dict[str, Any]:
    need_a = r.intent not in ("surah", "superlative")
    if need_a and (r.a is None or (r.intent != "theme" and r.a.subject is None)):
        return {"kind": "unresolved", "missing": "a"}
    if r.intent in TWO_TERMS and (r.b is None or r.b.subject is None):
        return {"kind": "unresolved", "missing": "b"}
    if r.intent == "surah" and not r.surah:
        return {"kind": "unresolved", "missing": "surah"}
    if r.intent == "superlative" and r.focus not in _SUPERLATIVES:
        return {"kind": "unresolved", "missing": "focus"}
    if r.intent == "count":
        return _count(conn, r)
    if r.intent in ("where", "distribution"):
        return _distribution(conn, r, r.intent)
    if r.intent == "meaning":
        return _meaning(conn, r)
    if r.intent == "root":
        return _root_answer(conn, r)
    if r.intent in TWO_TERMS:
        return _pair(conn, r, r.intent, limit, offset)
    if r.intent == "theme":
        return _theme(conn, r, limit)
    if r.intent == "surah":
        return _surah_answer(conn, r)
    return _superlative_answer(conn, r)


def understood(r: Reading) -> dict[str, Any]:
    term = lambda t: {"text": t.text, "subject": t.subject} if t else None  # noqa: E731
    return {
        "intent": r.intent,
        "a": term(r.a),
        "b": term(r.b),
        "surah": r.surah,
        "place": r.place,
        "focus": r.focus,
        "how": r.how,
        "rule": r.rule,
        "example": r.example,
        "score": r.score,
        "notes": r.notes,
    }


def ask(conn: Connection, q: str | None, limit: int = 20, offset: int = 0, **reading: Any) -> dict[str, Any]:
    r = given(conn, **reading) if reading.get("intent") else read(conn, q or "")
    out = answer(conn, r, limit, offset)
    # a one-term question whose term the data cannot name is searched by meaning, said so
    fallback = None
    if out["kind"] == "unresolved" and r.intent != "theme" and q:
        fallback = _theme(conn, Reading(intent="theme", a=Term(q), how="search"), limit)
    return {"question": q, "understood": understood(r), "answer": out, "fallback": fallback}
