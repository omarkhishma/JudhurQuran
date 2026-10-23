"""The search assertions (design 09 §9.6, adapted to the Quran) on the OpenSearch engine.

The five design assertions catch nearly every analyser regression:
a vocalised query finds the unvocalised word; a Latin query without diacritics finds the transliterated
form; hamza variants match; a tashkīl-marked query ranks its exact form first; a root query returns the
whole family. Plus Quran ones: mushaf (Uthmani) text pasted as a query, a verse phrase, English meaning.
Requires a reachable OpenSearch with a built index (skips otherwise, fails with JADHR_REQUIRE_DATA=1)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from jadhr_api import searchindex
from jadhr_api.main import app

client = TestClient(app)

if not searchindex.available(searchindex.client()):
    if os.environ.get("JADHR_REQUIRE_DATA") == "1":
        raise RuntimeError("JADHR_REQUIRE_DATA=1 but OpenSearch is not reachable")
    pytest.skip("OpenSearch not reachable", allow_module_level=True)


def search(q: str, limit: int = 10) -> dict:
    r = client.get("/api/v1/search", params={"q": q, "limit": limit})
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d["engine"] == "opensearch"
    return d


def slugs(d: dict) -> list[str]:
    return [x["slug"] for x in d["results"]["lemmas"]]


def test_vocalised_query_finds_the_unvocalised_word() -> None:
    assert slugs(search("كِتَاب"))[0] == "kitab"  # كِتَاب
    assert slugs(search("كتاب"))[0] == "kitab"


def test_latin_without_diacritics_finds_the_transliteration() -> None:
    assert slugs(search("kitab"))[0] == "kitab"
    assert "ilm" in slugs(search("ilm"))[:3]


def test_hamza_variants_match() -> None:
    plain = slugs(search("امر"))
    hamza = slugs(search("أمر"))
    assert "amr" in plain[:2] and "amr" in hamza[:2]


def test_tashkil_marked_query_ranks_its_exact_form_first() -> None:
    assert slugs(search("عَلِمَ"))[0] == "alima"  # عَلِمَ the verb
    assert slugs(search("عِلْم"))[0] == "ilm"  # عِلْم the noun


def test_root_query_returns_the_whole_family() -> None:
    d = search("ع ل م", limit=50)
    assert d["detected"]["kind"] == "root"
    root = client.get("/api/v1/roots/علم").json()
    assert sorted(slugs(d)) == sorted(lem_slug for lem_slug in _family_slugs())
    assert len(slugs(d)) == root["lemma_count"]


def _family_slugs() -> list[str]:
    d = client.get("/api/v1/words/ilm").json()
    return [m["slug"] for g in d["family"] for m in g["members"]]


def test_mushaf_text_pasted_as_a_query() -> None:
    d = search("ٱلرَّحْمَٰنِ")  # ٱلرَّحْمَٰنِ
    assert "rahman" in slugs(d)[:2]


def test_a_verse_phrase_finds_its_verse_first() -> None:
    d = search("الحمد لله رب العالمين")
    assert d["results"]["verses"][0]["key"] == "1:2"


def test_english_meaning_finds_the_word() -> None:
    assert "ilm" in slugs(search("knowledge"))[:2]
    assert "rahma" in slugs(search("mercy"))[:3]


def test_patterns_are_searchable() -> None:
    d = search("فَاعِل")  # فَاعِل
    assert d["results"]["patterns"][0]["slug"] == "faa3il"


def test_index_counts_match_postgres() -> None:
    st = searchindex.status()
    meta = client.get("/api/v1/meta").json()["dataset"]["counts"]
    assert st["indices"]["words"]["documents"] == meta["lemmas"]
    assert st["indices"]["roots"]["documents"] == meta["roots"]
    assert st["indices"]["passages"]["documents"] == meta["verses"]
    assert st["indices"]["occurrences"]["documents"] == meta["words"]
    shelf = client.get("/api/v1/texts").json()["data"]
    assert st["indices"]["texts"]["documents"] == sum(
        t["passage_count"] for t in shelf if t["kind"] != "quran"
    )


def test_chat_alphabet_finds_the_word() -> None:
    """Arabic typed with digits and doubled vowels, as in chat (RDR-602)."""
    from jadhr_api.search import chat_alphabet

    assert chat_alphabet("3ilm") == "ʿilm"
    assert chat_alphabet("ra7ma") == "raḥma"
    assert chat_alphabet("3'afoor") == "ghafūr"
    assert chat_alphabet("Saabir") == "sābir"
    assert chat_alphabet("qalb") == "qalb"
    for q, slug in (("Saabir", "sabir"), ("3ilm", "ilm"), ("ra7ma", "rahma"), ("7amd", "hamd")):
        d = client.get("/api/v1/search", params={"q": q, "limit": 3}).json()
        assert slug in [x["slug"] for x in d["results"]["lemmas"]], q


def test_nouns_come_before_verbs_among_the_words_a_query_names() -> None:
    from jadhr_api.search import rank_lemmas

    lem = client.get("/api/v1/search", params={"q": "علم", "limit": 6}).json()["results"]["lemmas"]
    assert lem[0]["slug"] == "ilm", [x["slug"] for x in lem]
    exact = [x for x in lem if x["slug"] in ("ilm", "alima")]
    assert [x["pos"] for x in exact] == ["N", "V"]
    # the rule itself: exact letters first, then non-verbs, then frequency
    rows = [
        {"ar": "عَلِمَ", "pos": "V", "occurrences": 300},
        {"ar": "عَالَمِين", "pos": "N", "occurrences": 70},
        {"ar": "عِلْم", "pos": "N", "occurrences": 100},
        {"ar": "عُلِّمَ", "pos": "V", "occurrences": 5},
    ]
    assert [r["ar"] for r in rank_lemmas(rows, "علم")] == ["عِلْم", "عَلِمَ", "عُلِّمَ", "عَالَمِين"]


# ─── Research screens audit (research 09): patterns, counts, paging, ranges, dictionaries ──────────


def _page_all(q: str, only: str, key: str) -> list[str]:
    seen: list[str] = []
    while True:
        r = client.get(
            "/api/v1/search", params={"q": q, "only": only, "limit": 100, "offset": len(seen)}
        ).json()
        got = [x[key] for x in r["results"][only]]
        if not got:
            return seen
        seen += got


def test_a_pattern_query_names_the_pattern_and_lists_every_word_on_it() -> None:
    """SRC-09, SRC-22: the slug, the vowelled wazn and a typed transliteration all name the pattern; its
    words are all the words on it, counted and paged."""
    pat = client.get("/api/v1/patterns/maf3uul", params={"limit": 1}).json()
    for q in ("maf3uul", "مَفْعُول", "mafʿūl", "maf'uul"):
        d = search(q, limit=10)
        assert d["detected"]["kind"] == "pattern" and d["detected"]["pattern"] == "maf3uul", q
        assert d["totals"]["lemmas"] == pat["lemma_count"]
    words = _page_all("maf3uul", "lemmas", "slug")
    assert len(words) == len(set(words)) == pat["lemma_count"]
    one = client.get("/api/v1/search", params={"q": "maf3uul", "limit": 100}).json()["results"]["lemmas"]
    assert {x["pattern"] for x in one} == {"maf3uul"}
    # unvowelled, the same letters are a word first, with the pattern offered beside it
    d = search("مفعول")
    assert d["detected"]["kind"] == "arabic_word" and "maf3uul" in [
        p["slug"] for p in d["results"]["patterns"]
    ]


def test_totals_count_the_matches_and_paging_reaches_them_all() -> None:
    """SRC-12, SRC-23: a count is the number of matches, not of the results returned."""
    d = search("mercy", limit=5)
    assert len(d["results"]["verses"]) == 5 and d["totals"]["verses"] > 5
    keys = _page_all("mercy", "verses", "key")
    assert len(keys) == len(set(keys)) == d["totals"]["verses"]


def test_latin_queries_are_told_apart() -> None:
    """SRC-41: a transliteration (signs, chat digits, or a Quranic word's spelling) or an English gloss."""
    for q in ("kitāb", "3ilm", "kitab"):
        assert search(q)["detected"]["kind"] == "translit", q
    for q in ("knowledge", "mercy"):
        assert search(q)["detected"]["kind"] == "english", q


def test_a_range_lists_its_verses() -> None:
    """SRC-Q01: 2:255-257 and ٢:٢٥٥-٢٥٧ list the three verses in order."""
    for q in ("2:255-257", "٢:٢٥٥-٢٥٧"):
        d = search(q)
        assert [v["key"] for v in d["results"]["verses"]] == ["2:255", "2:256", "2:257"], q


def test_the_root_builder_finds_hamza_and_alef_maqsura_roots() -> None:
    """SRC-15: أ إ آ ؤ ئ are the stored ء, and ى the stored ي."""

    def keys(**ls: str) -> list[str]:
        return [r["key"] for r in client.get("/api/v1/roots", params={**ls, "limit": 100}).json()["data"]]

    assert "أمن" in keys(l1="أ", l2="م") and keys(l1="أ", l2="م") == keys(l1="ء", l2="م")
    assert keys(l1="إ", l2="م") == keys(l1="ء", l2="م")
    assert "هدي" in keys(l1="ه", l2="د", l3="ى")


def test_roots_carry_their_meaning_and_dictionary_entries_are_found() -> None:
    """SRC-18: Ibn Fāris's statement on each root; SRC-Q03: dictionary entries with their work."""
    root = search("ع ل م")["results"]["roots"][0]
    assert root["gist_ar"].startswith("العين واللام والميم") and root["letters"] == ["ع", "ل", "م"]
    d = search("أمن")
    entries = d["results"]["dictionary"]
    assert entries and d["totals"]["dictionary"] >= len(entries)
    assert any(e["root_key"] == "أمن" and e["work"]["title_ar"] for e in entries)
    assert all("⁨" in (e["excerpt"] or "⁨") for e in entries)


def test_the_postgres_engine_answers_the_same_questions() -> None:
    """SRC-40: without OpenSearch, kitab still finds kitāb, a root still returns its family, a pattern its words."""
    from jadhr_api.db import connect
    from jadhr_api.search import search_pg

    with connect() as conn:
        assert search_pg(conn, "kitab", 5)["results"]["lemmas"][0]["slug"] == "kitab"
        fam = search_pg(conn, "ع ل م", 50)
        assert fam["totals"]["lemmas"] == client.get("/api/v1/roots/علم").json()["lemma_count"]
        assert len(fam["results"]["lemmas"]) == fam["totals"]["lemmas"]
        pat = search_pg(conn, "maf3uul", 200)
        assert {x["pattern"] for x in pat["results"]["lemmas"]} == {"maf3uul"}
        assert len(pat["results"]["lemmas"]) == pat["totals"]["lemmas"]


def test_the_same_search_can_be_asked_in_a_body_and_is_kept_nowhere() -> None:
    c = client
    got = c.get("/api/v1/search", params={"q": "علم", "limit": 5}).json()
    r = c.post("/api/v1/search", json={"q": "علم", "limit": 5})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert r.json()["detected"] == got["detected"] and r.json()["results"]["roots"] == got["results"]["roots"]
    assert c.post("/api/v1/search", json={"q": ""}).status_code == 422


def test_the_dictionary_is_searched_beyond_the_quran() -> None:
    """P11.1: a root the Quran does not have is found as typed and by its first letters; a word inside an article
    finds the article, which names the dictionary root it is filed under."""
    exact = search("قبعثر")["results"]["dict_roots"]
    assert exact[0]["key"] == "قبعثر" and exact[0]["quran_root"] is None and exact[0]["lexica"] >= 3
    assert "قبعثر" in {r["key"] for r in search("قبع")["results"]["dict_roots"]}
    # as a lexicon prints the heading: its root, the Quran's here
    assert search("سما")["results"]["dict_roots"][0]["key"] == "سمو"
    word = search("القبعثرى")["results"]["dictionary"]
    assert word and all(a["dict_root"] == "قبعثر" for a in word[:3])
    # no dictionary roots for a verse reference
    assert search("2:255")["results"].get("dict_roots", []) == []


def test_the_texts_beyond_the_quran_are_searched() -> None:
    """P11.4a: a hadith's words find the records that hold them, the phrase itself first, each with its collection,
    its kitāb and the bāb it is filed under and its words marked; the books' paragraphs holding them come as a group of
    their own (P11.3); the Postgres engine finds the passages holding the phrase; a page of them follows the one
    before; a verse reference or a Latin word asks nothing of them."""
    from jadhr_api.db import connect, rows
    from jadhr_api.search import search_pg

    q = "إنما الأعمال بالنيات"
    with connect() as conn:
        held: dict[str, set[str]] = {"hadith": set(), "book": set()}
        for r in rows(
            conn,
            """select p.uri, t.kind from content.passages p join content.texts t on t.id = p.text_id
                where p.verse_id is null and p.norm like :p""",
            {"p": "%انما الاعمال بالنيات%"},
        ):
            held[r["kind"]].add(r["uri"])
        pg = search_pg(conn, q, 40)
    assert len(held["hadith"]) >= 3 and len(held["book"]) >= 1
    for group, kind in (("texts", "hadith"), ("books", "book")):
        assert {h["uri"] for h in pg["results"][group]} == held[kind] and pg["totals"][group] == len(held[kind])
        assert {h["text"]["kind"] for h in pg["results"][group]} == {kind}
    d = search(q, limit=40)
    found = d["results"]["texts"]
    assert {h["uri"] for h in found[: len(held["hadith"])]} == held["hadith"]
    assert d["totals"]["texts"] >= len(held["hadith"])
    for h in found[: len(held["hadith"])]:
        assert h["excerpt"].count("⁨") >= 3 and h["text"]["title_ar"] and h["top"]["title_ar"]
    books = d["results"]["books"]
    assert {h["uri"] for h in books[: len(held["book"])]} == held["book"] and {h["text"]["kind"] for h in books} == {"book"}
    first = next(h for h in found if h["uri"] == "hadith:bukhari:1")
    assert first["chapter"]["title_ar"].startswith("باب كيف كان بدء الوحي") and first["start"]
    # paging one kind: the second page follows the first
    pages = [
        client.get("/api/v1/search", params={"q": q, "only": "texts", "limit": 2, "offset": o}).json()
        for o in (0, 2)
    ]
    assert [h["uri"] for p in pages for h in p["results"]["texts"]] == [h["uri"] for h in found[:4]]
    assert all(p["results"]["books"] == [] for p in pages)
    more = client.get("/api/v1/search", params={"q": q, "only": "books", "limit": 1, "offset": 1}).json()
    assert [h["uri"] for h in more["results"]["books"]] == [h["uri"] for h in books[1:2]]
    assert search("2:255")["results"]["books"] == [] and search("kitab")["results"]["books"] == []
    assert search("2:255")["results"]["texts"] == [] and search("kitab")["results"]["texts"] == []


def test_the_meanings_are_searched_in_the_sources_words() -> None:
    """B12: a query finds the verses whose tafsir, gharīb meaning or translation holds it — every verse whose Arabic
    sources hold the word whole (counted in Postgres, marks aside) and more by its stems (والصبر, بالصبر); each verse
    once, counted once, paged to the end; up to three sources a verse, each credited to its work with the words marked;
    English finds the translations alone; a verse reference asks nothing of them."""
    from jadhr_api.db import connect, rows, scalar

    marks = "[" + chr(0x064B) + "-" + chr(0x065F) + chr(0x0670) + chr(0x0640) + "]"
    letters = chr(0x0621) + "-" + chr(0x064A)

    def whole(w: str) -> str:
        return f"(^|[^{letters}]){w}([^{letters}]|$)"

    with connect() as conn:
        held = {
            r["key"]
            for r in rows(
                conn,
                """select v.key from content.work_passages p join content.works w on w.id = p.work_id
                     join content.verses v on v.id = p.verse_from
                    where w.lang = 'ar' and regexp_replace(p.text, :m, '', 'g') ~ :w
                   union select g.verse_keys[1] from content.gharib_meanings g
                    where regexp_replace(g.phrase_ar || ': ' || g.meaning_ar, :m, '', 'g') ~ :w""",
                {"m": marks, "w": whole("الصبر")},
            )
        }
        held_en = {
            r["key"]
            for r in rows(
                conn,
                """select distinct v.key from content.work_passages p join content.works w on w.id = p.work_id
                     join content.verses v on v.id = p.verse_from where w.lang = 'en' and p.text ~* '\\mpatience\\M'""",
            )
        }
        lang = {r["id"]: r["lang"] for r in rows(conn, "select id, lang from content.works")}
        gharib = {r["id"] for r in rows(conn, "select id from content.gharib_works")}
        docs = int(
            scalar(
                conn,
                "select (select count(*) from content.work_passages) + (select count(*) from content.gharib_meanings)",
            )
        )
    assert len(held) > 50 and held_en
    assert searchindex.status()["indices"]["meanings"]["documents"] == docs

    def every(q: str) -> list[dict]:
        seen: list[dict] = []
        while True:
            r = client.get(
                "/api/v1/search", params={"q": q, "only": "meanings", "limit": 100, "offset": len(seen)}
            ).json()
            if not r["results"]["meanings"]:
                return seen
            seen += r["results"]["meanings"]

    d = search("الصبر", limit=10)
    found = every("الصبر")
    keys = [m["verse"]["key"] for m in found]
    assert len(keys) == len(set(keys)) == d["totals"]["meanings"]
    assert held <= set(keys) and len(keys) > len(held)
    assert [m["verse"]["key"] for m in d["results"]["meanings"]] == keys[:10]
    with connect() as conn:
        qpc = {
            r["key"]: r["text_qpc"]
            for r in rows(conn, "select key, text_qpc from content.verses where key = any(:k)", {"k": keys})
        }
    kinds: set[str] = set()
    for m in found:
        assert m["verse"]["text_qpc"] == qpc[m["verse"]["key"]] and m["verse"]["name_ar"]
        assert 1 <= len(m["sources"]) <= 3
        for s in m["sources"]:
            kinds.add(s["kind"])
            assert s["kind"] in ("tafsir", "gharib") and s["work"]["title_ar"]
            assert (s["work"]["id"] in gharib) if s["kind"] == "gharib" else lang[s["work"]["id"]] == "ar"
            assert "⁨" in s["excerpt"] and "⁩" in s["excerpt"]
    assert kinds == {"tafsir", "gharib"}
    en = every("patience")
    assert held_en <= {m["verse"]["key"] for m in en}
    for m in en:
        for s in m["sources"]:
            assert s["kind"] == "translation" and lang[s["work"]["id"]] == "en" and s["work"]["title_en"]
            assert "⁨" in s["excerpt"]
    assert search("2:255")["results"]["meanings"] == [] and search("2:255")["totals"].get("meanings", 0) == 0


def test_a_failed_statement_in_the_index_path_still_falls_back_to_postgres(monkeypatch: pytest.MonkeyPatch) -> None:
    """The index path shares the request's connection: a statement of its that fails (a cold cache over the statement
    timeout, as after a restart) leaves the transaction aborted, and the fallback must not inherit it."""
    from jadhr_api import search_os
    from sqlalchemy import text

    def failing(conn, *_):
        conn.execute(text("select 1 / 0"))

    monkeypatch.setattr(search_os, "search", failing)
    r = client.get("/api/v1/search", params={"q": "علم", "limit": 6})
    assert r.status_code == 200, r.text[:300]
    assert r.json()["engine"] == "postgres" and r.json()["results"]["lemmas"]
