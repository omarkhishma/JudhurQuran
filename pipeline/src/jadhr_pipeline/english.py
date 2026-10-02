"""English glosses and transliteration, verbatim from their sources.

- Lemma glosses: the corpus author's revised lemma list (``qac-v2-kaisdukes/lemmas.txt``, GPL-3.0). It
  covers mostly verbs ("to know"); nouns are left without a lemma gloss rather than given one we wrote.
- Word glosses and transliteration: the corpus's Word by Word pages (``qac-wbw/wbw.jsonl``, fetched by
  ``corpus_wbw``), joined on the corpus word location — the same locations as our words, so no alignment
  is involved. Stored and shown verbatim, punctuation included, as the corpus terms require.
"""

from __future__ import annotations

import json
from pathlib import Path


def lemma_glosses(path: Path) -> dict[str, str]:
    """Buckwalter lemma key → gloss. A key listed twice (two senses) keeps both, in file order."""
    out: dict[str, str] = {}
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        key, sep, gloss = line.partition("\t")
        if not sep or not key or not gloss.strip():
            raise ValueError(f"{path.name}:{n}: expected 'lemma<TAB>gloss'")
        gloss = gloss.strip()
        out[key] = f"{out[key]}; {gloss}" if key in out and gloss not in out[key] else gloss
    return out


def word_glosses(path: Path) -> dict[str, tuple[str, str]]:
    """Corpus location → (transliteration, gloss)."""
    out: dict[str, tuple[str, str]] = {}
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            if r["location"] in out:
                raise ValueError(f"duplicate word {r['location']} in {path.name}")
            out[r["location"]] = (r["translit"], r["gloss"])
    return out
