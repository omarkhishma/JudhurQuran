"""The books (P11.3): a book's card read from its version, its sections, a section's paragraphs cut into their words with
the editor's brackets marked, and each paragraph's citation — by printed page where the version's pages are cited, by
the editor's paragraph numbers where he numbers them, else by section. Expected values come from the raw files and
the database, never typed in."""

from __future__ import annotations

import re
from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jadhr_api.db import connect, rows
from jadhr_api.main import app

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]
BOOKS = {b["slug"]: b for b in yaml.safe_load((REPO / "data/books.yaml").read_text(encoding="utf-8"))["books"]}
DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def _first_section(slug: str) -> dict:
    b = get(f"/api/v1/texts/{slug}")
    top = next(c for c in b["chapters"] if c["total"])
    return get(f"/api/v1/texts/{slug}/chapters/{top['ordinal']}", limit=20, words="true")


def test_a_books_card_is_its_versions_header() -> None:
    b = get("/api/v1/texts/tabari-jamicbayan")
    raw = (REPO / "data/raw" / BOOKS["tabari-jamicbayan"]["file"]).read_text(encoding="utf-8")
    title = re.search(r"#META# 020\.BookTITLE\s*::\s*(.+)", raw).group(1).strip()
    editor = re.search(r"#META# 040\.EdEDITOR\s*::\s*(.+)", raw).group(1).strip()
    assert b["kind"] == "book" and b["title_ar"] == title and b["author_ar"] == "الطبري"
    assert b["info"]["edition"]["editor"] == editor and editor in b["meta_ar"]
    assert b["info"]["version"] == BOOKS["tabari-jamicbayan"]["version"] and b["source"]["id"] == "openiti-books"
    # its volumes are those its page markers name
    vols = {int(v) for v in re.findall(r"PageV(\d+)P\d+", raw)} - {0}
    assert b["info"]["volumes"] == len(vols) and b["info"]["pages_trusted"]


def test_a_paragraph_is_cited_by_the_printed_page_it_opens_on() -> None:
    ch = _first_section("zaydibncali-musnad")
    p = ch["passages"][0]
    v, page = p["meta"]["pages"][0]
    version = BOOKS["zaydibncali-musnad"]["version"]
    assert p["cite"] == {
        "key": f"urn:cts:arabicLit:{version}:{v}.{page}.{p['meta']['on_page']}",
        "ar": p["cite"]["ar"],
        "by": "page",
        "base": p["cite"]["base"],
    }
    # the author, the work and the editor, which a page of it is cited after (B56)
    assert p["cite"]["ar"].startswith(p["cite"]["base"] + "، ") and not re.search(r"ف[٠-٩]+$", p["cite"]["base"])
    # one volume: «ص٤٩، ف١»
    assert p["cite"]["ar"].endswith(f"ص{page}، ف{p['meta']['on_page']}".translate(DIGITS))
    # many volumes: «١/٣، ف٢»
    t = _first_section("tabari-jamicbayan")["passages"][0]
    tv, tp = t["meta"]["pages"][0]
    assert t["cite"]["ar"].endswith(f"{tv}/{tp}، ف{t['meta']['on_page']}".translate(DIGITS))
    assert t["cite"]["ar"].startswith("الطبري، ")
    # the paragraph's own page cites it the same way
    one = get(f"/api/v1/texts/zaydibncali-musnad/passages/{p['ref']}")
    assert one["cite"] == p["cite"] and one["segments"] == p["segments"]


def test_a_page_turning_inside_a_paragraph_is_placed_in_its_stored_text() -> None:
    """B56: each turn names a character of the stored text at which a word (or the punctuation after the last one)
    begins, a page after the paragraph's first and within its last, the run's last page no earlier than the one it
    opens; al-Ṭabarī's turn at «عن زيد القصار» opens the page its page-end marker names in the raw file."""
    raw = (REPO / "data/raw" / BOOKS["tabari-jamicbayan"]["file"]).read_text(encoding="utf-8")
    m = re.search(r"PageEndV(01)P(024)\s*\n~~(\S+ \S+ \S+)", raw)
    assert m and m.group(3) == "عن زيد القصار،"
    with connect() as conn:
        found = rows(
            conn,
            """select t.slug, p.ref, p.ar_full, p.meta from content.passages p join content.texts t on t.id = p.text_id
                where t.kind = 'book' and p.meta ? 'breaks'""",
        )
    assert len(found) > 10000
    word = re.compile(r"[ء-ي]")
    for r in found:
        text, meta = r["ar_full"], r["meta"]
        first, last = meta["pages"][0], meta["pages"][-1]
        for o, v, opens, to in meta["breaks"]:
            assert 0 < o < len(text) and not (word.match(text[o - 1]) and word.match(text[o])), (
                r["slug"],
                r["ref"],
            )
            assert first < [v, opens] <= [v, to] <= last, (r["slug"], r["ref"])
    para = next(
        r
        for r in found
        if r["slug"] == "tabari-jamicbayan"
        and any(r["ar_full"][o:].startswith("عن زيد القصار") for o, *_ in r["meta"]["breaks"])
    )
    turn = next(b for b in para["meta"]["breaks"] if para["ar_full"][b[0] :].startswith("عن زيد القصار"))
    assert turn[1:3] == [int(m.group(1)), int(m.group(2))]
    # served as stored, on the paragraph's own page and in its section
    one = get(f"/api/v1/texts/tabari-jamicbayan/passages/{para['ref']}")
    assert one["meta"]["breaks"] == para["meta"]["breaks"] and one["meta"]["pages"] == para["meta"]["pages"]


def test_a_book_whose_pages_are_not_cited_is_cited_by_section_or_by_the_editors_numbers() -> None:
    h = _first_section("hudhawwari-tafsir")
    p = h["passages"][0]
    assert p["cite"]["by"] == "section" and p["cite"]["key"].endswith(f":{p['chapter']}.{p['ordinal']}")
    r = _first_section("shafici-risala")["passages"]
    assert all(x["cite"]["by"] == "number" for x in r)
    numbered = next(x for x in r if x["meta"].get("editor_number"))
    assert numbered["cite"]["key"].endswith(f":n{numbered['meta']['editor_number']}")
    assert numbered["cite"]["ar"].endswith(f"ف{numbered['meta']['editor_number']}".translate(DIGITS))


def test_the_editors_brackets_are_marked_in_the_words() -> None:
    with connect() as conn:
        found = rows(
            conn,
            """select t.slug, p.ref, p.ar_full, p.meta->'editor' as spans from content.passages p
                 join content.texts t on t.id = p.text_id
                where t.kind = 'book' and p.meta ? 'editor' order by p.id limit 5""",
        )
    assert found
    for f in found:
        p = get(f"/api/v1/texts/{f['slug']}/passages/{f['ref']}")
        marked = "".join(s["t"] for s in p["segments"] if s.get("e"))
        assert marked == "".join(f["ar_full"][a:b] for a, b in f["spans"])
        assert all(f["ar_full"][a] == "[" and f["ar_full"][b - 1] == "]" for a, b in f["spans"])
        assert "".join(s["t"] for s in p["segments"]) == f["ar_full"]
