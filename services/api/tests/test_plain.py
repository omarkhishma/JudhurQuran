"""What readers write for others keeps no character that would reorder the page around it (security review L12)."""

from __future__ import annotations

from jadhr_api import plain, published

RLO, PDF, LRI, PDI, RLM, LRM, ALM = (chr(c) for c in (0x202E, 0x202C, 0x2066, 0x2069, 0x200F, 0x200E, 0x061C))


def test_running_text_loses_what_reorders_it_and_keeps_its_marks() -> None:
    assert plain.text(f"خريطة {RLO}evil{PDF} {LRI}x{PDI}") == "خريطة evil x"
    assert plain.text(f"كلمة {LRM}API{RLM} هنا {ALM}") == f"كلمة {LRM}API{RLM} هنا {ALM}"


def test_a_name_loses_every_direction_control() -> None:
    assert plain.name(f"{RLM}جذر{LRM} {RLO}x{PDF}{ALM}") == "جذر x"


def test_a_published_maps_title_and_description_are_cleaned_as_they_are_saved() -> None:
    doc = {"version": 1, "id": "g", "title": "t", "nodes": [], "edges": []}
    out = published._content(f"{RLO}خريطة العلم{PDF}{RLM}", f"وصف {RLO}مقلوب{PDF} مع {LRM}API", "free", doc)
    assert out["title"] == "خريطة العلم"
    assert out["description"] == f"وصف مقلوب مع {LRM}API"
