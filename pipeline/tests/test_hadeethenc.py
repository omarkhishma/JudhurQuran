"""HadeethEnc's items (P11.2c): the versioned export verbatim, the Six Books' numbers each reference cites read to the
right book, and each item linked to the hadith it cites with how much of its wording our record holds."""

from __future__ import annotations

import json
from functools import cache
from typing import Any

import yaml
from jadhr_pipeline.ecosystem.hadeethenc import cited, items
from jadhr_pipeline.release import REPO

RAW = REPO / "data/raw"
SPEC = yaml.safe_load((REPO / "data/hadith.yaml").read_text(encoding="utf-8"))["hadeethenc"]


@cache
def _items() -> list[dict[str, Any]]:
    return items(RAW, SPEC)


def test_every_item_is_the_export_verbatim_and_agrees_with_the_api() -> None:
    its = _items()
    api = {int(x["id"]): x for x in json.loads((RAW / SPEC["api"]).read_text(encoding="utf-8"))}
    assert len(its) == len(api) == 3582 and all(i["version"] == "1.7.0" for i in its)
    # an independent copy: the API gives the same hadith text and explanation for all but one item
    same = sum(
        i["text"] == api[i["id"]]["hadeeth"] and i["explanation"] == api[i["id"]]["explanation"] for i in its
    )
    assert same >= len(its) - 2
    assert sum(bool(i["word_meanings"]) for i in its) > 2500 and all(
        i["reference"] is not None for i in its[:100]
    )


def test_a_reference_cites_each_number_to_the_book_named_before_it() -> None:
    assert cited(
        "صحيح البخاري (9/ 22) (6953)، (1/ 6) (1).\nصحيح مسلم (3/ 1515) (1907).\nالتحفة الربانية (ص5)."
    ) == [
        ("bukhari", 6953),
        ("bukhari", 1),
        ("muslim", 1907),
    ]
    assert cited("صحيح البخاري (2/ 74) (1258 - 1259).") == [("bukhari", 1258), ("bukhari", 1259)]
    assert cited("سنن أبي داود (4/ 200) (4607)، وسنن الترمذي (5/ 44) (2676).") == [
        ("abudawud", 4607),
        ("tirmidhi", 2676),
    ]
    # a number after a book outside the Six is not one of theirs
    assert cited("صحيح البخاري (1639)، وصحيح ابن حبان (97).") == [("bukhari", 1639)]
    assert cited("- صحيح البخاري، نشر: دار طوق النجاة") == []
