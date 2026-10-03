"""Map a word as al-Rāghib writes it («العَالِمُ», «وأَعْلَمْتُ», «أَعْلَامٌ») to the corpus lemma it stands for,
among the lemmas of the article's own root only — the article decides the root, the word decides the lemma.

Words are compared letter by letter with their written vowels (``vocalised``): hamza on any seat is one letter,
a dagger alef is ا, and a written vowel or sukun that contradicts the other side rules a candidate out
(«النَّفْرُ» is not نَفَر). The case ending and a lemma's assimilation shadda on its first letter are not
compared. Only mechanical evidence, in this order; the method is stored with every mapping:

1. ``lemma`` — the word, without a leading conjunction and the article, has the letters of exactly one lemma
   of the root and no written vowel contradicts it; vowels decide between lemmas with the same letters
   («العَالِمُ» is عَٰلِم). Confidence ``exact`` when at least two written vowels agree, else ``high``.
2. ``quran-form`` — the word is (letters and vowels) the stem of a Quranic word of this root, and those words
   have one lemma («أَعْلَامٌ» → the stem of «كَٱلۡأَعۡلَٰمِ», lemma أَعْلَٰم). Confidence ``high``.
3. ``verb-citation`` — a perfect verb cited with its subject «تُ» (and an object pronoun): «أَعْلَمْتُهُ»،
   «مِلْتُ»; or a perfect of Form I written with its vowels («لَهِثَ»); or a verb lemma with an object pronoun
   («اتَّبَعَهُ»). The pattern gives the verb form; mapped when the root has exactly one verb lemma of that form.
   Confidence ``medium``.
4. ``plural-lemma`` — the corpus lemma is a sound plural of the word («العَلَامَة» ↔ عَلَٰمَٰت). ``medium``.

Anything else stays unmapped with a reason: ``no-lemma-of-the-root`` (no Quranic lemma of the root fits — often
a word the Quran does not use, «العُلَّامُ: الحنّاء»), ``same-letters`` (candidates listed), ``article-not-
quranic`` (the article itself has no Quranic root).
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

FATHA, DAMMA, KASRA, SHADDA, SUKUN = (chr(c) for c in (0x064E, 0x064F, 0x0650, 0x0651, 0x0652))
_TANWIN = {chr(0x064B): FATHA, chr(0x064C): DAMMA, chr(0x064D): KASRA}
_VOWELS = {FATHA, DAMMA, KASRA, SUKUN}
_DAGGER = chr(0x0670)
_WASLA = chr(0x0671)
_HAMZA_MARKS = {chr(0x0654), chr(0x0655)}  # a hamza written as a mark (the corpus' «ٱسْتَيْ َٔسَ»)
_HAMZA = "ء"
# one letter per written letter: hamza on any seat → ء, alef wasla → ا, ى → ي, ة → ه
_FOLD = {"أ": _HAMZA, "إ": _HAMZA, "ؤ": _HAMZA, "ئ": _HAMZA, _WASLA: "ا", "ى": "ي"}
_SMALL_WAW, _SMALL_YEH = chr(0x06E5), chr(0x06E6)
_MID = re.compile("ى" + _DAGGER + "(?=[" + chr(0x0621) + "-" + chr(0x064A) + "])")


def uthmani_variants(text: str) -> list[str]:
    """A corpus lemma or Quran stem in Uthmani spelling, and its everyday spelling with the vowels kept (the
    rules of ``jadhr_arabic.plain_spelling``): «زَكَوٰة» → «زَكَاة», «بَغَىٰ» → «بَغَى», «تَوْرَىٰة» → «تَوْرَاة»."""
    t = unicodedata.normalize("NFC", text)
    p = t.replace("و" + _DAGGER, "ا")
    p = _MID.sub("ا", p)
    p = p.replace("ى" + _DAGGER, "ى").replace(_SMALL_WAW, "و").replace(_SMALL_YEH, "ي")
    p = p.replace("آ", "ا")  # in the mushaf «آ» is a long alef with the madd sign («هَوَآء»), not ء + ا
    return [t] if p == t else [t, p]


_LETTER = re.compile(
    "[" + chr(0x0621) + "-" + chr(0x063A) + chr(0x0641) + "-" + chr(0x064A) + chr(0x0671) + "]"
)
_PRONOUNS = ("هما", "هم", "هن", "ها", "كما", "كم", "كن", "ني", "نا", "ه", "ك")

Voc = list[tuple[str, str | None, bool]]


@dataclass
class LemmaMatch:
    lemma_key: str | None = None
    method: str | None = None
    confidence: str | None = None
    reason: str | None = None
    candidates: list[str] = field(default_factory=list)
    form: str | None = None  # the spelling compared (conjunction and article off)
    root_key: str | None = None  # the lemma's root: the article's, or its و/ي twin

    def as_dict(self) -> dict[str, Any]:
        return {
            "lemma_key": self.lemma_key,
            "lemma_root_key": self.root_key,
            "match_method": self.method,
            "match_confidence": self.confidence,
            "unmapped_reason": self.reason,
            "match_candidates": self.candidates,
        }


def vocalised(word: str) -> Voc:
    """(letter, written vowel — fatha, damma, kasra or sukun — or None, written shadda) per letter."""
    out: Voc = []
    for ch in unicodedata.normalize("NFC", word):
        if ch == "آ":  # alef madda: a hamza and a long ā
            out += [(_HAMZA, FATHA, False), ("ا", None, False)]
        elif ch == _DAGGER:
            out.append(("ا", None, False))
        elif ch in _HAMZA_MARKS:
            out.append((_HAMZA, None, False))
        elif _LETTER.fullmatch(ch):
            out.append((_FOLD.get(ch, ch), None, False))
        elif out and ch in _VOWELS:
            out[-1] = (out[-1][0], ch, out[-1][2])
        elif out and ch in _TANWIN:
            out[-1] = (out[-1][0], _TANWIN[ch], out[-1][2])
        elif out and ch == SHADDA:
            out[-1] = (out[-1][0], out[-1][1], True)
    return out


def letters(v: Voc) -> str:
    return "".join(x[0] for x in v)


def strip_clitics(word: str) -> list[str]:
    """Spellings to try, fullest first: as written, without a conjunction و/ف, without the article."""
    w = unicodedata.normalize("NFC", word)
    out = [w]
    idx = [i for i, ch in enumerate(w) if _LETTER.fullmatch(ch)]
    if len(idx) >= 4 and w[idx[0]] in "وف":
        out.append(w[idx[1] :])
    for x in list(out):
        xi = [i for i, ch in enumerate(x) if _LETTER.fullmatch(ch)]
        if len(xi) >= 4 and x[xi[0]] in "ا" + _WASLA and x[xi[1]] == "ل":
            out.append(x[xi[2] :])
        elif len(xi) >= 4 and x[xi[0]] == "ل" and x[xi[1]] == "ل":
            out.append(x[xi[2] :])  # «للمؤمنين»
    return list(dict.fromkeys(out))


def compatible(a: Voc, b: Voc) -> int | None:
    """Agreeing written vowels when the two have the same letters and no written vowel of one contradicts the
    other; None otherwise. The last letter's vowel (the case ending) is not compared."""
    if len(a) != len(b) or letters(a) != letters(b):
        return None
    agree = 0
    for i, (x, y) in enumerate(zip(a, b, strict=True)):
        if i < len(a) - 1 and x[1] and y[1]:
            if x[1] != y[1]:
                return None
            agree += 1
        if i > 0 and x[2] != y[2] and ((x[1] and not x[2]) or (y[1] and not y[2])):
            return None  # a vocalised letter written without the shadda the other has: «العَلَمُ» is not عَلَّمَ
        if x[2] and y[2] and i > 0:
            agree += 1
    return agree


_PERFECT = [  # (verb form, pattern on the letters of a perfect without its subject suffix)
    (10, re.compile(r"است(.)(.)(.)")),
    (8, re.compile(r"ا(.)[تطد](.)(.)")),
    (7, re.compile(r"ان(.)(.)(.)")),
    (6, re.compile(r"ت(.)ا(.)(.)")),
    (5, re.compile(r"ت(.)(.)(.)")),
    (4, re.compile(r"[ءا](.)(.)(.)")),
    (3, re.compile(r"(.)ا(.)(.)")),
    (1, re.compile(r"(.)(.)(.)")),
    (1, re.compile(r"(.)(.)")),  # hollow: «مِلْتُ», «قُلْتُ» — the middle radical restored below
]


def _radicals_fit(got: str, radicals: str) -> bool:
    """The letters a pattern left equal the root, a weak radical written as ا/و/ي or (hollow) not written."""
    if len(got) == len(radicals):
        return all(
            g == r or (r in "وي" and g in "اوي") or (r == _HAMZA and g in "ءا")
            for g, r in zip(got, radicals, strict=True)
        )
    if len(got) == 2 and len(radicals) == 3 and radicals[1] == radicals[2]:
        return got == radicals[:2]  # geminate: «مَدَّ», «حَدَّ»
    return len(got) == 2 and len(radicals) == 3 and radicals[1] in "وي" and got == radicals[0] + radicals[2]


class LemmaMapper:
    def __init__(
        self, roots: list[dict[str, Any]], lemmas: list[dict[str, Any]], words: list[dict[str, Any]]
    ) -> None:
        self.root_id = {r["key"]: r["id"] for r in roots}
        self.radicals = {r["key"]: "".join(r["letters"]) for r in roots}
        by_letters = {v: k for k, v in self.radicals.items()}
        self.twins: dict[str, list[str]] = {}
        for k, rad in self.radicals.items():
            for i, ch in enumerate(rad):
                if ch in "وي":
                    other = by_letters.get(rad[:i] + ("ي" if ch == "و" else "و") + rad[i + 1 :])
                    if other:
                        self.twins.setdefault(k, []).append(other)
        self.by_root: dict[int, list[dict[str, Any]]] = defaultdict(list)
        self.lemma: dict[str, dict[str, Any]] = {}
        for lm in lemmas:
            if lm.get("root_id"):
                self.by_root[int(lm["root_id"])].append(lm)
            self.lemma[lm["key"]] = lm
        self.voc: dict[str, list[Voc]] = {}
        for k, lm in self.lemma.items():
            forms = uthmani_variants(lm["ar"])
            v0 = vocalised(lm["ar"])
            if lm["pos"] == "V" and lm.get("verb_form") == 8 and v0 and v0[0][2]:
                # «طَّلَعَ» is how the corpus writes the Form VIII ٱطَّلَعَ: the shadda is the assimilated ت
                forms = [_WASLA + f for f in forms]
            self.voc[k] = [vocalised(x) for x in forms]
        # stems of the Quran's words → (lemma, the stem's vowels), per root and letters
        self.stems: dict[tuple[int, str], list[tuple[str, Voc]]] = defaultdict(list)
        seen: set[tuple[int, str, str]] = set()
        for w in words:
            for seg in w.get("segments") or ():
                if seg.get("kind") != "stem" or seg.get("lemma") not in self.lemma:
                    continue
                rid = self.lemma[seg["lemma"]].get("root_id")
                if not rid or (rid, seg["text"], seg["lemma"]) in seen:
                    continue
                seen.add((rid, seg["text"], seg["lemma"]))
                lm = self.lemma[seg["lemma"]]
                for x in uthmani_variants(seg["text"]):
                    v = vocalised(x)
                    if lm["pos"] == "V" and lm.get("verb_form") == 8 and v and v[0][2]:
                        v = vocalised(_WASLA + x)  # «فَٱطَّلَعَ» is segmented ف + «طَّلَعَ»: Form VIII
                    self.stems[(int(rid), letters(v))].append((seg["lemma"], v))

    def _best(self, v: Voc, key: str) -> int | None:
        scores = [s for lv in self.voc[key] if (s := compatible(v, lv)) is not None]
        return max(scores) if scores else None

    def lemmas_of(self, root_key: str) -> list[dict[str, Any]]:
        rid = self.root_id.get(root_key)
        return self.by_root.get(rid, []) if rid else []

    def map(self, word: str, root_key: str | None) -> LemmaMatch:
        """The lemma of ``word`` among the lemmas of ``root_key``; failing that, among those of the root that
        differs only by و/ي in one radical (al-Rāghib files زاد/زود and similar pairs in one article): method
        ``…+twin-root``, confidence ``medium``."""
        if not root_key or root_key not in self.root_id:
            return LemmaMatch(reason="article-not-quranic")
        m = self._map(word, root_key)
        if m.lemma_key:
            m.root_key = root_key
            return m
        if m.reason == "no-lemma-of-the-root":
            for twin in self.twins.get(root_key, ()):
                t = self._map(word, twin)
                if t.lemma_key:
                    return LemmaMatch(
                        t.lemma_key, f"{t.method}+twin-root", "medium", form=t.form, root_key=twin
                    )
        return m

    def _map(self, word: str, root_key: str) -> LemmaMatch:
        cands = self.lemmas_of(root_key)
        rid = self.root_id[root_key]
        lt0 = letters(vocalised(word))
        if lt0[:1] in "وف" and lt0[1:3] == "ال":
            lt0 = lt0[1:]
        if lt0.startswith("ال") and len(lt0) >= 4:  # a word with the article is a noun, never a verb lemma
            cands = [lm for lm in cands if lm["pos"] != "V"]
        nouns = {lm["key"] for lm in cands}
        same: list[str] = []
        for form in reversed(strip_clitics(word)):  # the barest spelling first
            v = vocalised(form)
            if len(v) < 2:
                continue
            # 1. a lemma of the root with these letters
            ok = [(lm["key"], s) for lm in cands if (s := self._best(v, lm["key"])) is not None]
            if len(ok) == 1:
                k, s = ok[0]
                return LemmaMatch(k, "lemma", "exact" if s >= 2 else "high", form=form)
            if ok:
                top = max(s for _, s in ok)
                tops = [k for k, s in ok if s == top]
                if len(tops) == 1 and top >= 2:
                    return LemmaMatch(
                        tops[0], "lemma", "high", candidates=sorted(k for k, _ in ok), form=form
                    )
                same = same or sorted(k for k, _ in ok)
                continue
            # 2. the stem of a Quranic word of this root
            keys = sorted(
                {
                    k
                    for k, sv in self.stems.get((rid, letters(v)), [])
                    if k in nouns and compatible(v, sv) is not None
                }
            )
            if len(keys) == 1:
                return LemmaMatch(keys[0], "quran-form", "high", form=form)
            if keys:
                same = same or keys
        if same:
            return LemmaMatch(reason="same-letters", candidates=same)
        vm = self._verb(word, root_key, cands)
        if vm:
            return vm
        # 4. the lemma is a sound plural of the word
        for form in reversed(strip_clitics(word)):
            v = vocalised(form)
            base = v[:-1] if v and v[-1][0] == "ة" else v
            if len(base) < 3:
                continue
            for lm in cands:
                for lv in self.voc[lm["key"]]:
                    for suf in ("ات", "ين", "ون"):
                        plural = len(lv) > len(suf) + 2 and letters(lv[-len(suf) :]) == suf
                        if plural and compatible(base, lv[: -len(suf)]) is not None:
                            return LemmaMatch(lm["key"], "plural-lemma", "medium", form=form)
        return LemmaMatch(reason="no-lemma-of-the-root")

    def verb_form(self, lm: dict[str, Any], radicals: str) -> int | None:
        """The corpus' verb form; where it gives none, Form I only when the lemma reads as Form I — a perfect
        that opens with the first radical («نَكِرَ», «طَلَعَت») or an imperfect whose prefix has a fatha
        («يَلْهَثْ»); «يُحَآدُّ» (no form given, prefix with damma) is not taken for Form I."""
        if lm.get("verb_form"):
            return int(lm["verb_form"])
        v = self.voc[lm["key"]][0]
        if not v:
            return None
        if v[0][0] == radicals[0] or (radicals[0] == _HAMZA and v[0][0] in "اء"):
            return 1
        if v[0][0] in "يتنء" and v[0][1] in (FATHA, None):
            return 1
        return None

    def _verb(self, word: str, root_key: str, cands: list[dict[str, Any]]) -> LemmaMatch | None:
        verbs = [lm for lm in cands if lm["pos"] == "V"]
        if not verbs:
            return None
        forms = strip_clitics(word)
        bare = forms[1] if len(forms) > 1 and letters(vocalised(forms[0]))[:1] in "وف" else forms[0]
        v = vocalised(bare)
        # a verb lemma with an object pronoun: «اتَّبَعَهُ»
        for p in _PRONOUNS:
            if letters(v).endswith(p) and len(v) - len(p) >= 3:
                head = v[: -len(p)]
                hits = [lm["key"] for lm in verbs if self._best(head, lm["key"]) is not None]
                if len(hits) == 1:
                    return LemmaMatch(hits[0], "verb-citation", "medium", form=bare)
        lt = letters(v)
        stem = None
        if lt.endswith("ت") and len(lt) >= 3:  # «أَعْلَمْتُ», «مِلْتُ»
            stem = lt[:-1]
        else:
            for p in _PRONOUNS:  # «أَعْلَمْتُهُ»
                if lt.endswith("ت" + p) and len(lt) - len(p) >= 3:
                    stem = lt[: -len(p) - 1]
                    break
        if stem is None and len(v) == 3 and v[0][1] == FATHA and v[2][1] == FATHA:
            stem = lt  # «لَهِثَ»: a Form I perfect written with its vowels
        if stem is None:
            return None
        radicals = self.radicals[root_key]
        for vf, rx in _PERFECT:
            m = rx.fullmatch(stem)
            if not m or not _radicals_fit("".join(m.groups()), radicals):
                continue
            if vf == 1 and len(stem) == 3 and v[1][2] and radicals[1] != radicals[2]:
                vf = 2  # «حَوَّلْتُ»: the doubled middle radical is Form II
            hits = [lm for lm in verbs if self.verb_form(lm, radicals) == vf]
            if len(hits) == 1:
                return LemmaMatch(hits[0]["key"], "verb-citation", "medium", form=bare)
            if hits:
                return LemmaMatch(reason="same-letters", candidates=sorted(h["key"] for h in hits))
            return None
        return None
