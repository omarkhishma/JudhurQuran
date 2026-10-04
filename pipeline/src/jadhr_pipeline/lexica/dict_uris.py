"""The lexica's articles as citable things (PLAN P1.7a): every article gets a namespaced identifier that never
changes between releases — ``dict:<work>:<root>``, the work and the dictionary's root it was first filed under (the
key its page uses, ``/dictionary/<root>``), with ``-2``, ``-3``… for a work's further articles on that root
(``dict:lane:علم``, ``dict:tahdhib:علم-2``).

The append-only registry ``data/registry/dict-articles.tsv`` holds them, keyed by the source's own address of the
article (``source_ref``: Perseus's entry id for Lane, the Shamela book, page and line for the others), so an article
keeps its identifier when a better mapping files it under another root, and an identifier is never given to another
article. A pinned source replaced by a new edition moves the addresses: its lines are re-keyed by hand, the identifiers
kept.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..slugs import SlugRegistry
from .rootmap import skeleton_letters

HEADER = "article (the source's own address)\tidentifier after dict:"


def assign_dict_uris(entries: list[dict[str, Any]], registry_dir: Path) -> dict[str, int]:
    """Set ``uri`` on every entry, in the build's order (each work in its source's order), and save the registry."""
    reg = SlugRegistry(registry_dir / "dict-articles.tsv")
    for e in sorted(entries, key=lambda e: e["id"]):
        roots = e.get("dict_roots") or []
        # an article filed under no root (a letter, a particle, a phrase) is named by its heading's letters
        where = roots[0] if roots else skeleton_letters(e["headword"]) or "x"
        e["uri"] = "dict:" + reg.assign(e["source_ref"], f"{e['work_id']}:{where}")
    reg.save(HEADER)
    return {"articles": len(entries), "issued_now": len(reg.added)}
