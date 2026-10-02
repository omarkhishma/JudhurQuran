"""Arabic text utilities shared by the Jadhr pipeline and API."""

from .buckwalter import BuckwalterError, bw_lemma_to_arabic, bw_to_arabic, split_lemma_key
from .normalize import (
    display_bare,
    fold,
    has_arabic,
    has_marks,
    is_uthmani,
    normalize,
    plain_spelling,
    skeleton,
    strip_marks,
)
from .romanise import scholarly, slug_lemma, slug_pattern
from .roots import display_letters, from_qac, key, parse_root_input, root_input_candidates, spaced, translit

__all__ = [
    "BuckwalterError",
    "bw_lemma_to_arabic",
    "bw_to_arabic",
    "display_bare",
    "display_letters",
    "fold",
    "from_qac",
    "has_arabic",
    "has_marks",
    "is_uthmani",
    "key",
    "normalize",
    "parse_root_input",
    "plain_spelling",
    "root_input_candidates",
    "scholarly",
    "skeleton",
    "slug_lemma",
    "slug_pattern",
    "spaced",
    "split_lemma_key",
    "strip_marks",
    "translit",
]
