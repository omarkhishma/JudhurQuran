"""What readers write that other readers see, kept from turning the page around (security review L12).

Characters that set the direction of what follows them — embeddings, overrides, isolates (U+202A–202E, U+2066–2069) —
are taken out of everything a reader writes for others: a title, a description, a comment, a class's or a lesson's
name, a proposal's note, a source's reference. Left in, one could make a map's title pass for another's, reverse an
author's name, or carry a comment's direction into what follows it. The marks (U+200E, U+200F, U+061C) that set a
Latin word inside an Arabic sentence stay in running text; a one-line name loses them too (a credit line, a title in a
list), as display names always have.
"""

from __future__ import annotations

import re

REORDERING = re.compile("[\u202a-\u202e\u2066-\u2069]")
MARKS = re.compile("[\u061c\u200e\u200f]")


def text(s: str) -> str:
    """Running text: what would reorder it out, the marks kept."""
    return REORDERING.sub("", s)


def name(s: str) -> str:
    """A one-line name: every direction control out."""
    return MARKS.sub("", REORDERING.sub("", s))
