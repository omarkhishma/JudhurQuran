"""Word boundaries refined against the audio (P3.7, D10): touching words meet at the quietest frame near
the aligner's boundary; words separated by a pause keep the aligner's edges; the dip depth is recorded."""

from __future__ import annotations

import pytest

np = pytest.importorskip("numpy")  # the audio extra: uv run --extra audio pytest …

from jadhr_pipeline.recitation_refine import refine_verse  # noqa: E402


def _energy(ms: int, quiet: dict[int, float]) -> np.ndarray:
    e = np.full(ms // 10, 60.0)
    for frame, level in quiet.items():
        e[frame] = level
    return e


def test_touching_words_meet_at_the_quietest_frame_and_the_dip_is_kept() -> None:
    # two words 0–1000 and 1010–2000 ms; the real gap is at 1060 ms (frame 106), 20 dB down
    out = refine_verse([[0, 1, 0, 1000], [1, 2, 1010, 2000]], _energy(2100, {106: 40.0}))
    assert out[0][3] == out[1][2] == 1065
    assert out[0][5] == out[1][4] == 20.0


def test_a_pause_between_words_is_left_alone() -> None:
    # 2:2-like: the reciter stops for 3.7 s; moving the edges would pull silence into the words
    segs = [[0, 1, 850, 4700], [1, 2, 8400, 8730]]
    out = refine_verse(segs, _energy(9000, {650: 10.0}))
    assert [s[:4] for s in out] == segs and out[0][5] is None and out[1][4] is None


def test_the_boundary_never_moves_past_the_middle_of_either_word() -> None:
    # the quiet frame lies inside the second word's first half: only reachable up to its middle
    out = refine_verse([[0, 1, 0, 400], [1, 2, 410, 600]], _energy(700, {58: 0.0}))
    assert out[0][3] <= 410 + (600 - 410) // 2 + 10
