"""Lane's paragraph on each Quranic word (PLAN P3.1: "Lane's English senses split per lemma").

Lane writes a root's article as a run of paragraphs, one ``<entryFree>`` per word he treats, keyed by the word as
Perseus spells it (Buckwalter): ``Ealimahu`` (the verb, with its object pronoun as the lexicographers cite verbs),
``EilomN`` (the noun, with its tanwin), ``EaAlimN``. Each Quranic word of the article's root is matched to the
paragraph that treats it, by two rules, said on every row:

* ``vocalised`` — the same word with its vowels: the case ending and tanwin dropped on both sides, sukun dropped, the
  superscript alef and alef wasla read as alef, a verb's object pronoun dropped from Lane's key, a shadda that
  assimilation put on the word's first letter dropped from the corpus's;
* ``verb-form`` — a verb Perseus keys without its vowels (``El~mhu``): Lane numbers its form (``<itype>2``), and the
  corpus numbers each verb's; matched when the root has exactly one verb of that form (form I unnumbered in the corpus);

Lane's key with the definite article («العَالَمُ») is compared without it. A verb of the corpus is matched only with a
paragraph Lane numbers as a verb form, a noun or adjective only with one he does not: «شَغَفٌ» is not «شَغَفَ». A verb the
corpus gives no form is taken as form I only when its lemma begins with the root's first letter (the corpus leaves
some derived verbs unnumbered: «تَجَلَّىٰ» is form V).

Nothing else is guessed — not even the same letters with other vowels, which in a sample were another word a third of
the time («مَرَاضِع» is not «مُرَاضَعٌ», «قَيِّمَة» not «قِيمَةٌ»): a word Lane does not key in the article of its root has no paragraph. The paragraph is
shown verbatim from the article (its words are the article's, never copied here), with the page it starts on.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from typing import Any

from jadhr_arabic.buckwalter import bw_lemma_to_arabic

from .lane import LaneWord, translit

_TANWIN = "\u064b\u064c\u064d"
_SHORT = "\u064e\u064f\u0650"
_SUKUN = "\u0652"
_SHADDA = "\u0651"
_MARKS = re.compile("[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")
# Lane cites a transitive verb with its object pronoun: «عَلِمَهُ», «عَلِمَهَا»
_OBJECT = re.compile("\u0647(?:\u064f|\u0650|\u064e\u0627)$")


def _common(ar: str) -> str:
    """One spelling of a word for both sides: the superscript alef and alef wasla as alef, sukun and the madda sign
    dropped, «آ» as alef, «ى» as «ي» (Perseus writes a final ya «ى»), tatweel dropped."""
    s = unicodedata.normalize("NFC", ar).replace("\u0640", "")
    for a, b in (("\u0670", "\u0627"), ("\u0671", "\u0627"), ("\u0622", "\u0627"), ("\u0649", "\u064a")):
        s = s.replace(a, b)
    s = s.replace(_SUKUN, "").replace("\u0653", "")
    return unicodedata.normalize("NFC", s)


def _vocalised(ar: str) -> str:
    """The word with its vowels, its case ending and tanwin taken off its last letter (a shadda there kept)."""
    s = _common(ar)
    last = len(s) - 1
    while last >= 0 and unicodedata.combining(s[last]):
        last -= 1
    if last < 0:
        return s
    s = s[: last + 1] + "".join(c for c in s[last + 1 :] if c not in _TANWIN + _SHORT)
    # tanwin al-fath carried by an alef: «عِلْمًا»
    if s.endswith("\u0627") and len(s) > 2 and s[-2] == "\u064b":
        s = s[:-2]
    return s


def lane_form(w: LaneWord) -> str:
    """Lane's word in Arabic script, as he keys it."""
    return unicodedata.normalize("NFC", translit(w.key))


_ARTICLE = "\u0627\u0644"


def _lane_key(w: LaneWord) -> str:
    ar = lane_form(w)
    if w.itype:
        ar = _OBJECT.sub("", ar)
    v = _vocalised(ar)
    # the definite article Lane sometimes keys a noun with
    return v[2:] if v.startswith(_ARTICLE) and len(v) > 4 else v


def _corpus_key(ar: str) -> str:
    s = _vocalised(ar)
    # the mushaf's «ءَا» is the «آ» of common spelling
    if s.startswith("\u0621\u064e\u0627"):
        s = "\u0627" + s[3:]
    # «مَّعْلُوم»: the shadda assimilation leaves on a first letter is not the word's
    if len(s) > 1 and s[1] == _SHADDA:
        s = s[0] + s[2:]
    elif len(s) > 2 and s[2] == _SHADDA and s[1] in _SHORT:
        s = s[:2] + s[3:]
    return s


def _verbal(lem: dict[str, Any]) -> bool:
    return lem.get("pos") == "V"


_HAMZA = str.maketrans("\u0623\u0625\u0622\u0624\u0626", "\u0621\u0621\u0621\u0621\u0621")


def _form_one(lem: dict[str, Any], first: str | None) -> bool:
    """Whether a verb the corpus gives no form begins as form I does: with the root's first letter."""
    if lem.get("verb_form") not in (None, 1):
        return False
    if lem.get("verb_form") == 1 or not first or not lem.get("key"):
        return lem.get("verb_form") == 1
    head = _MARKS.sub("", bw_lemma_to_arabic(lem["key"]))
    return bool(head) and head[0].translate(_HAMZA) == first.translate(_HAMZA)


def map_lane_words(
    entries: list[dict[str, Any]], lemmas: list[dict[str, Any]], roots: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Each Quranic word's paragraph in Lane's article of its root: rows (lemma, entry, paragraph, Lane's headword,
    the paragraph's page, the rule) and a report."""
    root_of = {r["id"]: r["key"] for r in roots}
    first_of = {r["key"]: (r.get("letters") or [None])[0] for r in roots}
    by_root: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for lem in lemmas:
        rk = root_of.get(lem.get("root_id"))
        if rk:
            by_root[rk].append(lem)
    rows: list[dict[str, Any]] = []
    rules: Counter[str] = Counter()
    articles = 0
    for e in entries:
        if e.get("work_id") != "lane" or not e.get("displayable") or not e.get("root_key"):
            continue
        words: list[LaneWord] = e.get("lane_words") or []
        lems = by_root.get(e["root_key"], [])
        if not words or not lems:
            continue
        articles += 1
        lane_v: dict[str, list[LaneWord]] = defaultdict(list)
        for w in words:
            lane_v[_lane_key(w)].append(w)
        taken: set[int] = set()
        found: set[int] = set()
        for lem in lems:
            # a verb with a verb's paragraph, a noun with a noun's
            for w in [
                w for w in lane_v.get(_corpus_key(lem["ar"]), []) if (w.itype is not None) == _verbal(lem)
            ]:
                rows.append(_row(lem, e, w, "vocalised"))
                rules["vocalised"] += 1
                taken.add(w.para)
                found.add(lem["id"])
        # a verb's form, where Perseus keys it without vowels: one verb of that form in the root
        left = [lem for lem in lems if lem["id"] not in found]
        for w in words:
            if not w.itype or w.para in taken or not w.itype.isdigit():
                continue
            form = int(w.itype)
            verbs = [
                lem
                for lem in left
                if _verbal(lem)
                and (
                    lem.get("verb_form") == form
                    or (form == 1 and _form_one(lem, first_of.get(e["root_key"])))
                )
            ]
            if len(verbs) == 1:
                rows.append(_row(verbs[0], e, w, "verb-form"))
                rules["verb-form"] += 1
                taken.add(w.para)
                found.add(verbs[0]["id"])
    with_root = [lem for lem in lemmas if lem.get("root_id")]
    matched = {r["lemma_id"] for r in rows}
    occ = sum(int(lem.get("occurrences") or 0) for lem in with_root)
    report = {
        "articles": articles,
        "rows": len(rows),
        "rules": dict(rules),
        "lemmas_with_root": len(with_root),
        "lemmas_matched": len(matched),
        "lemmas_matched_pct": round(100 * len(matched) / max(1, len(with_root)), 2),
        "occurrences_matched_pct": round(
            100
            * sum(int(lem.get("occurrences") or 0) for lem in with_root if lem["id"] in matched)
            / max(1, occ),
            2,
        ),
    }
    return rows, report


def _row(lem: dict[str, Any], e: dict[str, Any], w: LaneWord, rule: str) -> dict[str, Any]:
    return {
        "lemma_id": lem["id"],
        "entry_id": e["id"],
        "para": w.para,
        "headword": lane_form(w),
        "page_ref": w.page,
        "rule": rule,
    }
