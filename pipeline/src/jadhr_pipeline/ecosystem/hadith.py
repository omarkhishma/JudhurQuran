"""The hadith collections (PLAN P11.2a, D8, research 21 §3): the Six Books and the Muwaṭṭaʾ as texts of the generic
model — each record verbatim from fawazahmed0's compilation under its printed numbering, filed under its Arabic kitāb
and bāb from OpenITI's annotated version of the book, its grades under the name of the grader whose ruling each is.

* **The text** is the compilation's, character for character (its RLM marks and its order of marks included);
  compared after normalising, never changed. An empty record stays, said to be empty, with the witness that has its
  text named where the book joins by number (OpenITI's version under the same number) — never patched silently.
* **The titles.** OpenITI's file is read into units (number, kitāb, bāb, text) by the rule of its markup (``units``);
  four books join by number, the join kept only where the record's words are found in the unit (≥ 60%); al-Bukhārī
  (OpenITI's numbering is al-Bughā's, ours Fatḥ al-Bārī's), Muslim and the Muwaṭṭaʾ (OpenITI's numbers restart in
  each kitāb) join by aligning the texts in order (shared word 4-grams). A record no join reaches takes its kitāb from
  the records of its section that did, else from the joined records on both sides when they share one, and its bāb
  only when those records share it too. A title is OpenITI's typing with its markup taken out (page and milestone
  tags, a number, a stray Latin run such as «xsتعالى»); the compilation's English section names are never a title.
* **The grades** (``data/hadith.yaml``): only the graders whose attribution holds; the columns measured to be another
  grader's ruling are not shown under the name they carry; al-Tirmidhī's own verdict («حديث حسن صحيح» …) is read
  from his text. A value is kept as the compilation writes it, with its Arabic rendering where the register has one.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from jadhr_arabic import normalize

from . import narrators, taqrib
from .isnad import chain_words, known_names, split
from .model import Chapter, Draft, Passage

HEADER_END = "#META#Header#End#"
_NOISE = re.compile(r"PageV\d+P\d+|(?<![A-Za-z])ms\d+(?![A-Za-z])|@Q[BE]@")
_HEADING = re.compile(r"^###\s*([|$]+)\s?(.*)$")
_PAGE_REF = re.compile(r"^\[\s*ص\s*:")
_LETTERS = re.compile(r"[ء-ي]+")
_LATIN = re.compile(r"[A-Za-z]+")
_VERDICT = re.compile(r"حديث\s+(حسن\s+صحيح\s+غريب|حسن\s+صحيح|حسن\s+غريب|صحيح\s+غريب|حسن|صحيح|غريب)")
# the splits whose last name is the Companion who reports from the Prophet
PROPHET_ENDS = frozenset({"prophet-speech", "prophet-said", "that-prophet", "prophet-report"})
NUMBER_JOIN_SHARE = 0.6
TEXT_JOIN_SCORE = 0.5


@dataclass
class Unit:
    number: int | None
    kitab: str | None
    bab: str | None
    text: list[str] = field(default_factory=list)


def clean_title(s: str) -> str:
    s = _NOISE.sub(" ", s)
    s = s.strip().strip("()").strip()
    s = re.sub(r"^\(?\s*\d+\s*-?\s*", "", s)
    s = re.sub(r"\s+\d+\s*\)?$", "", s)
    s = s.strip("() ")
    s = _LATIN.sub("", s)  # a typing slip inside an Arabic title («حمد الله xsتعالى»)
    return re.sub(r"\s+", " ", s).strip()


def words(text: str) -> list[str]:
    return _LETTERS.findall(normalize(text).replace("‏", ""))


def units(raw: str, slug: str) -> list[Unit]:
    """OpenITI's file read into units by the rule of its markup."""
    body = raw.split(HEADER_END, 1)[1]
    out: list[Unit] = []
    kitab: str | None = None
    bab: str | None = None
    cur: Unit | None = None

    def start(n: int | None, first: str = "") -> None:
        nonlocal cur
        cur = Unit(n, kitab, bab, [first] if first else [])
        out.append(cur)

    for line in body.splitlines():
        line = _NOISE.sub(" ", line).rstrip()
        m = _HEADING.match(line)
        if m:
            mark, rest = m.group(1), m.group(2).strip()
            if _PAGE_REF.match(rest) or (not rest and mark != "$"):
                continue
            if slug == "abudawud":
                if mark == "$":
                    kitab, bab = clean_title(rest), None
                elif re.fullmatch(r"\d+\s*-?", rest):
                    start(int(re.match(r"\d+", rest).group()))  # type: ignore[union-attr]
                else:
                    bab = clean_title(rest)
            elif slug == "ibnmajah":
                if re.fullmatch(r"\d+\s*-?", rest):
                    start(int(re.match(r"\d+", rest).group()))  # type: ignore[union-attr]
                elif clean_title(rest).startswith(("كتاب", "افتتاح")):
                    # a kitāb names itself so; every other heading is a bāb («فضل أبي بكر»، «أبواب مواقيت الصلاة»)
                    kitab, bab = clean_title(rest), None
                else:
                    bab = clean_title(rest)
            elif slug == "muslim":
                if mark == "|":
                    kitab, bab = clean_title(rest), None
                elif mark == "||":
                    bab = clean_title(rest)
                elif mark == "$":
                    n = re.match(r"\s*(\d+)\s*", rest)
                    # a chain without a number is a further chain of the hadith before it
                    start(
                        int(n.group(1)) if n else (cur.number if cur else None),
                        rest[n.end() :] if n else rest,
                    )
            elif slug == "tirmidhi":
                if mark == "|":
                    kitab, bab = clean_title(rest), None
                elif mark == "||":
                    bab = clean_title(rest)
                elif mark == "|||" and re.match(r"\d+", rest):
                    start(int(re.match(r"\d+", rest).group()))  # type: ignore[union-attr]
            elif slug in ("nasai", "bukhari", "malik"):
                if mark == "|":
                    kitab, bab = clean_title(rest), None
                elif mark in ("||", "|||"):
                    bab = clean_title(rest)
            continue
        if line.startswith("# ") or line.startswith("~~"):
            text = line[2:].strip()
            if slug in ("nasai", "bukhari") and line.startswith("# "):
                n = re.match(r"(\d+)\s+(.*)$", text)
                if n:
                    start(int(n.group(1)), n.group(2))
                    continue
            if slug == "malik" and line.startswith("# "):
                n = re.fullmatch(r"(\d+)\s*-\s*", text)
                if n:
                    start(int(n.group(1)))
                    continue
            if cur is not None and text:
                cur.text.append(text)
    return out


def _grams(ws: list[str]) -> set[tuple[str, ...]]:
    return (
        {tuple(ws[i : i + 4]) for i in range(len(ws) - 3)} if len(ws) >= 4 else ({tuple(ws)} if ws else set())
    )


def join_by_number(
    records: list[dict[str, Any]], us: list[Unit], number_of: Any
) -> list[tuple[Unit | None, str]]:
    by_num: dict[int, list[Unit]] = defaultdict(list)
    for u in us:
        if u.number is not None:
            by_num[u.number].append(u)
    out: list[tuple[Unit | None, str]] = []
    for r in records:
        n = number_of(r)
        cands = by_num.get(n, []) if n is not None else []
        if not cands:
            out.append((None, "absent"))
            continue
        uw = {w for u in cands for line in u.text for w in words(line)}
        rw = set(words(r["text"]))
        if not rw:
            out.append((cands[0], "empty"))
            continue
        share = len(rw & uw) / len(rw)
        out.append((cands[0], "number") if share >= NUMBER_JOIN_SHARE else (None, "disagrees"))
    return out


def join_by_text(records: list[dict[str, Any]], us: list[Unit]) -> list[tuple[Unit | None, str]]:
    """Each record to the OpenITI unit sharing most of its word 4-grams, the book's order kept: among the units that
    score near the best, the nearest ahead of the last one placed (a hadith the book repeats later must not pull the
    reading forward), else the best anywhere."""
    ug = [_grams([w for line in u.text for w in words(line)]) for u in us]
    index: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for i, g in enumerate(ug):
        for x in g:
            index[x].append(i)
    out: list[tuple[Unit | None, str]] = []
    last = 0
    for r in records:
        rg = _grams(words(r["text"]))
        if not rg:
            out.append((None, "empty"))
            continue
        hits = Counter(i for x in rg for i in index.get(x, ()))
        good = [(i, n / min(len(rg), len(ug[i]) or 1)) for i, n in hits.most_common(30)]
        good = [(i, sc) for i, sc in good if sc >= TEXT_JOIN_SCORE]
        if not good:
            out.append((None, "unaligned"))
            continue
        top = max(sc for _, sc in good)
        near = [(i, sc) for i, sc in good if sc >= 0.85 * top]
        ahead = [x for x in near if last - 20 <= x[0] <= last + 300]
        pick = min(ahead, key=lambda x: abs(x[0] - last)) if ahead else max(near, key=lambda x: x[1])
        out.append((us[pick[0]], "text"))
        last = pick[0]
    return out


def _number(slug: str) -> Any:
    if slug == "muslim":
        return lambda r: int(float(r["arabicnumber"])) if r.get("arabicnumber") not in (None, "") else None
    return lambda r: int(float(r["hadithnumber"]))


def _ref(slug: str, r: dict[str, Any]) -> str:
    if slug == "muslim":
        return str(r["arabicnumber"]) if r.get("arabicnumber") not in (None, "") else f"s{r['hadithnumber']}"
    n = r["hadithnumber"]
    return str(int(n)) if float(n).is_integer() else str(n)


def grades(slug: str, r: dict[str, Any], reg: dict[str, Any], stats: Counter[str]) -> list[dict[str, Any]]:
    out = []
    for g in r.get("grades") or []:
        name, value = g["name"], (g.get("grade") or "").strip()
        if name in reg["excluded_graders"]:
            stats["grades-not-shown-misattributed"] += 1
            continue
        who = reg["graders"].get(name)
        if who is None or not value:
            stats["grades-unknown-grader"] += 1
            continue
        stats["grades-shown"] += 1
        out.append(
            {
                "grader": name,
                "grader_ar": who["ar"],
                "grader_en": who["en"],
                "work_ar": (who.get("works") or {}).get(slug),
                "value": value,
                "value_ar": None if who.get("as_published") else reg["grade_terms"].get(value),
            }
        )
    return out


def verdict(text: str) -> str | None:
    """al-Tirmidhī's own verdict, the last «حديث …» formula of his text."""
    found = _VERDICT.findall(normalize(text))
    return re.sub(r"\s+", " ", found[-1]) if found else None


def collection(
    raw: Path,
    spec: dict[str, Any],
    reg: dict[str, Any],
    stats: Counter[str],
    known: frozenset[str] = frozenset(),
) -> Draft:
    slug = spec["slug"]
    data = json.loads((raw / "fawazahmed0-hadith-api/editions" / spec["edition"]).read_text(encoding="utf-8"))
    records: list[dict[str, Any]] = data["hadiths"]
    sections: dict[str, str] = data["metadata"]["sections"]
    us = units((raw / "openiti-2025.1.9-hadith" / spec["openiti"]).read_text(encoding="utf-8"), slug)
    joined = (
        join_by_text(records, us) if spec["join"] == "text" else join_by_number(records, us, _number(slug))
    )
    # a section's Arabic kitāb: the one most of its joined records carry
    sec_kitab: dict[str, Counter[str]] = defaultdict(Counter)
    for r, (u, _) in zip(records, joined, strict=True):
        if u is not None and u.kitab:
            sec_kitab[str(r["reference"]["book"])][u.kitab] += 1
    placed: list[tuple[str, str | None, str]] = []  # (kitab, bab, how)
    for i, (r, (u, how)) in enumerate(zip(records, joined, strict=True)):
        if u is not None and u.kitab:
            placed.append((u.kitab, u.bab, how))
            continue
        prev = next((joined[j][0] for j in range(i - 1, -1, -1) if joined[j][0] is not None), None)
        nxt = next((joined[j][0] for j in range(i + 1, len(joined)) if joined[j][0] is not None), None)
        sk = sec_kitab.get(str(r["reference"]["book"]))
        # a record the compilation files under no section (the Muwaṭṭaʾ's empty «book 0»): the kitāb its neighbours
        # share, else — an empty slot between two kitābs — the one its number follows
        if sk:
            kit, by = sk.most_common(1)[0][0], "section"
        elif prev and nxt and prev.kitab and prev.kitab == nxt.kitab:
            kit, by = prev.kitab, "neighbours"
        elif prev and prev.kitab and not (r["text"] or "").strip():
            kit, by = prev.kitab, "number-order"
        else:
            raise ValueError(f"{slug} {_ref(slug, r)}: no kitāb from its section or its neighbours")
        # a bāb only when the records on both sides that were joined share it
        bab = prev.bab if prev and nxt and prev.bab == nxt.bab and prev.kitab == kit else None
        placed.append((kit, bab, f"{how}-bab-by-neighbours" if bab else f"{how}-kitab-by-{by}"))
    for _, _, how in placed:
        stats[f"{slug}:titles-{how}"] += 1
    # chapters: each kitāb, and each bāb inside it, in the order the records first reach them
    chapters: list[Chapter] = []
    at: dict[tuple[str, str | None], int] = {}
    en_of: dict[str, Counter[str]] = defaultdict(Counter)
    for r, (kit, _, _) in zip(records, placed, strict=True):
        en_of[kit][sections.get(str(r["reference"]["book"])) or ""] += 1
    passages: list[Passage] = []
    for r, (kit, bab, how) in zip(records, placed, strict=True):
        if (kit, None) not in at:
            at[(kit, None)] = len(chapters)
            chapters.append(Chapter(kit, en_of[kit].most_common(1)[0][0], 1))
        ci = at[(kit, None)]
        if bab:
            if (kit, bab) not in at:
                at[(kit, bab)] = len(chapters)
                chapters.append(Chapter(bab, "", 2, parent=at[(kit, None)]))
            ci = at[(kit, bab)]
        text = r["text"] or ""
        meta: dict[str, Any] = {
            "number": r.get("arabicnumber") if slug == "muslim" else r["hadithnumber"],
            "sequence": r["hadithnumber"],
            "in_book": r.get("reference"),
            "grades": grades(slug, r, reg, stats),
            "titles": how,
        }
        if slug == "tirmidhi":
            meta["verdict"] = verdict(text)
            stats["tirmidhi:verdict"] += meta["verdict"] is not None
        if text.strip():
            # the isnād, the matn and the collector's comment, by rule (isnad.py); None where the rules cannot read it
            sp = split(text, slug, known)
            meta["split"] = sp.as_meta() if sp else None
            stats[f"{slug}:split-{sp.rule if sp else 'none'}"] += 1
            # every narrator's name in it and the formulas before them: no root of theirs is counted (model.py)
            names, formulas, blessings = chain_words(text, sp, known)
            meta["names"] = [list(n) for n in names]
            meta["chain"] = [list(f) for f in formulas]
            meta["formulaic"] = [list(f) for f in blessings]
        if not text.strip():
            stats[f"{slug}:empty"] += 1
            u = (
                next((x for x in us if x.number == _number(slug)(r)), None)
                if spec["join"] == "number"
                else None
            )
            meta["empty"] = True
            meta["witness"] = (
                {"source": "openiti", "version": spec["openiti"], "number": u.number} if u else None
            )
        passages.append(Passage(ci, _ref(slug, r), text, meta))
    stats[f"{slug}:records"] = len(records)
    stats[f"{slug}:kitab"] = sum(1 for c in chapters if c.level == 1)
    stats[f"{slug}:bab"] = sum(1 for c in chapters if c.level == 2)
    return Draft(
        slug=slug,
        uri=f"hadith:{slug}",
        kind="hadith",
        title_ar=spec["title_ar"],
        title_en=spec["title_en"],
        author_ar=spec["author_ar"],
        author_en=spec["author_en"],
        meta_ar=spec["numbering_ar"],
        meta_en=spec["numbering_en"],
        era_year=spec["era_year"],
        source_id="fawazahmed0-hadith-api",
        info={
            "death_ah": spec["death_ah"],
            "numbering_ar": spec["numbering_ar"],
            "numbering_en": spec["numbering_en"],
            "edition": spec["edition"],
            "titles_source": "openiti-hadith",
            "titles_version": spec["openiti"],
        },
        chapters=chapters,
        passages=passages,
    )


def build_hadith(raw: Path, registry: Path) -> tuple[list[Draft], dict[str, Any]]:
    reg = yaml.safe_load(registry.read_text(encoding="utf-8"))
    stats: Counter[str] = Counter()
    # the names the chains of all seven books use, read once without them (isnad.py's first pass)
    first = []
    for spec in reg["collections"]:
        data = json.loads(
            (raw / "fawazahmed0-hadith-api/editions" / spec["edition"]).read_text(encoding="utf-8")
        )
        first += [
            (t, split(t, spec["slug"])) for t in (h["text"] or "" for h in data["hadiths"]) if t.strip()
        ]
    known = known_names(first)
    stats["split:known-names"] = len(known)
    drafts = [collection(raw, spec, reg, stats, known) for spec in reg["collections"]]
    # each name in each isnād linked to Ibn Ḥajar's entries, with its candidates, rule and confidence (narrators.py);
    # held in the passage's meta until the build gives the links their own rows
    entries = taqrib.parse((raw / reg["narrators"]["file"]).read_text(encoding="utf-8"))
    index = narrators.Index([{"id": i} for i in range(1, len(entries) + 1)], entries)
    chains = []
    for d in drafts:
        for p in d.passages:
            sp = p.meta.get("split")
            if sp and sp.get("names"):
                links = narrators.link_chain(
                    index, d.slug, p.text, [tuple(n) for n in sp["names"]], sp["rule"] in PROPHET_ENDS
                )
                p.meta["narrators"] = links
                chains.append((d.slug, links))
    for rule, n in narrators.resolve(index, chains).items():
        stats[f"links:{rule}"] = n
    for d in drafts:
        for p in d.passages:
            if "narrators" in p.meta:
                p.meta["narrators"] = [link.row() for link in p.meta["narrators"]]
    return drafts, dict(sorted(stats.items()))


def narrator_rows(raw: Path, registry: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The Taqrīb's entries as rows for ``content.narrators``, in the book's order, and what was read from them."""
    from jadhr_arabic import normalize

    from .taqrib import parse

    spec = yaml.safe_load(registry.read_text(encoding="utf-8"))["narrators"]
    entries = parse((raw / spec["file"]).read_text(encoding="utf-8"))
    rows = [
        {**e.row(), "id": i, "source_id": spec["source"], "name_norm": normalize(e.name)}
        for i, e in enumerate(entries, start=1)
    ]
    main = [e for e in entries if e.kind == "entry"]
    report = {
        "entries": len(main),
        "cross_references": len(entries) - len(main),
        "with_rank": sum(e.rank is not None for e in main),
        "with_tabaqa": sum(e.tabaqa is not None for e in main),
        "with_death_year": sum(e.death_ah is not None for e in main),
        "with_sigla": sum(bool(e.sigla) for e in main),
    }
    return rows, report
