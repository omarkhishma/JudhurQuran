"""Map a classical headword («الخوف», «أخلد», «ب ر ه ن», «والقرء») to a Quranic root and lemma.

Only mechanical evidence is used, and the method is stored with every mapping so the workbench can show
how it was made. In order:

1. ``lemma`` — the word (as written, then without the article, then without a leading conjunction و)
   equals the normalised spelling of exactly one corpus lemma; ``lemma-root`` — several lemmas share that
   spelling but all have the same root (root mapped, lemma left to the editor).
2. ``quran-form`` — the word equals the normalised stem of words in the Quran (an inflected form such as
   «أخلد», «الأفواه»); mapped when every such word has the same root (and lemma, if one).
3. ``root-letters`` — the word's letters without the article (hamza carriers folded to ء, ى to ي, ة to
   ه) are exactly a Quranic root: «الإصر» → أصر. Spaced root letters («ب ر ه ن») are matched this way.
4. ``root-letters-loose:<rule>`` — one documented weak-letter or hamza substitution makes the letters a
   root (rules and confidence from ``lexica/rootmap.py``); high and medium confidence are mapped, low is
   left unmapped with the candidate given.

Anything else stays unmapped with a reason: ``particle`` (corpus lemmas with no root), ``ambiguous``
(candidates with different roots, listed), ``phrase`` (a multi-word heading whose first word does not map),
``no-quranic-match``. Particles get no root, never a pseudo-root.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize, plain_spelling, strip_marks

from ..lexica.rootmap import RootMatcher, skeleton_letters

_CONTENT_POS = {"N", "V", "ADJ", "PN"}
# Nouns whose hamzat al-waṣl drops after the article (المرأة = ال + امرأة); only these get it back.
_WASL_NOUNS = {
    "امراه",
    "امرو",
    "امري",
    "ابن",
    "ابنه",
    "اسم",
    "اثنان",
    "اثنين",
    "اثنتان",
    "اثنتين",
}  # corpus parts of speech that are not function words
_STRIP = re.compile(r"[\"'«»()\[\]{}.،:؛!؟\-]")


@dataclass
class Mapping:
    root_key: str | None = None
    lemma_key: str | None = None
    method: str | None = None
    confidence: str | None = None  # exact | high | medium
    reason: str | None = None  # why unmapped (or why only the root)
    candidates: list[str] = field(default_factory=list)  # root or lemma keys an editor may choose from
    form: str | None = None  # the spelling that matched

    def as_dict(self, prefix: str = "") -> dict[str, Any]:
        return {
            f"{prefix}root_key": self.root_key,
            f"{prefix}lemma_key": self.lemma_key,
            f"{prefix}match_method": self.method,
            f"{prefix}match_confidence": self.confidence,
            f"{prefix}unmapped_reason": self.reason,
            f"{prefix}match_candidates": self.candidates,
        }


class HeadwordMapper:
    def __init__(
        self, roots: list[dict[str, Any]], lemmas: list[dict[str, Any]], words: list[dict[str, Any]]
    ):
        self.roots = RootMatcher(roots)
        root_by_id = {r["id"]: r["key"] for r in roots}
        self.lemma_root: dict[str, str | None] = {}
        self.lemma_pos: dict[str, str] = {}
        self.root_forms: dict[str, set[int]] = defaultdict(set)  # verb forms attested per root
        self._hamza_form: dict[str, str] = {}
        self.by_spelling: dict[str, set[str]] = defaultdict(set)
        self.by_spelling_nohamza: dict[str, set[str]] = defaultdict(set)
        for lem in lemmas:
            key = lem["key"]
            self.lemma_root[key] = root_by_id.get(lem["root_id"])
            self.lemma_pos[key] = lem["pos"]
            if lem["pos"] == "V" and self.lemma_root[key]:
                self.root_forms[self.lemma_root[key]].add(lem["verb_form"] or 1)
            for spelling in {lem["norm"], lem.get("norm_plain") or lem["norm"], plain_spelling(lem["ar"])}:
                self.by_spelling[spelling].add(key)
                # the Uthmani hamza seat differs from the everyday one (قرءان / قرآن): also without ء
                self.by_spelling_nohamza[_nohamza(spelling)].add(key)
        # stem spellings of every Quranic word → the lemmas they belong to
        self.by_stem: dict[str, set[str]] = defaultdict(set)
        for w in words:
            for seg in w.get("segments") or ():
                if seg.get("kind") == "stem" and seg.get("lemma"):
                    for spelling in {plain_spelling(seg["text"]), normalize(seg["text"])}:
                        self.by_stem[spelling].add(seg["lemma"])

    # ------------------------------------------------------------------------------------------
    def map_word(self, headword: str, *, conj: bool = False) -> Mapping:
        """Map a written headword. ``conj``: the work introduces headwords with a conjunction («والقرء»)."""
        raw = _STRIP.sub(" ", strip_marks(headword)).strip()
        if not raw:
            return Mapping(reason="empty")
        parts = raw.split()
        if len(parts) > 1:
            m = self._map_single(parts[0], conj=conj)
            if m.root_key or m.lemma_key:
                m.method = f"{m.method}+first-word"
                m.confidence = "medium" if m.confidence == "exact" else m.confidence
                return m
            return Mapping(reason="phrase", candidates=m.candidates)
        return self._map_single(raw, conj=conj)

    def map_letters(self, letters: str) -> Mapping:
        """Root letters as a work prints them («ب ر ه ن», «أت ى», «خ ون»)."""
        joined = "".join(letters.split())
        m = self.roots.match(joined, {}, set())
        if m.match == "strict":
            return Mapping(m.root_key, None, "root-letters", "exact", form=joined)
        if m.match == "loose" and m.confidence in ("high", "medium") and not m.ambiguous:
            return Mapping(m.root_key, None, f"root-letters-loose:{m.rule}", m.confidence, form=joined)
        if m.match == "loose":
            return Mapping(
                reason=f"loose-{m.confidence}:{m.rule}",
                candidates=[m.root_key, *m.alternatives] if m.root_key else [],
                form=joined,
            )
        return Mapping(reason="no-quranic-root", form=joined)

    def map_spaced(self, printed: str) -> Mapping:
        """al-Dāmaghānī's heading letters («ب ر ه ن», «إ ل ى», «س وا ء», «به ح م م»)."""
        groups = _STRIP.sub(" ", strip_marks(printed)).split()
        joined = "".join(groups)
        m = self.map_letters(joined)
        if m.method == "root-letters":
            return m
        particle = self._particle(joined)
        if particle:
            return particle  # «إ ل ى», «ح ت ى»: the letters of a particle, which has no root
        if m.root_key:
            return m
        if len(joined) >= 4:
            # a word spelled out letter by letter: «إ م ا م», «س وا ء» — only a lemma spelled exactly so
            # (an inflected form would let «ت ب ت», the tābūt, become the verb تبّت)
            keys = self.by_spelling.get(normalize(joined))
            if keys:
                w = self._from_lemmas(sorted(keys), "lemma", normalize(joined))
                if w.root_key:
                    w.method = f"spelled-word:{w.method}"
                    return w
        # a word of the previous sentence run onto the letters: «به ح م م», «يس س ور»
        for i in range(1, len(groups)):
            rest = "".join(groups[i:])
            if len(rest) < 3:
                break
            r = self.map_letters(rest)
            if r.method == "root-letters":
                r.method = "root-letters-after-leading-letters-dropped"
                r.confidence = "medium"
                return r
        return m

    # ------------------------------------------------------------------------------------------
    def _is_function_word(self, key: str) -> bool:
        return self.lemma_root.get(key) is None and self.lemma_pos.get(key) not in _CONTENT_POS

    def _particle(self, spelling: str) -> Mapping | None:
        keys = self.by_spelling.get(normalize(spelling))
        if keys and all(self._is_function_word(k) for k in keys):
            ks = sorted(keys)
            return Mapping(
                None, ks[0] if len(ks) == 1 else None, "lemma", "exact", "particle", ks if len(ks) > 1 else []
            )
        return None

    def _forms(self, word: str, conj: bool) -> list[tuple[list[str], list[str], bool]]:
        """Spelling groups to try, in order, as (spellings, spellings for the lemma lookup only, all steps?).

        The article (and, where the work introduces headwords with «و», the conjunction) comes off first —
        «اليأس» is يأس, not إلياس; a word that drops its hamzat al-waṣl after the article gets it back for
        the lemma lookup («المرأة» → امرأة). The word as written follows, for the lemma steps only («الله»,
        «الذي»): patterns and root letters never run on a spelling that still carries the article or the
        conjunction («الأمة» is not أ-ل-م, «وصار» not أ-ص-ر)."""
        n = normalize(word)
        h = skeleton_letters(word)  # hamza kept as ء (أ إ آ ؤ ئ → ء): what the pattern step reads
        conj_off = conj and n.startswith("و") and len(n) > 2
        base, hbase = (n[1:], h[1:]) if conj_off else (n, h)
        groups: list[tuple[list[str], list[str], bool]] = []
        for pre in ("ال", "لل"):
            if base.startswith(pre) and len(base) > 3:
                self._hamza_form[base[2:]] = hbase[2:]
                wasl = ["ا" + base[2:]] if "ا" + base[2:] in _WASL_NOUNS else []
                groups.append(([base[2:]], wasl, True))
                groups.append(([base], [], False))
                break
        else:
            self._hamza_form[base] = hbase
            groups.append(([base], [], True))
        if base != n:
            groups.append(([n], [], False))
        return groups

    def _map_single(self, word: str, conj: bool) -> Mapping:
        article = any(normalize(word).lstrip("و").startswith(p) for p in ("ال", "لل"))
        best: Mapping | None = None
        for forms, lemma_only, all_steps in self._forms(word, conj):
            m = self._ladder(forms, lemma_only, article, all_steps)
            if m.root_key or m.lemma_key:
                return m
            if best is None or (m.candidates and not best.candidates):
                best = m
        return best or Mapping(reason="no-quranic-match")

    def _ladder(self, forms: list[str], lemma_only: list[str], article: bool, all_steps: bool) -> Mapping:
        # 1. a corpus lemma spelled this way
        for f in forms + lemma_only:
            keys = self.by_spelling.get(f) or self.by_spelling_nohamza.get(_nohamza(f))
            if keys:
                return self._from_lemmas(self._filter(keys, article), "lemma", f)
        # 2. an inflected form found in the Quran
        for f in forms:
            keys = self.by_stem.get(f)
            if keys:
                return self._from_lemmas(self._filter(keys, article), "quran-form", f)
        if not all_steps:
            return Mapping(reason="no-quranic-match")
        # 3./4. root letters
        best: Mapping | None = None
        for f in forms:
            letters = skeleton_letters(f)
            if not 2 <= len(letters) <= 5:
                continue
            m = self.map_letters(letters)
            if m.root_key:
                return m
            if best is None or (m.candidates and not best.candidates):
                best = m
        # 5. a verbal noun, participle or perfect verb on a known pattern whose root is Quranic
        #    («الإنزال» → نزل, Form IV in the Quran; «العائذ» → عوذ; «رجوت» → رجو)
        for f in forms:
            m = self._pattern(self._hamza_form.get(f, f))
            if m:
                return m
        return best or Mapping(reason="no-quranic-match")

    def _pattern(self, form: str) -> Mapping | None:
        if form.startswith("ي"):
            return None  # an imperfect verb («يهوي»): its prefix would be read as a radical
        if len(form) >= 4 and form.endswith("ت"):
            # a perfect verb with its subject suffix: «رجوت», «أسررت», «اشتريت», «بعت», «أليت»
            m = self._pattern_in(form[:-1], _PERFECT, "perfect-verb")
            if m:
                return m
        return self._pattern_in(form, _PATTERNS, "pattern")

    def _pattern_in(
        self, form: str, patterns: list[tuple[str, re.Pattern[str], int | None, bool]], label: str
    ) -> Mapping | None:
        for name, rx, verb_form, variants in patterns:
            mm = rx.fullmatch(form)
            if not mm:
                continue
            letters = "".join(mm.groups())
            for cand in _weak_variants(letters) if variants else [letters]:
                k = self.roots.canon.get(cand)
                if k is None:
                    continue
                if verb_form and verb_form not in self.root_forms.get(k, set()):
                    continue
                # the first pattern that yields a Quranic root decides, the radicals as written before a
                # weak-letter variant («نسيان» → نسي, not نسأ)
                return Mapping(k, None, f"{label}:{name}", "medium", form=form)
        return None

    def _filter(self, keys: set[str], article: bool) -> list[str]:
        """A headword written with the article is a noun: drop verbs and rootless particles when a rooted
        noun remains («الأم» is أمّ, not the particle أم)."""
        if article:
            nouns = [k for k in keys if self.lemma_pos.get(k) != "V" and self.lemma_root.get(k)]
            if nouns:
                return sorted(nouns)
        return sorted(keys)

    def _from_lemmas(self, keys: list[str], method: str, form: str) -> Mapping:
        roots = {self.lemma_root.get(k) for k in keys}
        if len(keys) == 1:
            k = keys[0]
            r = self.lemma_root.get(k)
            reason = None if r else ("particle" if self._is_function_word(k) else "rootless-noun")
            return Mapping(r, k, method, "exact" if method == "lemma" else "high", reason, form=form)
        if len(roots) == 1:
            r = next(iter(roots))
            if r is None:
                reason = "particle" if all(self._is_function_word(k) for k in keys) else "rootless-noun"
                return Mapping(reason=reason, candidates=keys, form=form)
            return Mapping(r, None, f"{method}-root", "high", "several lemmas, one root", keys, form)
        return Mapping(reason="ambiguous", candidates=sorted({x for x in roots if x}) or keys, form=form)


# Verbal-noun patterns (normalised spelling: hamza carriers → ا/و/ي, ة → ه). Groups are the radicals; a
# two-radical match is a hollow root whose weak middle radical the pattern hides (إقامة → ق-و-م). Derived
# forms must exist as verbs of that root in the Quran (``verb_form``); Form I patterns need only the root.
_C = "([ء-ي])"
# (name, pattern, verb form the root must have in the Quran or None, weak-letter variants allowed)
_PATTERNS: list[tuple[str, re.Pattern[str], int | None, bool]] = [
    ("istifāla", re.compile(f"[اء]ست{_C}ا{_C}ه"), 10, True),
    ("istifʿāl", re.compile(f"[اء]ست{_C}{_C}ا{_C}"), 10, True),
    ("iftiʿāl-assimilated", re.compile(f"[اء](ت){_C}ا{_C}"), 8, True),
    ("iftiʿāl", re.compile(f"[اء]{_C}[تطد]{_C}ا{_C}"), 8, True),
    ("infiʿāl", re.compile(f"[اء]ن{_C}{_C}ا{_C}"), 7, True),
    ("ifāla", re.compile(f"[اء]{_C}ا{_C}ه"), 4, True),
    ("ifʿāl", re.compile(f"[اء]{_C}{_C}ا{_C}"), 4, True),
    ("tafʿīl", re.compile(f"ت{_C}{_C}ي{_C}"), 2, True),
    ("tafʿila", re.compile(f"ت{_C}{_C}(ي)ه"), 2, True),  # defective: تزكية → ز-ك-ي
    ("mufāʿala", re.compile(f"م{_C}ا{_C}{_C}ه"), 3, True),
    ("tafāʿul", re.compile(f"ت{_C}ا{_C}{_C}"), 6, True),
    ("fuʿūl", re.compile(f"{_C}{_C}و{_C}"), None, True),
    ("fiʿāla", re.compile(f"{_C}{_C}ا{_C}ه"), None, True),
    ("fiʿlān", re.compile(f"{_C}{_C}{_C}ان"), None, True),
    ("faʿāl", re.compile(f"{_C}{_C}ا{_C}"), None, True),
    ("fuʿla", re.compile(f"{_C}{_C}{_C}ه"), None, True),
    # participles and nouns of place; an initial م may itself be a radical, so no weak-letter guessing
    ("mustafʿil", re.compile(f"مست{_C}{_C}{_C}"), 10, True),
    ("mutafaʿʿil", re.compile(f"مت{_C}{_C}{_C}"), 5, True),
    ("fāʿil", re.compile(f"{_C}ا{_C}{_C}"), None, True),
    ("mafʿūl", re.compile(f"م{_C}{_C}و{_C}"), None, False),
    ("mufʿil", re.compile(f"م{_C}{_C}{_C}"), None, False),
    ("faʿīl", re.compile(f"{_C}{_C}ي{_C}"), None, True),
]
# A perfect verb once its subject suffix (ت) is off.
_PERFECT: list[tuple[str, re.Pattern[str], int | None, bool]] = [
    ("X", re.compile(f"[اء]ست{_C}{_C}{_C}"), 10, True),
    ("VIII", re.compile(f"[اء]{_C}[تطد]{_C}{_C}"), 8, True),
    ("IV", re.compile(f"[اء]{_C}{_C}{_C}"), 4, True),
    ("III", re.compile(f"{_C}ا{_C}{_C}"), 3, True),
    ("I", re.compile(f"{_C}{_C}{_C}"), None, True),
    ("I-hollow", re.compile(f"{_C}{_C}"), None, True),
]


def _nohamza(spelling: str) -> str:
    return spelling.replace("ء", "")


def _weak_variants(letters: str) -> list[str]:
    """The radicals as written, then with a hidden or written-as-alif weak or hamza radical restored. An
    initial alif can only be a hamza radical (أتى، أرجأ), never a hidden و/ي; a written و or ي stays."""
    out = [letters]
    if len(letters) == 2:  # a hollow pattern lost its middle radical
        out += [letters[0] + w + letters[1] for w in "وي"]
    for i, ch in enumerate(letters):
        if ch == "ا":
            subs = "ء" if i == 0 else "وي" + "ء"
        elif ch == "ء" and i > 0:
            subs = "وي"  # an initial hamza is a hamza radical or the Form IV prefix, never a hidden و/ي
        else:
            continue  # a written و or ي is a radical as written: swapping them names another root
        out += [letters[:i] + w + letters[i + 1 :] for w in subs]
    return list(dict.fromkeys(out))
