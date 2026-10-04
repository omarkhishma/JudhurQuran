"""The digits preference's fonts (SHL-Q05): tiny faces that draw one set of digits with the other set's shapes, so a
reader who prefers Western digits sees ٢٥٥ as 255 (and one who prefers Arabic-Indic digits sees 255 as ٢٥٥) on every
page, server-drawn or not, without the text changing — copying it, a screen reader, a search read the digits as written.

Made from the IBM Plex Sans Arabic and IBM Plex Mono files `next build` fetched (SIL OFL 1.1; "Plex" is a reserved font
name, so the faces are named Jadhr): the build must have run first. Run from apps/web:

    uv run --with fonttools --with brotli python scripts/digit-fonts.py

Writes public/fonts/jadhr-digits-{latin,arabic,latin-mono}-{400,500,600}.woff2 (mono: 400, 500).
"""

from __future__ import annotations

import glob
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

MEDIA = Path(".next/static/media")
OUT = Path("public/fonts")
WESTERN = list(range(0x30, 0x3A))
ARABIC_INDIC = list(range(0x660, 0x66A))
PERSIAN = list(range(0x6F0, 0x6FA))


def source(family: str, weight: int, digits: list[int]) -> Path:
    """The fetched file of that family and weight that holds those digits."""
    for f in sorted(glob.glob(str(MEDIA / "*.woff2"))):
        t = TTFont(f)
        cmap = t.getBestCmap()
        if t["name"].getDebugName(1).startswith(family) and t["OS/2"].usWeightClass == weight:
            if all(c in cmap for c in digits):
                return Path(f)
    raise SystemExit(f"no {family} {weight} with those digits in {MEDIA}: run next build first")


def build(src: Path, out: Path, name: str, weight: int, drawn: list[int], mapped: list[list[int]]) -> None:
    """Keep the glyphs of ``drawn`` and map every set in ``mapped`` onto them, one for one; nothing else."""
    f = TTFont(src)
    glyphs = [f.getBestCmap()[c] for c in drawn]
    opts = subset.Options()
    opts.layout_features = []
    opts.name_IDs = [0, 13, 14]
    opts.notdef_outline = True
    opts.flavor = "woff2"
    s = subset.Subsetter(opts)
    s.populate(glyphs=glyphs)
    s.subset(f)
    for table in f["cmap"].tables:
        if table.isUnicode():
            table.cmap = {cp: g for group in mapped for cp, g in zip(group, glyphs, strict=True)}
    names = f["name"]
    for nid, value in ((1, name), (2, "Regular"), (4, f"{name} {weight}"), (6, f"{name.replace(' ', '')}-{weight}")):
        names.setName(value, nid, 3, 1, 0x409)
    f["OS/2"].usWeightClass = weight
    f.flavor = "woff2"
    f.save(out)
    print(out, len(f.getBestCmap()), "code points")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for w in (400, 500, 600):
        # Arabic-Indic and Persian digits drawn as Western ones, and Western ones drawn as Arabic-Indic
        build(source("IBM Plex Sans Arabic", w, WESTERN), OUT / f"jadhr-digits-latin-{w}.woff2", "Jadhr Latin Digits", w, WESTERN, [ARABIC_INDIC, PERSIAN])
        build(source("IBM Plex Sans Arabic", w, ARABIC_INDIC), OUT / f"jadhr-digits-arabic-{w}.woff2", "Jadhr Arabic Digits", w, ARABIC_INDIC, [WESTERN])
    for w in (400, 500):
        # in a measured run (references, counts) the Western shapes keep the mono width
        build(source("IBM Plex Mono", w, WESTERN), OUT / f"jadhr-digits-latin-mono-{w}.woff2", "Jadhr Latin Digits Mono", w, WESTERN, [ARABIC_INDIC, PERSIAN])


if __name__ == "__main__":
    main()
