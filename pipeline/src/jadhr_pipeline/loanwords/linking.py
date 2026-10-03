"""Link a headword of al-Suyūṭī's list («أباريق», «ابلعي», «آزر», «الأولى والآخرة») to the Quran's lemmas.

Mechanical only; the rules are listed in ``data/loanwords.yaml`` → ``mapping_rules`` and every link carries its
method. Evidence, strongest first:

1. ``quoted-phrase`` — the entry quotes the Quran around the headword («يا أرض ابلعي ماءك», «وإذ قال إبراهيم
   لأبيه آزر», «لا وزر»): a run of two or more of the entry's words (five letters at least), marked as a
   quotation (a bracket right before or after it, or «قوله», «تعالى», «قرأ», «قرئ» just before it), that stands
   word for word after the project's normalisation in one sūra and aligns one of its words with a Quran word
   written as the headword. Of the runs through one word of the entry only the longest count («فناداها من
   تحتها», not «من تحتها» in 35 verses). The aligned Quran words are the occurrences; when they all carry one
   lemma (or are all sūra-opening letters, which the corpus gives no lemma) the headword is linked to it at
   those occurrences (``scope`` ``occurrence``). Runs that point to different lemmas link nothing. Only when no
   run aligns with the headword's own spelling, a Quran word written as the headword with a sound plural or
   dual ending may be aligned instead (level ``sound-ending``: «قسيس» in «بأن منهم قسيسين»).
2. ``word-form`` / ``lemma-form`` — the headword's spelling. First the Quran words that are written so once
   their proclitics (و ف ب ك ل س, the interrogative أ) are set aside, endings kept (a tanwīn alif may be
   left off: «هونا» is «هون»); only if none is, the same words with their attached pronouns and subject
   endings set aside too («فومها» → «فوم»), and the lemmas whose dictionary spelling it is. The headword's
   article «ال» is kept (it matches only words that carry it) and rules out verbs and function words. One
   lemma → linked; its ``scope`` is ``lemma`` when the headword is the lemma's own spelling, else ``form``
   with the occurrences of that form. Several lemmas → nothing is linked: they are ``candidates``.

Spelling is compared at four levels, the strictest that finds anything deciding (the method says which):
``exact`` (marks removed, hamza seats kept, a final yā' with or without its dots), ``initial-alif`` (the
typist's unmarked initial alif meets أ/إ/آ: «استبرق» = «إستبرق»), ``hamza-seat`` (the seat a hamza sits on
and a tanwīn alif after it are spelling conventions: «متكئا» = «متكأ»), ``normalised`` (the project's matching
normalisation: «منساة» = «منسأة»). A one-letter headword («ن») is matched only exactly, and only to the
sūra-opening letters.

When nothing is linked, the entry keeps ``candidates`` for editors: the lemmas that share the spelling, or —
when nothing shares it — lemmas with the headword's consonant skeleton, its letters with a sound ending, or
root letters that are its letters («قفل» → «أَقْفَال»), each with how it was found.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from jadhr_arabic import normalize, skeleton

from ..particles.mapping import bare

DAGGER = chr(0x670)
_TANWIN_FATH = (chr(0x64B), chr(0x8F0))
CONTENT_POS = {"N", "ADJ", "PN", "V"}
NOUN_POS = {"N", "ADJ", "PN"}
LEVELS = ("exact", "initial-alif", "hamza-seat", "normalised")
SOUND_ENDINGS = ("ين", "ون", "ان", "ات")
_WORD = re.compile("[ء-ي]+")
_HAMZA_SEATS = re.compile("[أإؤئء]")
# Proclitic prefixes of the corpus set aside to reach a word's form; the article is handled apart.
_PROCLITIC_TAGS = {
    "bi+", "l:P+", "w:CONJ+", "w:REM+", "A:EQ+", "w:CIRC+", "f:REM+", "w:SUP+", "ka+", "A:INTG+",
    "f:CONJ+", "l:EMPH+", "f:RSLT+", "f:CAUS+", "f:SUP+", "sa+", "l:PRP+", "l:IMPV+", "w:COM+", "w:P+", "ta+",
}  # fmt: skip
# Words after which the author quotes the Quran unmarked: «في قوله تعالى: أوبي معه», «قرئ ذلك بأن منهم قسيسين».
_TRIGGER = re.compile(r"(?:قوله|تعالى|يقرأ|قرأ|قرئ)(?![ء-ي])")


def marked(text: str, s: int, e: int) -> bool:
    """Is ``text[s:e]`` marked as a quotation: a bracket right before or after it (a colon or spaces between),
    or «قوله», «تعالى», «قرأ», «يقرأ», «قرئ» at most 30 characters before it in the same sentence? A run that
    is only the author's own prose («عن ابن جريج قال الحواريون الغاسلون») is not a quotation."""
    i = s - 1
    while i >= 0 and text[i] in " :":
        i -= 1
    if i >= 0 and text[i] in "()":
        return True
    j = e
    while j < len(text) and text[j] == " ":
        j += 1
    if j < len(text) and text[j] in "()":
        return True
    window = text[max(0, s - 30) : s]
    window = window[max(window.rfind("."), window.rfind("\n")) + 1 :]
    return bool(_TRIGGER.search(window))


def _joins(text: str, a: int, b: int) -> bool:
    """Do two words of the entry stand together in one quotation: at most three characters apart, no bracket
    between them («(هيت لك) قال» ends at the bracket)?"""
    gap = text[a:b]
    return len(gap) <= 3 and "(" not in gap and ")" not in gap


_CONFIDENCE = {
    "exact": "exact",
    "initial-alif": "high",
    "hamza-seat": "high",
    "sound-ending": "high",
    "normalised": "medium",
}


def spell(s: str) -> str:
    """Spelling for comparison (``particles.mapping.bare``) of the canonical composition: a lemma stored with
    alif and a madda sign («آزَر» as ا + ٓ) keeps its initial «آ»."""
    return bare(unicodedata.normalize("NFC", s))


def key_at(level: str, s: str) -> str:
    """The comparison key of ``s`` at one of the four levels."""
    b = spell(s)
    if level == "exact":
        return b
    if level == "initial-alif":
        return "ا" + b[1:] if b[:1] in ("أ", "إ", "آ") else b
    if level == "hamza-seat":
        b = _HAMZA_SEATS.sub("ء", b.replace("آ", "ءا"))
        return re.sub("ءا$", "ء", b)
    return normalize(b)


def plain_lemma(ar: str) -> str:
    """A lemma's dictionary spelling with the mushaf's dagger alif written out (صِرَٰط → صراط, صَلَوٰة → صلاة;
    عَلَىٰ keeps its ى)."""
    t = unicodedata.normalize("NFC", ar)
    t = t.replace("و" + DAGGER, "ا").replace("ى" + DAGGER, "ى").replace(DAGGER, "ا")
    return spell(t)


@dataclass
class QWord:
    idx: int  # position in the Quran word stream
    id: int
    location: str
    verse: str
    surah: int
    lemma_id: int | None
    pos: str
    article: bool
    surface: set[str]  # the word without proclitics or article, endings kept (± a tanwīn alif)
    stems: set[str]  # … and without attached pronouns and subject endings, imlāʾī and mushaf spellings
    norm: str  # the imlāʾī word normalised, for phrase runs


def _word(i: int, w: dict[str, Any]) -> QWord:
    segs = w.get("segments") or []
    s = spell(w["text_imlaei"])
    article = False
    for seg in segs:
        if seg["kind"] != "prefix":
            continue
        tag = seg["label"]["tag"]
        if tag == "Al+":
            article = True
            if s.startswith("ال"):
                s = s[2:]
            elif s.startswith("ل"):  # «للناس»: the article's alif is not written after لِ
                s = s[1:]
            continue
        letters = spell(seg["text"])
        if tag in _PROCLITIC_TAGS and letters and s.startswith(letters) and len(s) > len(letters):
            s = s[len(letters) :]
    uth_stem = "".join(x["text"] for x in segs if x["kind"] == "stem")
    surface = {s}
    if s.endswith("ا") and any(m in uth_stem for m in _TANWIN_FATH):
        surface.add(s[:-1])  # «هَوۡنٗا»: the tanwīn alif is not part of the word's letters
    t = s
    stripped = False
    for seg in reversed([x for x in segs if x["kind"] == "suffix"]):
        letters = spell(seg["text"])
        if letters and t.endswith(letters) and len(t) > len(letters):
            t = t[: -len(letters)]
            stripped = True
    stems = {t}
    if stripped and t.endswith("ت"):
        stems.add(t[:-1] + "ة")  # «منسأته» → «منسأة»: the open tā' before a pronoun is the noun's ة
    if uth_stem:
        stems.add(spell(uth_stem))
    surface.discard("")
    stems.discard("")
    return QWord(
        i,
        w["id"],
        w["location"],
        f"{w['surah']}:{w['ayah']}",
        int(w["surah"]),
        w.get("lemma_id"),
        w.get("pos") or "",
        article,
        surface,
        stems - surface,
        normalize(w["text_imlaei"]),
    )


@dataclass
class Link:
    part_ar: str  # the headword, or the part of a several-word headword, that is linked
    kind: str  # lemma | initials
    lemma_id: int | None
    lemma_key: str | None
    lemma_ar: str | None
    lemma_pos: str | None
    method: str  # quoted-phrase | word-form | lemma-form | word-form+lemma-form | initials-form, ":level"
    level: str
    confidence: str  # exact | high | medium
    scope: str  # occurrence | form | lemma
    locations: list[str] | None
    verse_keys: list[str]
    evidence: list[dict[str, Any]] = field(default_factory=list)  # the quoted runs, verbatim, with offsets
    excluded: list[dict[str, Any]] = field(default_factory=list)  # other lemmas of the spelling, and why


@dataclass
class PartResult:
    part_ar: str
    links: list[Link] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    reason: str | None = None


class QuranLinker:
    def __init__(
        self, lemmas: list[dict[str, Any]], words: list[dict[str, Any]], roots: list[dict[str, Any]]
    ) -> None:
        self.lemmas = {x["id"]: x for x in lemmas}
        self.words = [_word(i, w) for i, w in enumerate(words)]
        self.root_letters = {r["id"]: "".join(r["letters"]) for r in roots}
        # spelling indexes, one per level and per kind of form
        self.index: dict[tuple[str, str], dict[str, list[int]]] = {
            (kind, lv): defaultdict(list) for kind in ("surface", "stem") for lv in LEVELS
        }
        for qw in self.words:
            for kind, forms in (("surface", qw.surface), ("stem", qw.stems)):
                for f in forms:
                    for lv in LEVELS:
                        k = key_at(lv, f)
                        self.index[(kind, lv)][k].append(qw.idx)
                        if qw.article:
                            self.index[(kind, lv)]["ال" + k].append(qw.idx)
        self.lemma_index: dict[str, dict[str, set[int]]] = {lv: defaultdict(set) for lv in LEVELS}
        for lid, lem in self.lemmas.items():
            for sp in {spell(lem["ar"]), plain_lemma(lem["ar"])}:
                if sp.strip():
                    for lv in LEVELS:
                        self.lemma_index[lv][key_at(lv, sp)].add(lid)
        self.full_index: dict[str, list[int]] = defaultdict(list)  # the word as written, proclitics and all
        for qw, w in zip(self.words, words, strict=True):
            self.full_index[spell(w["text_imlaei"])].append(qw.idx)
        self.by_norm: dict[str, list[int]] = defaultdict(list)
        self.skeleton_index: dict[str, set[int]] = defaultdict(set)
        for qw in self.words:
            self.by_norm[qw.norm].append(qw.idx)
            if qw.lemma_id is not None:
                for f in qw.surface | qw.stems:
                    self.skeleton_index[skeleton(f)].add(qw.lemma_id)
        self.lemmas_of_root: dict[str, set[int]] = defaultdict(set)
        for lid, lem in self.lemmas.items():
            if lem.get("root_id") in self.root_letters:
                self.lemmas_of_root[self.root_letters[lem["root_id"]]].add(lid)

    # -- spelling --------------------------------------------------------------------------------------
    def spelling(self, part: str, level: str) -> tuple[list[int], list[int], set[int]]:
        """(surface-form word positions, stem-form word positions, lemma ids by dictionary spelling) of
        ``part`` at ``level``."""
        b = spell(part)
        if level == "initial-alif" and not b.startswith("ا"):
            return [], [], set()
        k = key_at(level, part)
        article = b.startswith("ال") and len(b) > 3
        surface = list(self.index[("surface", level)].get(k, []))
        stems = list(self.index[("stem", level)].get(k, []))
        lemma_key = k[2:] if article else k
        lemmas = set(self.lemma_index[level].get(lemma_key, set())) if len(lemma_key) >= 2 else set()
        if len(b) == 1:
            # one letter: only the sūra-opening letters, only exactly
            surface = [i for i in surface if self.words[i].pos == "INL"] if level == "exact" else []
            stems, lemmas = [], set()
        if article:
            surface = [i for i in surface if self.words[i].article]
            stems = [i for i in stems if self.words[i].article]
            lemmas = {x for x in lemmas if self.lemmas[x]["pos"] in NOUN_POS}
        return surface, stems, lemmas

    def _lemma_row(self, lid: int) -> dict[str, Any]:
        lem = self.lemmas[lid]
        return {
            "lemma_id": lid,
            "lemma_key": lem["key"],
            "lemma_ar": lem["ar"],
            "pos": lem["pos"],
            "occurrences": lem.get("occurrences"),
        }

    # -- quoted phrases --------------------------------------------------------------------------------
    def runs(self, text: str, skip: list[tuple[int, int]], targets: set[int]) -> list[dict[str, Any]]:
        """Runs of ``text``'s words that stand word for word in one sūra of the Quran and align one of their
        words with a Quran word in ``targets`` (the positions written as the headword)."""
        toks = [
            (m.start(), m.end(), normalize(m.group(0)))
            for m in _WORD.finditer(text)
            if not any(a <= m.start() < b for a, b in skip)
        ]
        stream = self.words
        n = len(stream)
        hits: list[tuple[int, int, int, int]] = []  # (entry word aligned with the target, run start, end, p)
        for i, (_, _, tok) in enumerate(toks):
            for p in self.by_norm.get(tok, ()):
                if p not in targets:
                    continue
                sura = stream[p].surah
                lo, qlo = i, p
                while (
                    lo > 0
                    and qlo > 0
                    and stream[qlo - 1].surah == sura
                    and toks[lo - 1][2] == stream[qlo - 1].norm
                    and _joins(text, toks[lo - 1][1], toks[lo][0])
                ):
                    lo, qlo = lo - 1, qlo - 1
                hi, qhi = i, p
                while (
                    hi + 1 < len(toks)
                    and qhi + 1 < n
                    and stream[qhi + 1].surah == sura
                    and toks[hi + 1][2] == stream[qhi + 1].norm
                    and _joins(text, toks[hi][1], toks[hi + 1][0])
                ):
                    hi, qhi = hi + 1, qhi + 1
                letters = sum(len(toks[j][2]) for j in range(lo, hi + 1))
                if hi - lo + 1 < 2 or letters < 5 or not marked(text, toks[lo][0], toks[hi][1]):
                    continue
                hits.append((i, lo, hi, p))
        # for each word of the entry, only the longest runs through it: «من تحتها» stands in 35 verses, but
        # the entry quotes «فناداها من تحتها»
        longest: dict[int, int] = {}
        for i, lo, hi, _ in hits:
            longest[i] = max(longest.get(i, 0), hi - lo + 1)
        found: dict[tuple[int, int], dict[str, Any]] = {}
        for i, lo, hi, p in hits:
            if hi - lo + 1 < longest[i]:
                continue
            key = (toks[lo][0], toks[hi][1])
            run = found.setdefault(
                key, {"start": key[0], "end": key[1], "quote": text[key[0] : key[1]], "positions": set()}
            )
            run["positions"].add(p)
        return sorted(found.values(), key=lambda r: r["start"])

    def function_word(self, part: str) -> str | None:
        """The parts of speech when every Quran word written ``part`` (proclitics and all) is a function word
        with no content lemma («لك»: the preposition with its pronoun), else None."""
        hits = self.full_index.get(spell(part), [])
        if not hits:
            return None
        pos = set()
        for i in hits:
            lid = self.words[i].lemma_id
            p = self.lemmas[lid]["pos"] if lid is not None else self.words[i].pos
            if p in CONTENT_POS:
                return None
            pos.add(p)
        return "+".join(sorted(pos))

    def _sound_ending(self, part: str) -> list[int]:
        """Quran words written as the headword with a sound plural or dual ending («قسيس» → «قسيسين»); used only
        to align a quoted phrase, never for spelling alone."""
        out: list[int] = []
        for suf in SOUND_ENDINGS:
            out += self.index[("surface", "exact")].get(key_at("exact", part) + suf, [])
        return out

    # -- one part --------------------------------------------------------------------------------------
    def link_part(self, part: str, text: str, skip: list[tuple[int, int]]) -> PartResult:
        """Link one headword (or part) given the entry's text and the spans of it not to search (the
        heading itself)."""
        res = PartResult(part)
        found = {lv: self.spelling(part, lv) for lv in LEVELS}
        targets = {i for lv in LEVELS for i in (*found[lv][0], *found[lv][1])}
        runs = self.runs(text, skip, targets) if targets else []
        sound = False
        if not runs and len(spell(part)) >= 3:
            extra = set(self._sound_ending(part))
            runs = self.runs(text, skip, extra) if extra else []
            sound = bool(runs)
        if runs:
            positions = sorted(set().union(*(r["positions"] for r in runs)))
            occ = {self.words[p].lemma_id for p in positions}
            if len(occ) == 1:
                lid = next(iter(occ))
                level = (
                    "sound-ending"
                    if sound
                    else next(lv for lv in LEVELS if set(positions) & {*found[lv][0], *found[lv][1]})
                )
                link = self._make(part, lid, "quoted-phrase", level, "occurrence", positions)
                link.evidence = [{"quote_ar": r["quote"], "start": r["start"], "end": r["end"]} for r in runs]
                # the other lemmas of the headword's spelling, at the strictest level that has any
                spell_level = next((lv for lv in LEVELS if any(found[lv])), None)
                surf, stems, lemmas = found[spell_level] if spell_level else ([], [], set())
                spelled = {self.words[i].lemma_id for i in (*surf, *stems)} | lemmas
                link.excluded = [
                    self._lemma_row(x) | {"reason": "the quoted phrase fixes the occurrence"}
                    for x in sorted(x for x in spelled - {lid} if x is not None)
                ]
                res.links.append(link)
                return res
            res.reason = "the quoted phrases point to occurrences of different lemmas"
            res.candidates = [
                self._lemma_row(x) | {"found_by": "quoted-phrase"}
                for x in sorted(x for x in occ if x is not None)
            ]
            return res
        for lv in LEVELS:
            surf, stems, lemmas = found[lv]
            if not (surf or stems or lemmas):
                continue
            if surf and all(self.words[i].pos == "INL" for i in surf):
                res.links.append(self._make(part, None, "initials-form", lv, "occurrence", sorted(surf)))
                return res
            words = surf if surf else stems
            spelled = {self.words[i].lemma_id for i in words if self.words[i].lemma_id is not None}
            if not surf:
                spelled |= lemmas
            if len(spelled) == 1:
                lid = next(iter(spelled))
                by_word = any(self.words[i].lemma_id == lid for i in words)
                by_lemma = lid in lemmas
                method = "+".join(m for m, ok in (("word-form", by_word), ("lemma-form", by_lemma)) if ok)
                if by_lemma:
                    link = self._make(part, lid, method, lv, "lemma", None)
                else:
                    link = self._make(part, lid, method, lv, "form", sorted(words))
                link.excluded = [
                    self._lemma_row(x)
                    | {
                        "reason": "its dictionary spelling is the headword's, but no Quran word of it keeps that form"
                    }
                    for x in sorted(lemmas - {lid})
                ]
                res.links.append(link)
                return res
            res.reason = (
                f"{len(spelled)} lemmas share this spelling and the entry quotes no Quran phrase with it"
            )
            res.candidates = [self._lemma_row(x) | {"found_by": f"spelling:{lv}"} for x in sorted(spelled)]
            return res
        res.reason = "no Quran word or lemma is written this way"
        res.candidates = self._loose_candidates(part)
        return res

    def _make(
        self, part: str, lid: int | None, method: str, level: str, scope: str, positions: list[int] | None
    ) -> Link:
        lem = self.lemmas.get(lid) if lid is not None else None
        verses = sorted(
            {self.words[p].verse for p in positions or ()}, key=lambda v: tuple(int(x) for x in v.split(":"))
        )
        return Link(
            part_ar=part,
            kind="lemma" if lid is not None else "initials",
            lemma_id=lid,
            lemma_key=lem["key"] if lem else None,
            lemma_ar=lem["ar"] if lem else None,
            lemma_pos=lem["pos"] if lem else None,
            method=f"{method}:{level}",
            level=level,
            confidence=_CONFIDENCE[level],
            scope=scope,
            locations=[self.words[p].location for p in positions] if positions is not None else None,
            verse_keys=verses,
        )

    def _loose_candidates(self, part: str) -> list[dict[str, Any]]:
        b = spell(part)
        b = b[2:] if b.startswith("ال") and len(b) > 3 else b
        out = [
            self._lemma_row(x) | {"found_by": "skeleton"}
            for x in sorted(self.skeleton_index.get(skeleton(b), ()))
        ]
        seen = {x["lemma_id"] for x in out}
        for suf in SOUND_ENDINGS:
            for lid in sorted(self.lemma_index["exact"].get(key_at("exact", b + suf), ())):
                if lid not in seen:
                    out.append(self._lemma_row(lid) | {"found_by": "sound-ending"})
                    seen.add(lid)
        root = _HAMZA_SEATS.sub("ء", b.replace("آ", "ءا"))
        for lid in sorted(self.lemmas_of_root.get(root, ())):
            if lid not in seen:
                out.append(self._lemma_row(lid) | {"found_by": "root-letters"})
        return out


def link_parts(headword: str) -> list[str]:
    """«الأولى والآخرة» → [الأولى, الآخرة]; «هيت لك» → [هيت, لك]; «أباريق» → [أباريق]."""
    parts = headword.split()
    out = parts[:1]
    for p in parts[1:]:
        out.append(p[1:] if p.startswith("و") and len(p) > 3 else p)
    return out


__all__ = [
    "CONTENT_POS",
    "LEVELS",
    "Link",
    "PartResult",
    "QuranLinker",
    "key_at",
    "link_parts",
    "marked",
    "plain_lemma",
    "spell",
]
