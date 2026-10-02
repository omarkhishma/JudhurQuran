"""Map a dictionary headword to exactly one canonical Quranic root (or none).

Canonical radicals are the Quranic Arabic Corpus roots with the hamza radical written ``ء``.
A headword is reduced to its letter skeleton (marks removed; أ إ آ ؤ ئ ٱ → ء; ى → ي; ة → ه).

* ``strict``  — the skeleton equals a canonical root (or a printed final shadda doubles the
  last letter: "أزّ" → ءزز, rule ``shadda-expanded``). Accepted automatically.
* ``manual``  — the registry maps this headword by hand (``manual_roots``).
* ``loose``   — one documented substitution makes it equal a canonical root. Assigned, and
  ALWAYS listed for human review with a confidence flag:

  ======================  ==========  =====================================================
  rule                    confidence  example
  ======================  ==========  =====================================================
  alif-for-hamza          high        اخذ → ءخذ (plain alif written for a hamza radical)
  alif-for-weak           high        سما → سمو, قال → قول (alif written for و/ي)
  two-letter-geminate     high        رب → ربب (doubled root keyed by two letters)
  waw-yaa-swap            medium      رضي → رضو (و/ي merged in one article)
  hamza-weak-swap         low         قرى → قرء
  two-letter-defective    low         يد → يدي, أخ → أخو (defective noun keyed by two letters)
  ======================  ==========  =====================================================

A loose candidate is NOT assigned when the same work already has a strict article for that
root (the headword is then most likely a different, non-Quranic root); it is still listed
for review as ``suppressed``. Ties between candidates of equal confidence are assigned to the
root with more Quranic occurrences and flagged ``ambiguous``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from judhur_arabic import key as root_key_of
from judhur_arabic import strip_marks

_FOLD = str.maketrans(
    {
        "\u0623": "\u0621",
        "\u0625": "\u0621",
        "\u0622": "\u0621",
        "\u0624": "\u0621",
        "\u0626": "\u0621",
        "\u0671": "\u0621",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }
)
_LETTERS = set("ءابتثجحخدذرزسشصضطظعغفقكلمنهوي")
CONFIDENCE_RANK = {"high": 0, "medium": 1, "low": 2}
RULE_CONFIDENCE = {
    "alif-for-hamza": "high",
    "alif-for-weak": "high",
    "two-letter-geminate": "high",
    "waw-yaa-swap": "medium",
    "hamza-weak-swap": "low",
    "two-letter-defective": "low",
}


def skeleton_letters(headword: str) -> str:
    """Headword → folded letter skeleton used for matching (never displayed)."""
    return "".join(ch for ch in strip_marks(headword).translate(_FOLD) if ch in _LETTERS)


def _final_shadda(headword: str) -> bool:
    """True when a shadda sits on the last letter of the headword ("أزّ", "رَبَّ")."""
    t = headword.strip().strip("[]()")
    last = max((i for i, ch in enumerate(t) if ch in _LETTERS or ch in "أإآؤئٱىة"), default=-1)
    return last >= 0 and "\u0651" in t[last + 1 :]


@dataclass(frozen=True)
class Match:
    root_key: str | None
    match: str | None  # strict | manual | loose | None
    confidence: str | None = None
    rule: str | None = None
    alternatives: tuple[str, ...] = ()
    suppressed: tuple[str, ...] = ()
    ambiguous: bool = False


@dataclass
class RootMatcher:
    roots: list[dict]
    canon: dict[str, str] = field(init=False)  # skeleton → display key
    occ: dict[str, int] = field(init=False)

    def __post_init__(self) -> None:
        self.canon = {}
        self.occ = {}
        for r in self.roots:
            letters = "".join(r["letters"])
            k = r["key"]
            if root_key_of(r["letters"]) != k:
                raise ValueError(f"root key mismatch for {r}")
            self.canon[letters] = k
            self.occ[k] = int(r.get("occurrences") or 0)
        self.keys = set(self.canon.values())

    def loose_candidates(self, s: str) -> list[tuple[str, str]]:
        """(canonical display key, rule) for every single documented substitution."""
        out: list[tuple[str, str]] = []

        def add(cand: str, rule: str) -> None:
            k = self.canon.get(cand)
            if k is not None and (k, rule) not in out:
                out.append((k, rule))

        for i, ch in enumerate(s):
            if ch == "ا":
                add(s[:i] + "ء" + s[i + 1 :], "alif-for-hamza")
                if i > 0:
                    add(s[:i] + "و" + s[i + 1 :], "alif-for-weak")
                    add(s[:i] + "ي" + s[i + 1 :], "alif-for-weak")
            elif ch in "وي":
                add(s[:i] + ("ي" if ch == "و" else "و") + s[i + 1 :], "waw-yaa-swap")
                add(s[:i] + "ء" + s[i + 1 :], "hamza-weak-swap")
            elif ch == "ء":
                add(s[:i] + "و" + s[i + 1 :], "hamza-weak-swap")
                add(s[:i] + "ي" + s[i + 1 :], "hamza-weak-swap")
        if len(s) == 2:
            add(s + s[1], "two-letter-geminate")
            add(s + "و", "two-letter-defective")
            add(s + "ي", "two-letter-defective")
            if s[0] == "ا":
                add("ء" + s[1] + s[1], "two-letter-geminate")
                add("ء" + s[1] + "و", "two-letter-defective")
                add("ء" + s[1] + "ي", "two-letter-defective")
        return out

    def match(self, headword: str, manual: dict[str, str | None], strict_in_work: set[str]) -> Match:
        s = skeleton_letters(headword)
        for cand in (headword.strip(), s):
            if cand in manual:
                k = manual[cand]
                if k is not None and k not in self.keys:
                    raise ValueError(f"manual root {k!r} for {headword!r} is not a canonical root key")
                return Match(k, "manual" if k else None, rule="manual")
        if not s:
            return Match(None, None)
        if s in self.canon:
            return Match(self.canon[s], "strict")
        if len(s) == 2 and _final_shadda(headword) and s + s[1] in self.canon:
            # "أزّ", "ربّ": the printed shadda writes the doubled radical — an orthographic
            # certainty, not a substitution.
            return Match(self.canon[s + s[1]], "strict", rule="shadda-expanded")
        cands = self.loose_candidates(s)
        if not cands:
            return Match(None, None)
        usable = [(k, r) for k, r in cands if k not in strict_in_work]
        suppressed = tuple(sorted({k for k, _ in cands if k in strict_in_work}))
        if not usable:
            return Match(None, None, suppressed=suppressed, rule="suppressed")
        best_rank = min(CONFIDENCE_RANK[RULE_CONFIDENCE[r]] for _, r in usable)
        best = [(k, r) for k, r in usable if CONFIDENCE_RANK[RULE_CONFIDENCE[r]] == best_rank]
        best_keys = sorted({k for k, _ in best}, key=lambda k: (-self.occ.get(k, 0), k))
        chosen = best_keys[0]
        rule = next(r for k, r in best if k == chosen)
        alts = tuple(k for k in sorted({k for k, _ in usable}) if k != chosen)
        ambiguous = len(best_keys) > 1
        confidence = RULE_CONFIDENCE[rule] if not ambiguous else "low"
        return Match(chosen, "loose", confidence, rule, alts, suppressed, ambiguous)
