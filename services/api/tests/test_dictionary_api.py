"""The Arabic dictionary (P11.1): every root the lexica file an article under, the Quran's and the others; a root
with each lexicon's articles in the scholars' order and the Quran as one layer; what a reader types reaching its root."""

from __future__ import annotations

from urllib.parse import quote

from fastapi.testclient import TestClient
from jadhr_api.main import app

client = TestClient(app)
BASE = "/api/v1/dictionary"


def _get(path: str) -> dict:
    r = client.get(BASE + path)
    assert r.status_code == 200, r.text
    return r.json()


def test_the_letters_and_the_roots_beyond_the_quran() -> None:
    letters = _get("/letters")["data"]
    assert len(letters) == 28 and letters[0]["letter"] == "ء"
    total = sum(x["roots"] for x in letters)
    quranic = sum(x["quranic"] for x in letters)
    # every root is under a letter, and most are not the Quran's
    assert quranic == 1642 and total == _get("/roots?limit=1")["total"] and total - quranic > 10_000
    ain = _get(f"/roots?first={quote('ع')}&letters=3&limit=50")
    assert ain["total"] > 300
    keys = [r["key"] for r in ain["data"]]
    assert keys == sorted(keys) and all(r["letters"] == 3 and r["first"] == "ع" for r in ain["data"])
    nxt = _get(f"/roots?first={quote('ع')}&letters=3&limit=50&after={quote(ain['next'])}")
    assert nxt["data"][0]["key"] > keys[-1]
    outside = _get(f"/roots?first={quote('ع')}&quranic=false&limit=5")["data"]
    assert outside and all(r["quran_root"] is None for r in outside)


def test_a_root_with_every_lexicon_in_the_scholars_order() -> None:
    ilm = _get(f"/roots/{quote('علم')}")
    assert [w["id"] for w in ilm["works"]] == [
        "ayn",
        "tahdhib",
        "sihah",
        "maqayis",
        "mufradat",
        "lisan",
        "qamus",
        "taj",
        "lane",
    ]
    assert ilm["quran"]["key"] == "علم" and ilm["quran"]["occurrences"] > 800
    assert all(a["excerpt"] for w in ilm["works"] for a in w["articles"])
    # a root outside the Quran, five letters
    q = _get(f"/roots/{quote('قبعثر')}")
    assert q["quran"] is None and q["letters"] == 5 and len(q["works"]) >= 3
    # one article whole, though the Quran does not have its root
    art = q["works"][0]["articles"][0]
    whole = _get(f"/entries/{art['id']}")
    assert len(whole["body"]) == art["length"] and "قبعثر" in whole["dict_roots"]


def test_what_a_reader_types_reaches_its_root() -> None:
    for typed, key in (
        ("سما", "سمو"),
        ("رد", "ردد"),
        ("أخذ", "ءخذ"),
        ("ء خ ذ", "ءخذ"),
        ("ʿ-l-m", "علم"),
        ("عِلْم", "علم"),
    ):
        assert _get(f"/roots/{quote(typed)}")["key"] == key, typed
    assert client.get(f"{BASE}/roots/{quote('xyz')}").status_code == 404
    # a Quranic root the lexica file elsewhere says where
    z = _get(f"/roots/{quote('زلزل')}")
    assert z["articles"] == 0 and z["filed_under"]["key"] == "زلل" and z["quran"]["key"] == "زلزل"


def test_an_unsettled_heading_names_its_candidates() -> None:
    page = _get(f"/roots/{quote('سار')}")
    rules = {a["rule"] for w in page["works"] for a in w["articles"]}
    assert "ambiguous" in rules
    assert {c["key"] for c in page["candidates"]} >= {"سير", "سور"}
