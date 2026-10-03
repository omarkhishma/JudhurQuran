"""The concordance of a root (P4, CON-01…39, CON-Q01…Q09): totals, filters, sorts, distribution, CSV.

Every expectation is recomputed from other endpoints or the build, never typed in."""

from __future__ import annotations

from fastapi.testclient import TestClient
from jadhr_api.main import app
from jadhr_arabic import normalize

client = TestClient(app)


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def test_total_matches_the_root_and_pages_cover_every_line_once() -> None:
    root = get("/api/v1/roots/علم")
    first = get("/api/v1/concordance", root="علم", limit=500)
    assert first["total"] == root["occurrences"]
    rest = get("/api/v1/concordance", root="علم", limit=500, offset=500)
    locs = [x["location"] for x in first["data"] + rest["data"]]
    assert len(locs) == len(set(locs)) == root["occurrences"]
    # mushaf order: sūra, āya, word
    order = [(x["surah"], x["ayah"], x["position"]) for x in first["data"]]
    assert order == sorted(order)


def test_kwic_lines_rebuild_their_verse() -> None:
    d = get("/api/v1/concordance", root="رحم", limit=20)
    for x in d["data"]:
        v = get(f"/api/v1/verses/{x['verse_key']}")
        assert " ".join(p for p in (x["left"], x["keyword"], x["right"]) if p) == " ".join(
            t["text"] for t in v["tokens"]
        )


def test_filters_narrow_and_facets_count() -> None:
    d = get("/api/v1/concordance", root="علم", limit=1)
    lemma = d["facets"]["lemmas"][0]
    by_lemma = get("/api/v1/concordance", root="علم", lemma=lemma["slug"], limit=1)
    assert by_lemma["total"] == lemma["n"]
    pat = d["facets"]["patterns"][0]
    assert get("/api/v1/concordance", root="علم", pattern=pat["slug"], limit=1)["total"] == pat["n"]
    s = d["facets"]["surahs"][1]
    assert get("/api/v1/concordance", root="علم", surah=s["surah"], limit=1)["total"] == s["n"]
    mec = get("/api/v1/concordance", root="علم", place="meccan", limit=1)["total"]
    med = get("/api/v1/concordance", root="علم", place="medinan", limit=1)["total"]
    assert mec + med == d["total"]


def test_sorts_follow_the_context_outward_from_the_keyword() -> None:
    fol = get("/api/v1/concordance", root="كتب", sort="following", limit=500)["data"]
    keys = [normalize(x["right"]) for x in fol]
    assert keys == sorted(keys)
    pre = get("/api/v1/concordance", root="كتب", sort="preceding", limit=500)["data"]
    keys = [" ".join(reversed(normalize(x["left"]).split())) for x in pre]
    assert keys == sorted(keys)


def test_distribution_adds_up_and_leaves_particles_out_of_collocates() -> None:
    d = get("/api/v1/concordance/distribution", root="علم")
    assert sum(s["hits"] for s in d["per_surah"]) == d["total"] == sum(d["place"].values())
    assert sum(f["n"] for f in d["forms"]) == d["total"]
    for s in d["per_surah"][:5]:
        assert round(100 * s["hits"] / s["words"], 2) == s["per100"]
    slugs = {c["slug"] for c in d["collocates"]}
    assert "min" not in slugs and "fi" not in slugs  # prepositions are never collocates


def test_csv_has_a_bom_an_ascii_name_and_every_line() -> None:
    r = client.get("/api/v1/concordance.csv", params={"root": "علم"})
    assert r.status_code == 200
    assert r.content.startswith(b"\xef\xbb\xbf")
    assert 'filename="concordance-3-l-m.csv"' in r.headers["content-disposition"]
    lines = r.content.decode("utf-8-sig").strip().split("\r\n")
    assert len(lines) == 1 + get("/api/v1/roots/علم")["occurrences"]
    assert client.get("/api/v1/concordance", params={"root": "zzz"}).status_code == 404


def test_juz_and_part_of_speech_facets_count_and_filter() -> None:
    d = get("/api/v1/concordance", root="علم", limit=1)
    assert sum(j["n"] for j in d["facets"]["juz"]) == d["total"]
    assert sum(p["n"] for p in d["facets"]["pos"]) == d["total"]
    j = d["facets"]["juz"][3]
    by_juz = get("/api/v1/concordance", root="علم", juz=j["juz"], limit=500)
    assert by_juz["total"] == j["n"]
    for x in by_juz["data"]:
        assert get(f"/api/v1/verses/{x['verse_key']}")["juz"] == j["juz"] == x["juz"]
    for p in d["facets"]["pos"]:
        assert p["ar"] and p["en"]
        lines = get("/api/v1/concordance", root="علم", pos=p["tag"], limit=500)
        assert lines["total"] == p["n"]
        assert {x["pos"] for x in lines["data"]} == {p["tag"]}


def test_a_surface_form_from_the_distribution_filters_the_lines() -> None:
    d = get("/api/v1/concordance/distribution", root="علم")
    f = d["forms"][2]
    lines = get("/api/v1/concordance", root="علم", form=f["form"], limit=500)
    assert lines["total"] == f["n"]
    assert {x["form"] for x in lines["data"]} == {f["form"]}


def test_a_collocate_filters_the_lines_to_hits_with_it_nearby() -> None:
    d = get("/api/v1/concordance/distribution", root="علم")
    c = d["collocates"][0]
    lines = get("/api/v1/concordance", root="علم", near=c["slug"], limit=500)
    assert 0 < lines["total"] <= c["n"]
    for x in lines["data"][:40]:
        words = get(f"/api/v1/verses/{x['verse_key']}")["words"]
        near = [
            w["lemma_slug"]
            for w in words
            if abs(w["position"] - x["position"]) <= 2 and w["location"] != x["location"]
        ]
        assert c["slug"] in near, (x["location"], c["slug"], near)


def test_each_line_can_carry_its_verse_in_a_translation_with_the_work_named() -> None:
    d = get("/api/v1/concordance", root="رحم", limit=30, tr="saheeh")
    assert d["translation"]["title_en"] == "Saheeh International"
    by_surah: dict[int, dict] = {}
    for x in d["data"]:
        if x["surah"] not in by_surah:
            by_surah[x["surah"]] = get(f"/api/v1/works/saheeh/surahs/{x['surah']}")
        expected = next(
            p["text"]
            for p in by_surah[x["surah"]]["passages"]
            if p["from_surah"] == x["surah"] and p["from_ayah"] <= x["ayah"] <= p["to_ayah"]
        )
        assert x["translation"] == expected
    assert get("/api/v1/concordance", root="رحم", limit=1)["translation"] is None


def test_the_distribution_follows_the_filters_and_gives_revelation_order() -> None:
    mec = get("/api/v1/concordance/distribution", root="علم", place="meccan")
    assert mec["total"] == get("/api/v1/concordance", root="علم", place="meccan", limit=1)["total"]
    assert {s["place"] for s in mec["per_surah"]} == {"meccan"}
    orders = {
        s["surah"]: s["revelation_order"]
        for s in get("/api/v1/concordance/distribution", root="علم")["per_surah"]
    }
    surahs = {s["number"]: s for s in get("/api/v1/surahs")["data"]}
    assert all(orders[n] == surahs[n]["revelation_order"] for n in orders)


def test_csv_names_the_translation_and_gives_the_root() -> None:
    r = client.get("/api/v1/concordance.csv", params={"root": "علم", "tr": "saheeh", "place": "medinan"})
    assert r.status_code == 200
    import csv
    import io

    table = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert (
        table[0][-1]
        == "translation: Saheeh International (Saheeh International — issued by Noor International Center)"
    )
    assert table[0][7] == "root" and {row[7] for row in table[1:]} == {"علم"}
    assert all(row[-1] for row in table[1:])
    assert len(table) - 1 == get("/api/v1/concordance", root="علم", place="medinan", limit=1)["total"]
