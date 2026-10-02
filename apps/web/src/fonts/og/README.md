# Fonts for generated share images (Open Graph)

IBM Plex Sans Arabic, Medium (500) and Bold (700), TrueType from Google Fonts — © IBM Corp., SIL Open Font License 1.1 (`OFL.txt`). Used server-side only, to draw share images; the site itself loads the same family through `next/font`.

| File | sha256 |
|---|---|
| IBMPlexSansArabic-Medium.ttf | 1fe214ca7ff822ff8b73e5bb9584414bfc6c845e7ddab41f24ac4fce8e55a860 |
| IBMPlexSansArabic-Bold.ttf | 05616a64c5dca137a327b30b1fe7f4fcd1e16892a332e1665b49d52038858044 |

The image renderer (Satori) shapes Arabic letters but does not reorder mixed right-to-left text, and misplaces Quranic marks; share images therefore never contain Quranic text, and each Arabic word is laid out as its own box in right-to-left order (`src/lib/og.tsx`).
