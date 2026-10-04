"""The names in a chain linked to Ibn Ḥajar's entries (PLAN P11.2b, research 21 §3): every link with its candidates,
the rule that chose among them, a confidence, and no reviewer yet — shown as automatic until the board checks it.

A chain names its narrators as their students did: «سفيان», «الزهري», «ابن عباس», «أبي هريرة». The Taqrīb itself
resolves most of them: its entries open with the name (a kunya in its section of kunyas), and its closing sections map
«بن عباس هو عبد الله», a nisba «الزهري محمد بن مسلم بن شهاب …», a laqab «الأعمش سليمان بن مهران» to their
owners. Among the candidates a name has:

* the book: an entry whose sigla do not include the collection narrates in it from no one (``taqrib.BOOKS_OF``);
* the chain: a student is of a later ṭabaqa than his teacher, the collector's own teacher of the ninth or after;
* the corpus: two narrators the unambiguous chains put next to each other are more likely the pair again.

A name the evidence does not settle keeps its candidates and no choice."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

from jadhr_arabic import normalize

from .taqrib import BOOKS_OF, Entry

# words in an entry after which the name has ended: his notes on spelling, the descriptions that follow
_AFTER_NAME = frozenset(
    normalize(w)
    for w in [
        "بضم",
        "بفتح",
        "بكسر",
        "بالتحتانية",
        "بالمهملة",
        "بالمعجمة",
        "بالمثلثة",
        "بالموحدة",
        "بالنون",
        "بالقاف",
        "بالفاء",
        "مصغر",
        "مكبر",
        "بعدها",
        "ثم",
        "يكنى",
        "ويكنى",
        "واسم",
        "واسمه",
        "يقال",
        "ويقال",
        "قيل",
        "نزيل",
        "قاضي",
        "صاحب",
        "الصحابي",
        "صحابي",
        "مشهور",
        "تقدم",
        "في",
        "وهو",
        "أخو",
        "اخو",
        "مولى",
        "مولاهم",
    ]
)
# where a cross-reference stops naming its target
_TARGET_END = frozenset(
    normalize(w)
    for w in ["تقدم", "تقدموا", "تقدما", "تقدمت", "يأتي", "سيأتي", "مضى", "في", "صحابي", "وهو", "الصحابي"]
)
SIX = ("bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah")
# a link's confidence is its rule's precision measured against MIS's hand mapping of Ṣaḥīḥ Muslim's chains (narrators_check,
# 2026-10-04: 31,728 links over 7,185 records), floored to two places; a rule too rare to measure takes context's
CONFIDENCE = {
    "companion-place": 0.99,
    "cross-reference-unique": 0.97,
    "father-unique": 0.95,
    "lineage-unique": 0.93,
    "name-unique": 0.91,
    "context": 0.80,
    "name-words-unique": 0.79,
    "grandfather-unique": 0.80,
}


def canon(text: str) -> list[str]:
    """A name's words as the index compares them: normalised, «ابن» as «بن», a kunya's case as «ابو»."""
    out = []
    for w in text.split():
        n = normalize(w)
        if not n or not any("ء" <= c <= "ي" for c in n):
            continue
        if n in ("ابي", "ابا"):
            n = "ابو"
        elif n == "ابن":
            n = "بن"
        out.append(n)
    return out


def _name_tokens(e: Entry) -> list[str]:
    toks = canon(e.name)
    for i, t in enumerate(toks):
        if i > 0 and t in _AFTER_NAME:
            return toks[:i]
    return toks


@dataclass
class Candidate:
    id: int
    number: int | None
    name: str
    tabaqa: int | None


@dataclass
class Link:
    span: tuple[int, int]
    text: str
    candidates: list[Candidate] = field(default_factory=list)
    chosen: int | None = None
    rule: str = "none"
    confidence: float = 0.0
    companion_place: bool = False
    kin: int | None = None  # «أبيه» 1, «جده» 2: read off the name before it once that is settled

    def row(self) -> dict[str, Any]:
        return {
            "span": list(self.span),
            "text": self.text,
            "chosen": self.chosen,
            "rule": self.rule,
            "confidence": round(self.confidence, 3),
            "status": "auto",
            "candidates": [c.id for c in self.candidates[:8]],
        }


class Index:
    """The Taqrīb's entries by the first words of their names, and its cross-references by what they map."""

    def __init__(self, rows: list[dict[str, Any]], entries: list[Entry]) -> None:
        self.entries: dict[int, Entry] = {}
        self.tokens: dict[int, list[str]] = {}
        self.by_first: dict[str, list[int]] = defaultdict(list)
        self.aliases: dict[str, list[list[str]]] = defaultdict(list)
        self._asked: dict[tuple[str, ...], tuple[list[int], str]] = {}
        for r, e in zip(rows, entries, strict=True):
            if e.kind == "entry":
                toks = _name_tokens(e)
                if toks:
                    self.entries[r["id"]] = e
                    self.tokens[r["id"]] = toks
                    self.by_first[toks[0]].append(r["id"])
            else:
                for alias, target in _alias(e.text):
                    self.aliases[" ".join(alias)].append(target)

    def prefix(self, m: list[str]) -> list[int]:
        return [i for i in self.by_first.get(m[0], []) if self.tokens[i][: len(m)] == m] if m else []

    def in_order(self, m: list[str]) -> list[int]:
        """Names that hold every word of ``m`` in order among their first words («محمد بن مسلم بن شهاب» of
        «محمد بن مسلم بن عبيد الله بن عبد الله بن شهاب»), starting with its first."""
        out = []
        for i in self.by_first.get(m[0], []) if m else []:
            k = 0
            for t in self.tokens[i][:14]:
                if k < len(m) and t == m[k]:
                    k += 1
            if k == len(m):
                out.append(i)
        return out

    def lineage(self, m: list[str]) -> list[int]:
        """«بن شهاب», «بن جريج», «بن عباس»: names whose lineage holds them, the father's or an ancestor's."""
        n = len(m)
        return [
            i
            for i, toks in self.tokens.items()
            if any(toks[k : k + n] == m for k in range(1, min(len(toks), 14) - n + 1))
        ]

    def words(self, i: int) -> set[str]:
        return set(canon(self.entries[i].text))

    def candidates(self, m: list[str]) -> tuple[list[int], str]:
        """The entries a name may be, and how they were found; a name asked again is answered from memory."""
        key = tuple(m)
        if key not in self._asked:
            self._asked[key] = self._candidates(m)
        found, rule = self._asked[key]
        return list(found), rule

    def _candidates(self, m: list[str]) -> tuple[list[int], str]:
        found = self.prefix(m)
        rule = "name"
        # what distinguishes the referred name («شهاب» of «بن شهاب», «شيبه» of «ابو بكر بن ابو شيبه»): its owner's
        # entry carries it
        marks = {t for t in m if t not in ("بن", "ابو", "ام", "بنت", "عبد")}
        # a reference to the name as the chain gives it, or to the name and what follows it («ابو معاويه الضرير هو
        # محمد بن خازم» for «أبو معاوية»)
        key = " ".join(m)
        targets = list(self.aliases.get(key, []))
        if len(m) >= 2 and m[0] in ("ابو", "ام"):
            targets += [t for k, ts in self.aliases.items() if k.startswith(key + " ") for t in ts]
        for target in targets:
            more = [
                i
                for i in self.prefix(target) or self.in_order(target)
                if marks <= self.words(i) | set(target)
            ]
            if more:
                found += more
                rule = "cross-reference" if rule == "name" and not self.prefix(m) else rule
        if not found and len(m) >= 3 and m[0].startswith("ال") and m[1] != "بن":
            # «الحميدي عبد الله بن الزبير»: a nisba before the name — the name, its bearer carrying the nisba
            rest = [i for i in self.prefix(m[1:]) or self.in_order(m[1:]) if m[0] in self.words(i)]
            if rest:
                return rest, "name"
        if not found and len(m) >= 2 and m[0] == "بن":
            found, rule = self.lineage(m), "lineage"
        elif not found and len(m) >= 2:
            # «سفيان الثوري»: every word in order within the first words of a name
            found, rule = self.in_order(m), "name-words"
        return list(dict.fromkeys(found)), rule


def _alias(text: str) -> list[tuple[list[str], list[str]]]:
    """«بن عباس هو عبد الله» → (بن عباس, عبد الله بن عباس); «الزهري محمد بن مسلم بن شهاب وأبو مصعب» → each owner;
    «عبد الرحمن بن صخر أبو هريرة في الكنى» → (عبد الرحمن بن صخر, ابو هريره)."""
    toks = canon(text)
    out: list[tuple[list[str], list[str]]] = []
    said = next((w for w in ("هو", "اسمه") if w in toks), None)
    if said:
        i = toks.index(said)
        # his spelling notes are no part of the name referred («أبو كريب بالتصغير هو …»)
        alias = [t for t in toks[:i] if not t.startswith("بال") and t not in _AFTER_NAME]
        rest = toks[i + 1 :]
        target = []
        for t in rest:
            if t in _TARGET_END:
                break
            target.append(t)
        if not alias or not target:
            return out
        if target[0] == "بن":
            target = [alias[0], *target]
        elif alias[0] == "بن" and "بن" not in target:
            target = [*target, *alias]
        return [(alias, target)]
    if toks and toks[0].startswith("ال") and len(toks) > 1:
        # a nisba or laqab and its owners, «و» between them
        alias = [toks[0]]
        target: list[str] = []
        for t in toks[1:]:
            if t in _TARGET_END:
                break
            if t.startswith("و") and target and len(t) > 2:  # «… وأبو مصعب»: the next owner
                out.append((alias, target))
                target = [t[1:]]
                continue
            target.append(t)
        if target:
            out.append((alias, target))
        return out
    if "في" in toks and "الكني" in toks and "ابو" in toks:
        k = toks.index("ابو")
        f = toks.index("في")
        if 0 < k < f:
            return [(toks[:k], toks[k:f])]
    return out


def _books(e: Entry) -> set[str]:
    out: set[str] = set()
    for s in e.sigla:
        out |= BOOKS_OF.get(s, set())
    return out


def link_chain(
    index: Index, book: str, text: str, names: list[tuple[int, int]], ends_at_prophet: bool = False
) -> list[Link]:
    """Each name in a chain with its candidates — those whose sigla include the collection, when any do. «عن أبيه»
    and «عن جده» are read off the name before them; the last name before the Prophet is a Companion's place."""
    links: list[Link] = []
    for a, b in names:
        m = canon(text[a:b])
        if m and m[0].startswith("و") and len(m[0]) > 2 and m[0][1:] in index.by_first:
            m[0] = m[0][1:]
        # «عن أبيه», «عن جده», and «حدثني أبي» (my father)
        kin = {"ابيه": 1, "جده": 2, "ابو": 1}.get(m[0]) if len(m) == 1 and m else None
        if kin and links:
            m = _kin(canon(links[-1].text), kin) or m
        ids, rule = index.candidates(m)
        if kin and links:
            rule = "father" if kin == 1 else "grandfather"
        cands = _in_book(index, book, ids)
        link = Link((a, b), text[a:b], cands, rule=rule if cands else "none", kin=kin if links else None)
        if book == "malik" and canon(text[a:b]) == ["يحيي"] and not links:
            # «حدثني يحيى عن مالك»: Yaḥyā al-Laythī, whose recension this is, is no narrator of the Taqrīb
            link = Link((a, b), text[a:b], [], rule="recension")
        links.append(link)
    if ends_at_prophet and links:
        links[-1].companion_place = True
    return links


def _kin(base: list[str], kin: int) -> list[str] | None:
    """«هشام بن عروه عن ابيه»: the words after his «بن» name the father, after the next the grandfather."""
    cut = [k for k, t in enumerate(base) if t == "بن"]
    return base[cut[kin - 1] + 1 :][:3] if len(cut) >= kin else None


def _in_book(index: Index, book: str, ids: list[int]) -> list[Candidate]:
    """The candidates whose sigla include the collection, when any do (one of the Six); never a «تمييز» entry there."""
    if book in SIX:
        in_book = [i for i in ids if book in _books(index.entries[i])]
        ids = in_book or [i for i in ids if "تمييز" not in index.entries[i].sigla]
    return [
        Candidate(i, index.entries[i].number, index.entries[i].name, index.entries[i].tabaqa) for i in ids
    ]


def _fits(t_student: int | None, t_teacher: int | None) -> bool:
    """A student is of his teacher's ṭabaqa or up to four after it (one step of slack the other way): a narrator of
    the seventh did not hear a Companion."""
    return t_student is None or t_teacher is None or -1 <= t_student - t_teacher <= 4


def resolve(index: Index, chains: Iterable[tuple[str, list[Link]]], rounds: int = 3) -> Counter[str]:
    """Choose among the candidates: alone, by the chain's ṭabaqāt, by the pairs the settled chains show; «عن أبيه»
    by the entry of the narrator before it once he is settled."""
    chains = list(chains)
    stats: Counter[str] = Counter()

    def kinship() -> None:
        for book, links in chains:
            for k, link in enumerate(links):
                if link.kin and not link.chosen and k and links[k - 1].chosen:
                    m = _kin(canon(index.entries[links[k - 1].chosen].name), link.kin)
                    if m:
                        link.candidates = _in_book(index, book, index.candidates(m)[0])
                        if len(link.candidates) == 1:
                            link.chosen, link.confidence = link.candidates[0].id, 0.85
                            link.rule = "father-unique" if link.kin == 1 else "grandfather-unique"

    for _, links in chains:
        for link in links:
            if len(link.candidates) == 1:
                link.chosen, link.confidence = link.candidates[0].id, 0.9
                link.rule = f"{link.rule}-unique"
            elif link.companion_place:
                # the last name before the Prophet: a Companion's place — one Companion among the candidates is he
                comp = [c for c in link.candidates if c.tabaqa == 1]
                if len(comp) == 1:
                    link.chosen, link.confidence, link.rule = comp[0].id, 0.8, "companion-place"
    for _ in range(rounds):
        kinship()
        pairs: Counter[tuple[int, int]] = Counter()
        seen: Counter[int] = Counter()
        for _, links in chains:
            for x, y in pairwise(links):
                if x.chosen and y.chosen:
                    pairs[(x.chosen, y.chosen)] += 1
            for x in links:
                if x.chosen:
                    seen[x.chosen] += 1
        for book, links in chains:
            for k, link in enumerate(links):
                if link.chosen or len(link.candidates) < 2 or link.rule == "recension":
                    continue
                prev = links[k - 1] if k > 0 else None
                nxt = links[k + 1] if k + 1 < len(links) else None
                scores = []
                for c in link.candidates:
                    s = 0.0
                    if prev and prev.chosen:
                        s += math.log1p(pairs[(prev.chosen, c.id)]) * 2
                        pt = next((x.tabaqa for x in prev.candidates if x.id == prev.chosen), None)
                        s -= 0 if _fits(pt, c.tabaqa) else 3
                    if nxt and nxt.chosen:
                        s += math.log1p(pairs[(c.id, nxt.chosen)]) * 2
                        nt = next((x.tabaqa for x in nxt.candidates if x.id == nxt.chosen), None)
                        s -= 0 if _fits(c.tabaqa, nt) else 3
                    if k == 0 and book in SIX and c.tabaqa is not None and c.tabaqa < 9:
                        s -= 3  # the collector's own teacher is of the ninth ṭabaqa or after
                    # the narrator the settled chains name often is the likelier bearer of a common name
                    s += math.log1p(seen[c.id]) * 0.5
                    scores.append((s, c.id))
                scores.sort(reverse=True)
                best, second = scores[0], scores[1]
                if best[0] > 0 and best[0] - second[0] >= 1.0:
                    link.chosen = best[1]
                    link.rule = "context"
                    link.confidence = min(0.85, 0.4 + (best[0] - second[0]) / 10)
    for _, links in chains:
        for link in links:
            if link.chosen:
                link.confidence = CONFIDENCE.get(link.rule, CONFIDENCE["context"])
            stats[link.rule if link.chosen or link.rule == "recension" else f"{link.rule}-open"] += 1
    return stats
