"""The dictionary's roots (PLAN P11.1): every root the lexica file an article under, the Quran's and all the others,
each article linked to its root(s) — by what the lexicographers wrote and what the other lexica attest, never by a
guess.

The Quran's roots are known (the corpus); the others are not, so a heading becomes a root by these rules, in order:

* ``quran``         — the article is shown today under a Quranic root (an exact, hand-made or high-confidence match,
                      lexica/rootmap.py): that root.
* ``as-written``    — a heading of three or four letters, or five with no article (قبعثر): the root itself.
* ``alif-hamza``    — an initial alif stands for a hamza radical when the hamza form is attested (اسل → ءسل).
* ``alif-weak``     — an alif inside stands for a weak radical or a hamza when exactly one of و / ي / ء is attested
                      (سما → سمو; a hamza reading is filed as ``alif-hamza``).
* ``two-letter-doubled``  — a two-letter heading is the doubled root when that is attested (رد → ردد): the
                      lexicographers' convention for the biliteral section (الثنائي المضاعف), preferred over a weak
                      reading attested beside it.
* ``two-letter-weak`` — a two-letter heading whose doubled form is attested nowhere, and exactly one weak form is.

Attested means: the skeleton of a three- or four-letter heading, with no alif, in any of the lexica, or a Quranic
root. Where the evidence points two ways (سار: سير or سور) or nowhere, the article stays under the heading as written
(``ambiguous`` / ``unresolved``), its page linking the candidates, for editors to decide. The letters themselves,
function words (لا، ما، في) and phrases are headings, not roots (``heading``): the article is kept, no root is made.

A combined heading (عق، قع — al-ʿAyn's and al-Azharī's permutations; ثاد، داث) links the article to each of its roots;
al-Qāmūs's bullet words take the Tāj root their section is aligned to.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from .rootmap import skeleton_letters

FUNCTION_WORDS = {
    "لا", "ما", "في", "ذا", "هي", "هو", "وي", "وا", "يا", "لو", "او", "ءو", "ان", "ءن", "كي", "لم", "لن", "من", "عن",
    "قد", "بل", "هل", "ثم", "ءي", "اي", "ذي", "تي", "ته", "ها", "ءم", "ام", "ءل", "ال", "ءذ", "اذ", "مذ", "لي", "كم",
}  # fmt: skip
# split a printed heading into its headings: «عق، قع», «خور _ خير», «ثاد، داث», «عفنقس، وعقنفس»
_SEPARATORS = ("،", ",", "_", "-", "/", "؛")


def heads_of(headword: str, given: list[str] | None) -> list[str]:
    """The headings an article is filed under: those the parser gave (permutations, the Tāj root), else the
    printed heading split at its separators; brackets, spaces and a leading و of a variant dropped."""
    raw = list(given) if given else [headword]
    out: list[str] = []
    for h in raw:
        h = h.strip().strip("[]()«»")
        for sep in _SEPARATORS:
            h = h.replace(sep, "|")
        for part in h.split("|"):
            part = part.strip()
            if not part:
                continue
            letters = skeleton_letters(part.replace(" ", ""))
            if len(letters) > 3 and letters.startswith("و") and out:  # «…، وعقنفس»: a variant after a comma
                letters = letters[1:]
            if letters and letters not in out:
                out.append(letters)
    return out


@dataclass
class Resolved:
    roots: list[str]  # the article's roots (skeletons, hamza as ء)
    rule: str
    candidates: list[str] = field(default_factory=list)  # for ambiguous / unresolved: what it could be


def resolve(head: str, attested: set[str]) -> Resolved:
    """One heading's root by the rules above (the Quranic match is applied by the caller)."""
    n = len(head)
    if n == 1 or head in FUNCTION_WORDS:
        return Resolved([], "heading")
    if n == 2:
        doubled = head + head[1]
        if doubled in attested or not any(head + w in attested for w in "وي"):
            # the doubled root when attested, and the convention when nothing else is
            if doubled in attested:
                return Resolved([doubled], "two-letter-doubled")
            return Resolved([head], "unresolved", [doubled, head + "و", head + "ي"])
        weak = [head + w for w in "وي" if head + w in attested]
        return Resolved(weak, "two-letter-weak") if len(weak) == 1 else Resolved([head], "ambiguous", weak)
    if n > 5 or (n == 5 and head.startswith("ال")):
        return Resolved([], "heading")
    if "ا" not in head:
        return Resolved([head], "as-written")
    if head.startswith("ا") and head.count("ا") == 1 and "ء" + head[1:] in attested:
        return Resolved(["ء" + head[1:]], "alif-hamza")
    if head.count("ا") == 1 and n in (3, 4):
        # an alif inside stands for a weak radical or for a hamza (سار: سير, سور — or سأر, as al-ʿAyn's article is)
        cands = [head.replace("ا", w) for w in "ويء"]
        found = [c for c in cands if c in attested]
        if len(found) == 1:
            return Resolved(found, "alif-hamza" if found[0] == head.replace("ا", "ء") else "alif-weak")
        return Resolved([head], "ambiguous" if found else "unresolved", found or cands)
    return Resolved([head], "unresolved", [])


def build_dict_roots(
    entries: list[dict[str, Any]], quran_roots: list[dict[str, Any]], work_order: list[str]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Every article's roots (``dict_roots``, ``dict_rule``, ``dict_candidates`` set on each entry) and the registry
    rows: one per root, with the lexica that have it and its Quranic root when it is one."""
    quran = {skeleton_letters(r["key"]): r["key"] for r in quran_roots}
    attested: set[str] = set(quran)
    for e in entries:
        for h in heads_of(e["headword"], e.get("heads")):
            if len(h) in (3, 4) and "ا" not in h:
                attested.add(h)
    rules: Counter[str] = Counter()
    by_root: dict[str, list[dict[str, Any]]] = defaultdict(list)
    review: list[dict[str, Any]] = []
    for e in entries:
        if e.get("displayable") and e.get("root_key"):
            res = Resolved([skeleton_letters(e["root_key"])], "quran")
        else:
            parts = [resolve(h, attested) for h in heads_of(e["headword"], e.get("heads"))]
            roots = list(dict.fromkeys(r for p in parts for r in p.roots))
            kinds = [p.rule for p in parts if p.roots or p.rule == "heading"]
            rule = (
                "heading"
                if not roots
                else next((k for k in kinds if k in ("ambiguous", "unresolved")), kinds[0])
            )
            cands = list(dict.fromkeys(c for p in parts for c in p.candidates))
            res = Resolved(roots, rule, cands)
        e["dict_roots"] = res.roots
        e["dict_rule"] = res.rule
        e["dict_candidates"] = res.candidates or None
        rules[res.rule] += 1
        for r in res.roots:
            by_root[r].append(e)
        if res.rule in ("ambiguous", "unresolved"):
            review.append(
                {
                    "entry_id": e["id"],
                    "work_id": e["work_id"],
                    "headword": e["headword"],
                    "rule": res.rule,
                    "candidates": res.candidates,
                }
            )
    order = {w: i for i, w in enumerate(work_order)}
    rows: list[dict[str, Any]] = []
    for key, arts in sorted(by_root.items()):
        # the form most of its articles print, marks off, hamza on its seat (أخذ, not ءخذ); the Quran's own key wins
        printed = Counter(
            next((h for h in _printed(a["headword"]) if skeleton_letters(h) == key), None) for a in arts
        )
        printed.pop(None, None)
        display = quran.get(key) or (printed.most_common(1)[0][0] if printed else key)
        works = sorted({a["work_id"] for a in arts}, key=lambda w: order.get(w, 99))
        rule_counts = Counter(a["dict_rule"] for a in arts)
        rows.append(
            {
                "key": key,
                "display": display,
                "letters": len(key),
                "first": key[0],
                "quran_root": quran.get(key),
                "lexica": works,
                "articles": len(arts),
                # a root only some heading's evidence made (no article written that way, no Quranic root) is said so
                "attested_as_written": key in quran
                or any(r == "as-written" or r == "quran" for r in rule_counts),
                "unsure": all(a["dict_rule"] in ("ambiguous", "unresolved") for a in arts),
                "filed_under": None,
            }
        )
    # every Quranic root is in the dictionary: one no lexicon files under its own letters gets its row, pointing to
    # where they do file it — a reduplicated root under its doubled one (زلزل under زلل), as the lexicographers did
    for skel, qkey in sorted(quran.items()):
        if skel in by_root:
            continue
        under = (
            skel[0] + skel[1] + skel[1]
            if len(skel) == 4 and skel[0] == skel[2] and skel[1] == skel[3]
            else None
        )
        rows.append(
            {
                "key": skel,
                "display": qkey,
                "letters": len(skel),
                "first": skel[0],
                "quran_root": qkey,
                "lexica": [],
                "articles": 0,
                "attested_as_written": True,
                "unsure": False,
                "filed_under": under if under in by_root else None,
            }
        )
    rows.sort(key=lambda r: r["key"])
    report = {
        "roots": len(rows),
        "quranic": sum(1 for r in rows if r["quran_root"]),
        "outside_the_quran": sum(1 for r in rows if not r["quran_root"]),
        "by_letters": dict(sorted(Counter(r["letters"] for r in rows).items())),
        "articles_by_rule": dict(rules),
        "articles_without_root": rules["heading"],
        "review": len(review),
        "review_sample": review[:200],
        "quranic_roots_without_article": {
            r["display"]: r["filed_under"] for r in rows if r["quran_root"] and not r["articles"]
        },
    }
    return rows, report


def _printed(headword: str) -> list[str]:
    """The printed headings without marks (أخذ, رد), for a root's display form."""
    from jadhr_arabic import strip_marks

    h = strip_marks(headword).strip().strip("[]()«»").replace("ـ", "")
    for sep in _SEPARATORS:
        h = h.replace(sep, "|")
    return [p.strip().replace(" ", "") for p in h.split("|") if p.strip()]
