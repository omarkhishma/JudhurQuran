"""A word read against a known vocabulary, with how sure each reading is (the Analyser's rules, PLAN P4.3,
extended past the Quran in P11.4). Pure functions over a :class:`Vocabulary` the caller builds — the pipeline from
the dataset's files, the API from its database — so every text is read by one set of rules.

The rules, in order (DECISIONS 2026-10-03, «The Analyser reads … never with an invented analysis»):

``form``     the same written form occurs in the Quran: its analyses there, ranked by their share of those
             occurrences (the share is the confidence), one per root, three at most;
``particle`` that form's best analysis is a function word: no root;
``clitic``   the form after a conjunction, preposition, article or attached pronoun is taken off, then as above,
             confidence × 0.7; after the article no verb reading;
``pattern``  root candidates from the Quran's patterns read over the word — the letters in the ف ع ل slots taken
             as the root — kept where the Quran has that root (confidence at most 0.35). The patterns are lemma
             patterns, so a verb's inflection is taken off first where the pattern is a verb's: an imperfect
             prefix (ي ت ن ا) and a person or number ending (ون ين وا ان تم تن نا ت ن), × 0.8;
``pattern-dict``  the same over the dictionary's roots, for a word whose root the Quran does not have (confidence
             at most 0.2): the classical lexica attest the root, nothing more is claimed;
``weak`` / ``weak-dict``  a stem of two or three letters read by the classical rules for weak and doubled roots
             (a doubled root written with two letters: حد → حدد; a hollow root's alif: حال → حول, حيل; a first
             و dropped: يقع → وقع, صفة → وصف; a last weak letter: دعا → دعو), each candidate kept only where the
             Quran (≤ 0.25) or else the dictionary (≤ 0.15) has the root, every attested candidate listed;
``none``     nothing found — a name, a loanword, a word no source here attests.

Every reading names a lemma, root and pattern some source gives; nothing is guessed beyond that.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from .normalize import normalize

CONTENT_POS = frozenset({"N", "V", "PN", "ADJ", "IMPN", "T", "LOC"})
CLITIC_FACTOR = 0.7
PATTERN_CEILING = 0.35
DICT_PATTERN_CEILING = 0.2
TOP = 3
PREFIXES = ("وبال", "فبال", "وال", "فال", "بال", "كال", "ولل", "فلل", "لل", "ال", "وب", "فب", "ول", "فل", "وس", "فس", "و", "ف", "ب", "ك", "ل", "س")  # fmt: skip
SUFFIXES = ("كما", "هما", "تما", "كم", "كن", "هم", "هن", "نا", "ها", "تم", "ني", "ه", "ك", "ي")
# a verb's inflection, read only against verb patterns (the imperfect prefix, the person and number endings)
VERB_PREFIXES = ("ي", "ت", "ن", "ا")
VERB_SUFFIXES = ("ون", "ين", "وا", "ان", "تم", "تن", "نا", "ت", "ن", "و")
INFLECTION_FACTOR = 0.8
# written apart, these are function marks, not words with a root: the vocative, a lone letter (the hadith's
# taḥwīl «ح», a conjunction or preposition split from its word)
MARKS = frozenset({"يا", *"ءابتثجحخدذرزسشصضطظعغفقكلمنهوي"})
WEAK_CEILING = 0.25
WEAK_DICT_CEILING = 0.15
_SLOTS = ("ف", "ع", "ل")


def fold_root(key: str) -> str:
    """A root key as a matching key reads it: hamza on any seat, or alone, as ا (أخذ, ءخذ → اخذ)."""
    return normalize(key).replace("ء", "ا")


@dataclass(frozen=True)
class Reading:
    lemma_id: int | None
    root: str | None  # the Quran's root key (the corpus's), when the reading is the Quran's
    dict_root: str | None  # the dictionary's root key (hamza written ء), whenever there is a root
    pattern: str | None  # a pattern's slug
    pos: str | None
    confidence: float
    count: int = 0


@dataclass(frozen=True)
class Analysis:
    kind: str  # form | particle | clitic | pattern | pattern-dict | none
    confidence: float
    clitics: tuple[str, ...] = ()
    readings: tuple[Reading, ...] = ()


@dataclass
class Vocabulary:
    """What words are read against. ``forms``: a matching key → its analyses in the Quran (lemma id, the Quran's
    root key, part of speech, how often); ``patterns``: (slug, bare letters, part-of-speech hint, occurrences);
    ``quran_roots``: the corpus's root keys; ``dict_roots``: the dictionary's root keys (P11.1);
    ``to_dict``: a Quranic root key → its dictionary key."""

    forms: dict[str, list[tuple[int | None, str | None, str | None, int]]]
    patterns: list[tuple[str, str, str | None, int]]
    quran_roots: set[str]
    dict_roots: set[str]
    to_dict: dict[str, str]
    _quran_by_fold: dict[str, list[str]] = field(default_factory=dict, repr=False)
    _dict_by_fold: dict[str, list[str]] = field(default_factory=dict, repr=False)
    _patterns_by_len: dict[int, list[tuple[str, str, str | None, int]]] = field(
        default_factory=dict, repr=False
    )

    def __post_init__(self) -> None:
        q: dict[str, list[str]] = defaultdict(list)
        for k in sorted(self.quran_roots):
            q[fold_root(k)].append(k)
        d: dict[str, list[str]] = defaultdict(list)
        for k in sorted(self.dict_roots):
            d[fold_root(k)].append(k)
        p: dict[int, list[tuple[str, str, str | None, int]]] = defaultdict(list)
        for slug, bare, hint, n in self.patterns:
            p[len(normalize(bare))].append((slug, normalize(bare), hint, n))
        self._quran_by_fold, self._dict_by_fold, self._patterns_by_len = dict(q), dict(d), dict(p)


def vocabulary_from(
    words: list[dict[str, Any]],
    root_rows: list[dict[str, Any]],
    pattern_rows: list[dict[str, Any]],
    dict_rows: list[dict[str, Any]],
) -> Vocabulary:
    """The vocabulary from the dataset's rows — the build's before they are written, the API's from its database —
    so both read every word against the same thing: a word counted once under each of its matching keys (its
    everyday spelling, its mushaf spelling, the spelling read off the mushaf). ``words``: lemma_id, root_id, pos and
    the three keys; ``root_rows``: id and key; ``pattern_rows``: slug, ar_bare, pos_hint, occurrences;
    ``dict_rows``: key, quran_root, letters."""
    roots = {r["id"]: r["key"] for r in root_rows}
    counts: dict[str, Counter[tuple[int | None, str | None, str | None]]] = {}
    for w in words:
        sig = (w["lemma_id"], roots.get(w["root_id"]) if w["root_id"] else None, w["pos"])
        for key in {w.get("norm"), w.get("norm_uthmani"), w.get("norm_plain")} - {None, ""}:
            counts.setdefault(key, Counter())[sig] += 1
    forms = {k: [(*sig, n) for sig, n in c.items()] for k, c in counts.items()}
    patterns = [(p["slug"], p["ar_bare"], p.get("pos_hint"), int(p["occurrences"])) for p in pattern_rows]
    return Vocabulary(
        forms=forms,
        patterns=patterns,
        quran_roots=set(roots.values()),
        dict_roots={r["key"] for r in dict_rows if r["letters"] >= 3},
        to_dict={r["quran_root"]: r["key"] for r in dict_rows if r["quran_root"]},
    )


def strips(key: str) -> list[tuple[str, tuple[str, ...]]]:
    """Stems left after taking off a proclitic, an enclitic or both, with what was taken; a stem keeps two letters."""
    out: list[tuple[str, tuple[str, ...]]] = []
    for p in ("", *PREFIXES):
        if not key.startswith(p):
            continue
        rest = key[len(p) :]
        for s in ("", *SUFFIXES):
            if (p or s) and rest.endswith(s):
                stem = rest[: len(rest) - len(s)] if s else rest
                if len(stem) >= 2:
                    out.append((stem, tuple(x for x in (p, s) if x)))
    return out


def _has_article(taken: tuple[str, ...]) -> bool:
    return any(c.endswith("ال") or c.endswith("لل") for c in taken)


def _by_form(v: Vocabulary, key: str, factor: float, nouns_only: bool) -> list[Reading]:
    rows = [r for r in v.forms.get(key, []) if not (nouns_only and r[2] == "V")]
    total = sum(r[3] for r in rows)
    if not total:
        return []
    best: dict[str, Reading] = {}
    for lemma_id, root, pos, n in sorted(rows, key=lambda r: -r[3]):
        share = n / total
        reading = Reading(
            lemma_id, root, v.to_dict.get(root) if root else None, None, pos, round(share * factor, 3), n
        )
        # one reading per root; a rootless word per lemma, else per part of speech (as the site's Analyser)
        k = root or (f"lemma:{lemma_id}" if lemma_id is not None else (pos or ""))
        if k not in best:
            best[k] = reading
    return sorted(best.values(), key=lambda r: -r.confidence)[:TOP]


def _inflections(stem: str) -> list[str]:
    """A verb's stems once its imperfect prefix and/or person-number ending is taken off (يتقاعسون → تقاعس)."""
    out: list[str] = []
    for p in ("", *VERB_PREFIXES):
        if p and not stem.startswith(p):
            continue
        rest = stem[len(p) :]
        for s in ("", *VERB_SUFFIXES):
            if (p or s) and rest.endswith(s):
                core = rest[: len(rest) - len(s)] if s else rest
                if len(core) >= 3 and core not in out:
                    out.append(core)
    return out


def _by_pattern(
    v: Vocabulary, key: str, nouns_only: bool, verbs_only: bool = False, factor: float = 1.0
) -> tuple[str, list[Reading]]:
    pats = [
        p
        for p in v._patterns_by_len.get(len(key), [])
        if not (nouns_only and p[2] == "V") and not (verbs_only and p[2] != "V")
    ]
    total = sum(p[3] for p in pats) or 1
    quran: dict[str, Reading] = {}
    dic: dict[str, Reading] = {}
    for slug, bare, _, n in pats:
        letters: list[str] = []
        ok = True
        for pc, kc in zip(bare, key, strict=True):
            if pc in _SLOTS:
                letters.append(kc)
            elif pc != kc:
                ok = False
                break
        if not ok or len(letters) != 3:
            continue
        fold = fold_root("".join(letters))
        weight = (0.5 + n / total) * factor
        for root in v._quran_by_fold.get(fold, []):
            score = round(min(PATTERN_CEILING, PATTERN_CEILING * weight), 3)
            if root not in quran or score > quran[root].confidence:
                quran[root] = Reading(None, root, v.to_dict.get(root), slug, None, score)
        for droot in v._dict_by_fold.get(fold, []):
            score = round(min(DICT_PATTERN_CEILING, DICT_PATTERN_CEILING * weight), 3)
            if droot not in dic or score > dic[droot].confidence:
                dic[droot] = Reading(None, None, droot, slug, None, score)
    if quran:
        return "pattern", sorted(quran.values(), key=lambda r: -r.confidence)[:TOP]
    return "pattern-dict", sorted(dic.values(), key=lambda r: -r.confidence)[:TOP]


def weak_roots(stem: str) -> list[str]:
    """The roots a short stem may come from by the weak- and doubled-root rules, most usual first."""
    out: list[str] = []
    if len(stem) == 2:
        x, y = stem
        out += [x + y + y, "و" + x + y, x + y + "و", x + y + "ي", x + "و" + y, x + "ي" + y]
    elif len(stem) == 3:
        x, m, y = stem
        if m == "ا":  # a hollow root's alif
            out += [x + "و" + y, x + "ي" + y]
        if y in "اي":  # a last weak letter
            out += [x + m + "و", x + m + "ي"]
        if y == "ه" and m != "ا":  # a first و dropped before ة (صفة، جهة، عدة)
            out += ["و" + x + m]
    return list(dict.fromkeys(out))


def _by_weak(v: Vocabulary, stem: str) -> tuple[str, list[Reading]]:
    cands = weak_roots(stem)
    quran = [r for c in cands for r in v._quran_by_fold.get(fold_root(c), [])]
    if quran:
        return "weak", [
            Reading(None, r, v.to_dict.get(r), None, None, WEAK_CEILING) for r in dict.fromkeys(quran)
        ][:TOP]
    dic = [r for c in cands for r in v._dict_by_fold.get(fold_root(c), [])]
    return "weak-dict", [Reading(None, None, r, None, None, WEAK_DICT_CEILING) for r in dict.fromkeys(dic)][
        :TOP
    ]


def analyse(v: Vocabulary, word: str) -> Analysis:
    """One word (any spelling, with or without marks) read by the rules above."""
    key = normalize(word).replace(" ", "")
    if not key:
        return Analysis("none", 0.0)
    found = _by_form(v, key, 1.0, False)
    if not found and key in MARKS:
        return Analysis("particle", 1.0)
    if found:
        top = found[0]
        if top.root is None and (top.pos or "") not in CONTENT_POS:
            return Analysis("particle", 1.0, (), (top,))
        return Analysis("form", top.confidence, (), tuple(found))
    for stem, taken in strips(key):
        nouns = _has_article(taken)
        found = [r for r in _by_form(v, stem, CLITIC_FACTOR, nouns) if (r.pos or "") in CONTENT_POS or r.root]
        if found:
            return Analysis("clitic", found[0].confidence, taken, tuple(found))
    best: Analysis | None = None
    for stem, taken in [(key, ()), *strips(key)]:
        kind, found = _by_pattern(v, stem, _has_article(taken))
        if not found and not _has_article(taken):
            # a verb in its inflection: read against the verb patterns once the inflection is off
            for core in _inflections(stem):
                kind, found = _by_pattern(v, core, False, verbs_only=True, factor=INFLECTION_FACTOR)
                if found:
                    break
        if found:
            cand = Analysis(kind, found[0].confidence, taken, tuple(found))
            # the Quran's roots before the dictionary's: stop at the first reading over a Quranic root
            if kind == "pattern":
                return cand
            best = best or cand
    if best:
        return best
    # the weak and doubled roots, on the stem and on a verb's stem once its inflection is off
    for stem, taken in [(key, ()), *strips(key)]:
        for core in [
            stem,
            *([] if _has_article(taken) else _inflections(stem)),
            *(stem[1:] for _ in [0] if len(stem) == 3 and stem[0] in VERB_PREFIXES),
        ]:
            kind, found = _by_weak(v, core)
            if found and (kind == "weak" or best is None):
                cand = Analysis(kind, found[0].confidence, taken, tuple(found))
                if kind == "weak":
                    return cand
                best = cand
    return best or Analysis("none", 0.0)


# one tokeniser for every text, shared by the pipeline (which stores a form id per word) and the API (which gives a
# passage's words back with their spans): a run of Arabic letters and the marks on them
_WORD = re.compile("[ء-غف-يٱ-ۓً-ٰٟۖ-ۭ]+")


def word_spans(text: str) -> list[tuple[int, int]]:
    """Where each word of a text begins and ends, in order."""
    return [(m.start(), m.end()) for m in _WORD.finditer(text)]
