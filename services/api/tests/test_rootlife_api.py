"""A root's life across the texts (P11.4b): the hadith and the books holding it, counted by text with the sure apart
from the possible, recounted here from the passages; each passage's marked word one of the root's, in what the
passage reports — never its isnād; a root asked by the Quran's key or the dictionary's."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.db import connect, one, rows
from jadhr_api.main import app
from jadhr_api.texts import segments

client = TestClient(app)


def get(key: str, **params: object) -> dict:
    r = client.get(f"/api/v1/roots/{key}/texts", params=params)
    assert r.status_code == 200, (r.status_code, r.text[:300])
    return r.json()


def test_a_roots_passages_are_counted_by_text_the_sure_apart_from_the_possible() -> None:
    d = get("علم")
    with connect() as conn:
        expected = {
            (r["slug"], r["sure"], r["possible"])
            for r in rows(
                conn,
                """select t.slug,
                          sum(case when 'علم' = any(p.roots) then 1 else 0 end)::int as sure,
                          sum(case when 'علم' = any(p.roots_low) then 1 else 0 end)::int as possible
                     from content.passages p join content.texts t on t.id = p.text_id
                    where t.kind <> 'quran' group by t.slug
                   having sum(case when 'علم' = any(p.roots) or 'علم' = any(p.roots_low) then 1 else 0 end) > 0""",
            )
        }
    assert {(c["slug"], c["sure"], c["possible"]) for c in d["counts"]} == expected
    assert d["total"] == sum(c["sure"] for c in d["counts"])
    for kind in ("hadith", "book"):
        assert d["totals"][kind]["sure"] == sum(c["sure"] for c in d["counts"] if c["kind"] == kind)
    books = get("علم", kind="book", which="possible", limit=5)
    assert books["total"] == d["totals"]["book"]["possible"] and all(not h["sure"] for h in books["data"])
    one_text = get("علم", text="tabari-jamicbayan", limit=5)
    assert {h["text"]["slug"] for h in one_text["data"]} == {"tabari-jamicbayan"}


def test_the_marked_word_is_the_roots_and_stands_in_the_report() -> None:
    d = get("زهر", kind="hadith", limit=40)
    assert d["data"]
    with connect() as conn:
        for h in d["data"]:
            p = one(
                conn,
                "select ar_full, form_ids, meta from content.passages where uri = :u",
                {"u": h["uri"]},
            )
            k = h["kwic"]
            assert k is not None and k["word"]
            text = p["ar_full"]
            # the word stands in the text where its context says, and its form reads to the root
            at = text.index(k["before"].lstrip("…") + k["word"])
            start = at + len(k["before"].lstrip("…"))
            segs, ids = segments(text, p["form_ids"])
            pos = 0
            fid = None
            for s in segs:
                if "w" in s and pos == start:
                    fid = ids[s["w"]]
                pos += len(s["t"])
            form = one(conn, "select readings from content.text_forms where id = :i", {"i": fid})
            assert any(r.get("dict_root") == "زهر" for r in form["readings"])
            # in the report: after the isnād, outside a narrator's name («الزهري» is never marked)
            split = p["meta"].get("split")
            if split and split.get("matn"):
                assert start >= split["matn"][0]
            assert not any(a <= start < b for a, b in p["meta"].get("names") or [])


def test_a_root_is_asked_by_the_qurans_key_or_the_dictionarys() -> None:
    with connect() as conn:
        pair = one(
            conn,
            """select d.key, d.quran_root from content.dict_roots d
                where d.quran_root is not null and d.quran_root <> d.key limit 1""",
        )
    if pair:
        assert get(pair["quran_root"], limit=1)["root"]["key"] == pair["key"]
    assert get("علم", limit=1)["root"] == {"key": "علم", "display": "علم", "quran_root": "علم"}
    assert client.get("/api/v1/roots/ءءء/texts").status_code == 404
    assert client.get("/api/v1/roots/علم/texts", params={"kind": "quran"}).status_code == 422


def test_the_timeline_holds_the_texts_by_their_compilers_death_each_marked_where_it_holds_the_root() -> None:
    """P11.2, P3.5: the panel's timeline carries the hadith collections and the books after the Quran, each at its
    compiler's death year, attesting the root where its passages hold it, with the build's count."""
    with connect() as conn:
        slug = one(
            conn,
            """select l.slug from content.lemmas l join content.roots r on r.id = l.root_id
                where r.key = 'علم' order by l.occurrences desc limit 1""",
        )["slug"]
        bukhari = one(
            conn,
            """select count(*)::int as n from content.passages p join content.texts t on t.id = p.text_id
                where t.slug = 'bukhari' and 'علم' = any(p.roots)""",
        )["n"]
        texts = {
            r["slug"]: r["era_year"]
            for r in rows(conn, "select slug, era_year from content.texts where kind <> 'quran'")
        }
    w = client.get(f"/api/v1/words/{slug}").json()
    corpora = {c["id"]: c for c in w["timeline"]["corpora"]}
    assert corpora["quran"]["year"] == 632 and corpora["quran"]["attests"]
    assert corpora["bukhari"]["count"] == bukhari and corpora["bukhari"]["attests"]
    assert {k: c["year"] for k, c in corpora.items() if k != "quran"} == texts
    years = [c["year"] for c in w["timeline"]["corpora"]]
    assert years == sorted(years)


def test_a_readers_known_words_are_counted_in_each_text_and_kept_nowhere() -> None:
    """LIB-Q08: how many of each text's Quranic words (content lemmas, where the rules are sure) the reader knows —
    asked in a body, answered no-store; the counts recomputed here from the passages' forms."""
    with connect() as conn:
        known = [
            r["slug"]
            for r in rows(conn, "select slug from content.lemmas order by occurrences desc limit 50")
        ]
        expected = one(
            conn,
            """select count(distinct (f.readings->0->>'lemma_id')::int) as n
                 from content.passages p join content.texts t on t.id = p.text_id,
                      unnest(p.form_ids) fid join content.text_forms f on f.id = fid
                where t.slug = 'nawawi-riyadsalihin' and f.kind in ('form', 'clitic')
                  and f.readings->0->>'lemma_id' is not null""",
        )["n"]
    r = client.post("/api/v1/texts/known", json={"lemmas": known})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    by = {x["slug"]: x for x in r.json()["data"]}
    assert set(by) >= {"bukhari", "tabari-jamicbayan"} and "quran" not in by
    assert all(0 < x["known"] <= x["total"] <= 4832 for x in by.values())
    # a text's total is at most the lemmas its sure forms name (content words only, the report's words only)
    assert 0 < by["nawawi-riyadsalihin"]["total"] <= expected
    nothing = {
        x["slug"]: x["known"] for x in client.post("/api/v1/texts/known", json={"lemmas": []}).json()["data"]
    }
    assert set(nothing.values()) == {0}
