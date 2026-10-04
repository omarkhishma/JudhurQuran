"""Texts beyond the Quran (P11.4a): a text with its source and its top-level chapters, a chapter with its place and its
passages, a passage cut into its words with each word's reading. Expected numbers come from the source files and the
database, never typed in."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

import yaml
from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows, scalar
from jadhr_api.main import app
from jadhr_api.texts import segments

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]
EDITIONS = REPO / "data/raw/fawazahmed0-hadith-api/editions"
COLLECTIONS = yaml.safe_load((REPO / "data/hadith.yaml").read_text(encoding="utf-8"))["collections"]


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


@cache
def _records(edition: str) -> list[dict[str, Any]]:
    return json.loads((EDITIONS / edition).read_text(encoding="utf-8"))["hadiths"]


def test_the_shelf_lists_the_seven_collections_after_the_quran() -> None:
    shelf = get("/api/v1/texts")["data"]
    assert [t["slug"] for t in shelf] == ["quran", *[c["slug"] for c in COLLECTIONS]]
    for t, c in zip(shelf[1:], COLLECTIONS, strict=True):
        assert t["kind"] == "hadith" and t["passage_count"] == len(_records(c["edition"]))
        assert t["lemma_count"] is None and t["function_lemmas"] == []


def test_a_text_comes_with_its_sources_and_its_top_level_chapters() -> None:
    for c in COLLECTIONS:
        d = get(f"/api/v1/texts/{c['slug']}")
        assert d["title_ar"] == c["title_ar"] and d["meta_ar"] == c["numbering_ar"]
        assert d["source"]["id"] == "fawazahmed0-hadith-api" and d["source"]["attribution_ar"]
        assert d["titles_source"]["id"] == "openiti-hadith"
        assert d["titles_source"]["license_url"] == "https://creativecommons.org/licenses/by-nc-sa/4.0/"
        tops = d["chapters"]
        assert tops and all(x["level"] == 1 and x["parent"] is None for x in tops)
        # every passage under exactly one kitāb, every chapter a kitāb or one of its bābs
        assert sum(x["total"] for x in tops) == d["passage_count"]
        assert len(tops) + sum(x["children"] for x in tops) == d["chapter_count"]
        assert all(x["first_ref"] for x in tops if x["total"])
    # the Quran keeps its sūras as before, each its own top-level chapter
    q = get("/api/v1/texts/quran")
    assert [x["ordinal"] for x in q["chapters"]] == list(range(1, 115))
    assert all(x["total"] == x["passage_count"] and x["children"] == 0 for x in q["chapters"])


def test_a_kitab_pages_its_passages_in_order_each_under_its_bab() -> None:
    kitab = next(x for x in get("/api/v1/texts/bukhari")["chapters"] if x["title_ar"] == "كتاب الرقاق")
    first = get(f"/api/v1/texts/bukhari/chapters/{kitab['ordinal']}", limit=200)
    assert first["chapter"]["title_ar"] == "كتاب الرقاق" and first["path"] == []
    assert first["total"] == kitab["total"] and len(first["children"]) == kitab["children"]
    seen = list(first["passages"])
    while len(seen) < first["total"]:
        seen += get(f"/api/v1/texts/bukhari/chapters/{kitab['ordinal']}", offset=len(seen), limit=200)[
            "passages"
        ]
    assert len(seen) == len({p["ref"] for p in seen}) == first["total"]
    # the text's order: Fatḥ al-Bārī's numbers rise through the kitāb
    numbers = [float(p["ref"]) for p in seen]
    assert numbers == sorted(numbers)
    # each passage names the chapter it is filed under: 6502 under «باب التواضع»
    under = {x["ordinal"]: x["title_ar"] for x in first["children"]}
    p6502 = next(p for p in seen if p["ref"] == "6502")
    assert under[p6502["chapter"]].startswith("باب التواضع")
    # a bāb: its kitāb above it, its neighbours beside it, its passages its own
    bab = get(f"/api/v1/texts/bukhari/chapters/{p6502['chapter']}")
    assert [x["title_ar"] for x in bab["path"]] == ["كتاب الرقاق"] and bab["children"] == []
    assert bab["prev"] and bab["next"] and "6502" in {p["ref"] for p in bab["passages"]}
    assert bab["total"] == sum(1 for p in seen if p["chapter"] == p6502["chapter"])


def test_a_passage_is_its_text_verbatim_cut_into_words_each_with_its_reading() -> None:
    src = next(r for r in _records("ara-abudawud.json") if r["hadithnumber"] == 4607)
    p = get("/api/v1/texts/abudawud/passages/4607")
    assert p["ar_full"] == src["text"] and "".join(s["t"] for s in p["segments"]) == src["text"]
    pieces = [s for s in p["segments"] if "w" in s]
    assert [s["w"] for s in pieces] == list(range(len(p["words"]))) == list(range(p["token_count"]))
    assert [x["title_ar"] for x in p["path"]] == ["كتاب السنة", "باب في لزوم السنة"]
    assert (p["prev"], p["next"]) == ("4606", "4608")
    assert "Al-Albani" in {g["grader"] for g in p["meta"]["grades"]}
    assert p["source"]["id"] == "fawazahmed0-hadith-api"
    # each form once, every word's form among them
    assert set(p["forms"]) == {str(i) for i in p["words"] if i}
    words = [p["forms"].get(str(i)) for i in p["words"]]
    # «حدثنا» read by a pattern: a possible root, said to be one
    assert words[0]["kind"] == "pattern" and not words[0]["sure"]
    assert words[0]["readings"][0]["dict_root"] == "حدث" and words[0]["readings"][0]["pattern_ar"]
    # a word the Quran spells is sure and carries the Quran's lemma
    sure = [w for w in words if w and w["sure"] and w["readings"] and w["readings"][0]["lemma"]]
    assert sure and all(w["readings"][0]["lemma"]["slug"] for w in sure)
    # the passage's roots: those of its report only — not its isnād, a narrator's name or a blessing — the sure from
    # sure words, the possible from the rest, never both
    at, starts = 0, []
    for seg in p["segments"]:
        if "w" in seg:
            starts.append(at)
        at += len(seg["t"])
    m = p["meta"]
    skip = [x for k in ("names", "chain", "formulaic") for x in m[k]]
    counted = [
        (w["sure"], w["readings"][0]["dict_root"])
        for w, a in zip(words, starts, strict=True)
        if w and w["readings"] and a >= m["split"]["matn"][0] and not any(x <= a < y for x, y in skip)
    ]
    assert set(p["roots"]) == {r for s, r in counted if s and r}
    assert set(p["roots_low"]) == {r for s, r in counted if not s and r} - set(p["roots"])
    # «يزيد», a narrator's name in the chain (ثور بن يزيد), gives no root
    assert "زيد" not in p["roots"] + p["roots_low"] and m["split"]["matn"]


def test_only_texts_beyond_the_quran_are_served_as_passages_here() -> None:
    assert client.get("/api/v1/texts/quran/passages/2:255").status_code == 404
    assert client.get("/api/v1/texts/bukhari/passages/999999").status_code == 404
    assert client.get("/api/v1/texts/nothing/chapters/1").status_code == 404
    assert client.get("/api/v1/texts/bukhari/chapters/0").status_code == 422


def test_every_passage_lines_its_words_up_with_its_stored_forms() -> None:
    """The one tokeniser holds across the pipeline and the API: every passage beyond the Quran cuts into as many words
    as it stores form ids, its pieces join back to its text, and every form it names exists."""
    with connect() as conn:
        found = rows(
            conn,
            """select p.ar_full, p.form_ids from content.passages p join content.texts t on t.id = p.text_id
                where t.kind <> 'quran'""",
        )
        missing = scalar(
            conn,
            """select count(*) from content.passages p, unnest(p.form_ids) f
                where f <> 0 and not exists (select 1 from content.text_forms x where x.id = f)""",
        )
    assert len(found) == sum(len(_records(c["edition"])) for c in COLLECTIONS)
    for r in found:
        segs, _ = segments(r["ar_full"] or "", r["form_ids"] or [])
        assert "".join(s["t"] for s in segs) == (r["ar_full"] or "")
    assert missing == 0


def test_a_hadith_carries_hadeethencs_explanation_of_the_number_it_cites() -> None:
    """P11.2c: HadeethEnc's items citing this hadith, verbatim with their version, its grade HadeethEnc's verdict; a
    citation whose wording our record does not hold is never shown."""
    p = get("/api/v1/texts/bukhari/passages/1")
    by_id = {x["id"]: x for x in p["explanations"]}
    x = by_id[4560]
    assert (
        x["cites"] == {"book": "bukhari", "number": 1} and x["status"] == "agrees" and x["agreement"] >= 0.6
    )
    assert x["version"] == "1.7.0" and x["grade"] == "صحيح" and x["explanation"] and x["benefits"]
    assert (
        p["explanations_source"]["id"] == "hadeethenc"
        and "1.7.0" in p["explanations_source"]["attribution_ar"]
    )
    item = get("/api/v1/hadeethenc/4560")
    assert {(c["slug"], c["ref"]) for c in item["cites"]} >= {
        ("bukhari", "1"),
        ("bukhari", "6953"),
        ("muslim", "1907.01"),
    }
    assert item["text"] == x["text"] and client.get("/api/v1/hadeethenc/999999").status_code == 404
    with connect() as conn:
        hidden = rows(
            conn,
            """select l.passage_id, t.slug, p.ref from content.hadeethenc_links l
                 join content.passages p on p.id = l.passage_id join content.texts t on t.id = p.text_id
                where l.status = 'disagrees' limit 3""",
        )
    for h in hidden:
        shown = get(f"/api/v1/texts/{h['slug']}/passages/{h['ref']}")["explanations"]
        assert all(e["status"] != "disagrees" for e in shown)


def test_no_text_beyond_the_quran_holds_a_character_outside_the_bmp() -> None:
    """The web slices a record's parts by the offsets the API counts (apps/web lib/hadith.ts, parts()): Python counts
    code points, JavaScript UTF-16 units, the same only while no character lies outside the Basic Multilingual Plane."""
    with connect() as conn:
        astral = scalar(
            conn,
            """select count(*) from content.passages p join content.texts t on t.id = p.text_id
                where t.kind <> 'quran' and p.ar_full ~ '[\\U00010000-\\U0010FFFF]'""",
        )
        # the check can fail: the same pattern finds an astral character when there is one
        assert scalar(conn, "select '𝒜' ~ '[\\U00010000-\\U0010FFFF]'") is True
    assert astral == 0
