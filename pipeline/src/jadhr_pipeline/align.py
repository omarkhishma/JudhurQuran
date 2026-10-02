"""Monotonic token alignment between two spellings/segmentations of the same verse.

Used for:
* QPC display tokens  ↔ corpus (QAC) words      — 3 QPC fusions (لَّوۡمَا، مَالِيَ، وَمَالِيَ)
* Tanzil Uthmani tokens ↔ corpus words           — 4 corpus fusions (بَعْدَ مَا ×3, إِلْ يَاسِينَ)
* Tanzil Uthmani tokens ↔ Tanzil imlāʾī tokens   — vocative splits (يَٰٓأَيُّهَا → يا أيها) etc.

A dynamic programme over group moves (1:1, 1:2, 2:1, 1:3, 3:1, 2:2) finds the
segmentation where every group's keys match. If no zero-cost path exists the
verse is reported, never silently forced.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

MOVES = ((1, 1), (1, 2), (2, 1), (1, 3), (3, 1), (2, 2))


@dataclass(frozen=True)
class Group:
    left: tuple[int, ...]  # 0-based token indices on the left side
    right: tuple[int, ...]


class AlignmentError(ValueError):
    pass


def align(left: list[str], right: list[str], key: Callable[[str], str]) -> list[Group]:
    """Return the groups pairing left and right tokens; raise if they cannot be matched exactly."""
    lk = [key(t) for t in left]
    rk = [key(t) for t in right]
    n, m = len(lk), len(rk)
    inf = 10**9
    # cost[i][j]: min (number of non-1:1 groups) to align left[:i] with right[:j]; prefer 1:1 pairs.
    cost = [[inf] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if cost[i][j] >= inf:
                continue
            for di, dj in MOVES:
                ni, nj = i + di, j + dj
                if ni > n or nj > m:
                    continue
                if "".join(lk[i:ni]) != "".join(rk[j:nj]):
                    continue
                c = cost[i][j] + (0 if (di, dj) == (1, 1) else 1)
                if c < cost[ni][nj]:
                    cost[ni][nj] = c
                    back[ni][nj] = (di, dj)
    if cost[n][m] >= inf:
        raise AlignmentError(f"no exact alignment: {left!r} vs {right!r}")
    groups: list[Group] = []
    i, j = n, m
    while i or j:
        step = back[i][j]
        assert step is not None
        di, dj = step
        groups.append(Group(tuple(range(i - di, i)), tuple(range(j - dj, j))))
        i, j = i - di, j - dj
    groups.reverse()
    return groups


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def align_fuzzy(
    left: list[str], right: list[str], key: Callable[[str], str], *, max_ratio: float = 0.34
) -> list[Group]:
    """Like ``align`` but tolerates small spelling differences inside a group (edit distance).

    Used only to attach an imlāʾī search spelling to each Uthmani word, where the rasm differs
    systematically (ٱلَّيْلِ / الليل, يَبْصُۜطُ / يبسط). Each group must stay within ``max_ratio``
    of its length; otherwise the verse is reported.
    """
    lk = [key(t) for t in left]
    rk = [key(t) for t in right]
    n, m = len(lk), len(rk)
    inf = float("inf")
    cost = [[inf] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if cost[i][j] == inf:
                continue
            for di, dj in MOVES:
                ni, nj = i + di, j + dj
                if ni > n or nj > m:
                    continue
                a, b = "".join(lk[i:ni]), "".join(rk[j:nj])
                d = _levenshtein(a, b)
                if d > max(1, int(max_ratio * max(len(a), len(b)))):
                    continue
                c = cost[i][j] + d + (0 if (di, dj) == (1, 1) else 0.5)
                if c < cost[ni][nj]:
                    cost[ni][nj] = c
                    back[ni][nj] = (di, dj)
    if cost[n][m] == inf:
        raise AlignmentError(f"no fuzzy alignment: {left!r} vs {right!r}")
    groups: list[Group] = []
    i, j = n, m
    while i or j:
        step = back[i][j]
        assert step is not None
        di, dj = step
        groups.append(Group(tuple(range(i - di, i)), tuple(range(j - dj, j))))
        i, j = i - di, j - dj
    groups.reverse()
    return groups
