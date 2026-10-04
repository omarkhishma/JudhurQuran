"""The lexica's articles as citable things (P1.7a): an identifier per article, ``dict:<work>:<root>``, issued once and
kept — when a better mapping files the article elsewhere, and in every later build; never reissued."""

from __future__ import annotations

import json
from pathlib import Path

from jadhr_pipeline.lexica.dict_uris import assign_dict_uris
from jadhr_pipeline.slugs import SlugRegistry

REPO = Path(__file__).resolve().parents[2]
BUILT = REPO / "data" / "build" / "2026.10.0" / "lexicon_entries.jsonl"


def _e(i: int, ref: str, roots: list[str], work: str = "lane", head: str = "علم") -> dict:
    return {"id": i, "work_id": work, "source_ref": ref, "dict_roots": roots, "headword": head}


def test_each_article_is_named_by_its_work_and_root_and_keeps_its_name(tmp_path: Path) -> None:
    first = [
        _e(1, "a", ["علم"]),
        _e(2, "b", ["علم"]),
        _e(3, "c", ["علم"], work="taj"),
        _e(4, "d", [], head="لا"),
    ]
    report = assign_dict_uris(first, tmp_path)
    assert [e["uri"] for e in first] == ["dict:lane:علم", "dict:lane:علم-2", "dict:taj:علم", "dict:lane:لا"]
    assert report == {"articles": 4, "issued_now": 4}
    # the next build: article b now filed under another root, article a gone, a new article on the same root
    second = [_e(2, "b", ["عمل"]), _e(5, "e", ["علم"]), _e(3, "c", ["علم"], work="taj")]
    report = assign_dict_uris(second, tmp_path)
    by_ref = {e["source_ref"]: e["uri"] for e in second}
    assert by_ref["b"] == "dict:lane:علم-2"
    assert by_ref["c"] == "dict:taj:علم"
    # a's identifier is not given to another article
    assert by_ref["e"] == "dict:lane:علم-3"
    assert report["issued_now"] == 1
    # the registry keeps every line, the gone article's too
    assert SlugRegistry(tmp_path / "dict-articles.tsv").by_key["a"] == "lane:علم"


def test_every_built_article_has_one_identifier_of_its_own_work() -> None:
    entries = [json.loads(line) for line in BUILT.open(encoding="utf-8")]
    uris = [e["uri"] for e in entries]
    assert all(u.startswith(f"dict:{e['work_id']}:") for u, e in zip(uris, entries, strict=True))
    assert len(set(uris)) == len(uris)
    # the registry holds exactly the built ones and no more than it ever issued
    reg = SlugRegistry(REPO / "data" / "registry" / "dict-articles.tsv")
    assert {e["source_ref"]: e["uri"] for e in entries}.items() <= {
        k: f"dict:{v}" for k, v in reg.by_key.items()
    }.items()
