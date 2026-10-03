"""Mechanical mapping of a pattern the book names to our Quranic pattern slugs (``patterns.jsonl``).

The digital texts are unvowelled, so a written pattern («فعل»، «مفعل») can stand for several of our
vocalised patterns. Each mention is decided by the first of these steps that leaves exactly one slug;
the step is stored as ``method`` and sets ``confidence``:

1. ``as-written`` (high) — the written letters, compared with our patterns' letters (marks stripped;
   hamza kept, then folded if nothing matches), within the chapter's word class (verb chapters → our verb
   patterns, noun chapters → the rest) and, where the chapter is a derivational class our corpus tags
   (اسم الفاعل ACT_PCPL, اسم المفعول PASS_PCPL), within the patterns of lemmas carrying that tag.
2. ``section-vowel-rule`` (high) — the chapter states its pattern's vowels in words (التصغير: «يضم أوله
   و يفتح ثانية»); the registry quotes the statement, and candidates that break it go.
3. ``examples`` (medium) — the book's own example words for that mention vote. Two vowel oracles read an
   unvowelled example: the Quran (the example as a stem in words.jsonl → the patterns of its lemmas of the
   right class) and, in noun chapters, Lane's Lexicon (the vocalised forms with a nominal ending that its
   articles give for those letters; the written pattern takes their vowels). A word votes for the one
   candidate it reads as (the Quran's reading must be one Lane allows, where Lane knows the word; Lane
   alone must give a single reading). All votes must agree, and they must include a Quranic one or be two
   or more — a lexicon need not list a regular form (Lane gives qitla, the manner, not qatla, the act).
4. ``elimination`` (medium, verb chapters) — every other statement of the chapter is decided and exactly
   one candidate is left. Assumes, as in al-Shāfiya's «الماضي», a chapter treats each paradigm once.
5. ``same-in-chapter`` (medium) — another mention of the same written pattern in the same chapter was
   decided, and no mention of it there was decided otherwise.
6. ``example-only`` (medium) — the book names no pattern, only an example word: decided when both
   oracles know the word and read it as the same single pattern. One oracle is not enough here: books also
   list words as exceptions to their pattern («ليس بقياس»), where a dictionary's reading is exactly what
   the book says does not hold.
7. ``class-rule`` (high) — a sentence the registry quotes states the shape of a whole class our corpus
   tags («ومن غير الثلاثي على صيغة المضارع بميم مضمومة وكسر ما قبل الآخر»: the active participles of the
   augmented verbs); it maps to the base patterns of the lemmas carrying that tag with verb form II or up.

Otherwise the mention is unmapped, with a reason: ``ambiguous`` (candidates listed), ``examples-disagree``,
``one-lexicon-vote``, ``not-a-quranic-pattern`` (none of our patterns has these letters), and for examples
``oracles-disagree``, ``one-oracle-only``, ``example-unread``. There is no low tier: a mapping is confident
or absent, and what the oracles said is kept in ``votes``/``voters`` for the editors.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jadhr_arabic import display_bare, normalize

from ..wazn import HAMZAS, KNOWN4_NFC, KNOWN_NFC, SHADDA, SUFFIXES_CANON, _canon, noun_pattern

CONFIDENT = ("high", "medium")
NOUN_POS = {"N", "ADJ", "PN"}
MARKS = "".join(chr(c) for c in range(0x064B, 0x0653))  # tanwin, short vowels, shadda, sukun
_MARK = re.compile(f"[{MARKS}{chr(0x0670)}]")
_FINAL_VOWEL = re.compile(f"[{chr(0x064B)}-{chr(0x0650)}{chr(0x0652)}]+$")
_NOMINAL_END = "".join(chr(c) for c in (0x064B, 0x064C, 0x064D, 0x064F, 0x0650))  # a case ending
LANE_TOKEN = re.compile(
    f"[{chr(0x0621)}-{chr(0x063A)}{chr(0x0641)}-{chr(0x0652)}{chr(0x0670)}{chr(0x0671)}]+"
)


FATHA, DAMMA, KASRA, SUKUN = chr(0x064E), chr(0x064F), chr(0x0650), chr(0x0652)
VOWEL_NAMES = {"fatha": FATHA, "damma": DAMMA, "kasra": KASRA, "sukun": SUKUN}
_YA = chr(0x064A)
# The inflectional endings a chapter defines (al-Kāfiya's dual and sound plurals, al-Shāfiya's nisba), as
# they end our vocalised patterns (wazn.SUFFIXES).
SUFFIX_CLASSES: dict[str, tuple[str, ...]] = {
    "dual": (FATHA + "ان", FATHA + _YA + SUKUN + "ن"),
    "sound-plural-m": (DAMMA + "ون", "ون", KASRA + _YA + "ن", _YA + "ن"),
    "sound-plural-f": (FATHA + "ات", "ات"),
    "nisba": (KASRA + _YA + SHADDA, KASRA + _YA + SHADDA + FATHA + "ة"),
}


def _cls(pos: str | None) -> str | None:
    if pos == "V":
        return "V"
    if pos in NOUN_POS:
        return "N"
    return None


def _body(canon: str, cls: str) -> str:
    """A pattern for comparison: canonical, and for nouns without a final short vowel."""
    return _FINAL_VOWEL.sub("", canon) if cls == "N" else canon


@dataclass(frozen=True)
class OurPattern:
    id: int
    slug: str
    ar: str
    bare: str  # marks stripped, hamza kept
    folded: str  # normalize(): alef/hamza/ى/ة folded
    cls: str  # V | N
    form_number: int | None
    lemma_count: int
    occurrences: int
    base: str | None  # slug of the pattern without its inflectional ending (faa3iluun -> faa3il)
    suffix: str | None  # that ending, canonical (-uun, -iin, -aat, -a ...)


def _letters_vowels(ar: str) -> list[tuple[str, str]]:
    """(letter, its short vowel or '') per letter of a vocalised pattern."""
    out: list[tuple[str, str]] = []
    for ch in unicodedata.normalize("NFC", ar):
        if _MARK.match(ch):
            if out and ch != SHADDA:
                out[-1] = (out[-1][0], ch)
        else:
            out.append((ch, ""))
    return out


def _decompose(ar: str) -> tuple[str, str] | None:
    """(base, suffix) when a pattern is a base pattern plus an inflectional ending; None for a base."""
    c = _canon(ar)
    if c in KNOWN_NFC or c in KNOWN4_NFC:
        return None
    fits = [
        (c[: -len(s)], s) for s in SUFFIXES_CANON if c.endswith(s) and c[: -len(s)] in KNOWN_NFC | KNOWN4_NFC
    ]
    return max(fits, key=lambda x: len(x[1])) if fits else None


class PatternIndex:
    """Our patterns, their letters, classes, derivational tags and inflectional decomposition."""

    def __init__(self, patterns: list[dict[str, Any]], lemmas: list[dict[str, Any]]) -> None:
        by_canon = {_canon(p["ar"]): p for p in patterns}
        self.patterns: dict[str, OurPattern] = {}
        for p in patterns:
            dec = _decompose(p["ar"])
            base = by_canon.get(dec[0]) if dec else None
            self.patterns[p["slug"]] = OurPattern(
                id=p["id"],
                slug=p["slug"],
                ar=p["ar"],
                bare=display_bare(p["ar"]),
                folded=normalize(p["ar"]),
                cls="V" if p["pos_hint"] == "V" else "N",
                form_number=p["form_number"],
                lemma_count=p["lemma_count"],
                occurrences=p["occurrences"],
                base=base["slug"] if base else None,
                suffix=dec[1] if dec else None,
            )
        self.by_id = {p.id: p for p in self.patterns.values()}
        self.by_bare: dict[str, list[str]] = defaultdict(list)
        self.by_folded: dict[str, list[str]] = defaultdict(list)
        self.by_body: dict[tuple[str, str], str] = {}
        for p in self.patterns.values():
            self.by_bare[p.bare].append(p.slug)
            self.by_folded[p.folded].append(p.slug)
            self.by_body[(p.cls, _body(_canon(p.ar), p.cls))] = p.slug
        self.tags: dict[str, set[str]] = defaultdict(set)
        # the base patterns of a tag's lemmas from the augmented verbs (verb form II and up)
        self.augmented: dict[str, set[str]] = defaultdict(set)
        for lm in lemmas:
            if lm.get("derivation") and lm.get("pattern_id") in self.by_id:
                pat = self.by_id[lm["pattern_id"]]
                self.tags[lm["derivation"]].add(pat.slug)
                if (lm.get("verb_form") or 1) >= 2:
                    self.augmented[lm["derivation"]].add(pat.base or pat.slug)

    def candidates(self, written: str, cls: str, tag: str | None = None) -> tuple[list[str], str]:
        """Our slugs with these letters in this class (and tag); ('bare' or 'folded') says how they matched."""

        def keep(slugs: list[str]) -> list[str]:
            out = [s for s in slugs if self.patterns[s].cls == cls]
            if tag:
                out = [s for s in out if s in self.tags.get(tag, set())]
            return sorted(out)

        exact = keep(self.by_bare.get(display_bare(written), []))
        if exact:
            return exact, "bare"
        return keep(self.by_folded.get(normalize(written), [])), "folded"

    def in_class(self, cls: str, tag: str | None = None) -> set[str]:
        out = {s for s, p in self.patterns.items() if p.cls == cls}
        return out & self.tags.get(tag, set()) if tag else out

    def slug_of(self, vocalised: str, cls: str) -> str | None:
        return self.by_body.get((cls, _body(_canon(vocalised), cls)))

    def with_suffix(self, suffixes: list[str]) -> list[str]:
        want = {_canon(s) for s in suffixes}
        return sorted(s for s, p in self.patterns.items() if p.suffix in want)

    def inflected_of(self, slugs: list[str]) -> list[str]:
        base = set(slugs)
        return sorted(s for s, p in self.patterns.items() if p.base in base and s not in base)

    def obeys(self, slug: str, rule: dict[int, str]) -> bool:
        """True when the pattern's letters carry the vowels a section rule states (position → vowel)."""
        lv = _letters_vowels(self.patterns[slug].ar)
        return all(i < len(lv) and lv[i][1] == v for i, v in rule.items())


_CLITIC_PREFIXES = ("وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل")
_OBJ = ("هما", "هم", "ها", "ني", "كم", "نا", "ه", "ك")
_SUBJ = ("تما", "تم", "نا", "وا", "ت", "ا", "ن")


_WEAK_OR_HAMZA = set("ويىاءأإآؤئ")
_PRONOUN_END = re.compile(f"[{FATHA}{DAMMA}{KASRA}]ه[{DAMMA}{KASRA}]$")  # -ahu, -ihi: a pronoun, not a case


def _root_fits(bare: str, root: str) -> bool:
    """True when a word's letters hold its article's strong radicals in order (weak ones may change)."""
    it = iter(bare)
    return all(ch in it for ch in root if ch not in _WEAK_OR_HAMZA)


def _variants(word: str, cls: str, fold: bool = True) -> list[str]:
    """The example as written, then without a proclitic or the article, then (verbs) without the object
    and subject endings (أجلسته → أجلست → أجلس), then (nouns) without an accusative alef. ``fold``:
    compare after ``normalize`` (hamza seats, ة, ى folded) or letter for letter."""
    w = normalize(word) if fold else display_bare(word)
    heads = [w] + [w[len(p) :] for p in _CLITIC_PREFIXES if w.startswith(p) and len(w) - len(p) >= 2]
    out: list[str] = []
    for h in heads:
        out.append(h)
        if cls == "V":
            for o in _OBJ:
                if h.endswith(o) and len(h) - len(o) >= 2:
                    stem = h[: -len(o)]
                    out.append(stem)
                    out += [stem[: -len(s)] for s in _SUBJ if stem.endswith(s) and len(stem) - len(s) >= 2]
            out += [h[: -len(s)] for s in _SUBJ if h.endswith(s) and len(h) - len(s) >= 2]
        elif h.endswith("ا") and len(h) > 3:
            out.append(h[:-1])
    seen: list[str] = []
    for v in out:
        if v not in seen:
            seen.append(v)
    return seen


def _noun_key(s: str) -> str:
    """A noun's letters for comparing a stem with its lemma: the article off, a final open ت read as ة."""
    s = s[2:] if s.startswith("ال") and len(s) > 3 else s
    s = s[:-1] if s.endswith("ا") and len(s) > 2 else s  # the alef of a final tanwin
    return s[:-1] + "ه" if s.endswith("ت") else s


class QuranExamples:
    """Quranic stems (normalised) → the patterns of their lemmas, by word class (and derivational tag).

    A noun stem counts only when it spells its lemma (the corpus files a broken plural under its singular:
    a plural like rukka' under raaki' — the plural's own pattern is not the lemma's), a verb stem always (its pattern is
    the lemma's form, whatever the person or tense)."""

    def __init__(self, words: list[dict[str, Any]], lemmas: list[dict[str, Any]], pi: PatternIndex) -> None:
        lem = {lm["id"]: lm for lm in lemmas}
        key_to_id = {lm["key"]: lm["id"] for lm in lemmas}
        self.index: dict[str, dict[str, set[tuple[str, str | None]]]] = defaultdict(lambda: defaultdict(set))
        for w in words:
            segs = w.get("segments") or []
            stems = [s for s in segs if s.get("kind") == "stem"]
            for i, s in enumerate(segs):
                if s.get("kind") != "stem":
                    continue
                lid = key_to_id.get(s.get("lemma")) if s.get("lemma") else None
                lid = lid or (w.get("lemma_id") if len(stems) == 1 else None)
                lm = lem.get(lid) if lid else None
                if not lm:
                    continue
                cls = _cls(lm.get("pos"))
                pat = pi.by_id.get(lm.get("pattern_id"))
                if not cls or not pat:
                    continue
                if cls == "N" and _noun_key(normalize(s["text"])) != _noun_key(normalize(lm["ar"])):
                    continue
                forms = {normalize(s["text"])}
                if cls == "N":
                    forms.add(_noun_key(normalize(s["text"])))
                tail = "".join(x["text"] for x in segs[i + 1 :] if x.get("kind") == "suffix")
                if tail:
                    forms.add(normalize(s["text"] + tail))
                for f in forms:
                    if f:
                        self.index[cls][f].add((pat.slug, lm.get("derivation")))

    def patterns_of(self, word: str, cls: str, tag: str | None = None) -> set[str]:
        """Patterns of the Quranic lemmas whose stem is this word (first spelling variant that matches)."""
        for v in _variants(word, cls):
            hit = self.index[cls].get(v)
            if hit:
                return {p for p, d in hit if not tag or d == tag}
        return set()


class LaneVowels:
    """Vocalised nominal forms in Lane's Lexicon articles (our build's lexicon_entries, work ``lane``):
    bare spelling → {(vocalised form without its case ending, root letters)}. Only tokens that end in a
    nominative or genitive vowel or a tanwin are taken — a final fatha may be a verb's."""

    def __init__(self, entries: list[dict[str, Any]]) -> None:
        self.by_bare: dict[str, set[tuple[str, str]]] = defaultdict(set)
        self.articles = 0
        for r in entries:
            if r.get("work_id") != "lane" or not r.get("root_key") or not r.get("body"):
                continue
            self.articles += 1
            root = r["root_key"]
            for tok in LANE_TOKEN.findall(r["body"]):
                t = unicodedata.normalize("NFC", tok).replace(chr(0x0671), chr(0x0627))
                if t.startswith("ال"):
                    t = t[2:].lstrip(MARKS)
                    i = 1
                    while i < len(t) and t[i] in MARKS:
                        i += 1
                    t = t[:1] + t[1:i].replace(SHADDA, "") + t[i:]  # a sun letter's assimilation shadda
                if len(t) < 3 or t[-1] not in _NOMINAL_END or _PRONOUN_END.search(t):
                    continue
                t = t.rstrip(_NOMINAL_END)
                if not any(ch in MARKS for ch in t):
                    continue
                self.by_bare[display_bare(t)].add((t, root))

    def forms(self, word: str) -> set[tuple[str, str]]:
        """Lane's readings of an unvowelled word, compared letter for letter (ة, hamza seats as written)."""
        for v in _variants(display_bare(word), "N", fold=False):
            hit = self.by_bare.get(v)
            if hit:
                return hit
        return set()


def _transfer(written: str, vocalised: str) -> str | None:
    """The written pattern (mf'l) with the vowels of an example of it (mihlab -> mif'al)."""
    lv = _letters_vowels_full(vocalised)
    w = display_bare(written)
    if len(lv) != len(w):
        return None
    return "".join(w[i] + lv[i][1] for i in range(len(w)))


def _letters_vowels_full(ar: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for ch in unicodedata.normalize("NFC", ar):
        if ch in MARKS:
            if out:
                out[-1] = (out[-1][0], out[-1][1] + ch)
        else:
            out.append((ch, ""))
    return out


class Oracles:
    """The two vowel oracles for an example word, as sets of our pattern slugs."""

    def __init__(self, pi: PatternIndex, quran: QuranExamples, lane: LaneVowels) -> None:
        self.pi, self.quran, self.lane = pi, quran, lane

    def quran_slugs(self, word: str, cls: str, tag: str | None) -> set[str]:
        out: set[str] = set()
        for p in self.quran.patterns_of(word, cls, tag):
            out.add(p)
        return out

    def lane_slugs(self, word: str, written: str | None, tag: str | None) -> set[str]:
        """Our patterns for Lane's readings of the word: the written pattern with each reading's vowels,
        or (no pattern written) the project's wazn matcher on each reading and its article's root."""
        out: set[str] = set()
        for form, root in self.lane.forms(word):
            if written:
                pat = _transfer(written, form)
            else:
                radicals = ["ء" if r in HAMZAS else r for r in root]
                try:
                    pat = noun_pattern(form, radicals)
                except (IndexError, ValueError):
                    pat = None
            if pat is None and not written and not _root_fits(display_bare(form), root):
                continue  # the token stands in another root's article (a cross-reference): not a reading
            slug = self.pi.slug_of(pat, "N") if pat else None
            if slug and tag and slug not in self.pi.tags.get(tag, set()):
                continue  # a reading outside the chapter's class (makhraj beside mukhrij in the active participle)
            out.add(slug or "?")  # «?»: a reading that is none of our patterns — another vowelling
        return out


@dataclass
class Decision:
    slug: str | None = None
    method: str | None = None
    confidence: str | None = None
    candidates: list[str] = field(default_factory=list)
    level: str | None = None
    votes: dict[str, int] = field(default_factory=dict)
    voters: dict[str, list[str]] = field(default_factory=dict)
    reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "method": self.method,
            "confidence": self.confidence,
            "candidates": self.candidates,
            "votes": self.votes,
            "voters": self.voters,
            "reason": self.reason,
        }


def _word_vote(q: set[str], lane: set[str]) -> str | None:
    """The one candidate an example reads as. ``q``: the Quran's readings among the candidates; ``lane``:
    all of Lane's readings («?» for one that is none of our patterns). With both, the Quran's single
    reading must be one Lane allows; with Lane alone, all its readings must be that one pattern."""
    if len(q) == 1 and (not lane or q <= lane):
        return next(iter(q))
    if not q and len(lane) == 1 and "?" not in lane:
        return next(iter(lane))
    return None


def vote(
    examples: list[str], cands: list[str], cls: str, tag: str | None, orc: Oracles, written: str | None
) -> tuple[Counter[str], dict[str, list[str]], bool]:
    """Votes per candidate, the words behind them, and whether any vote rests on the Quran."""
    votes: Counter[str] = Counter()
    voters: dict[str, list[str]] = defaultdict(list)
    from_quran = False
    cs = set(cands)
    pats = orc.pi.patterns
    for item in examples:
        for word in item.split():
            q = orc.quran_slugs(word, cls, tag)
            q = {p for p in q if p in cs} | {pats[p].base for p in q if pats[p].base in cs}
            lane = orc.lane_slugs(word, written, tag) if cls == "N" else set()
            lane = {s if s in cs else "?" for s in lane}
            s = _word_vote(q, lane)
            if s:
                votes[s] += 1
                voters[s].append(word)
                from_quran = from_quran or s in q
    return votes, dict(voters), from_quran


def decide(
    written: str | None,
    examples: list[str],
    cls: str,
    tag: str | None,
    orc: Oracles,
    vowel_rule: dict[int, str] | None = None,
    use_examples: bool = True,
) -> Decision:
    """Steps 1–3 and 6 of the module doc (elimination and same-in-chapter run over a whole chapter)."""
    pi = orc.pi
    if written is None:
        d = Decision()
        words = [w for item in examples for w in item.split()]
        if len(words) != 1:
            d.reason = "no-pattern-named"
            return d
        q = orc.quran_slugs(words[0], cls, tag)
        lane = orc.lane_slugs(words[0], None, tag) if cls == "N" else set()
        d.voters = {"quran": sorted(q), "lane": sorted(lane)}
        # strict: both oracles know the word and read it as the same one pattern. One oracle alone is not
        # enough here — a book also lists words as exceptions to their pattern (المسعط، المنخل … «ليس
        # بقياس»), where the dictionary reading is exactly what the book says does not hold.
        if len(q) == 1 and lane == q:
            d.slug = next(iter(q))
            d.method, d.confidence = "example-only", "medium"
        elif q and lane:
            d.reason = "oracles-disagree"
        else:
            d.reason = "example-unread" if not (q or lane) else "one-oracle-only"
        return d
    cands, level = pi.candidates(written, cls, tag)
    d = Decision(candidates=cands, level=level)
    if not cands:
        d.reason = "not-a-quranic-pattern"
        return d
    if len(cands) == 1:
        d.slug, d.method, d.confidence = cands[0], "as-written", "high"
        return d
    if vowel_rule:
        kept = [s for s in cands if pi.obeys(s, vowel_rule)]
        if len(kept) == 1:
            d.slug, d.method, d.confidence = kept[0], "section-vowel-rule", "high"
            return d
    if use_examples:
        votes, voters, from_quran = vote(examples, cands, cls, tag, orc, written)
        d.votes, d.voters = dict(votes), voters
        if len(votes) == 1:
            # one Quranic witness, or two words (a lexicon need not list every regular form: Lane gives
            # qitla, the manner of killing, and not qatla, the single act)
            if from_quran or sum(votes.values()) >= 2:
                d.slug, d.method, d.confidence = next(iter(votes)), "examples", "medium"
                return d
            d.reason = "one-lexicon-vote"
            return d
        if votes:
            d.reason = "examples-disagree"
            return d
    d.reason = "ambiguous"
    return d


def eliminate(decisions: list[Decision]) -> int:
    """Step 4 over one chapter's statements: an undecided statement whose candidates, less those decided
    elsewhere in the chapter, leave one. Returns how many it decided."""
    changed = 0
    while True:
        taken = {d.slug for d in decisions if d.slug and d.confidence in CONFIDENT}
        step = 0
        for d in decisions:
            if d.slug or not d.candidates:
                continue
            left = [c for c in d.candidates if c not in taken]
            if len(left) == 1:
                d.slug, d.method, d.confidence, d.reason = left[0], "elimination", "medium", None
                step += 1
        changed += step
        if not step:
            return changed


def same_in_chapter(groups: dict[tuple[str, str, str], list[Decision]]) -> int:
    """Step 5: (chapter, class, written pattern) → its decisions; spread a single decided slug to the
    undecided ones. Returns how many it decided."""
    n = 0
    for ds in groups.values():
        decided = {d.slug for d in ds if d.slug and d.confidence in CONFIDENT}
        if len(decided) != 1:
            continue
        slug = decided.pop()
        for d in ds:
            if not d.slug and slug in d.candidates:
                d.slug, d.method, d.confidence, d.reason = slug, "same-in-chapter", "medium", None
                n += 1
    return n


def load_oracles(build_dir: Path, patterns: list[dict[str, Any]], lemmas: list[dict[str, Any]]) -> Oracles:
    words = []
    with (build_dir / "words.jsonl").open(encoding="utf-8") as fh:
        words = [json.loads(line) for line in fh if line.strip()]
    entries: list[dict[str, Any]] = []
    lex = build_dir / "lexicon_entries.jsonl"
    if lex.exists():
        with lex.open(encoding="utf-8") as fh:
            entries = [
                r for r in (json.loads(line) for line in fh if line.strip()) if r.get("work_id") == "lane"
            ]
    pi = PatternIndex(patterns, lemmas)
    return Oracles(pi, QuranExamples(words, lemmas, pi), LaneVowels(entries))
