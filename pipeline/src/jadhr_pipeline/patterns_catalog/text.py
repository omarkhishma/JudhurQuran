"""OpenITI file → cleaned text for the pattern catalog: the relation seeds' cleaner plus four extra rules.

Every row of the catalog is a slice of ``clean_source(raw, uri, rules).text``. The shared rules (header,
paragraphs, page and milestone markers, line bars, quote tags, stray marks, folio marks, whitespace) are
``relations.openiti.clean``'s, unchanged. Some editions carry apparatus or markup those rules do not cover;
the registry (``data/patterns.yaml`` → each source's ``extra_cleaning``) names which of these run, before
the shared cleaner, on that source's raw file. Each is counted in the build report.

* ``auto-headings`` — al-Kāfiya's typing marks the editor's section titles as ``### | AUTO [المصدر]``
  followed by a line holding only ``# :``. They are section headings, not inline words: the line becomes an
  ordinary heading (``### | [المصدر]``, brackets kept — they mark the title as the editor's) and the lone
  colon line is dropped.
* ``footnote-refs`` — the editor's footnote numbers left in the running text after OpenITI removed the
  footnotes themselves: ``(1)`` and ``(¬1)``.
* ``shahid-numbers`` — the editor's running numbers before quoted verses in al-Raḍī's edition
  (``قال الفرزدق: - 13 - ما زلت …``, ``# 27 - لقيت …``).
* ``hemistich-marks`` — OpenITI's ``%`` hemistich separator in quoted verse.

Nothing here adds, removes or changes a letter of the author's text.
"""

from __future__ import annotations

import re
from collections import Counter

from ..relations.openiti import Clean, clean

_AUTO = re.compile(r"^(###\s*\|+)\s*AUTO\s+(.*)$", re.M)
_COLON_LINE = re.compile(r"^#\s*:\s*$\n?", re.M)
_FOOTNOTE = re.compile(r" ?\(¬?\d{1,3}\)")
_SHAHID = re.compile(r"(^# |^~~|(?<=[ :\]]))-? ?\d{1,3} - ", re.M)
_HEMISTICH = re.compile(r" ?%")

EXTRA_RULES = ("auto-headings", "footnote-refs", "shahid-numbers", "hemistich-marks")


def preclean(raw: str, rules: list[str] | tuple[str, ...]) -> tuple[str, Counter[str]]:
    """Apply the named extra rules to a raw OpenITI file; returns the text and a count per rule."""
    unknown = sorted(set(rules) - set(EXTRA_RULES))
    if unknown:
        raise ValueError(f"unknown cleaning rule(s): {unknown}")
    stats: Counter[str] = Counter()
    head, sep, body = raw.partition("#META#Header#End#")
    if not sep:
        return raw, stats
    if "auto-headings" in rules:
        body, n = _AUTO.subn(r"\1 \2", body)
        body, m = _COLON_LINE.subn("", body)
        stats["auto-headings"] = n
        stats["auto-headings-colon-lines"] = m
    if "footnote-refs" in rules:
        body, n = _FOOTNOTE.subn("", body)
        stats["footnote-refs"] = n
    if "shahid-numbers" in rules:
        body, n = _SHAHID.subn(lambda mm: mm.group(1) or "", body)
        stats["shahid-numbers"] = n
    if "hemistich-marks" in rules:
        body, n = _HEMISTICH.subn("", body)
        stats["hemistich-marks"] = n
    return head + sep + body, stats


def clean_source(raw: str, uri: str, rules: list[str] | tuple[str, ...] = ()) -> Clean:
    """``preclean`` with the source's extra rules, then the shared OpenITI cleaner."""
    text, extra = preclean(raw, rules)
    c = clean(text, uri)
    c.stats.update(extra)
    return c


def paragraphs(c: Clean) -> list[tuple[int, int, bool]]:
    """(start, end, is_heading) of every paragraph of a cleaned text (paragraphs are separated by \\n)."""
    out: list[tuple[int, int, bool]] = []
    pos = 0
    for line in c.text.split("\n"):
        out.append((pos, pos + len(line), c.is_heading(pos)))
        pos += len(line) + 1
    return out
