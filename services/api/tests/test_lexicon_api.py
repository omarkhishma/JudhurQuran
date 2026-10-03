"""The lexeme-centred API (PLAN P1.3): envelope, word payload, patterns, glossary, texts.

Expected numbers are recomputed from other endpoints or the source files, never typed in."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jadhr_api.main import app
from jadhr_arabic import display_bare

client = TestClient(app)
REPO = Path(__file__).resolve().parents[3]


def get(path: str, **params: object) -> dict:
    r = client.get(path, params=params)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    return r.json()


def envelopes(obj: object) -> list[dict]:
    """Every {full, bare, translit} envelope anywhere in a payload."""
    found: list[dict] = []
    if isinstance(obj, dict):
        if set(obj) == {"full", "bare", "translit"}:
            found.append(obj)
        for v in obj.values():
            found += envelopes(v)
    elif isinstance(obj, list):
        for v in obj:
            found += envelopes(v)
    return found


def test_every_arabic_string_in_the_word_payload_is_an_envelope() -> None:
    d = get("/api/v1/words/ilm", at="2:32:4")
    envs = envelopes(d)
    assert len(envs) > 20
    for e in envs:
        assert e["bare"] == display_bare(e["full"])
        assert e["translit"]


def test_word_payload_ties_out_with_the_root_and_the_occurrence() -> None:
    d = get("/api/v1/words/ilm", at="2:32:4")
    assert d["ar"]["full"] == "عِلْم"  # عِلْم
    assert d["root"]["key"] == "علم"
    root = get("/api/v1/roots/علم")
    assert d["root"]["occurrences"] == root["occurrences"]
    assert sum(len(g["members"]) for g in d["family"]) == root["lemma_count"]
    # every family member's occurrences add up to the root's
    assert sum(m["occurrences"] for g in d["family"] for m in g["members"]) == root["occurrences"]
    assert d["occurrence"]["location"] == "2:32:4"
    assert d["attestations"]["total"] == d["corpus_freq"]
    assert d["attestations"]["meccan"] + d["attestations"]["medinan"] == d["corpus_freq"]
    assert sum(c["occurrences"] for c in d["attestations"]["by_chapter"]) == d["corpus_freq"]
    assert [s["kind"] for s in d["next_steps"]] == ["cousin", "verse", "pattern"]
    assert d["senses_status"] in ("pending", "linked")


def test_next_steps_are_deterministic() -> None:
    a = get("/api/v1/words/ilm")["next_steps"]
    b = get("/api/v1/words/ilm")["next_steps"]
    assert a == b


def test_occurrence_must_belong_to_the_word() -> None:
    # 1:1:1 is بِسْمِ, not عِلْم: the payload comes back without an occurrence
    d = get("/api/v1/words/ilm", at="1:1:1")
    assert d["occurrence"] is None
    assert client.get("/api/v1/words/ilm", params={"at": "nonsense"}).status_code == 400


def test_location_resolves_to_its_lemma_slug() -> None:
    assert get("/api/v1/locations/2:32:4/word")["slug"] == "ilm"
    assert get("/api/v1/locations/1:1:2/word")["slug"] == "allah"


def test_attestations_page_through_every_occurrence() -> None:
    total = get("/api/v1/words/ilm")["corpus_freq"]
    seen, cursor = 0, None
    while True:
        page = get("/api/v1/words/ilm/attestations", limit=40, **({"cursor": cursor} if cursor else {}))
        seen += len(page["data"])
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == total


def test_pattern_lists_its_lemmas() -> None:
    p = get("/api/v1/patterns/faa3il")
    assert p["ar"]["full"] == "فَاعِل"  # فَاعِل
    assert len(p["members"]) == min(p["lemma_count"], 200)
    all_patterns = get("/api/v1/patterns")["data"]
    assert len({x["slug"] for x in all_patterns}) == len(all_patterns)
    # every lemma with a pattern is counted exactly once across the catalogue (recomputed from the build)
    version = get("/api/v1/meta")["dataset"]["version"]
    lemmas = [json.loads(x) for x in (REPO / "data/build" / version / "lemmas.jsonl").open(encoding="utf-8")]
    assert sum(x["lemma_count"] for x in all_patterns) == sum(1 for x in lemmas if x["pattern"])
    assert len(all_patterns) == len({x["pattern"] for x in lemmas if x["pattern"]})


def test_glossary_serves_every_term_in_the_data_file() -> None:
    expected = yaml.safe_load((REPO / "data/glossary.yaml").read_text(encoding="utf-8"))["terms"]
    terms = get("/api/v1/glossary")["terms"]
    assert [t["key"] for t in terms] == [t["key"] for t in expected]
    assert all(t["label_ar"] and t["label_en"] and t["body_ar"] and t["body_en"] for t in terms)


def test_quran_is_a_text_with_114_chapters() -> None:
    shelf = get("/api/v1/texts")["data"]
    quran = next(t for t in shelf if t["slug"] == "quran")
    surahs = get("/api/v1/surahs")["data"]
    assert quran["passage_count"] == sum(s["verse_count"] for s in surahs)
    detail = get("/api/v1/texts/quran")
    assert [c["ordinal"] for c in detail["chapters"]] == list(range(1, 115))
    assert [c["passage_count"] for c in detail["chapters"]] == [s["verse_count"] for s in surahs]


def test_dictionaries_carry_licences() -> None:
    for d in get("/api/v1/dictionaries")["data"]:
        assert d["license"] and d["attribution_ar"] and d["attribution_en"]


def test_root_gist_is_ibn_faris_statement_cited_by_its_entry() -> None:
    """P3.4: the root record's Arabic core idea is Maqāyīs's statement, the same text the entry shows."""
    w = get("/api/v1/words/karim", limit=0)
    assert w["root"]["gist_ar"] == w["core_meaning"]["text"]
    assert w["root"]["gist_source"] == {
        "work_id": "maqayis",
        "entry_id": w["core_meaning"]["entry_id"],
        "page_ref": w["core_meaning"]["page_ref"],
        "usul": "several",  # «أصلٌ صحيح له بابان»: two uṣūl (P3.7a)
    }
    assert (
        " … والأصل الآخر" in w["root"]["gist_ar"]
    )  # both uṣūl of ك ر م, the second where Ibn Fāris turns to it


def test_word_audio_is_a_slice_of_the_teaching_recitation_with_its_flags() -> None:
    """P3.7, D10: every word is heard from al-Ḥuṣarī's teaching recitation; what keeps a slice from being
    clean is flagged from the text and the alignment; an untimed word has no audio at all."""
    huda = get("/api/v1/words/huda", at="2:2:6", limit=0)["occurrence"]["audio"]
    assert huda["reciter_id"] == "husary-muallim" and "Husary_Muallim_128kbps/002002.mp3" in huda["url"]
    assert 0 <= huda["start_ms"] < huda["end_ms"]
    assert "joined" in huda["flags"]  # «هُدٗى لِّلۡمُتَّقِينَ»: the tanwīn runs into the doubled lām
    assert "wasl" in get("/api/v1/words/allah", at="1:1:2", limit=0)["occurrence"]["audio"]["flags"]
    assert get("/api/v1/words/alim", at="2:181:13", limit=0)["occurrence"]["audio"] is None
    reciters = get("/api/v1/recitations")["data"]
    assert [r["id"] for r in reciters if r.get("word_audio")] == ["husary-muallim"]


def test_verse_and_surah_lexical_profiles_are_consistent() -> None:
    """P3.6: a verse's band counts add up to its words and its level follows the rare share; a sūra sums its verses."""
    v = get("/api/v1/verses/2:255")
    p = v["lexical_profile"]
    assert p["words"] == sum(p[b] for b in ("c100", "c20", "c5", "c2", "c1")) > 0
    rare = (p["words"] - p["c100"] - p["c20"]) / p["words"]
    assert (
        v["lexical_level"]
        == p["level"]
        == (1 if rare == 0 else 2 if rare <= 0.15 else 3 if rare <= 0.30 else 4 if rare <= 0.50 else 5)
    )
    mulk = next(s for s in get("/api/v1/surahs")["data"] if s["number"] == 67)
    assert sum(mulk["lexical_profile"]["verse_levels"].values()) == mulk["verse_count"]


def test_mushaf_signs_and_the_signs_on_a_word() -> None:
    """P3.9: the eight signs with their source, and the sign written on a word (رَيۡبَۛ in 2:2: muʿānaqa)."""
    d = get("/api/v1/mushaf-signs")
    assert [s["id"] for s in d["data"]][:5] == ["lazim", "qila", "jaiz", "sila", "muanaqa"]
    assert d["source"]["attribution_ar"].startswith("«التعريف بهذا المصحف»")
    assert get("/api/v1/words/rayb", at="2:2:4", limit=0)["occurrence"]["signs"] == ["muanaqa"]
    assert get("/api/v1/words/ilm", at="20:114:17", limit=0)["occurrence"]["signs"] == []
