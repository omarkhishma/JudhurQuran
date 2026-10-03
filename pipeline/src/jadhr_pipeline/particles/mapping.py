"""Link a particle headword («إن المكسورة الخفيفة», «الباء», «هو وهي وهم») to what the corpus writes the same way.

Mechanical only; the rules are listed in ``data/particles.yaml`` → ``mapping_rules`` and each link carries
its method. A headword is linked to

* ``lemma`` — corpus lemmas whose spelling (marks removed, hamza seats kept, a dagger alif dropped) equals the
  form. Shape words in the heading narrow them (first vowel, doubling), and so does al-Murādī's chapter
  (number of letters, a doubled letter counted twice). Function-word lemmas are linked; content words of the
  same spelling are only candidates (``homographs``).
* ``prefix`` / ``suffix`` — for a one-letter particle, the corpus affixes written with that letter (bi+,
  w:CONJ+ …; +n:EMPH, +VOC), and for «يا», «ها», «أل» the prefixes written so. Attached pronouns are names, not
  particles: never linked.
* ``pronoun`` — free pronoun stems (the corpus gives pronouns no lemma) written the same way and not attached
  to a preposition prefix.

When nothing matches as printed, the same steps run on the project's normalised form (hamza seats and ى/ي
folded) and the confidence drops to ``high``. Particles get no root: nothing here reads or writes one.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import display_bare, normalize

SHADDA = chr(0x651)
DAGGER = chr(0x670)
_MADDA = chr(0x653)  # the mushaf's madda sign over a long vowel («يَٰٓ»): not a letter
_MID_MADDA = re.compile("(?<=[ء-ي])آ")
FATHA, DAMMA, KASRA = chr(0x64E), chr(0x64F), chr(0x650)
_TANWIN_FATH = chr(0x64B)
CONTENT_POS = {"N", "V", "ADJ", "PN"}
_PREPOSITION_PREFIXES = {"bi+", "l:P+", "ka+", "w:P+", "ta+"}
# One-letter particles by the name of their letter (al-Murādī's first chapter, Ibn Hishām's «X المفردة»).
LETTER_OF_NAME: dict[str, str] = {
    "الهمزة": "ء", "الألف": "ا", "الالف": "ا", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "السين": "س",
    "الشين": "ش", "الفاء": "ف", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه",
    "الواو": "و", "الياء": "ي",
}  # fmt: skip
_HAMZA_LETTERS = {"ء", "أ", "إ", "آ", "ؤ", "ئ"}


def bare(text: str) -> str:
    """Spelling for comparison: marks and tatweel removed, alef wasla written ا, hamza seats kept, and a
    final yā' read alike with or without its dots (the mushaf writes «فِى», «هِىَ», «كَى»). The mushaf's madda
    sign over a long vowel («أَلَآ», «لَوْلَآ») is a mark, not the letter آ: dropped, and an آ after a letter
    read as the alif it stands on (only a word's first آ is hamza and alif, «آدَم»)."""
    b = display_bare(text.replace(_MADDA, "")).replace("ـ", "").replace("ى", "ي").strip()
    return _MID_MADDA.sub("ا", b)


def _same_seat(a: str, b: str) -> bool:
    """Do two spellings open with the same letter — a hamza seat counting (أيا is not إيا) — or does one
    open with a hamzat al-waṣl, written as a bare alif (ٱل is the grammarians' «أل»)?"""
    if not a or not b:
        return False
    alifs = "اأإآ"
    if a[0] in alifs and b[0] in alifs:
        return a[0] == b[0] or "ا" in (a[0], b[0])
    return True


@dataclass
class LemmaShape:
    key: str
    id: int
    ar: str
    slug: str
    pos: str
    rooted: bool
    bare: str
    shadda: bool
    first_vowel: str | None  # fatha | kasra | damma
    tanwin_alif: bool
    letters: int

    @property
    def function_word(self) -> bool:
        return self.pos not in CONTENT_POS or (not self.rooted and self.pos != "PN")


def _shape(lem: dict[str, Any]) -> LemmaShape:
    ar = unicodedata.normalize("NFC", lem["ar"])
    b = bare(ar)
    first_vowel = None
    letters = [i for i, ch in enumerate(ar) if "ء" <= ch <= "ي" or ch == "ٱ"]
    if letters:
        i = letters[0]
        if ar[i] == "إ":
            first_vowel = "kasra"
        else:
            for ch in ar[i + 1 : i + 4]:
                if ch in (FATHA, DAMMA, KASRA):
                    first_vowel = {FATHA: "fatha", DAMMA: "damma", KASRA: "kasra"}[ch]
                    break
                if "ء" <= ch <= "ي":
                    break
    # a shadda on the first letter is the word before it assimilated into this one («أَن لَّا», «لَّمَّا»
    # after a nūn), not this word's own doubling
    shaddas = ar.count(SHADDA)
    if letters:
        i = letters[0] + 1
        while i < len(ar) and not ("ء" <= ar[i] <= "ي"):
            if ar[i] == SHADDA:
                shaddas -= 1
            i += 1
    n = len(re.findall("[ء-ي]", b)) + shaddas
    n += len(re.findall(f"(?<![ىي]){DAGGER}", ar))  # لَٰكِن: the dagger alif is a letter; عَلَىٰ: not
    tanwin_alif = bool(re.search(f"{_TANWIN_FATH}ا$|ا{_TANWIN_FATH}$", ar))
    return LemmaShape(
        lem["key"],
        lem["id"],
        lem["ar"],
        lem["slug"],
        lem["pos"],
        lem.get("root_id") is not None,
        b,
        shaddas > 0,
        first_vowel,
        tanwin_alif,
        n,
    )


@dataclass
class Constraints:
    """What the heading's own words say about the form («المكسورة الخفيفة»), and al-Murādī's chapter."""

    first_vowel: str | None = None
    shadda: bool | None = None
    madda: bool = False  # «أي بالمد», «آ بالمد»: the word opens with آ
    letters: int | None = None
    said: list[str] = field(default_factory=list)  # the words that set them

    @classmethod
    def read(cls, descriptor: str, letters: int | None) -> Constraints:
        c = cls(letters=letters)
        d = descriptor.strip()
        if letters:
            c.said.append(f"chapter of {letters}-letter particles")
        if re.search(r"(?:^|\s)(?:ب|بال|ال)مد(?:\s|$)", d):
            c.madda = True
            c.said.append("opens with madda")
        if not d or " أو " in f" {d} ":
            return c  # «عل بلام مشددة مفتوحة أو مكسورة»: neither vowel nor doubling is the word's own
        lead = d.split()[0] if d.split() else ""
        vowel = re.match(r"(?:ال|ب|بال)?(مكسور|كسر|مفتوح|فتح|مضموم|ضم)", lead)
        if vowel:
            c.first_vowel = {"مكسور": "kasra", "كسر": "kasra", "مفتوح": "fatha", "فتح": "fatha"}.get(
                vowel.group(1), "damma"
            )
            c.said.append(lead)
        if re.search(r"مشدد|تشديد", d):
            c.shadda = True
            c.said.append("doubled")
        elif re.search(r"خفيف|تخفيف|مخفف|ساكن|سكون", d):
            c.shadda = False
            c.said.append("not doubled")
        return c

    def check(self, lem: LemmaShape) -> str | None:
        """Why ``lem`` does not fit, or None."""
        if self.madda and not lem.bare.startswith("آ"):
            return "does not open with madda, the heading says it does"
        if self.first_vowel and lem.first_vowel and lem.first_vowel != self.first_vowel:
            return f"first vowel {lem.first_vowel}, the heading says {self.first_vowel}"
        if self.shadda is not None and lem.shadda != self.shadda:
            return "doubled" if lem.shadda else "not doubled"
        if self.letters and lem.letters != self.letters:
            return f"{lem.letters} letters, the chapter is of {self.letters}"
        return None


@dataclass
class Link:
    kind: str  # lemma | prefix | suffix | pronoun
    key: str  # lemma key, affix tag, or the pronoun as the corpus writes it
    ar: str
    count: int
    tags: dict[str, int]
    lemma_id: int | None = None
    slug: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "key": self.key,
            "ar": self.ar,
            "lemma_id": self.lemma_id,
            "slug": self.slug,
            "count": self.count,
            "tags": self.tags,
        }


@dataclass
class Mapping:
    forms: list[str] = field(default_factory=list)  # the forms looked up («هو», «هي», «هم»)
    links: list[Link] = field(default_factory=list)
    homographs: list[dict[str, Any]] = field(default_factory=list)  # content words of the same spelling
    excluded: list[dict[str, Any]] = field(default_factory=list)  # lemmas the heading or chapter rules out
    method: str | None = None
    confidence: str | None = None  # exact | shared-form | high
    reason: str | None = None  # why nothing is linked
    constraints: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        lemmas = [x for x in self.links if x.kind == "lemma"]
        tags: Counter[str] = Counter()
        for x in self.links:
            tags.update(x.tags)
        return {
            "mapped_forms_ar": self.forms,
            "lemma_ids": [x.lemma_id for x in lemmas],
            "lemma_keys": [x.key for x in lemmas],
            "lemma_slugs": [x.slug for x in lemmas],
            "affix_tags": [x.key for x in self.links if x.kind in ("prefix", "suffix")],
            "corpus_pos": dict(tags.most_common()),
            "corpus_links": [x.as_dict() for x in self.links],
            "homograph_lemma_keys": [h["key"] for h in self.homographs],
            "match_method": self.method,
            "match_confidence": self.confidence,
            "match_constraints": self.constraints,
            "match_excluded": self.excluded,
            "unmapped_reason": self.reason,
        }


class ParticleMapper:
    def __init__(self, lemmas: list[dict[str, Any]], words: list[dict[str, Any]]) -> None:
        self.shapes = {lem["key"]: _shape(lem) for lem in lemmas}
        self.by_bare: dict[str, list[str]] = defaultdict(list)
        self.by_norm: dict[str, list[str]] = defaultdict(list)
        for k, s in self.shapes.items():
            self.by_bare[s.bare].append(k)
            self.by_norm[normalize(s.bare)].append(k)
        self.lemma_tags: dict[str, Counter[str]] = defaultdict(Counter)
        affix_text: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
        self.affix_count: Counter[tuple[str, str]] = Counter()
        self.pronouns: dict[str, Counter[str]] = defaultdict(Counter)  # bare form → spellings
        for w in words:
            prev_tag = None
            for seg in w.get("segments") or ():
                kind = seg.get("kind")
                if kind == "stem":
                    tag = seg["features"]["pos"]["tag"]
                    if seg.get("lemma"):
                        self.lemma_tags[seg["lemma"]][tag] += 1
                    elif tag == "PRON" and prev_tag not in _PREPOSITION_PREFIXES:
                        self.pronouns[bare(seg["text"])][seg["text"]] += 1
                else:
                    tag = seg["label"]["tag"]
                    if kind == "prefix" or not tag.startswith("PRON"):
                        # a dagger alif is written-out alif in a prefix («يَٰٓ» is يا, «هَٰٓ» is ها)
                        txt = bare(seg["text"].replace(_MADDA, "").replace(DAGGER, "ا"))
                        affix_text[(kind, tag)][txt] += 1
                        self.affix_count[(kind, tag)] += 1
                prev_tag = seg["label"]["tag"] if kind == "prefix" else None
        # an affix is written as its most frequent spelling («ٱلْ» for Al+, not the assimilated «لْ»)
        self.affix_form = {kt: c.most_common(1)[0][0] for kt, c in affix_text.items()}

    # ---------------------------------------------------------------------------------------------
    def map(self, forms: list[str], descriptor: str = "", letters: int | None = None,
            letter: str | None = None) -> Mapping:  # fmt: skip
        """Link the forms of one entry. ``letter``: the letter of a one-letter particle (from its name)."""
        cons = Constraints.read(descriptor, letters)
        m = Mapping(forms=forms, constraints=cons.said)
        if letter:
            m.links = self._affixes(letter, single=True)
            m.method = "affix-form"
            m.confidence = "exact" if m.links else None
            if not m.links:
                m.reason = "no corpus affix written with this letter (attached pronouns are not linked)"
            return m
        methods: list[str] = []
        normalised = False
        unlinked: list[str] = []
        for f in forms:
            # as printed first; the normalised form only for a form that matched nothing as printed
            for strict in (True, False):
                probe = Mapping()
                links, how = self._one(f, cons, strict, probe)
                if strict or links:
                    m.excluded += [
                        x for x in probe.excluded if x["key"] not in {e["key"] for e in m.excluded}
                    ]
                    m.homographs += [
                        x for x in probe.homographs if x["key"] not in {h["key"] for h in m.homographs}
                    ]
                if links:
                    m.links += [x for x in links if (x.kind, x.key) not in {(y.kind, y.key) for y in m.links}]
                    methods += [h for h in how if h not in methods]
                    normalised = normalised or not strict
                    break
            else:
                unlinked.append(f)
        if not m.links:
            m.reason = (
                "only content words share this spelling in the corpus"
                if m.homographs
                else "every corpus lemma of this spelling is ruled out by the heading or chapter"
                if m.excluded
                else "no corpus lemma, affix or pronoun is written this way"
            )
            return m
        lemma_links = [x for x in m.links if x.kind == "lemma"]
        if lemma_links and (cons.first_vowel or cons.shadda is not None or cons.madda):
            methods.append("shape-words")
        if lemma_links and cons.letters:
            methods.append("letter-count")
        m.method = "+".join(methods)
        m.confidence = "high" if normalised else "exact"
        if not normalised and len(lemma_links) > len(forms):
            m.confidence = "shared-form"
        if unlinked:
            # «كلا وكلتا»: one form links, the other does not — the pair is for an editor to settle
            m.confidence = "partial"
            m.reason = f"no corpus link for {', '.join(unlinked)}"
        return m

    def _one(self, f: str, cons: Constraints, strict: bool, m: Mapping) -> tuple[list[Link], list[str]]:
        """Links for one form, as printed (``strict``) or normalised. The normalised pass keeps the first
        letter's hamza seat («أيا» is not «إيّا») and never runs on a one-letter form («آ» is not «أ»)."""
        printed = bare(f)
        key = printed if strict else normalize(f)
        if not strict and len(key.replace(" ", "")) < 2:
            return [], []
        index = self.by_bare if strict else self.by_norm
        how: list[str] = []

        def seat_ok(k: str) -> bool:
            return strict or _same_seat(printed, self.shapes[k].bare)

        keys = [k for k in index.get(key, []) if not self.shapes[k].tanwin_alif and seat_ok(k)]
        links = self._lemmas(keys, cons, m)
        if links:
            how.append("lemma-form")
        elif key.endswith("ن"):
            # «إذن» is written «إِذًا» in the mushaf: a tanwīn alif in place of the final nūn
            alif = [k for k in index.get(key[:-1] + "ا", []) if self.shapes[k].tanwin_alif and seat_ok(k)]
            links = self._lemmas(alif, cons, m)
            if links:
                how.append("lemma-form:tanwin-alif")
        affixes = self._affixes(printed, single=False, normalised=not strict)
        if affixes:
            links += affixes
            how.append("affix-form")
        pron: Counter[str] = Counter()
        for b, c in self.pronouns.items():
            if (b == key) if strict else (normalize(b) == key and _same_seat(printed, b)):
                pron.update(c)
        if pron:
            n = sum(pron.values())
            links.append(Link("pronoun", key, pron.most_common(1)[0][0], n, {"PRON": n}))
            how.append("pronoun-stem")
        return links, ([h if strict else f"normalised-form:{h}" for h in how])

    def _lemmas(self, keys: list[str], cons: Constraints, m: Mapping) -> list[Link]:
        """Function-word lemmas among ``keys`` that the heading and chapter allow; the others are recorded
        on ``m`` as excluded (with the reason) or as content-word homographs."""
        links = []
        for k in keys:
            s = self.shapes[k]
            why = cons.check(s)
            entry = {"key": k, "ar": s.ar, "pos": s.pos, "tags": dict(self.lemma_tags[k])}
            if why:
                m.excluded.append(entry | {"reason": why})
            elif not s.function_word:
                m.homographs.append(entry)
            else:
                tags = dict(self.lemma_tags[k].most_common())
                links.append(Link("lemma", k, s.ar, sum(tags.values()), tags, s.id, s.slug))
        return links

    def _affixes(self, form: str, single: bool, normalised: bool = False) -> list[Link]:
        """Corpus affixes written ``form`` (a letter: every prefix or non-pronoun suffix of that letter)."""
        out = []
        want = {"ء": _HAMZA_LETTERS}.get(form, {form}) if single else {form}
        for (kind, tag), written in sorted(self.affix_form.items(), key=lambda x: -self.affix_count[x[0]]):
            if single and tag == "Al+":
                continue  # the article «ال» is two letters (al-Murādī's «أل»), never «اللام»
            if single:
                ok = written in want
            elif normalised:
                # «أل» and the corpus's «ٱلْ»: the same two letters, the alif a hamzat al-waṣl
                ok = len(form) >= 2 and normalize(written) == normalize(form) and _same_seat(form, written)
            else:
                ok = written == form
            if ok:
                n = self.affix_count[(kind, tag)]
                out.append(Link(kind, tag, written, n, {tag: n}))
        return out


def heading_forms(form: str) -> list[str]:
    """«هو وهي وهم» → [هو, هي, هم]; «منذ ومذ» → [منذ, مذ]; «إذ ما» → [إذ ما]; «وا» → [وا]."""
    parts = form.split()
    if len(parts) > 1 and all(p.startswith("و") and len(p) > 1 for p in parts[1:]):
        return [parts[0], *(p[1:] for p in parts[1:])]
    return [form]


__all__ = ["LETTER_OF_NAME", "Constraints", "Mapping", "ParticleMapper", "heading_forms"]
