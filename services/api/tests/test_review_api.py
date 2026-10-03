"""The review deck's content (P5.3, RDR-344…360): a root's family and a verse that uses it, varied by pick;
a reader's words mapped to their roots by POST, never kept."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.main import app
from jadhr_arabic import normalize

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def test_a_root_comes_with_its_whole_family_and_a_verse_with_its_words_to_fill_in() -> None:
    d = get("/api/v1/roots/علم/review")
    assert len(d["family"]) == get("/api/v1/roots/علم")["lemma_count"] == d["root"]["lemma_count"]
    c = d["context"]
    v = get(f"/api/v1/verses/{c['verse_key']}")
    assert c["tokens"] == [t["text"] for t in v["tokens"]]
    # every blank is a word of the root, at its place in the verse
    assert c["blanks"] and all(b["slug"] in {m["slug"] for m in d["family"]} for b in c["blanks"])
    for b in c["blanks"]:
        assert normalize(" ".join(c["tokens"][b["token_from"] - 1 : b["token_to"]])) == normalize(
            b["surface"]
        )
    # the verse is the richest in the root; another pick is another verse among the first few
    counts = {}
    for k in range(c["choices"]):
        x = get("/api/v1/roots/علم/review", pick=k)["context"]
        counts[x["verse_key"]] = len(x["blanks"])
    assert len(counts) == c["choices"] and len(c["blanks"]) == max(counts.values())
    assert get("/api/v1/roots/علم/review", pick=c["choices"])["context"]["verse_key"] == c["verse_key"]


def test_every_root_has_a_verse_so_the_card_never_dead_ends() -> None:
    for key in ("صبر", "كتب", "قرأ", "نور"):
        assert get(f"/api/v1/roots/{key}/review")["context"]["blanks"]
    assert client.get("/api/v1/roots/zzz/review").status_code == 404


def test_a_readers_words_are_mapped_to_their_roots_and_kept_nowhere() -> None:
    r = client.post("/api/v1/lemmas/roots", json={"slugs": ["ilm", "min", "kitab", "no-such"]})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    by = {x["slug"]: x["root"] for x in r.json()["data"]}
    assert (
        by["ilm"]["key"] == "علم"
        and by["kitab"]["key"] == "كتب"
        and by["min"] is None
        and "no-such" not in by
    )
    # the word itself, in Arabic, for naming it where the reader sees it
    ar = {x["slug"]: x["ar"] for x in r.json()["data"]}
    assert (
        normalize(ar["ilm"]) == "\u0639\u0644\u0645" and ar["kitab"] == "\u0643\u0650\u062a\u064e\u0670\u0628"
    )


def test_each_blank_takes_the_everyday_spelling_and_carries_its_hint_and_what_is_revealed() -> None:
    # الصلاة is written ٱلصَّلَوٰةَ in the mushaf: a reader may type either (RDR-355)
    d = get("/api/v1/roots/صلو/review")
    b = next(x for x in d["context"]["blanks"] if x["imlaei"] == "الصلاة")
    assert normalize(b["surface"]) != normalize(b["imlaei"])
    # the hint before checking and the reveal after (RDR-354, 356)
    assert b["lemma"]["pos"]["ar"] and b["lemma"]["occurrences"] > 0 and b["translit"]
    assert all(x["pattern"] is None or x["pattern"]["ar"]["full"] for x in d["context"]["blanks"])


def test_the_card_can_be_asked_in_a_body_and_is_kept_nowhere() -> None:
    r = client.post("/api/v1/review/root", json={"root": "علم", "pick": 1})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert r.json()["context"]["verse_key"] == get("/api/v1/roots/علم/review", pick=1)["context"]["verse_key"]
    assert client.post("/api/v1/review/root", json={"root": "zzz"}).status_code == 404
