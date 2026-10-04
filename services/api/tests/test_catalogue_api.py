"""The catalogue (P11.3a): the works the D9 gate lets in, found by title and author, browsed by the century their
authors died in, each linked to where its text is read. Expected numbers come from the build's report and the
registry, never typed in."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jadhr_api.main import app
from jadhr_arabic import normalize

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]
REPORT = json.loads((REPO / "data/build/2026.10.0/report.json").read_text(encoding="utf-8"))["catalogue"]
BOOKS = yaml.safe_load((REPO / "data/books.yaml").read_text(encoding="utf-8"))["books"]


def get(**params: object) -> dict:
    r = client.get("/api/v1/catalogue", params=params)
    assert r.status_code == 200, (r.status_code, r.text[:300])
    return r.json()


def test_the_catalogue_holds_the_works_the_gate_lets_in_in_the_order_their_authors_died() -> None:
    c = get(limit=100)
    assert c["all"] == c["total"] == REPORT["in"] and sum(x["n"] for x in c["centuries"]) == REPORT["in"]
    deaths = [w["death_ah"] for w in c["data"]]
    assert deaths == sorted(deaths) and len(c["data"]) == 100
    assert c["source"]["id"] == "openiti-catalogue" and c["source"]["license"] == "CC BY-NC-SA 4.0"


def test_a_century_holds_the_works_of_authors_who_died_in_it() -> None:
    four = get(century=4, limit=100)
    assert four["total"] == next(x["n"] for x in get()["centuries"] if x["century"] == 4)
    assert all(301 <= w["death_ah"] <= 400 and not w["before_islam"] for w in four["data"])
    poets = get(century=0, limit=100)
    assert poets["total"] == REPORT["before_islam"] and all(w["before_islam"] for w in poets["data"])


def test_a_work_is_found_by_its_title_or_author_and_linked_to_where_it_is_read() -> None:
    found = get(q="جامع البيان", limit=100)
    assert all("جامع البيان" in normalize(w["title_ar"] + " " + w["author_ar"]) for w in found["data"])
    tabari = next(w for w in found["data"] if w["work"] == "0310Tabari.JamicBayan")
    assert tabari["shelf"] == "tabari-jamicbayan"
    assert tabari["links"] == {
        "openiti": "https://github.com/OpenITI/RELEASE/tree/v2025.1.9/data/0310Tabari/0310Tabari.JamicBayan",
        "shamela": "https://shamela.ws/book/7798",
        "turath": "https://app.turath.io/book/7798",
    }
    shelf = get(shelf="true", limit=100)
    assert {w["shelf"] for w in shelf["data"]} == {b["slug"] for b in BOOKS} and shelf["total"] == len(BOOKS)
    assert get(q="لا يوجد عمل بهذا الاسم ابدا")["total"] == 0
    assert client.get("/api/v1/catalogue", params={"century": 15}).status_code == 422
