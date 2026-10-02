"""Quranic Arabic Corpus morphology parsers.

Three artefacts are read:

* **v0.4** (2011, corpus.quran.com) — segment level, Buckwalter, the
  long-standing reference everybody cites. Carries segment surface forms.
* **v2** (Kais Dukes' current repository) — word level, same tagset family,
  includes the author's later corrections; no segment surface forms.
* **mustafa0x fork** of v0.4 — Arabic script, community corrections of roots
  and lemmas (used by furqan.co).

All three are parsed into comparable shapes so they can be diffed word by
word. A word may contain more than one stem (وَمِمَّا = و + مِن + مَا), so
features live on each stem and the word exposes a *primary* stem. Parsing is
strict: unknown structure raises.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from judhur_arabic import bw_lemma_to_arabic, bw_to_arabic, from_qac, split_lemma_key

ROMAN = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8,
    "IX": 9,
    "X": 10,
    "XI": 11,
    "XII": 12,
}
PGN_RE = re.compile(r"^([123])?([MF])?([SDP])?$")
CASES = {"NOM", "ACC", "GEN"}
ASPECTS = {"PERF", "IMPF", "IMPV"}
CONTENT_POS = {"N", "PN", "ADJ", "V", "IMPN"}


class MorphError(ValueError):
    pass


def read_lines_strict(path: Path) -> list[str]:
    """Decode UTF-8 and split lines. Consistent CRLF is accepted (the v0.4 file ships with it);
    a stray CR anywhere else raises — a CR left on a line becomes part of the last field and creates phantom roots."""
    raw = path.read_bytes()
    crlf, cr, lf = raw.count(b"\r\n"), raw.count(b"\r"), raw.count(b"\n")
    if cr and not (cr == crlf and lf - crlf <= 1):
        raise MorphError(f"{path.name}: inconsistent line endings (CR={cr}, CRLF={crlf}, LF={lf})")
    return raw.decode("utf-8").replace("\r\n", "\n").split("\n")


@dataclass
class Stem:
    pos: str = ""
    lemma_bw: str | None = None  # corpus LEM incl. homograph digit
    lemma_ar: str | None = None
    root_bw: str | None = None
    root: list[str] | None = None  # canonical radicals (hamza = ء)
    verb_form: int | None = None
    aspect: str | None = None  # PERF / IMPF / IMPV
    voice: str | None = None  # 'PASS' for passive verbs
    mood: str | None = None  # IND / SUBJ / JUS
    derivation: str | None = None  # ACT_PCPL / PASS_PCPL / VN
    person: str | None = None
    gender: str | None = None
    number: str | None = None
    case: str | None = None
    indefinite: bool = False
    special: str | None = None  # SP: group (kaAn, <in~ …)
    flags: list[str] = field(default_factory=list)  # remaining stem flags, verbatim

    def apply(self, tok: str) -> None:
        """Interpret one stem feature token (shared by v0.4 and v2)."""
        if tok.startswith("POS:"):
            self.pos = tok[4:]
        elif tok.startswith("LEM:"):
            self.lemma_bw = tok[4:]
            self.lemma_ar = bw_lemma_to_arabic(tok[4:])
        elif tok.startswith("ROOT:"):
            self.root_bw = tok[5:]
            self.root = from_qac(tok[5:])
        elif tok.startswith("MOOD:"):
            self.mood = tok[5:]
        elif tok.startswith("SP:"):
            self.special = tok[3:]
        elif tok.startswith("(") and tok.endswith(")") and tok[1:-1] in ROMAN:
            self.verb_form = ROMAN[tok[1:-1]]
        elif tok in ASPECTS:
            self.aspect = tok
        elif tok == "PASS":
            self.voice = "PASS"
        elif tok == "ACT":
            self.flags.append("ACT")
        elif tok == "PCPL":
            # "ACT PCPL" / "PASS PCPL": a preceding PASS belongs to the participle, not to a verb voice.
            if self.voice == "PASS":
                self.derivation, self.voice = "PASS_PCPL", None
            else:
                self.derivation = "ACT_PCPL"
            if "ACT" in self.flags:
                self.flags.remove("ACT")
        elif tok == "VN":
            self.derivation = "VN"
        elif tok in CASES:
            self.case = tok
        elif tok == "INDEF":
            self.indefinite = True
        else:
            m = PGN_RE.match(tok)
            if m and any(m.groups()):
                self.person, self.gender, self.number = m.groups()
            else:
                self.flags.append(tok)


@dataclass
class Segment:
    index: int
    kind: str  # 'prefix' | 'stem' | 'suffix'
    tag: str  # corpus POS tag of the segment (P, DET, CONJ, N, V, PRON …)
    form_bw: str | None = None
    form_ar: str | None = None
    feature: str | None = None  # prefix/suffix descriptor, e.g. 'bi+', 'w:CONJ+', 'PRON:3MP'
    stem: Stem | None = None


@dataclass
class MorphWord:
    surah: int
    ayah: int
    word: int
    segments: list[Segment] = field(default_factory=list)

    @property
    def location(self) -> str:
        return f"{self.surah}:{self.ayah}:{self.word}"

    @property
    def stems(self) -> list[Stem]:
        return [s.stem for s in self.segments if s.stem is not None]

    @property
    def primary(self) -> Stem:
        """The stem that carries the word's identity: first with a root, else first content
        word (noun, verb…), else the first stem."""
        stems = self.stems
        for st in stems:
            if st.root:
                return st
        for st in stems:
            if st.pos in CONTENT_POS:
                return st
        return stems[0]

    @property
    def definite(self) -> bool:
        return any(s.kind == "prefix" and s.feature == "Al+" for s in self.segments)

    @property
    def suffix_pronouns(self) -> list[str]:
        return [
            s.feature[5:]
            for s in self.segments
            if s.kind == "suffix" and (s.feature or "").startswith("PRON:")
        ]


# ─── v0.4 ───────────────────────────────────────────────────────────────────

_V04_LINE = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)\t([^\t]*)\t([^\t]+)\t([^\t]+)$")


def parse_v04(path: Path) -> list[MorphWord]:
    words: dict[tuple[int, int, int], MorphWord] = {}
    order: list[tuple[int, int, int]] = []
    header_seen = False
    for line in read_lines_strict(path):
        if not line or line.startswith("#"):
            continue
        if line.startswith("LOCATION\t"):
            header_seen = True
            continue
        m = _V04_LINE.match(line)
        if not m:
            raise MorphError(f"v0.4: malformed line {line[:80]!r}")
        s, a, w, seg = (int(m.group(i)) for i in range(1, 5))
        form_bw, tag, features = m.group(5), m.group(6), m.group(7)
        key = (s, a, w)
        word = words.get(key)
        if word is None:
            word = words[key] = MorphWord(s, a, w)
            order.append(key)
        if seg != len(word.segments) + 1:
            raise MorphError(f"v0.4: segment {s}:{a}:{w}:{seg} out of order")
        toks = features.split("|")
        kind = toks[0]
        segment = Segment(
            index=seg,
            kind=kind.lower(),
            tag=tag,
            form_bw=form_bw,
            form_ar=" ".join(bw_to_arabic(part) for part in form_bw.split(" ")),
        )  # merged words (37:130) contain a space
        if kind == "PREFIX":
            if len(toks) != 2:
                raise MorphError(f"v0.4: prefix {s}:{a}:{w}:{seg} has {toks}")
            segment.feature = toks[1]
        elif kind == "SUFFIX":
            segment.feature = "|".join(toks[1:])
        elif kind == "STEM":
            stem = Stem()
            for tok in toks[1:]:
                stem.apply(tok)
            if stem.pos != tag:
                raise MorphError(f"v0.4: stem tag {tag} ≠ POS:{stem.pos} at {s}:{a}:{w}")
            segment.stem = stem
        else:
            raise MorphError(f"v0.4: unknown segment kind {kind!r}")
        word.segments.append(segment)
    if not header_seen:
        raise MorphError("v0.4: header line missing")
    for key in order:
        if not words[key].stems:
            raise MorphError(f"v0.4: no stem in {key}")
    return [words[k] for k in order]


# ─── v2 ─────────────────────────────────────────────────────────────────────


def parse_v2(path: Path, locations: list[tuple[int, int, int]]) -> list[MorphWord]:
    """v2: one line per word, no location column (locations come from the v0.4 word order).

    Tokens ending in ``+`` before a stem are prefixes; each ``POS:`` opens a stem; ``PRON:x``
    after a stem is a suffix pronoun.
    """
    lines = [ln for ln in read_lines_strict(path) if ln != ""]
    if len(lines) != len(locations):
        raise MorphError(f"v2: {len(lines)} lines vs {len(locations)} word locations")
    out = []
    for (s, a, w), line in zip(locations, lines, strict=True):
        word = MorphWord(s, a, w)
        current: Stem | None = None
        for tok in line.split(" "):
            if current is None and tok.endswith("+"):
                word.segments.append(
                    Segment(index=len(word.segments) + 1, kind="prefix", tag="", feature=tok)
                )
                continue
            if tok.startswith("POS:"):
                current = Stem()
                word.segments.append(
                    Segment(index=len(word.segments) + 1, kind="stem", tag=tok[4:], stem=current)
                )
            elif current is not None and tok.startswith("PRON:"):
                word.segments.append(
                    Segment(index=len(word.segments) + 1, kind="suffix", tag="PRON", feature=tok)
                )
                continue
            if current is None:
                raise MorphError(f"v2: feature {tok!r} before any POS at {s}:{a}:{w}")
            current.apply(tok)
        if not word.stems:
            raise MorphError(f"v2: no stem at {s}:{a}:{w}")
        out.append(word)
    return out


# ─── mustafa0x fork (Arabic script) ─────────────────────────────────────────

_FORK_LINE = re.compile(r"^(\d+):(\d+):(\d+):(\d+)\t([^\t]*)\t([^\t]+)\t([^\t]*)$")


@dataclass
class ForkWord:
    surah: int
    ayah: int
    word: int
    roots: list[str] = field(default_factory=list)  # Arabic letters as written in the fork (أ for hamza)
    lemmas: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)

    @property
    def root(self) -> str | None:
        return self.roots[0] if self.roots else None


def parse_fork(path: Path) -> list[ForkWord]:
    words: dict[tuple[int, int, int], ForkWord] = {}
    order: list[tuple[int, int, int]] = []
    for line in read_lines_strict(path):
        if not line:
            continue
        m = _FORK_LINE.match(line)
        if not m:
            raise MorphError(f"fork: malformed line {line[:80]!r}")
        key = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        fw = words.get(key)
        if fw is None:
            fw = words[key] = ForkWord(*key)
            order.append(key)
        feats = m.group(7).split("|")
        fw.tags.append(m.group(6))
        if "PREF" in feats or "SUFF" in feats:
            continue
        for f in feats:
            if f.startswith("ROOT:"):
                fw.roots.append(f[5:])
            elif f.startswith("LEM:"):
                fw.lemmas.append(f[4:])
    return [words[k] for k in order]


def group_by_verse(words: list[MorphWord]) -> dict[tuple[int, int], list[MorphWord]]:
    out: dict[tuple[int, int], list[MorphWord]] = defaultdict(list)
    for w in words:
        out[(w.surah, w.ayah)].append(w)
    return out


def lemma_base(lemma_bw: str | None) -> str | None:
    return None if lemma_bw is None else split_lemma_key(lemma_bw)[0]
